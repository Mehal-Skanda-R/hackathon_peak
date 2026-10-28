// The Warden: the castle's keeper, who hunts by heartbeat. Pure logic like
// Guard (which provides pathing and movement); GuardSystem renders him and
// turns his queued events into scene events.
//
// He hears every pulse anywhere on the floor, through walls, unless it came
// from cover; a pulse from cover is heard only nearby and only while the
// heart is well above its baseline. He cannot see in the dark, so he walks to
// where he last heard a beat and lunges only at very close range. Hidden near
// him, the thief faces The Inspection: he stands over the cover and listens,
// and each beat more than `quietDelta` above baseline is a strike.
import Guard from './Guard.js';

export const WARDEN_STATES = Object.freeze(['dormant', 'hunt', 'search', 'inspect', 'return', 'rest', 'freed']);

export const WARDEN_TUNING = Object.freeze({
  bodySize: 20,
  huntSpeed: 105,        // px/s: slower than the 160 px/s thief, so moving works
  returnSpeed: 80,
  catchDistance: 22,
  lungeRange: 70,        // closer than this, in sight and in the open: he lunges
  hiddenHearing: 140,    // a loud pulse from cover is heard within this range
  quietDelta: 8,         // BPM above baseline that counts as loud
  listenMs: 1500,        // pause where a beat was heard before searching cover
  inspectRange: 150,     // hidden this close to him starts The Inspection
  inspectMs: 8000,       // survive this long...
  maxStrikes: 3,         // ...with fewer loud beats than this
  restMs: 20000,         // after a passed Inspection when `after` is 'rest'
});

export default class Warden extends Guard {
  // post: [x, y] start/office point. dormant: waits until wake(). after:
  // 'dormant' (goes back to his office for good) or 'rest' (hunts again later).
  constructor({ post, dormant = true, after = 'dormant', coverZones = [], tuning = {}, ...rest }) {
    super({ ...rest, kind: 'warden', route: [post], tuning: { ...WARDEN_TUNING, ...tuning } });
    this.post = post;
    this.startsDormant = dormant;
    this.after = after;
    this.coverPoints = coverZones.map(zone => ({ x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 }));
    this.resetWarden();
  }

  reset() {
    super.reset();
    if (this.post) this.resetWarden();
  }

  resetWarden() {
    this.state = this.startsDormant ? 'dormant' : 'hunt';
    this.path = [];
    this.heardAt = null;
    this.listenedMs = 0;
    this.searchQueue = [];
    this.inspection = null;
    this.inspectionDone = false;
    this.restLeftMs = 0;
    this.events = [];
  }

  getState() {
    return Object.freeze({ ...super.getState(), inspection: this.inspection
      ? Object.freeze({ leftMs: Math.max(0, this.tuning.inspectMs - this.inspection.elapsedMs),
        strikes: this.inspection.strikes, maxStrikes: this.tuning.maxStrikes })
      : null });
  }

  // Events since the last call: 'woke', 'inspection-start', 'inspection-passed', 'inspection-failed'.
  takeEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }

  wake(heardAt = null) {
    if (this.state !== 'dormant') return;
    this.state = 'hunt';
    this.events.push('woke');
    if (heardAt) this.goTo(heardAt);
  }

  // The Heart is home: he stops hunting for good.
  release() {
    this.state = 'freed';
    this.path = [];
    this.inspection = null;
  }

  goTo(point) {
    this.heardAt = { x: point.x, y: point.y };
    this.listenedMs = 0;
    this.searchQueue = [];
    this.setDestination(this.heardAt);
  }

  handlePulse(pulse) {
    if (['dormant', 'rest', 'freed', 'return'].includes(this.state)) return false;
    const loud = (pulse.delta ?? 0) > this.tuning.quietDelta;
    if (this.state === 'inspect') {
      if (loud) this.inspection.strikes++;
      return loud;
    }
    const near = Math.hypot(pulse.x - this.x, pulse.y - this.y) <= this.tuning.hiddenHearing;
    if (pulse.hidingAtEmission && !(loud && near)) return false;
    if (this.state === 'search') this.state = 'hunt';
    this.goTo(pulse);
    return true;
  }

  update(deltaMs, player) {
    const seconds = Math.max(0, deltaMs) / 1000;
    switch (this.state) {
      case 'dormant': case 'freed': return false;
      case 'rest':
        this.restLeftMs -= deltaMs;
        if (this.restLeftMs <= 0) { this.state = 'hunt'; this.inspectionDone = false; }
        return false;
      case 'return':
        if (this.followPath(this.tuning.returnSpeed * seconds)) {
          this.state = this.after === 'rest' ? 'rest' : 'dormant';
          this.restLeftMs = this.tuning.restMs;
        }
        return false;
      case 'inspect': return this.updateInspection(deltaMs, seconds, player);
      default: return this.updateHunt(deltaMs, seconds, player);
    }
  }

  updateHunt(deltaMs, seconds, player) {
    const distance = player ? Math.hypot(player.x - this.x, player.y - this.y) : Infinity;
    const sees = player && !player.hiding && this.hasLineOfSight(this, player);
    if (sees && distance <= this.tuning.catchDistance && !this.caught) {
      this.caught = true;
      return true;
    }
    if (sees && distance <= this.tuning.lungeRange) {
      this.path = [];
      this.heardAt = { x: player.x, y: player.y };
      this.moveDirect(this.heardAt, this.tuning.huntSpeed * seconds);
      return false;
    }
    if (player?.hiding && !this.inspectionDone && distance <= this.tuning.inspectRange) {
      this.state = 'inspect';
      this.inspection = { elapsedMs: 0, strikes: 0 };
      this.setDestination(player);
      this.path = this.path.slice(0, -1); // stand over the cover, not on the thief
      this.events.push('inspection-start');
      return false;
    }
    if (!this.followPath(this.tuning.huntSpeed * seconds)) return false;
    // Arrived where the beat was (or at the next cover he is checking): listen, then search.
    this.listenedMs += deltaMs;
    if (this.listenedMs < this.tuning.listenMs) return false;
    this.listenedMs = 0;
    this.state = 'search';
    if (!this.searchQueue.length) {
      this.searchQueue = [...this.coverPoints]
        .sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y));
    }
    const next = this.searchQueue.shift();
    if (next) this.setDestination(next);
    return false;
  }

  updateInspection(deltaMs, seconds, player) {
    if (!player?.hiding) {
      // Stepping out of cover under his nose: he hunts (and lunges) at once.
      this.inspection = null;
      this.state = 'hunt';
      if (player) this.goTo(player);
      return this.updateHunt(deltaMs, seconds, player);
    }
    this.followPath(this.tuning.returnSpeed * seconds);
    this.inspection.elapsedMs += deltaMs;
    if (this.inspection.strikes >= this.tuning.maxStrikes && !this.caught) {
      this.caught = true;
      this.events.push('inspection-failed');
      return true;
    }
    if (this.inspection.elapsedMs >= this.tuning.inspectMs) {
      this.inspection = null;
      this.inspectionDone = true;
      this.events.push('inspection-passed');
      this.state = 'return';
      this.setDestination(this.post);
    }
    return false;
  }
}
