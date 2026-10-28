// Story layer logic: the Heart Lock, Vesper, story progress and the script's coverage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, MAP_GEOMETRY, setLevel, canOccupy } from '../../src/game/config.js';
import { createHeartLock, updateHeartLock, HEART_LOCK } from '../../src/story/heartLock.js';
import Rival, { RIVAL_BY_LEVEL, RIVAL_TUNING } from '../../src/story/Rival.js';
import { FLOOR_LINES, CUTSCENES, ENDINGS, MOMENTS, JOURNAL } from '../../src/story/script.js';
import { recordFloorComplete, catacombProgress, loadProgress, recordJournal, journalFound, recordEnding,
  act3Unlocked, bankCoins, wallet, buyIntel, hasIntel, markSeen, hasSeen } from '../../src/ui/progress.js';

const fakeStorage = () => {
  const data = new Map();
  globalThis.localStorage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) };
};
const run = (lock, ms, reading, step = 100) => {
  const events = [];
  for (let t = 0; t < ms; t += step) events.push(...updateHeartLock(lock, step, reading));
  return events;
};

test('Heart Lock: raise at the case, then settle, opens it', () => {
  const lock = createHeartLock();
  assert.deepEqual(run(lock, 1000, { delta: 14, distance: 20 }), [], '+14 is not enough');
  assert.deepEqual(run(lock, 100, { delta: 15, distance: 20 }), ['armed']);
  assert.equal(lock.phase, 'settle');
  assert.deepEqual(run(lock, 3000, { delta: 9, distance: 20 }), [], 'not settled yet');
  // Settling counts from nearby cover too, and must be held without a break.
  run(lock, 1500, { delta: 4, distance: 100 });
  run(lock, 100, { delta: 7, distance: 100 });
  assert.equal(lock.settledMs, 0, 'a rise resets the settle hold');
  assert.deepEqual(run(lock, HEART_LOCK.settleHoldMs, { delta: 5, distance: 100 }), ['opened']);
  assert.equal(lock.phase, 'open');
  assert.deepEqual(run(lock, 1000, { delta: 30, distance: 0 }), [], 'open stays open');
});

test('Heart Lock: raising away from the case does nothing; the slow pick always works', () => {
  const lock = createHeartLock();
  assert.deepEqual(run(lock, 2000, { delta: 40, distance: 200 }), []);
  assert.equal(lock.phase, 'raise');
  // Accessibility fallback: no heart-rate change needed, only time at the case.
  run(lock, HEART_LOCK.pickMs / 2, { delta: 0, distance: 10 });
  run(lock, 5000, { delta: 0, distance: 300 }); // stepping away keeps the progress
  assert.deepEqual(run(lock, HEART_LOCK.pickMs / 2, { delta: 0, distance: 10 }), ['opened']);
});

test('Vesper: waits, races for the nearest coins, then leaves by the door', () => {
  setLevel(LEVELS.findIndex(l => l.id === 'gallery-hall'));
  try {
    const start = { x: (12 + 0.5) * 32, y: (1 + 0.5) * 32 };
    const exit = { x: 22 * 32 + 32, y: 14 * 32 + 32 };
    const coins = LEVELS[2].coins.map(c => ({ ...c }));
    const rival = new Rival({ start, exit, map: MAP_GEOMETRY, canOccupy });
    assert.deepEqual(rival.update(RIVAL_TUNING.startDelayMs - 10, coins), []);
    assert.deepEqual(rival.update(20, coins).map(e => e.type), ['arrived']);
    const types = [];
    for (let t = 0; t < 60000 && rival.state !== 'gone'; t += 50) {
      for (const event of rival.update(50, coins)) {
        types.push(event.type);
        if (event.type === 'coin') { coins.splice(coins.indexOf(event.coin), 1); rival.coinTaken(true); }
      }
    }
    assert.equal(rival.taken, RIVAL_TUNING.maxCoins);
    assert.equal(types.filter(t => t === 'coin').length, RIVAL_TUNING.maxCoins);
    assert.ok(types.includes('noise'), 'she distracts the guards');
    assert.equal(types.at(-1), 'gone');
    const door = LEVELS[2].door;
    assert.ok(rival.x >= door.x && rival.x <= door.x + door.width && rival.y >= door.y && rival.y <= door.y + door.height,
      'left through the door');
  } finally { setLevel(0); }
});

