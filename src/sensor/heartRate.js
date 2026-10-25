import { SignalProcessor } from './signalProcessor.js';
import { TestSensor } from './testSensor.js';

let currentState = {
  mode: 'test',
  bpm: null,
  smoothedBpm: null,
  baselineBpm: 0,
  pulseDelta: 0,
  connected: false,
  calibrated: false,
  stale: true,
  lastReadingAtMs: null,
  error: null
};

const listeners = new Set();
const signalProcessor = new SignalProcessor();

let bleDevice = null;
let bleServer = null;
let hrCharacteristic = null;
let watchdogTimer = null;

const testSensor = new TestSensor((rawBpm) => {
  if (currentState.mode === 'test') {
    handleIncomingReading(rawBpm);
  }
});

function notifySubscribers() {
  const snapshot = Object.freeze({ ...currentState });
  listeners.forEach((callback) => callback(snapshot));
}

// Never leave a calibrated/usable BPM behind once the signal is gone.
function clearReadings() {
  currentState.stale = true;
  currentState.bpm = null;
  currentState.smoothedBpm = null;
  currentState.calibrated = false;
  currentState.baselineBpm = 0;
  currentState.pulseDelta = 0;
}

function startWatchdog() {
  stopWatchdog();
  watchdogTimer = setInterval(() => {
    const now = performance.now();
    const stale = signalProcessor.isStale(now);
    if (stale && currentState.calibrated) {
      // Signal loss restarts calibration; it re-runs on the next fresh samples.
      signalProcessor.reset();
      clearReadings();
      notifySubscribers();
    } else if (stale !== currentState.stale) {
      currentState.stale = stale;
      notifySubscribers();
    }
  }, 1000);
}

function stopWatchdog() {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
}

function handleIncomingReading(rawBpm) {
  const now = performance.now();
  currentState.bpm = rawBpm;
  currentState.lastReadingAtMs = now;

  const metrics = signalProcessor.processSample(rawBpm, now);
  currentState.smoothedBpm = metrics.smoothedBpm;
  currentState.baselineBpm = metrics.baselineBpm;
  currentState.pulseDelta = metrics.pulseDelta;
  currentState.calibrated = metrics.calibrated;
  currentState.stale = metrics.stale;
  currentState.error = null;

  notifySubscribers();
}

// Heart Rate Measurement (0x2A37): flags bit 0 selects uint8 or little-endian
// uint16 BPM at offset 1. Returns null for malformed packets.
export function parseHeartRateMeasurement(dataView) {
  if (!dataView || dataView.byteLength < 2) return null;
  const is16Bit = (dataView.getUint8(0) & 0x01) === 1;
  if (is16Bit) return dataView.byteLength >= 3 ? dataView.getUint16(1, true) : null;
  return dataView.getUint8(1);
}

function handleCharacteristicValueChanged(event) {
  const bpm = parseHeartRateMeasurement(event.target.value);
  if (bpm !== null) handleIncomingReading(bpm);
}

export async function connectHeartRate() {
  if (currentState.mode !== 'live') {
    setSensorMode('live');
  }

  try {
    currentState.error = null;
    notifySubscribers();

    bleDevice = await navigator.bluetooth.requestDevice({
      filters: [{ services: ['heart_rate'] }]
    });

    bleDevice.addEventListener('gattserverdisconnected', onDeviceDisconnected);

    bleServer = await bleDevice.gatt.connect();
    const service = await bleServer.getPrimaryService('heart_rate');
    hrCharacteristic = await service.getCharacteristic('heart_rate_measurement');

    await hrCharacteristic.startNotifications();
    hrCharacteristic.addEventListener('characteristicvaluechanged', handleCharacteristicValueChanged);

    currentState.connected = true;
    startCalibration();
    startWatchdog();
    notifySubscribers();
  } catch (err) {
    currentState.connected = false;
    currentState.error = err.message || 'Failed to connect BLE Heart Rate sensor';
    notifySubscribers();
    throw err;
  }
}

function onDeviceDisconnected() {
  currentState.connected = false;
  currentState.error = 'Sensor disconnected';
  signalProcessor.reset();
  clearReadings();
  notifySubscribers();
}

export function disconnectHeartRate() {
  if (hrCharacteristic) {
    try {
      hrCharacteristic.removeEventListener('characteristicvaluechanged', handleCharacteristicValueChanged);
      hrCharacteristic.stopNotifications();
    } catch (_) {}
  }

  if (bleDevice && bleDevice.gatt.connected) {
    bleDevice.gatt.disconnect();
  }

  stopWatchdog();
  testSensor.stop();

  currentState.connected = false;
  signalProcessor.reset();
  clearReadings();

  notifySubscribers();
}

export function startCalibration() {
  signalProcessor.startCalibration();
  currentState.calibrated = false;
  currentState.baselineBpm = 0;
  currentState.pulseDelta = 0;
  notifySubscribers();
}

export function setSensorMode(mode) {
  if (mode !== 'live' && mode !== 'test') return;

  if (currentState.mode === mode && mode === 'test' && watchdogTimer !== null) {
    return;
  }

  disconnectHeartRate();

  currentState.mode = mode;
  currentState.error = null;

  if (mode === 'test') {
    currentState.connected = false;
    testSensor.start();
    startWatchdog();
    startCalibration();
  }

  notifySubscribers();
}

// AUTO-START TEST MODE ON INITIAL MODULE LOAD:
setSensorMode('test');
export function setTestBpm(bpm) {
  if (currentState.mode !== 'test') return;
  testSensor.setBpm(bpm);
}

export function getHeartRateState() {
  return Object.freeze({ ...currentState });
}

export function subscribeToHeartRate(callback) {
  listeners.add(callback);
  callback(getHeartRateState());
  return () => {
    listeners.delete(callback);
  };
}
