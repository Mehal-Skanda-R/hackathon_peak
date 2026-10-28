// Single guard: patrol -> suspicious (investigate) -> chase -> return.
// Pure logic over Soham's geometry helpers; GuardSystem owns rendering/events.
// Kinds (story expansion): 'watchman' (default), 'hound' (hears pulses from
// further away), 'lantern' (carries a light; seeing the thief inside it starts
// a chase) and 'sleeper' (asleep at its post until enough pulses reach it).
import { canOccupy as defaultCanOccupy, hasLineOfSight as defaultHasLineOfSight } from './config.js';

export const GUARD_STATES = Object.freeze(['patrol', 'suspicious', 'chase', 'return', 'asleep']);
export const GUARD_KINDS = Object.freeze(['watchman', 'hound', 'lantern', 'sleeper']);

// Initial tuning from context.md section 4. Not playtested balance.
export const GUARD_TUNING = Object.freeze({
  bodySize: 20,
  patrolSpeed: 70,          // px/second
  investigateSpeed: 90,
  chaseSpeed: 130,          // slower than the 160 px/s player so escape is possible
  suspicionPerPulse: 0.25,
  suspicionDecayPerSecond: 0.08,
  hidingMultiplier: 0.25,
  chaseThreshold: 0.75,
  catchDistance: 22,        // center distance, with line of sight, during chase
  lostSightGiveUpMs: 3000,  // chase without sight this long -> return
  hiddenGiveUpMs: 3000,     // player hidden in cover this long -> guard leaves
  calmDownMs: 5000,         // then suspicion drains linearly to 0 over this long
  investigateWaitMs: 1500,  // pause at the pulse origin before returning
  hearingMultiplier: 1,     // pulse radius multiplier for hearing
});

// Per-kind overrides of GUARD_TUNING.
export const KIND_TUNING = Object.freeze({
  watchman: Object.freeze({}),
  hound: Object.freeze({ hearingMultiplier: 1.8, chaseSpeed: 140 }),
  lantern: Object.freeze({ patrolSpeed: 60, lightRadius: 64 }),
  sleeper: Object.freeze({ wakePulses: 2 }),
});

const tileOf = (point, tileSize) => ({
  column: Math.floor(point.x / tileSize), row: Math.floor(point.y / tileSize),
});
const tileCenter = (column, row, tileSize) => ({
  x: (column + 0.5) * tileSize, y: (row + 0.5) * tileSize,
});

// 4-direction BFS over tiles a guard body fits in. Returns tile-center points
// from the start tile's center to `to`'s tile center; [] if unreachable.
// Starting at the own tile center keeps off-center guards from clipping corners.
export function findPath(from, to, map, canOccupy = defaultCanOccupy, bodySize = GUARD_TUNING.bodySize) {
  const { tileSize, columns, rows } = map;
  const free = (c, r) => c >= 0 && r >= 0 && c < columns && r < rows
    && canOccupy((c + 0.5) * tileSize, (r + 0.5) * tileSize, Math.max(bodySize, tileSize - 2));
  const start = tileOf(from, tileSize);
  const goal = tileOf(to, tileSize);
  if (!free(goal.column, goal.row)) return [];
  const key = (c, r) => r * columns + c;
  const previous = new Map([[key(start.column, start.row), null]]);
  const queue = [start];
  while (queue.length) {
    const { column, row } = queue.shift();
    if (column === goal.column && row === goal.row) {
      const path = [];
      for (let k = key(column, row); k !== null; k = previous.get(k)) {
        path.unshift(tileCenter(k % columns, Math.floor(k / columns), tileSize));
      }
      return path;
    }
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c = column + dc;
      const r = row + dr;
      if (!previous.has(key(c, r)) && free(c, r)) {
        previous.set(key(c, r), key(column, row));
        queue.push({ column: c, row: r });
      }
    }
  }
  return [];
}

export default class Guard {
  constructor({ id, route, map, tuning = {}, kind = 'watchman', canOccupy = defaultCanOccupy,
    hasLineOfSight = defaultHasLineOfSight }) {
    if (!route?.length) throw new Error(`Guard ${id} needs at least one waypoint`);
    this.id = id;
    this.kind = kind;
    this.route = route;
    this.map = map;
    this.tuning = { ...GUARD_TUNING, ...tuning, ...(KIND_TUNING[kind] ?? {}) };
    this.canOccupy = canOccupy;
    this.hasLineOfSight = hasLineOfSight;
    this.reset();
  }

