const EMA_ALPHA = 0.2;
const CALIBRATION_DURATION_MS = 45000; // 45 seconds
const STALE_THRESHOLD_MS = 5000;        // 5 seconds

export class SignalProcessor {
  constructor() {
    this.reset();
  }

  reset() {
    this.smoothedBpm = null;
    this.baselineBpm = null;
    this.calibrationStartTime = null;
    this.calibrationSamples = [];
    this.isCalibrated = false;
    this.lastReadingTime = null;
  }

  processSample(rawBpm, timestampMs = performance.now()) {
    if (typeof rawBpm !== 'number' || isNaN(rawBpm) || rawBpm < 30 || rawBpm > 220) {
      return this.getCurrentMetrics(timestampMs);
    }

    this.lastReadingTime = timestampMs;

    if (this.smoothedBpm === null) {
      this.smoothedBpm = rawBpm;
    } else {
      this.smoothedBpm = (EMA_ALPHA * rawBpm) + ((1 - EMA_ALPHA) * this.smoothedBpm);
    }

    if (!this.isCalibrated) {
      if (!this.calibrationStartTime) {
        this.calibrationStartTime = timestampMs;
      }

      this.calibrationSamples.push(this.smoothedBpm);

      if (timestampMs - this.calibrationStartTime >= CALIBRATION_DURATION_MS) {
        const sum = this.calibrationSamples.reduce((acc, val) => acc + val, 0);
        this.baselineBpm = sum / this.calibrationSamples.length;
        this.isCalibrated = true;
      }
    }

    return this.getCurrentMetrics(timestampMs);
  }

  startCalibration(timestampMs = performance.now()) {
    this.isCalibrated = false;
    this.baselineBpm = null;
    this.calibrationStartTime = timestampMs;
    this.calibrationSamples = [];
  }

  isStale(timestampMs = performance.now()) {
    if (this.lastReadingTime === null) return true;
    return (timestampMs - this.lastReadingTime) >= STALE_THRESHOLD_MS;
  }

  getCurrentMetrics(timestampMs = performance.now()) {
    const stale = this.isStale(timestampMs);
    const baseline = this.isCalibrated ? this.baselineBpm : 0;
    const smoothed = this.smoothedBpm !== null ? Math.round(this.smoothedBpm) : null;
    const pulseDelta = this.isCalibrated && smoothed !== null ? Math.max(0, smoothed - Math.round(baseline)) : 0;

    return {
      smoothedBpm: smoothed,
      baselineBpm: this.isCalibrated ? Math.round(this.baselineBpm) : 0,
      pulseDelta,
      calibrated: this.isCalibrated,
      stale
    };
  }
}