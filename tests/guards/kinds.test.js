// Guard kinds and the Warden, on real level geometry with synthetic pulses.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, MAP_GEOMETRY, setLevel, canOccupy, hasLineOfSight } from '../../src/game/config.js';
import Guard from '../../src/game/Guard.js';
import Warden, { WARDEN_TUNING } from '../../src/game/Warden.js';
import GuardSystem, { GUARD_ROUTES_BY_LEVEL, GUARD_KINDS_BY_LEVEL, WARDEN_BY_LEVEL } from '../../src/game/GuardSystem.js';

const T = 32;
const at = (c, r) => ({ x: (c + 0.5) * T, y: (r + 0.5) * T });
let id = 0;
const pulse = (point, extra = {}) => ({ id: `t${++id}`, x: point.x, y: point.y, radius: 100, delta: 0,
  hidingAtEmission: false, ...extra });
const levelIndex = levelId => LEVELS.findIndex(level => level.id === levelId);
const onLevel = (levelId, body) => { setLevel(levelIndex(levelId)); try { body(); } finally { setLevel(0); } };
const map = () => MAP_GEOMETRY;

test('every listed guard kind belongs to a real route on a real level', () => {
  for (const [levelId, kinds] of Object.entries(GUARD_KINDS_BY_LEVEL)) {
    assert.ok(levelIndex(levelId) >= 0, levelId);
    for (const [guardId, kind] of Object.entries(kinds)) {
      assert.ok(GUARD_ROUTES_BY_LEVEL[levelId][guardId], `${levelId}/${guardId}`);
      assert.ok(['hound', 'lantern', 'sleeper'].includes(kind));
    }
  }
  for (const [levelId, warden] of Object.entries(WARDEN_BY_LEVEL)) {
    onLevel(levelId, () => assert.ok(canOccupy(at(...warden.post).x, at(...warden.post).y, 20), `${levelId} post`));
  }
});

test('a hound hears pulses 1.8x further than a watchman', () => {
  const route = [at(10, 10)];
  const hound = new Guard({ id: 'h', route, map: map(), kind: 'hound' });
  const watchman = new Guard({ id: 'w', route, map: map() });
  const origin = { x: route[0].x + 150, y: route[0].y };
  assert.equal(watchman.handlePulse(pulse(origin)), false);
  assert.equal(hound.handlePulse(pulse(origin)), true);
  assert.equal(hound.state, 'suspicious');
});

test('a sleeper stays put until two pulses reach it, then investigates', () => {
  const sleeper = new Guard({ id: 's', route: [at(10, 10), at(14, 10)], map: map(), kind: 'sleeper' });
  const player = { ...at(12, 10), hiding: false };
  for (let t = 0; t < 3000; t += 16) sleeper.update(16, player);
  assert.equal(sleeper.state, 'asleep');
  assert.deepEqual({ x: sleeper.x, y: sleeper.y }, at(10, 10));
  sleeper.handlePulse(pulse(player));
  assert.equal(sleeper.state, 'asleep', 'one beat is not enough');
  sleeper.handlePulse(pulse(player));
  assert.equal(sleeper.state, 'suspicious');
  sleeper.update(500, player);
  assert.notDeepEqual({ x: sleeper.x, y: sleeper.y }, at(10, 10), 'walks to the beat');
});

test('a lantern-bearer chases a thief it sees in its light, but not one in cover', () => {
  const lantern = new Guard({ id: 'l', route: [at(10, 10)], map: map(), kind: 'lantern' });
  lantern.update(16, { ...at(11, 10), hiding: true });
  assert.notEqual(lantern.state, 'chase');
  lantern.update(16, { x: at(10, 10).x + 150, y: at(10, 10).y, hiding: false });
  assert.notEqual(lantern.state, 'chase', 'outside the light');
  lantern.update(16, { ...at(11, 10), hiding: false });
  assert.equal(lantern.state, 'chase');
});