  reset() {
    this.x = this.route[0].x;
    this.y = this.route[0].y;
    this.state = 'patrol';
    this.suspicion = 0;
    this.waypointIndex = 0;
    this.path = [];
    this.target = null;
    this.lastSeen = null;
    this.lostSightMs = 0;
    this.waitMs = 0;
    this.caught = false;
    this.hiddenMs = 0;
    this.calmRate = 0; // suspicion/second while calming down after losing a hidden player
    this.wakeCount = 0;
    this.advanceWaypoint();
    if (this.kind === 'sleeper') { this.state = 'asleep'; this.path = []; }
  }

  getState() {
    return Object.freeze({ id: this.id, kind: this.kind, x: this.x, y: this.y, state: this.state,
      suspicion: this.suspicion, lightRadius: this.tuning.lightRadius ?? 0 });
  }

  // A sleeper wakes after `wakePulses` pulses reach it and investigates the last.
  wake(origin) {
    this.state = 'suspicious';
    this.suspicion = this.tuning.suspicionPerPulse;
    this.waitMs = 0;
    this.setDestination(origin);
  }

  // Pulse eligibility uses the emission snapshot (origin + hidingAtEmission).
  // Returns true when the pulse raised this guard's suspicion.
  handlePulse(pulse) {
    if (Math.hypot(this.x - pulse.x, this.y - pulse.y) > pulse.radius * this.tuning.hearingMultiplier) return false;
    if (this.state === 'asleep') {
      if (++this.wakeCount >= this.tuning.wakePulses) this.wake({ x: pulse.x, y: pulse.y });
      return true;
    }
    // A guard that already gave up on a hidden player ignores pulses from cover;
    // a pulse from out in the open ends the calm-down and counts normally.
    if (this.calmRate && pulse.hidingAtEmission) return false;
    this.calmRate = 0;
    const gain = this.tuning.suspicionPerPulse
      * (pulse.hidingAtEmission ? this.tuning.hidingMultiplier : 1);
    this.suspicion = Math.min(1, this.suspicion + gain);
    const origin = { x: pulse.x, y: pulse.y };
    if (this.suspicion >= this.tuning.chaseThreshold) {
      if (this.state !== 'chase') this.enterChase(origin);
    } else if (this.state !== 'chase') {
      this.state = 'suspicious';
      this.waitMs = 0;
      this.setDestination(origin);
    }
    return true;
  }

  // Returns true once, on the update where this guard catches the player.
  update(deltaMs, player) {
    const seconds = Math.max(0, deltaMs) / 1000;
    this.hiddenMs = player?.hiding ? this.hiddenMs + Math.max(0, deltaMs) : 0;
    // Hidden in cover long enough: an alerted guard leaves and calms down to 0
    // over calmDownMs (team decision, context.md section 4).
    if (this.hiddenMs >= this.tuning.hiddenGiveUpMs && this.suspicion > 0 && !this.calmRate) {
      this.calmRate = this.suspicion / (this.tuning.calmDownMs / 1000);
      if (this.state === 'chase' || this.state === 'suspicious') this.enterReturn();
    }
    if (this.calmRate) {
      this.suspicion = Math.max(0, this.suspicion - this.calmRate * seconds);
      if (this.suspicion === 0) this.calmRate = 0;
    } else if (this.state !== 'chase') {
      this.suspicion = Math.max(0, this.suspicion - this.tuning.suspicionDecayPerSecond * seconds);
    }
    // A lantern-bearer sees the thief inside its light: an immediate chase.
    if (this.tuning.lightRadius && this.state !== 'chase' && this.state !== 'asleep' && player && !player.hiding
      && Math.hypot(player.x - this.x, player.y - this.y) <= this.tuning.lightRadius
      && this.hasLineOfSight(this, player)) {
      this.suspicion = Math.max(this.suspicion, this.tuning.chaseThreshold);
      this.enterChase({ x: player.x, y: player.y });
    }
    switch (this.state) {
      case 'asleep': return false;
      case 'patrol': return this.updatePatrol(seconds);
      case 'suspicious': return this.updateSuspicious(seconds, deltaMs);
      case 'chase': return this.updateChase(seconds, deltaMs, player);
      default: return this.updateReturn(seconds);
    }
  }

