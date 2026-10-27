import Phaser from 'phaser';
import { LEVEL } from './config.js';

const BRUSH_KEY = 'hh-reveal-gradient-v1';
const BRUSH_RADIUS = 128;

// Soft radial brush: fully clear in the middle, fading to nothing at the edge
// (Among Us-style vision, no hard outline). Cached per texture manager.
function revealBrush(scene) {
  if (!scene.textures.exists(BRUSH_KEY)) {
    const size = BRUSH_RADIUS * 2;
    const canvas = scene.textures.createCanvas(BRUSH_KEY, size, size);
    const ctx = canvas.context;
    const gradient = ctx.createRadialGradient(BRUSH_RADIUS, BRUSH_RADIUS, 0, BRUSH_RADIUS, BRUSH_RADIUS, BRUSH_RADIUS);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.55, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.8, 'rgba(255,255,255,0.55)');
    gradient.addColorStop(0.93, 'rgba(255,255,255,0.15)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    canvas.refresh();
    // The game uses pixelArt (nearest filtering); a scaled gradient needs smoothing.
    canvas.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
  return BRUSH_KEY;
}

// Brightness of the brush at a fraction (0 centre .. 1 edge) of its radius;
// mirrors the gradient stops above so revealAt() matches what is drawn.
function brushFalloff(f) {
  const stops = [[0, 1], [0.55, 1], [0.8, 0.55], [0.93, 0.15], [1, 0]];
  if (f >= 1) return 0;
  for (let i = 1; i < stops.length; i++) {
    const [f1, v1] = stops[i];
    const [f0, v0] = stops[i - 1];
    if (f <= f1) return v0 + (v1 - v0) * (f - f0) / (f1 - f0);
  }
  return 0;
}

// Warm halo for the wall lamps, drawn over the darkness so they still glow
// softly when the room is dark. Additive tint only: it never erases the
// darkness, so guards near a lamp stay hidden.
const LAMP_KEY = 'hh-lamp-glow-v1';
const LAMP_TEXTURE_RADIUS = 64;

function lampGlowTexture(scene) {
  if (!scene.textures.exists(LAMP_KEY)) {
    const size = LAMP_TEXTURE_RADIUS * 2;
    const canvas = scene.textures.createCanvas(LAMP_KEY, size, size);
    const ctx = canvas.context;
    const r = LAMP_TEXTURE_RADIUS;
    const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
    gradient.addColorStop(0, 'rgba(255,196,110,1)');
    gradient.addColorStop(0.25, 'rgba(240,150,60,.55)');
    gradient.addColorStop(0.6, 'rgba(200,110,40,.18)');
    gradient.addColorStop(1, 'rgba(200,110,40,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    canvas.refresh();
    canvas.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
  return LAMP_KEY;
}

// Constant dim vision around the thief: 120% of the 100 px base pulse radius,
// showing the map very faintly. Guards are not shown by it (see revealAt).
export const AMBIENT_RADIUS = 120;
const AMBIENT_STRENGTH = 0.28;

export default class VisibilitySystem {
  constructor(scene, mapGeometry) {
    this.scene = scene;
    this.mapGeometry = mapGeometry;

    // Darkness covering the whole map, redrawn each frame with soft holes
    // erased where pulses are revealing. Sits above the map, below pulse FX/UI.
    this.overlay = this.scene.add.renderTexture(0, 0, mapGeometry.width, mapGeometry.height)
      .setOrigin(0, 0)
      .setDepth(50);
    this.brush = this.scene.make.image({ x: 0, y: 0, key: revealBrush(scene), add: false });

    // One soft pool and one small bright core per lamp, each breathing slowly
    // on its own phase so the room does not pulse in unison.
    const glowKey = lampGlowTexture(scene);
    this.lampGlows = (LEVEL.decor?.lamps ?? []).flatMap(([x, y], i) => [
      { image: scene.add.image(x + 5, y + 10, glowKey).setScale(58 / LAMP_TEXTURE_RADIUS), base: 0.16, phase: i * 1.7 },
      { image: scene.add.image(x, y, glowKey).setScale(16 / LAMP_TEXTURE_RADIUS), base: 0.55, phase: i * 1.7 },
    ]);
    for (const glow of this.lampGlows) glow.image.setDepth(50.5).setBlendMode(Phaser.BlendModes.ADD);
    this.lampTime = 0;

    this.activePulses = [];
    this.preview = null;
    this.scene.events.on('heartbeat:pulse', this.handlePulse, this);
  }

  // Briefly show the whole map (e.g. at round start), then fade back to dark.
  // Visual only: guards and pulse exposure are unaffected.
  revealAll(holdMs = 1000, fadeMs = 500) {
    this.preview = { elapsed: 0, holdMs, fadeMs };
    this.overlay.setAlpha(0);
  }

  // True while the full map is held fully visible (before the fade starts).
  isHolding() {
    return Boolean(this.preview && this.preview.elapsed < this.preview.holdMs);
  }

  handlePulse(pulse) {
    this.activePulses.push({ ...pulse, progress: 0 });
  }

  update(deltaMs) {
    if (this.preview) {
      const p = this.preview;
      p.elapsed += deltaMs;
      const t = Phaser.Math.Clamp((p.elapsed - p.holdMs) / p.fadeMs, 0, 1);
      this.overlay.setAlpha(t);
      if (t >= 1) this.preview = null;
    }

    this.overlay.clear();
    this.overlay.fill(0x000000, 0.98); // almost pitch black

    // Lamps glow only as much as the room is dark (not over the full-map preview).
    this.lampTime += deltaMs;
    for (const glow of this.lampGlows) {
      const breath = 0.8 + 0.2 * Math.sin(this.lampTime / 900 + glow.phase);
      glow.image.setAlpha(glow.base * breath * this.overlay.alpha);
    }

    // Non-pulsing dim vision that follows the thief.
    const me = this.scene.getPlayerState?.();
    if (me) {
      this.brush.setPosition(me.x, me.y).setScale(AMBIENT_RADIUS / BRUSH_RADIUS).setAlpha(AMBIENT_STRENGTH);
      this.overlay.erase(this.brush);
    }

    for (let i = this.activePulses.length - 1; i >= 0; i--) {
      const p = this.activePulses[i];
      p.progress += deltaMs;

      if (p.progress >= p.durationMs) {
        this.activePulses.splice(i, 1);
        continue;
      }

      const t = p.progress / p.durationMs;
      // Same easing as PulseEffects so the glow band sits on the reveal edge.
      const currentRadius = p.radius * Phaser.Math.Easing.Quadratic.Out(t);
      // Fade the reveal out over the last 40% instead of snapping shut.
      const strength = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      // The light follows the thief; guard exposure still uses the emission snapshot.
      const at = this.scene.getPlayerState?.() ?? p;
      this.brush
        .setPosition(at.x, at.y)
        .setScale(currentRadius / BRUSH_RADIUS)
        .setAlpha(strength);
      this.overlay.erase(this.brush);
      p.drawn = { x: at.x, y: at.y, radius: currentRadius, strength };
    }
  }

  // How strongly pulse light (or the round-start preview) reveals a point, 0..1.
  // The dim ambient circle is deliberately excluded, so guards stay hidden in it.
  revealAt(x, y) {
    let best = this.preview ? 1 - this.overlay.alpha : 0;
    for (const p of this.activePulses) {
      const d = p.drawn;
      if (!d || d.radius <= 0) continue;
      best = Math.max(best, d.strength * brushFalloff(Math.hypot(x - d.x, y - d.y) / d.radius));
    }
    return best;
  }

  destroy() {
    this.scene.events.off('heartbeat:pulse', this.handlePulse, this);
    this.overlay.destroy();
    this.brush.destroy();
    for (const glow of this.lampGlows) glow.image.destroy();
  }
}