test('Vesper leaves at once when the engine refuses a coin', () => {
  const rival = new Rival({ start: { x: 48, y: 48 }, exit: { x: 400, y: 48 }, map: MAP_GEOMETRY, canOccupy,
    tuning: { startDelayMs: 0 } });
  rival.update(16, [{ x: 112, y: 48 }]);
  rival.coinTaken(false);
  assert.equal(rival.state, 'leaving');
});

test("every rival start tile is open floor on Vesper's floors", () => {
  for (const [levelId, { start }] of Object.entries(RIVAL_BY_LEVEL)) {
    const index = LEVELS.findIndex(l => l.id === levelId);
    assert.ok(index >= 0, levelId);
    setLevel(index);
    try { assert.ok(canOccupy((start[0] + 0.5) * 32, (start[1] + 0.5) * 32, 18), levelId); } finally { setLevel(0); }
  }
});

test('the script covers every floor, cutscene and ending', () => {
  for (const level of LEVELS) {
    assert.ok(FLOOR_LINES[level.id]?.start && FLOOR_LINES[level.id]?.door, `${level.id} radio lines`);
  }
  assert.equal(new Set(JOURNAL.map(p => p.level)).size, LEVELS.length);
  for (const id of ['intro', 'act3', ...Object.keys(ENDINGS)]) assert.ok(CUTSCENES[id]?.length, `cutscene ${id}`);
  for (const moment of Object.values(MOMENTS)) assert.ok(moment.text.length > 10);
});

test('story progress: journal, endings, Act III, cutscenes', () => {
  fakeStorage();
  assert.equal(recordJournal('gallery'), true);
  assert.equal(recordJournal('gallery'), false, 'once');
  recordJournal('ossuary');
  assert.deepEqual([...journalFound()].sort(), ['gallery', 'ossuary']);
  assert.equal(act3Unlocked(), false);
  assert.equal(recordEnding('clean'), true);
  assert.equal(act3Unlocked(), false, 'leaving the Heart does not open Act III');
  recordEnding('heart');
  assert.equal(act3Unlocked(), true);
  assert.equal(hasSeen('intro'), false);
  markSeen('intro');
  assert.equal(hasSeen('intro'), true);
});

test('Act I and Act III floors record separately', () => {
  fakeStorage();
  recordFloorComplete(7, 20);
  const act1 = loadProgress();
  assert.equal(act1.completed, 7);
  assert.equal(act1.unlocked, 7, 'Act I never unlocks past floor 07');
  recordFloorComplete(8, 25);
  recordFloorComplete(9, 30);
  assert.deepEqual(catacombProgress(), { unlocked: 3, completed: 2 });
  assert.equal(loadProgress().completed, 7, 'depths do not change Act I counts');
  assert.equal(loadProgress().bestCoins, 30);
});

test('wallet and intel: bank coins, buy once per floor, never overspend', () => {
  fakeStorage();
  assert.equal(wallet(), 0);
  assert.deepEqual(buyIntel('archive', 'routes'), { ok: false, reason: 'funds' });
  bankCoins(6);
  assert.deepEqual(buyIntel('archive', 'routes'), { ok: true });
  assert.equal(wallet(), 2);
  assert.equal(hasIntel('archive', 'routes'), true);
  assert.equal(hasIntel('vault-ring', 'routes'), false, 'per floor');
  assert.deepEqual(buyIntel('archive', 'routes'), { ok: false, reason: 'owned' });
  assert.deepEqual(buyIntel('archive', 'preview'), { ok: false, reason: 'funds' });
  assert.deepEqual(buyIntel('archive', 'nonsense'), { ok: false, reason: 'unknown' });
});

test('without working storage, story progress still lasts for the page load', () => {
  globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  recordEnding('heart');
  assert.equal(act3Unlocked(), true);
  delete globalThis.localStorage;
});
