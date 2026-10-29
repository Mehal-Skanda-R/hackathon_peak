import test from 'node:test';
import assert from 'node:assert/strict';
import { makeMap, canFit, reachable, SPAWN, TREASURE, LOOT, ROUTES, at, SHIFTS,
  canShift, securityAt, DirectorBudget, pulseSettings, GEAR, CURSES, hiddenAt, lineOfSight } from '../../src/afterhours/rules.js';
import { RunRecording, EchoPlayback, MAX_MS, MAX_EVENTS, frameAt } from '../../src/afterhours/recording.js';
import { loadProfile, saveProfile, buyGear, rewardEscape } from '../../src/afterhours/profile.js';
import Guard, { findPath } from '../../src/game/Guard.js';

test('both room variants preserve every objective, coin, cover and guard route', () => {
  for (const variant of [0, 1]) {
    const map = makeMap(variant), fit = (x, y, w, h) => canFit(map, x, y, w, h);
    assert.ok(reachable(map, SPAWN, [TREASURE, ...LOOT, ...Object.values(ROUTES).flat().map(p => at(...p))]));
    for (const [id, route] of Object.entries(ROUTES)) {
      const guard = new Guard({ id, route: route.map(p => at(...p)), map, canOccupy: fit,
        hasLineOfSight: (a, b) => lineOfSight(map, a, b) });
      for (let i = 0; i < route.length; i++) assert.ok(findPath(at(...route[i]), at(...route[(i + 1) % route.length]), map, fit).length);
      for (let t = 0; t < 60000; t += 16) {
        guard.update(16, { ...SPAWN, hiding: true });
        assert.ok(fit(guard.x, guard.y, 20), `${variant}/${id} at ${t}`);
      }
    }
  }
});
test('shifting refuses visible/occupied/pulse-lit space and accepts safe unseen exhibit', () => {
  const next = makeMap(1), farActors = [SPAWN, at(18, 14)];
  assert.ok(canShift(next, SHIFTS[1], farActors, 900));
  assert.equal(canShift(next, SHIFTS[1], farActors, 300), false);
  assert.equal(canShift(next, SHIFTS[1], farActors, 900, true), false);
  assert.equal(canShift(next, SHIFTS[1], [at(13, 6), at(18, 14)], 900), false);
  const broken = { ...next, walls: [...next.walls, { x: 32, y: 256, width: 192, height: 64 }] };
  assert.equal(canShift(broken, SHIFTS[1], farActors, 900), false);
});
test('every curse keeps a full 1.2-second warning and begins quietly', () => {
  for (const cycle of [6000, ...Object.values(CURSES).map(c => c.cycle)]) {
    assert.equal(securityAt(0, cycle).phase, 'quiet');
    assert.equal(securityAt(cycle - 2200, cycle).phase, 'warning');
    assert.equal(securityAt(cycle - 1001, cycle).phase, 'warning');
    assert.equal(securityAt(cycle - 1000, cycle).phase, 'active');
    assert.equal(securityAt(cycle, cycle).phase, 'quiet');
    assert.equal(securityAt(cycle, cycle).lane, 1);
  }
});
test('equipment and curse alter the same radius sent to all pulse consumers', () => {
  assert.equal(pulseSettings(GEAR.standard, CURSES.bellheart, false).base, 100);
  assert.equal(pulseSettings(GEAR.standard, CURSES.bellheart, true).base, 165);
  assert.equal(pulseSettings(GEAR.lens, CURSES.bellheart, true).base, 206.25);
  assert.equal(pulseSettings(GEAR.velvet, CURSES.eclipse, true).base, 78);
  assert.equal(pulseSettings(GEAR.standard, CURSES.eclipse, true).duration, 320);
  assert.ok(hiddenAt(SPAWN)); assert.equal(hiddenAt(TREASURE), false);
});
test('director actions have charges, cooldown and capped time-based recharge', () => {
  const d = new DirectorBudget(); assert.equal(d.spend(), true); assert.equal(d.charges, 1);
  assert.equal(d.spend(), false); d.update(4000); assert.equal(d.spend(), true);
  d.update(4000); assert.equal(d.charges, 1); d.update(80000); assert.equal(d.charges, 3);
});
test('ghost records are bounded, immutable snapshots and do not repeat echoes', () => {
  const r = new RunRecording(), p = { x: 80, y: 80, hiding: false };
  for (let t = 0; t <= MAX_MS + 1000; t += 20) r.sample(t, { player: p });
  p.x = 999; assert.equal(r.frames[0].player.x, 80); assert.ok(r.frames.length <= 6001);
  for (let i = 0; i < MAX_EVENTS + 50; i++) r.event(i, 'pulse', { x: 80, y: 80, radius: 100 });
  assert.equal(r.events.length, MAX_EVENTS); r.finish(5000, 'caught');
  r.sample(9999, { player: p }); assert.equal(r.meta.outcome, 'caught');
  const echo = new EchoPlayback(r);
  assert.equal(echo.update(3000).echoes.length, 12);
  assert.equal(echo.update(4000).echoes.length, 0);
  assert.equal(echo.update(6000).frame, null);
  assert.equal(frameAt(r, 500).t, 500);
});
test('market purchases/rewards are separate, validated, and tolerate unavailable storage', () => {
  const data = new Map(), storage = { getItem: k => data.get(k), setItem: (k, v) => data.set(k, v) };
  let p = loadProfile(storage); assert.deepEqual(p.owned, ['standard']);
  assert.equal(buyGear(p, 'lens'), null); assert.equal(buyGear(p, 'invalid'), null);
  p = rewardEscape(p, 8, GEAR.standard); assert.equal(p.marks, 14);
  p = buyGear(p, 'lens'); assert.equal(p.marks, 2); assert.ok(p.owned.includes('lens'));
  assert.equal(buyGear(p, 'lens'), null); assert.ok(saveProfile(p, storage)); assert.deepEqual(loadProfile(storage), p);
  storage.setItem('hh-after-hours-v1', '{broken'); assert.deepEqual(loadProfile(storage).owned, ['standard']);
  assert.equal(saveProfile(p, { setItem() { throw Error('denied'); } }), false);
  assert.equal(data.has('hh-progress-v1'), false);
});
