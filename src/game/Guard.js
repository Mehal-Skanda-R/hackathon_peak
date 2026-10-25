// Single guard: patrol -> suspicious (investigate) -> chase -> return.
// Pure logic over Soham's geometry helpers; GuardSystem owns rendering/events.
import { canOccupy as defaultCanOccupy, hasLineOfSight as defaultHasLineOfSight } from './config.js';

export const GUARD_STATES = Object.freeze(['patrol', 'suspicious', 'chase', 'return']);

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
  investigateWaitMs: 1500,  // pause at the pulse origin before returning
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
  constructor({ id, route, map, tuning = {}, canOccupy = defaultCanOccupy,
    hasLineOfSight = defaultHasLineOfSight }) {
    if (!route?.length) throw new Error(`Guard ${id} needs at least one waypoint`);
    this.id = id;
    this.route = route;
    this.map = map;
    this.tuning = { ...GUARD_TUNING, ...tuning };
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
    this.advanceWaypoint();
  }

  getState() {
    return Object.freeze({ id: this.id, x: this.x, y: this.y, state: this.state,
      suspicion: this.suspicion });
  }

  // Pulse eligibility uses the emission snapshot (origin + hidingAtEmission).
  // Returns true when the pulse raised this guard's suspicion.
  handlePulse(pulse) {
    if (Math.hypot(this.x - pulse.x, this.y - pulse.y) > pulse.radius) return false;
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
    if (this.state !== 'chase') {
      this.suspicion = Math.max(0, this.suspicion - this.tuning.suspicionDecayPerSecond * seconds);
    }
    switch (this.state) {
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
    if (this.lostSightMs >= this.tuning.lostSightGiveUpMs || (arrived && this.lastSeenReached())) {
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
