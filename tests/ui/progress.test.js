import test from 'node:test';
import assert from 'node:assert/strict';
import { floorStars, starText, formatTime, recordFloorResult, recordLevelComplete, loadProgress } from '../../src/ui/progress.js';

const fakeStorage = () => {
  const data = new Map();
  globalThis.localStorage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) };
};

test('floor stars: clear, every coin, never chased', () => {
  assert.equal(floorStars({ allCoins: false, spotted: true }), 1);
  assert.equal(floorStars({ allCoins: true, spotted: true }), 2);
  assert.equal(floorStars({ allCoins: false, spotted: false }), 2);
  assert.equal(floorStars({ allCoins: true, spotted: false }), 3);
  assert.equal(starText(2), '★★☆');
});

test('time format is m:ss', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(65_400), '1:05');
  assert.equal(formatTime(-5), '0:00');
});

test('floor records keep the best stars and best time separately', () => {
  fakeStorage();
  assert.equal(recordFloorResult(2, { timeMs: 90_000, stars: 3 }).newBest, true);
  const slower = recordFloorResult(2, { timeMs: 120_000, stars: 1 });
  assert.deepEqual(slower, { stars: 3, bestMs: 90_000, newBest: false });
  const faster = recordFloorResult(2, { timeMs: 60_000, stars: 2 });
  assert.deepEqual(faster, { stars: 3, bestMs: 60_000, newBest: true });
});

test('campaign progress keeps floor records', () => {
  fakeStorage();
  recordFloorResult(1, { timeMs: 30_000, stars: 2 });
  recordLevelComplete(1, 7, 7);
  const progress = loadProgress();
  assert.equal(progress.unlocked, 2);
  assert.deepEqual(progress.floors['1'], { stars: 2, bestMs: 30_000 });
});
