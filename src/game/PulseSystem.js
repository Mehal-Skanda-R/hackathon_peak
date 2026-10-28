import Phaser from 'phaser';

export default class PulseSystem {
  constructor(scene) {
    this.scene = scene;
    this.pulseCount = 0;
    this.timer = 0;
    this.baseRadius = 100;
    this.radiusPerBpm = 4;
    this.maxRadius = 260;
    this.durationMs = 600;
  }

  update(deltaMs, sensorState, engineState) {
    if (engineState.status !== 'playing') return;
    if (!sensorState || sensorState.bpm === null) return;

    this.timer -= deltaMs;
    if (this.timer <= 0) {
      const interval = 60000 / sensorState.bpm;
      this.timer = interval;
      this.emitPulse(sensorState, engineState);
    }
  }

  emitPulse(sensorState, engineState) {
    this.pulseCount++;
    const delta = Math.max(0, sensorState.pulseDelta || 0);
    const calcRadius = this.baseRadius + (this.radiusPerBpm * delta);
    const radius = Phaser.Math.Clamp(calcRadius, this.baseRadius, this.maxRadius);

    const pulse = {
      id: this.pulseCount,
      x: engineState.player.x,
      y: engineState.player.y,
      radius: radius,
      durationMs: this.durationMs,
      emittedAtMs: performance.now(),
      source: 'heartbeat',
      mode: sensorState.mode,
      delta, // BPM above baseline at emission (the Warden listens for loud beats)
      hidingAtEmission: engineState.player.hiding
    };

    this.scene.events.emit('heartbeat:pulse', pulse);
  }

  reset() {
    this.pulseCount = 0;
    this.timer = 0;
  }

  destroy() {
    this.reset();
  }
}
