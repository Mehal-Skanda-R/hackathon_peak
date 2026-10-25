export class TestSensor {
  constructor(onReadingCallback) {
    this.onReadingCallback = onReadingCallback;
    this.testBpm = 72;
    this.timer = null;
    this.intervalMs = 1000;
  }

  setBpm(bpm) {
    this.testBpm = Math.max(40, Math.min(200, bpm));
  }

  start() {
    this.stop();
    this.timer = setInterval(() => {
      if (this.onReadingCallback) {
        const jitter = (Math.random() - 0.5) * 2;
        this.onReadingCallback(Math.round(this.testBpm + jitter));
      }
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}