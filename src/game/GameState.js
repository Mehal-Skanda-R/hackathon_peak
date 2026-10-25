let state = {
  status: 'ready',
  pauseReason: null,
  player: { x: 0, y: 0, hiding: false },
  hasArtefact: false,
  sensor: {
    mode: 'test',
    bpm: null,
    smoothedBpm: null,
    baselineBpm: null,
    pulseDelta: 0,
    connected: false,
    calibrated: false,
    stale: false,
    lastReadingAtMs: null,
    error: null
  },
  guards: [],
  pulseRadius: 0
};

const listeners = new Set();

export function getGameState() {
  return state;
}

export function subscribeToGameState(callback) {
  listeners.add(callback);
  callback(state);
  return () => listeners.delete(callback);
}

export function updateGameState(updates) {
  state = { ...state, ...updates };
  listeners.forEach(cb => cb(state));
}

// Single readiness rule for Start, Resume and the sensor-loss pause
// (context.md section 5): fresh, calibrated input; LIVE also needs the device.
export function isSensorUsable(sensor) {
  if (!sensor || !sensor.calibrated || sensor.stale || sensor.smoothedBpm == null) return false;
  return sensor.mode === 'test' || sensor.connected === true;
}
