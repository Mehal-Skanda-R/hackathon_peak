import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_WIDTH, WORLD_HEIGHT, TILE_SIZE, MAP_COLUMNS, MAP_ROWS, WALLS,
  SPAWN, PLAYER_SPEED, LEVELS, ACTS, actOf, setLevel,
  canOccupy, hasLineOfSight, getHidingZone, movementVelocity } from '../../src/game/config.js';
import { JOURNAL, journalFor } from '../../src/story/script.js';

test('walls are within the 800 × 544 world; invalid/outside positions are blocked', () => {
  assert.equal(WORLD_WIDTH, 800);
  assert.equal(WORLD_HEIGHT, 544);
  for (const wall of WALLS) {
    assert.ok(wall.x >= 0 && wall.y >= 0);
    assert.ok(wall.x + wall.width <= WORLD_WIDTH && wall.y + wall.height <= WORLD_HEIGHT);
    assert.equal(canOccupy(wall.x + wall.width / 2, wall.y + wall.height / 2), false);
  }
  for (const [x, y] of [[-1, 100], [801, 100], [100, -1], [100, 545], [NaN, 10]]) {
    assert.equal(canOccupy(x, y), false);
  }
  assert.equal(canOccupy(41, 100), true);
  assert.equal(canOccupy(40, 100), false);
});

for (const [index, level] of LEVELS.entries()) {
  test(`level ${index + 1} (${level.id}): floor, door, coins, cover${level.artefact ? ', crystal' : ''} reachable`, t => {
    setLevel(index);
    try {
      const tile = point => `${Math.floor(point.x / TILE_SIZE)},${Math.floor(point.y / TILE_SIZE)}`;
      const start = tile(level.spawn).split(',').map(Number);
      const queue = [start];
      const distances = new Map([[start.join(','), 0]]);
      for (let i = 0; i < queue.length; i++) {
        const [x, y] = queue[i];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, key = `${nx},${ny}`;
          if (distances.has(key) || !canOccupy((nx + 0.5) * TILE_SIZE, (ny + 0.5) * TILE_SIZE)) continue;
          distances.set(key, distances.get(`${x},${y}`) + 1);
          queue.push([nx, ny]);
        }
      }
      for (let y = 0; y < MAP_ROWS; y++) for (let x = 0; x < MAP_COLUMNS; x++) {
        if (canOccupy((x + 0.5) * TILE_SIZE, (y + 0.5) * TILE_SIZE)) assert.ok(distances.has(`${x},${y}`), `floor ${x},${y}`);
      }
      const door = { x: level.door.x + 16, y: level.door.y + 16 };
      const page = journalFor(level.id);
      assert.ok(page, `${level.id} has a journal page`);
      const pagePoint = { x: (page.cell[0] + 0.5) * TILE_SIZE, y: (page.cell[1] + 0.5) * TILE_SIZE };
      const points = [door, ...level.coins, ...level.hidingZones.map(z => ({ x: z.x + 16, y: z.y + 16 })),
        ...(level.artefact ? [level.artefact] : []), ...(level.shrine ? [level.shrine] : []), pagePoint];
      for (const point of points) assert.ok(distances.has(tile(point)), `unreachable ${tile(point)}`);
      const inside = (p, r) => p.x >= r.x && p.x < r.x + r.width && p.y >= r.y && p.y < r.y + r.height;
      for (const coin of level.coins) {
        assert.equal(getHidingZone(coin.x, coin.y, 1), null, `coin ${tile(coin)} sits in cover`);
        assert.ok(!inside(coin, level.door) && !inside(coin, level.entrance), `coin ${tile(coin)} sits on a door`);
      }
      // The door needs 50% of this level's coins, rounded up.
      assert.equal(level.coinsRequired, Math.ceil(level.coins.length * 0.5),
        `${level.id} needs ${level.coinsRequired} of ${level.coins.length} coins`);
      // The Golden Heart is on floor 07 only; Aurel's shrine on Act III's last depth only.
      assert.equal(Boolean(level.artefact), level.id === 'final-heist');
      assert.equal(Boolean(level.shrine), level.id === 'heart-shrine');
      // The journal page sits on open floor, clear of coins, cover, doors and objectives.
      const same = (a, b) => tile(a) === tile(b);
      assert.equal(getHidingZone(pagePoint.x, pagePoint.y, 1), null, `${level.id} page in cover`);
      assert.ok(!inside(pagePoint, level.door) && !inside(pagePoint, level.entrance), `${level.id} page on a door`);
      for (const other of [...level.coins, level.artefact, level.shrine].filter(Boolean)) {
        assert.ok(!same(pagePoint, other), `${level.id} page shares ${tile(other)}`);
      }
      const steps = distances.get(tile(door));
      if (index === 0) assert.ok(steps >= 44 && steps <= 70, `Door route is ${steps} tiles`);
      t.diagnostic(`Shortest four-direction route to the door: ${steps} tiles`);
    } finally {
      setLevel(0);
    }
  });
}

test('acts cover every level once; one final floor per act', () => {
  const covered = ACTS.flatMap(act => Array.from({ length: act.last - act.first + 1 }, (_, i) => act.first + i));
  assert.deepEqual(covered, LEVELS.map((_, i) => i));
  for (const act of ACTS) {
    const finals = LEVELS.slice(act.first, act.last + 1).filter(level => level.final);
    assert.deepEqual(finals, [LEVELS[act.last]], `act ${act.id} ends on its last floor`);
    assert.ok(LEVELS.slice(act.first, act.last + 1).every(level => level.act === act.id));
  }
  assert.equal(actOf(6).id, 1);
  assert.equal(actOf(7).id, 3);
  assert.equal(JOURNAL.length, LEVELS.length);
});

test('diagonal speed is normalized, opposite keys cancel, no input stops', () => {
  for (const keys of [[false, true, false, false], [false, true, true, false]]) {
    const v = movementVelocity(...keys);
    assert.ok(Math.abs(Math.hypot(v.x, v.y) - PLAYER_SPEED) < 1e-9);
  }
  assert.deepEqual(movementVelocity(true, true, true, true), { x: 0, y: 0 });
  assert.deepEqual(movementVelocity(false, false, false, false), { x: 0, y: 0 });
});

test('cover requires the full player body inside; LOS blocks wall crossings', () => {
  assert.equal(getHidingZone(80, 176)?.id, 'west-cover');
  assert.equal(getHidingZone(65, 176), null);
  assert.equal(getHidingZone(SPAWN.x, SPAWN.y), null);
  assert.equal(hasLineOfSight({ x: 240, y: 80 }, { x: 304, y: 80 }), false);
  assert.equal(hasLineOfSight({ x: 240, y: 176 }, { x: 304, y: 176 }), true);
  assert.equal(hasLineOfSight(SPAWN, SPAWN), true);
  assert.equal(hasLineOfSight({ x: NaN, y: 1 }, SPAWN), false);
});
