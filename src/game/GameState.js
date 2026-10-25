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