  updatePatrol(seconds) {
    if (this.followPath(this.tuning.patrolSpeed * seconds)) this.advanceWaypoint();
    return false;
  }

  updateSuspicious(seconds, deltaMs) {
    if (this.followPath(this.tuning.investigateSpeed * seconds)) {
      this.waitMs += deltaMs;
      if (this.waitMs >= this.tuning.investigateWaitMs || this.suspicion === 0) this.enterReturn();
    } else if (this.suspicion === 0) {
      this.enterReturn();
    }
    return false;
  }

  updateChase(seconds, deltaMs, player) {
    // A player fully inside cover is invisible to guards: no sight, no catch
    // (team decision, context.md section 4). Pulses still raise suspicion.
    const sees = player && !player.hiding && this.hasLineOfSight(this, player);
    if (sees) {
      this.lastSeen = { x: player.x, y: player.y };
      this.lostSightMs = 0;
      this.path = [];
      this.moveDirect(this.lastSeen, this.tuning.chaseSpeed * seconds);
      // Physical capture only: close contact, unobstructed sight, during chase.
      if (!this.caught && Math.hypot(player.x - this.x, player.y - this.y) <= this.tuning.catchDistance) {
        this.caught = true;
        return true;
      }
      return false;
    }
    this.lostSightMs += deltaMs;
    // Without sight, head for where the player was last seen (no wall-hacks).
    if (!this.path.length && this.lastSeen) this.setDestination(this.lastSeen);
    const arrived = this.followPath(this.tuning.chaseSpeed * seconds);
    // A hidden player is searched for until the hidden rule (update) sends the guard away.
    if (!player?.hiding
      && (this.lostSightMs >= this.tuning.lostSightGiveUpMs || (arrived && this.lastSeenReached()))) {
      this.suspicion = Math.min(this.suspicion, this.tuning.chaseThreshold - 0.25);
      this.enterReturn();
    }
    return false;
  }

  updateReturn(seconds) {
    if (this.followPath(this.tuning.patrolSpeed * seconds)) {
      this.state = 'patrol';
      this.advanceWaypoint();
    }
    return false;
  }

  enterChase(origin) {
    this.state = 'chase';
    this.calmRate = 0;
    this.lastSeen = origin;
    this.lostSightMs = 0;
    this.setDestination(origin);
  }

  enterReturn() {
    this.state = 'return';
    this.lastSeen = null;
    this.setDestination(this.route[this.waypointIndex]);
  }

  lastSeenReached() {
    return !this.lastSeen
      || Math.hypot(this.lastSeen.x - this.x, this.lastSeen.y - this.y) <= this.map.tileSize;
  }

  advanceWaypoint() {
    this.waypointIndex = (this.waypointIndex + 1) % this.route.length;
    this.setDestination(this.route[this.waypointIndex]);
  }

  setDestination(point) {
    this.target = point;
    this.path = findPath(this, point, this.map, this.canOccupy, this.tuning.bodySize);
  }

  // Moves along the tile path; returns true when the path is finished.
  followPath(distance) {
    while (distance > 0 && this.path.length) {
      const next = this.path[0];
      const remaining = Math.hypot(next.x - this.x, next.y - this.y);
      if (remaining <= distance) {
        this.x = next.x;
        this.y = next.y;
        distance -= remaining;
        this.path.shift();
      } else {
        this.moveDirect(next, distance);
        distance = 0;
      }
    }
    return this.path.length === 0;
  }

  // Straight-line step that slides along walls axis by axis; never enters a wall.
  moveDirect(point, distance) {
    const dx = point.x - this.x;
    const dy = point.y - this.y;
    const length = Math.hypot(dx, dy);
    if (length === 0 || distance <= 0) return;
    const step = Math.min(distance, length);
    const nx = this.x + dx / length * step;
    const ny = this.y + dy / length * step;
    const size = this.tuning.bodySize;
    if (this.canOccupy(nx, ny, size, size)) {
      this.x = nx; this.y = ny;
    } else {
      if (this.canOccupy(nx, this.y, size, size)) this.x = nx;
      if (this.canOccupy(this.x, ny, size, size)) this.y = ny;
    }
  }
}
