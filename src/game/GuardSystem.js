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
  // East wing in front of the door room's west opening at (17,3).
  'guard-east': [[17, 4], [23, 4], [23, 15], [17, 15]],
});

// Routes per level (config.LEVELS ids). GUARD_ROUTES is level 1, 'gallery'.
export const GUARD_ROUTES_BY_LEVEL = Object.freeze({
  gallery: GUARD_ROUTES,
  'west-wing': Object.freeze({
    'guard-hall': [[6, 7], [14, 7], [14, 10], [6, 10]],
    'guard-east': [[16, 7], [23, 7], [23, 15], [12, 14]],
  }),
  'gallery-hall': Object.freeze({
    'guard-ring': [[7, 5], [17, 5], [17, 11], [7, 11]],        // around the skeleton
    'guard-east': [[19, 12], [23, 12], [23, 15], [15, 15]],
  }),
  archive: Object.freeze({
    'guard-stacks': [[4, 7], [10, 7], [10, 9], [4, 9]],
    'guard-reading': [[12, 13], [16, 13], [16, 15], [9, 15]],
    'guard-east': [[18, 7], [23, 7], [23, 11], [20, 11]],
  }),
  'vault-ring': Object.freeze({
    'guard-outer': [[4, 2], [20, 2], [18, 14], [6, 14]],
    'guard-middle': [[6, 4], [18, 4], [18, 12], [6, 12]],
    'guard-inner': [[8, 6], [16, 6], [16, 10], [8, 10]],
  }),
  'royal-exhibit': Object.freeze({
    'guard-pool': [[5, 5], [19, 5], [19, 9], [5, 9]],          // around the pool
    'guard-south': [[10, 12], [14, 12], [14, 14], [10, 14]],
    'guard-north': [[9, 2], [17, 2], [17, 3], [9, 3]],
  }),
  'final-heist': Object.freeze({
    'guard-north': [[8, 2], [16, 2], [16, 4], [8, 4]],
    'guard-west': [[2, 6], [6, 6], [6, 9], [2, 9]],
    'guard-east': [[18, 6], [22, 6], [22, 9], [18, 9]],
    'guard-door': [[6, 14], [18, 14], [18, 15], [6, 15]],     // the crystal and door
  }),
});

// Suspicion bar colour and the icon above the guard's head, per state.
const STATE_COLORS = Object.freeze({
  patrol: 0xffd84a, suspicious: 0xffa133, chase: 0xff4d5e, return: 0xffd84a,
});
// '?' colour by suspicion: yellow (low) -> orange -> red (chase level), so a guard
// that lost a hidden player visibly cools down red -> yellow -> no icon.
const ICON_STEPS = 12;
function suspicionColor(suspicion) {
  const t = Math.min(1, suspicion / GUARD_TUNING.chaseThreshold);
  const lerp = (a, b, u) => Math.round(a + (b - a) * u);
  const [r, g, b] = t < 0.5
    ? [lerp(0xff, 0xff, t * 2), lerp(0xd8, 0xa1, t * 2), lerp(0x4a, 0x33, t * 2)]
    : [lerp(0xff, 0xff, t * 2 - 1), lerp(0xa1, 0x4d, t * 2 - 1), lerp(0x33, 0x5e, t * 2 - 1)];
  return (r << 16) | (g << 8) | b;
}
function guardIcon(guard) {
  if (guard.state === 'chase') return { text: '!', color: STATE_COLORS.chase };
  const alerted = guard.state === 'suspicious' || guard.state === 'return' || guard.calmRate;
  if (!alerted || guard.suspicion < 0.01) return { text: '', color: STATE_COLORS.patrol };
  // Quantised so the text texture is only redrawn a few times while cooling down.
  const level = Math.ceil(Math.min(1, guard.suspicion / GUARD_TUNING.chaseThreshold) * ICON_STEPS) / ICON_STEPS;
  return { text: '?', color: suspicionColor(level * GUARD_TUNING.chaseThreshold) };
}
const SPRITE_SIZE = 40;      // visual only; the logic body stays tuning.bodySize
const STRIDE_PX = 8;         // walking-frame swap distance

