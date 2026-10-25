import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_WIDTH, WORLD_HEIGHT, TILE_SIZE, MAP_COLUMNS, MAP_ROWS, WALLS,
  SPAWN, ARTEFACT, EXIT, HIDING_ZONES, PLAYER_SPEED,
  canOccupy, hasLineOfSight, getHidingZone, movementVelocity } from '../../src/game/config.js';

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

test('all floor/objectives remain reachable and the artefact route requires a detour', t => {
  const start = [Math.floor(SPAWN.x / TILE_SIZE), Math.floor(SPAWN.y / TILE_SIZE)];
  const queue = [start];
  const visited = new Set([start.join(',')]);
  const distances = new Map([[start.join(','), 0]]);
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, key = `${nx},${ny}`;
      if (visited.has(key) || !canOccupy((nx + 0.5) * TILE_SIZE, (ny + 0.5) * TILE_SIZE)) continue;
      visited.add(key);
      distances.set(key, distances.get(`${x},${y}`) + 1);
      queue.push([nx, ny]);
    }
  }
  for (let y = 0; y < MAP_ROWS; y++) for (let x = 0; x < MAP_COLUMNS; x++) {
    if (canOccupy((x + 0.5) * TILE_SIZE, (y + 0.5) * TILE_SIZE)) assert.ok(visited.has(`${x},${y}`));
  }
  for (const point of [ARTEFACT, { x: EXIT.x + 16, y: EXIT.y + 16 },
    ...HIDING_ZONES.map(z => ({ x: z.x + 16, y: z.y + 16 }))]) {
    assert.ok(visited.has(`${Math.floor(point.x / TILE_SIZE)},${Math.floor(point.y / TILE_SIZE)}`));
  }
  const steps = distances.get(`${Math.floor(ARTEFACT.x / TILE_SIZE)},${Math.floor(ARTEFACT.y / TILE_SIZE)}`);
  // Preserve the intended moderate detour, while avoiding an excessively long maze.
  assert.ok(steps >= 44 && steps <= 70, `Artefact route is ${steps} tiles`);
  t.diagnostic(`Shortest four-direction artefact route: ${steps} tiles (${steps * TILE_SIZE} px)`);
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
