// Owns the two guards, pulse handling, caught reporting and guard visuals.
// Never creates the map, controls the player or opens Bluetooth.
import Guard, { GUARD_TUNING } from './Guard.js';

export const GUARD_EVENTS = Object.freeze({ CAUGHT: 'guards:caught' });

const tile = (column, row, tileSize) => Object.freeze({
  x: (column + 0.5) * tileSize, y: (row + 0.5) * tileSize,
});

// Patrol routes in tile coordinates against Soham's revised WALLS (25 x 17 grid).
// Legs between waypoints are walked with tile BFS, so they bend around walls.
// tests/guards/guards.test.js verifies every leg is reachable.
export const GUARD_ROUTES = Object.freeze({
  // Central gallery loop around the (11,11) pillar; covers the west doorway.
  'guard-gallery': [[9, 2], [15, 2], [15, 14], [9, 14]],
  // East wing in front of the artefact room's west opening at (17,3).
  'guard-east': [[17, 4], [23, 4], [23, 15], [17, 15]],
});

const STATE_COLORS = Object.freeze({
  patrol: 0xd8dee9, suspicious: 0xffb347, chase: 0xff4d5e, return: 0x9aa7b8,
});

export default class GuardSystem {
  constructor(scene, mapGeometry, { routes = GUARD_ROUTES, tuning = {} } = {}) {
    this.scene = scene;
    this.map = mapGeometry;
    this.tuning = { ...GUARD_TUNING, ...tuning };
    const canOccupy = (x, y, w, h) => scene.canOccupy(x, y, w, h);
    const hasLineOfSight = (from, to) => scene.hasLineOfSight(from, to);
    this.guards = Object.entries(routes).map(([id, waypoints]) => new Guard({
      id, map: mapGeometry, tuning: this.tuning, canOccupy, hasLineOfSight,
      route: waypoints.map(([column, row]) => tile(column, row, mapGeometry.tileSize)),
    }));
    this.processedPulseIds = new Set();
    this.views = new Map();
    this.destroyed = false;
    // Phaser destroys scene-owned display objects on restart; drop our handles
    // first so no later sync touches a destroyed rectangle (audit: setSize on null).
    this.onShutdown = () => this.views.clear();
    scene.events.once?.('shutdown', this.onShutdown);
    this.createViews();
  }

  // Mehal calls this only while status === 'playing'.
  update(deltaMs, playerState) {
    if (this.destroyed || !this.isPlaying()) return;
    for (const guard of this.guards) {
      if (guard.update(deltaMs, playerState)) {
        this.scene.events.emit(GUARD_EVENTS.CAUGHT, { guardId: guard.id });
      }
    }
    this.syncViews();
  }

  // Each pulse ID is processed once per run.
  handlePulse(pulse) {
    if (this.destroyed || !this.isPlaying() || this.processedPulseIds.has(pulse.id)) return;
    this.processedPulseIds.add(pulse.id);
    for (const guard of this.guards) guard.handlePulse(pulse);
    this.syncViews();
  }

  getStates() {
    return this.guards.map(guard => guard.getState());
  }

  reset() {
    this.processedPulseIds.clear();
    for (const guard of this.guards) guard.reset();
    this.syncViews();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off?.('shutdown', this.onShutdown);
    for (const view of this.views.values()) {
      if (view.body?.scene) view.body.destroy();
      if (view.meter?.scene) view.meter.destroy();
    }
    this.views.clear();
    this.processedPulseIds.clear();
  }

  // Defensive second gate; the integration caller is the primary one.
  isPlaying() {
    return this.scene.status === undefined || this.scene.status === 'playing';
  }

  createViews() {
    if (!this.scene.add?.rectangle) return; // headless tests
    for (const guard of this.guards) {
      const size = this.tuning.bodySize;
      this.views.set(guard.id, {
        body: this.scene.add.rectangle(guard.x, guard.y, size, size, STATE_COLORS.patrol)
          .setStrokeStyle(2, 0x1d2430).setDepth(9),
        meter: this.scene.add.rectangle(guard.x - size / 2, guard.y - size / 2 - 6, 0, 3, 0xff4d5e)
          .setOrigin(0, 0.5).setDepth(9),
      });
    }
    this.syncViews();
  }

  syncViews() {
    for (const guard of this.guards) {
      const view = this.views.get(guard.id);
      if (!view?.body.scene || !view.meter.scene) continue; // already destroyed by Phaser
      const size = this.tuning.bodySize;
      view.body.setPosition(guard.x, guard.y).setFillStyle(STATE_COLORS[guard.state]);
      view.meter.setPosition(guard.x - size / 2, guard.y - size / 2 - 6)
        .setSize(size * guard.suspicion, 3);
    }
  }
}
