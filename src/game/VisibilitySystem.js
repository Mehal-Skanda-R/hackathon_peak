import Phaser from 'phaser';

export default class VisibilitySystem {
  constructor(scene, mapGeometry) {
    this.scene = scene;
    this.mapGeometry = mapGeometry;
    
    // Create the darkness overlay covering the whole map
    this.overlay = this.scene.add.graphics();
    this.overlay.fillStyle(0x000000, 0.98); // Almost pitch black
    this.overlay.fillRect(0, 0, mapGeometry.width, mapGeometry.height);
    
    // We want the darkness to sit above the map but below the HUD/UI
    this.overlay.setDepth(50); 
    
    // Create a geometry mask to punch transparent holes in the darkness
    this.maskGraphics = this.scene.make.graphics();
    const mask = new Phaser.Display.Masks.GeometryMask(this.scene, this.maskGraphics);
    mask.setInvertAlpha(true);
    this.overlay.setMask(mask);

    this.activePulses = [];
    this.scene.events.on('heartbeat:pulse', this.handlePulse, this);
  }

  handlePulse(pulse) {
    this.activePulses.push({ ...pulse, progress: 0 });
  }

  update(deltaMs) {
    this.maskGraphics.clear();
    
    for (let i = this.activePulses.length - 1; i >= 0; i--) {
      let p = this.activePulses[i];
      p.progress += deltaMs;
      
      if (p.progress >= p.durationMs) {
        this.activePulses.splice(i, 1);
        continue;
      }
      
      let t = p.progress / p.durationMs;
      // Use the same easing as PulseEffects so the reveal matches the white rings
      let currentRadius = p.radius * Phaser.Math.Easing.Quadratic.Out(t);
      
      this.maskGraphics.fillStyle(0xffffff);
      this.maskGraphics.fillCircle(p.x, p.y, currentRadius);
    }
  }

  destroy() {
    this.scene.events.off('heartbeat:pulse', this.handlePulse, this);
    this.overlay.destroy();
    this.maskGraphics.destroy();
  }
}
