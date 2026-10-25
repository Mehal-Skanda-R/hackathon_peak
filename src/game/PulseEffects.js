import Phaser from 'phaser';

const BAND_HALF_WIDTH = 10; // px either side of the glow band's centre

export default class PulseEffects {
  constructor(scene) {
    this.scene = scene;
    this.graphics = this.scene.add.graphics();
    this.activePulses = [];
    this.scene.events.on('heartbeat:pulse', this.handlePulse, this);
  }

  handlePulse(pulse) {
    this.activePulses.push({ ...pulse, progress: 0 });
  }

  update(deltaMs) {
    this.graphics.clear();
    for (let i = this.activePulses.length - 1; i >= 0; i--) {
      let p = this.activePulses[i];
      p.progress += deltaMs;
      
      if (p.progress >= p.durationMs) {
        this.activePulses.splice(i, 1);
        continue;
      }
      
      let t = p.progress / p.durationMs;
      let currentRadius = p.radius * Phaser.Math.Easing.Quadratic.Out(t);
      // Soft glow band instead of a hard outline: thin rings whose alpha falls
      // off toward both sides of the reveal edge, fading as the pulse ends.
      const peak = 0.16 * (1 - t);
      for (let k = -BAND_HALF_WIDTH; k <= BAND_HALF_WIDTH; k += 2) {
        const falloff = 1 - Math.abs(k) / (BAND_HALF_WIDTH + 2);
        this.graphics.lineStyle(2, 0xdff4ff, peak * falloff * falloff);
        this.graphics.strokeCircle(p.x, p.y, Math.max(0, currentRadius * 0.86 + k));
      }
    }
  }

  destroy() {
    this.scene.events.off('heartbeat:pulse', this.handlePulse, this);
    this.graphics.destroy();
  }
}
