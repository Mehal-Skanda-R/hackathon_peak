import Phaser from 'phaser';

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
      let alpha = 1 - t;
      
      this.graphics.lineStyle(2, 0xffffff, alpha);
      this.graphics.strokeCircle(p.x, p.y, currentRadius);
    }
  }

  destroy() {
    this.scene.events.off('heartbeat:pulse', this.handlePulse, this);
    this.graphics.destroy();
  }
}