// Yellow museum guard drawn in the thief's style (MuseumArt.thiefTexture):
// same 40px frame, silhouette, facing and two-frame stride, plus a peaked cap,
// badge and torch so it reads as security. Cached per facing/stride.
export function guardSpriteTexture(scene, facing, stride) {
  const key = `hh-guard-v1-${facing}-${stride}`;
  if (scene.textures.exists(key)) return key;
  const canvas = scene.textures.createCanvas(key, SPRITE_SIZE, SPRITE_SIZE);
  const ctx = canvas.context;
  const glow = ctx.createRadialGradient(20, 20, 0, 20, 20, 20);
  glow.addColorStop(0, 'rgba(255,214,74,.14)'); glow.addColorStop(1, 'rgba(255,214,74,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, 40, 40);
  ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.beginPath(); ctx.ellipse(21, 31, 11, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); if (facing === 'left') { ctx.translate(40, 0); ctx.scale(-1, 1); }
  // legs and boots
  ctx.fillStyle = '#231a05';
  ctx.fillRect(14 + stride * 2, 25, 5, 8 - stride * 2);
  ctx.fillRect(22 - stride * 2, 25, 5, 6 + stride * 2);
  ctx.fillStyle = '#8a6a1a'; ctx.fillRect(13 + stride * 2, 31 - stride * 2, 7, 3);
  ctx.fillRect(22 - stride * 2, 29 + stride * 2, 7, 3);
  // coat with belt
  ctx.fillStyle = '#a77d12';
  ctx.beginPath(); ctx.moveTo(15, 14); ctx.lineTo(25, 14); ctx.lineTo(29, 28);
  ctx.lineTo(11, 28); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#3b2c06'; ctx.fillRect(12, 24, 16, 2);
  if (facing !== 'up') { ctx.fillStyle = '#fff3b0'; ctx.fillRect(facing === 'down' ? 22 : 24, 17, 3, 3); }
  // head
  ctx.fillStyle = '#d9a826'; ctx.beginPath(); ctx.ellipse(20, 12, 9, 10, -.15, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff09a'; ctx.stroke();
  if (facing !== 'up') {
    ctx.fillStyle = '#1c1505'; ctx.beginPath(); ctx.ellipse(facing === 'down' ? 20 : 24, 14, 6, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff3b0'; ctx.fillRect(facing === 'down' ? 17 : 24, 13, 2, 2);
    ctx.fillRect(facing === 'down' ? 22 : 27, 13, 2, 2);
  }
  // peaked cap
  ctx.fillStyle = '#3b2c06'; ctx.beginPath(); ctx.ellipse(20, 6, 9, 4, -.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(facing === 'down' ? 13 : 18, 7, facing === 'up' ? 0 : 14, 3);
  ctx.fillStyle = '#ffd84a'; ctx.fillRect(18, 4, 4, 3);
  // arms and torch
  ctx.strokeStyle = '#231a05'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(12, 19); ctx.lineTo(10, 25 + stride * 2);
  ctx.moveTo(27, 18); ctx.lineTo(30, 24 - stride * 2); ctx.stroke();
  ctx.strokeStyle = '#d9a826'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#e8e8e8'; ctx.fillRect(29, 23 - stride * 2, 4, 3);
  ctx.fillStyle = 'rgba(255,244,190,.8)'; ctx.fillRect(33, 23 - stride * 2, 2, 3);
  ctx.restore();
  canvas.refresh();
  return key;
}

export default class GuardSystem {
  constructor(scene, mapGeometry, {
    routes = GUARD_ROUTES_BY_LEVEL[mapGeometry.levelId] ?? GUARD_ROUTES, tuning = {},
  } = {}) {
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
      for (const part of this.viewParts(view)) if (part?.scene) part.destroy();
    }
    this.views.clear();
    this.processedPulseIds.clear();
  }

  // Defensive second gate; the integration caller is the primary one.
  isPlaying() {
    return this.scene.status === undefined || this.scene.status === 'playing';
  }

  createViews() {
    if (!this.scene.add?.image || !this.scene.textures) return; // headless tests
    for (const guard of this.guards) {
      this.views.set(guard.id, {
        body: this.scene.add.image(guard.x, guard.y, guardSpriteTexture(this.scene, 'down', 0)).setDepth(9),
        meter: this.scene.add.rectangle(guard.x - 10, guard.y - 24, 0, 3, STATE_COLORS.patrol)
          .setOrigin(0, 0.5).setDepth(9),
        icon: this.scene.add.text(guard.x, guard.y - 34, '', {
          fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold', color: '#ffffff',
          stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(9),
        lastX: guard.x, lastY: guard.y, facing: 'down', walked: 0,
      });
    }
    this.syncViews();
  }

  // Optional (x, y) => 0..1 light level; guards are drawn only as visible as
  // pulse light makes them, so dim ambient vision never shows them.
  setVisibilityProbe(probe) {
    this.visibilityProbe = probe;
    this.syncViews();
  }

  viewParts(view) {
    return [view.body, view.meter, view.icon];
  }

  syncViews() {
    for (const guard of this.guards) {
      const view = this.views.get(guard.id);
      if (!view || this.viewParts(view).some(part => !part?.scene)) continue; // destroyed by Phaser
      const dx = guard.x - view.lastX;
      const dy = guard.y - view.lastY;
      const moved = Math.hypot(dx, dy);
      if (moved > 0.01) {
        view.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        view.walked += moved;
      }
      const stride = moved > 0.01 ? Math.floor(view.walked / STRIDE_PX) % 2 : 0;
      view.lastX = guard.x; view.lastY = guard.y;
      view.body.setPosition(guard.x, guard.y);
      const texture = guardSpriteTexture(this.scene, view.facing, stride);
      if (texture !== view.texture) { view.body.setTexture(texture); view.texture = texture; }
      view.meter.setPosition(guard.x - 10, guard.y - 24).setSize(20 * guard.suspicion, 3);
      view.icon.setPosition(guard.x, guard.y - 34);
      const alpha = this.visibilityProbe ? this.visibilityProbe(guard.x, guard.y) : 1;
      if (alpha !== view.alpha) {
        view.alpha = alpha;
        for (const part of this.viewParts(view)) part.setAlpha(alpha);
      }
      // Text restyles redraw and re-upload the text texture, so only on change.
      const icon = guardIcon(guard);
      const key = `${icon.text}:${icon.color}`;
      if (key !== view.iconKey) {
        view.iconKey = key;
        view.meter.setFillStyle(icon.text ? icon.color : STATE_COLORS[guard.state]);
        view.icon.setText(icon.text).setColor(`#${icon.color.toString(16).padStart(6, '0')}`);
      }
    }
  }
}
