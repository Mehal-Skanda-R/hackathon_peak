// Run: node --test tests/sensor/sensor.test.js
// Fake clock + fake timers + fake Web Bluetooth device; no hardware needed.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { SignalProcessor } from '../../src/sensor/signalProcessor.js';

let clock = 0;
Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => clock } });
mock.timers.enable({ apis: ['setInterval'] });
// Advance the fake clock and fire due intervals one second at a time.
const advance = ms => { for (let t = 0; t < ms; t += 1000) { clock += 1000; mock.timers.tick(1000); } };

// Fake BLE device exposing the standard Heart Rate Service.
const handlers = {};
const characteristic = {
  startNotifications: async () => {}, stopNotifications: () => {},
  addEventListener: (n, f) => { handlers[n] = f; }, removeEventListener: n => { delete handlers[n]; },
};
const device = {
  addEventListener: (n, f) => { handlers[n] = f; },
  gatt: { connected: true, connect: async () => ({ getPrimaryService: async () => ({ getCharacteristic: async () => characteristic }) }), disconnect() {} },
};
Object.defineProperty(globalThis, 'navigator', { configurable: true,
  value: { bluetooth: { requestDevice: async () => device } } });
const packet = bytes => ({ target: { value: new DataView(Uint8Array.from(bytes).buffer) } });

// Import after the fakes: the module auto-starts TEST mode on load.
const HR = await import('../../src/sensor/heartRate.js');
const state = () => HR.getHeartRateState();
test.after(() => { HR.disconnectHeartRate(); mock.timers.reset(); });

test('BLE parsing: uint8, little-endian uint16, malformed', () => {
  const dv = b => new DataView(Uint8Array.from(b).buffer);
  assert.equal(HR.parseHeartRateMeasurement(dv([0x00, 72])), 72);
  assert.equal(HR.parseHeartRateMeasurement(dv([0x01, 0x2c, 0x01])), 300);
  assert.equal(HR.parseHeartRateMeasurement(dv([0x01, 0x48])), null);  // uint16 flag, 1 byte
  assert.equal(HR.parseHeartRateMeasurement(dv([0x00])), null);
  assert.equal(HR.parseHeartRateMeasurement(null), null);
});

test('SignalProcessor: EMA seed/alpha, range rejection, 20 s LIVE calibration, 5 s stale', () => {
  const sp = new SignalProcessor();
  assert.equal(sp.processSample(70, 0).smoothedBpm, 70);
  assert.equal(sp.processSample(80, 1000).smoothedBpm, 72);       // 0.2*80 + 0.8*70
  for (const bad of [NaN, '90', 0, 29, 221, undefined]) {
    assert.equal(sp.processSample(bad, 2000).smoothedBpm, 72);
  }
  assert.equal(sp.processSample(72, 19000).calibrated, false);
  const m = sp.processSample(72, 20000);
  assert.equal(m.calibrated, true);
  assert.ok(m.baselineBpm >= 70 && m.baselineBpm <= 72);
  assert.equal(sp.isStale(24999), false);
  assert.equal(sp.isStale(25000), true);
});

test('TEST mode starts on load without any call and calibrates in ~3 s, not 20 s', () => {
  assert.equal(state().mode, 'test');
  advance(2000);
  assert.ok(state().bpm !== null, 'readings flowing');
  assert.equal(state().stale, false);
  assert.equal(state().calibrated, false);
  advance(3000);
  assert.equal(state().calibrated, true);
  assert.ok(state().smoothedBpm !== null);
});

test('selecting TEST again keeps the running source and calibration', () => {
  HR.setSensorMode('test');
  advance(2000);
  assert.equal(state().calibrated, true);
  assert.equal(state().stale, false);
});

test('switching to LIVE never falls back to TEST and clears calibration', () => {
  HR.setSensorMode('live');
  assert.deepEqual(
    { connected: state().connected, calibrated: state().calibrated, stale: state().stale, bpm: state().bpm },
    { connected: false, calibrated: false, stale: true, bpm: null });
  advance(10000);
  assert.equal(state().bpm, null, 'no silent test readings in live mode');
  assert.equal(state().mode, 'live');
});

test('LIVE: fake BLE device connects, calibrates, rejects malformed packets', async () => {
  await HR.connectHeartRate();
  assert.equal(state().connected, true);
  const notify = handlers.characteristicvaluechanged;
  for (let i = 0; i < 19; i++) { notify(packet([0x00, 70])); advance(1000); }
  assert.equal(state().calibrated, false, 'LIVE keeps the 20 s baseline window');
  for (let i = 0; i < 3; i++) { notify(packet([0x00, 70])); advance(1000); }
  assert.equal(state().calibrated, true);
  assert.equal(state().stale, false);
  notify(packet([0x01, 0x48]));   // malformed: ignored
  notify(packet([0x00, 250]));    // implausible: ignored
  assert.equal(state().smoothedBpm, 70);
  notify(packet([0x01, 100, 0])); // uint16 = 100
  assert.equal(state().bpm, 100);
});

test('LIVE signal loss: stale after 5 s resets calibration; recalibrates on fresh data', () => {
  advance(7000);  // device silent
  assert.equal(state().stale, true);
  assert.equal(state().calibrated, false, 'calibration must restart on signal loss');
  assert.equal(state().smoothedBpm, null);
  assert.equal(state().pulseDelta, 0);
  const notify = handlers.characteristicvaluechanged;
  notify(packet([0x00, 75])); advance(1000);
  assert.equal(state().stale, false);
  assert.equal(state().calibrated, false, 'needs a fresh 20 s window');
  for (let i = 0; i < 21; i++) { notify(packet([0x00, 75])); advance(1000); }
  assert.equal(state().calibrated, true);
});

test('LIVE device disconnect: not connected, not calibrated, stays LIVE', () => {
  handlers.gattserverdisconnected();
  assert.equal(state().connected, false);
  assert.equal(state().calibrated, false);
  assert.equal(state().stale, true);
  assert.equal(state().mode, 'live');
  assert.equal(state().error, 'Sensor disconnected');
});

test('back to TEST after LIVE: readings resume and recalibrate in ~3 s', () => {
  HR.setSensorMode('test');
  assert.equal(state().calibrated, false);
  advance(5000);
  assert.equal(state().mode, 'test');
  assert.equal(state().calibrated, true);
  assert.equal(state().stale, false);
});
