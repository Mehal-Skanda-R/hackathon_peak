import Phaser from 'phaser';

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
    }
  }

  destroy() {
    this.scene.events.off('heartbeat:pulse', this.handlePulse, this);
    this.overlay.destroy();
    this.brush.destroy();
  }
}