test('floor 07 Warden sleeps until woken, then hears every open beat through walls', () => onLevel('final-heist', () => {
  const warden = new Warden({ id: 'warden', map: map(), post: at(13, 4), coverZones: map().hidingZones });
  const farAway = at(2, 14);
  assert.equal(warden.handlePulse(pulse(farAway)), false, 'dormant: deaf');
  for (let t = 0; t < 2000; t += 16) warden.update(16, { ...farAway, hiding: false });
  assert.deepEqual({ x: warden.x, y: warden.y }, at(13, 4));
  warden.wake();
  assert.deepEqual(warden.takeEvents(), ['woke']);
  assert.equal(warden.handlePulse({ ...pulse(farAway), radius: 100 }), true, 'any distance, through walls');
  assert.equal(warden.state, 'hunt');
  // From cover: a quiet beat is never heard; a loud one only nearby.
  assert.equal(warden.handlePulse(pulse(farAway, { hidingAtEmission: true, delta: 20 })), false);
  const near = { x: warden.x + 60, y: warden.y };
  assert.equal(warden.handlePulse(pulse(near, { hidingAtEmission: true, delta: 3 })), false);
  assert.equal(warden.handlePulse(pulse(near, { hidingAtEmission: true, delta: 12 })), true);
}));

test('the Warden walks toward the last beat and catches an open thief up close', () => onLevel('final-heist', () => {
  const warden = new Warden({ id: 'warden', map: map(), post: at(13, 4), dormant: false });
  const player = { ...at(12, 8), hiding: false };
  warden.handlePulse(pulse(player));
  let caught = false;
  for (let t = 0; t < 8000 && !caught; t += 16) caught = warden.update(16, player);
  assert.equal(caught, true);
}));

test('The Inspection: quiet for 8 s passes; three loud beats fail', () => onLevel('final-heist', () => {
  const cover = map().hidingZones[0];
  const hidden = { x: cover.x + cover.width / 2, y: cover.y + cover.height / 2, hiding: true };
  const make = () => {
    const warden = new Warden({ id: 'warden', map: map(), post: at(13, 4), dormant: false, after: 'dormant' });
    ({ x: warden.x, y: warden.y } = at(4, 4)); // open floor beside the cover
    warden.update(16, hidden);
    assert.equal(warden.state, 'inspect');
    assert.deepEqual(warden.takeEvents(), ['inspection-start']);
    return warden;
  };
  const quiet = make();
  for (let t = 0; t < WARDEN_TUNING.inspectMs - 100; t += 16) quiet.update(16, hidden);
  quiet.handlePulse(pulse(hidden, { hidingAtEmission: true, delta: 4 }));
  assert.equal(quiet.state, 'inspect');
  for (let t = 0; t < 200; t += 16) quiet.update(16, hidden);
  assert.deepEqual(quiet.takeEvents(), ['inspection-passed']);
  for (let t = 0; t < 20000 && quiet.state !== 'dormant'; t += 16) quiet.update(16, hidden);
  assert.equal(quiet.state, 'dormant', 'back to his office for good');

  const loud = make();
  for (let i = 0; i < 3; i++) loud.handlePulse(pulse(hidden, { hidingAtEmission: true, delta: 15 }));
  assert.equal(loud.update(16, hidden), true, 'three loud beats: found');
  assert.deepEqual(loud.takeEvents(), ['inspection-failed']);
}));

test('a freed Warden ignores everything', () => onLevel('heart-shrine', () => {
  const warden = new Warden({ id: 'warden', map: map(), post: at(12, 9), dormant: false });
  warden.release();
  assert.equal(warden.handlePulse(pulse(at(2, 14))), false);
  assert.equal(warden.update(1000, { ...at(12, 9), hiding: false }), false);
  assert.equal(warden.state, 'freed');
}));

test('GuardSystem adds the Warden on floor 07 and noise distracts only awake guards', () => onLevel('final-heist', () => {
  const scene = { status: 'playing', canOccupy, hasLineOfSight, events: { emit() {} } };
  const system = new GuardSystem(scene, map());
  const states = system.getStates();
  assert.equal(states.filter(s => s.kind === 'warden').length, 1);
  assert.equal(system.warden.state, 'dormant');
  const north = states.find(s => s.id === 'guard-north');
  system.handleNoise({ id: 'noise-1', x: north.x, y: north.y, radius: 100 });
  assert.equal(system.getStates().find(s => s.id === 'guard-north').state, 'suspicious');
  assert.equal(system.warden.state, 'dormant');
}));
