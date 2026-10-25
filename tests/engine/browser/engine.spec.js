import { test, expect } from '@playwright/test';
import { canOccupy, TILE_SIZE, SPAWN, ARTEFACT } from '../../../src/game/config.js';

const state = page => page.evaluate(() => window.__ENGINE_TEST__.scene.getScene('MuseumScene').getState());
const start = page => page.getByRole('button', { name: 'Start engine test' }).click();
const place = (page, x, y) => page.evaluate(({ x, y }) => {
  const scene = window.__ENGINE_TEST__.scene.getScene('MuseumScene');
  scene.player.body.reset(x, y);
}, { x, y });

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error; });
  await page.goto('/');
  await page.waitForFunction(() => window.__ENGINE_TEST__?.scene.getScene('MuseumScene')?.player?.body);
});

test('single canvas, WASD/arrows, normalized diagonal, wall blocking and cover', async ({ page }) => {
  await expect(page.locator('canvas')).toHaveCount(1);
  await start(page);
  await page.keyboard.down('d');
  await expect.poll(async () => (await state(page)).player.x).toBeGreaterThan(SPAWN.x + 15);
  await page.keyboard.up('d');
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await state(page)).player.y).toBeLessThan(SPAWN.y - 15);
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => {
    const velocity = window.__ENGINE_TEST__.scene.getScene('MuseumScene').player.body.velocity;
    return Math.abs(velocity.x) > 0 && Math.abs(velocity.y) > 0;
  });
  const speed = await page.evaluate(() => window.__ENGINE_TEST__.scene.getScene('MuseumScene').player.body.velocity.length());
  expect(speed).toBeCloseTo(160, 5);
  await page.keyboard.up('ArrowUp');
  await page.keyboard.up('ArrowRight');
  await place(page, 240, 80);
  await page.keyboard.down('d');
  await page.waitForTimeout(650);
  await page.keyboard.up('d');
  expect((await state(page)).player.x).toBeLessThanOrEqual(247.01);
  expect((await state(page)).player.x).toBeGreaterThan(245);
  await place(page, 80, 176);
  expect((await state(page)).player.hiding).toBe(true);
  await page.keyboard.down('a');
  await expect.poll(async () => (await state(page)).player.hiding).toBe(false);
  await page.keyboard.up('a');
});

// Derive a legal grid route, then use real keyboard input along straight runs.
function route(from, to) {
  const start = [Math.floor(from.x / TILE_SIZE), Math.floor(from.y / TILE_SIZE)];
  const end = `${Math.floor(to.x / TILE_SIZE)},${Math.floor(to.y / TILE_SIZE)}`;
  const queue = [start];
  const parents = new Map([[start.join(','), null]]);
  for (let i = 0; i < queue.length && !parents.has(end); i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = [x + dx, y + dy];
      const key = next.join(',');
      if (parents.has(key) || !canOccupy((next[0] + 0.5) * TILE_SIZE, (next[1] + 0.5) * TILE_SIZE)) continue;
      parents.set(key, [x, y]);
      queue.push(next);
    }
  }
  if (!parents.has(end)) throw new Error('No walkable route');
  const path = [];
  for (let tile = end.split(',').map(Number); tile; tile = parents.get(tile.join(','))) path.unshift(tile);
  return path.filter((tile, i) => i === 0 || i === path.length - 1
    || path[i + 1][0] - tile[0] !== tile[0] - path[i - 1][0]
    || path[i + 1][1] - tile[1] !== tile[1] - path[i - 1][1])
    .map(([x, y]) => ({ x: (x + 0.5) * TILE_SIZE, y: (y + 0.5) * TILE_SIZE }));
}

async function walk(page, points, stopOnVictory = false) {
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1], target = points[i];
    const axis = prev.x === target.x ? 'y' : 'x';
    const sign = Math.sign(target[axis] - prev[axis]);
    const key = axis === 'x' ? (sign > 0 ? 'ArrowRight' : 'ArrowLeft') : (sign > 0 ? 'ArrowDown' : 'ArrowUp');
    await page.keyboard.down(key);
    await page.waitForFunction(({ axis, sign, target, stopOnVictory }) => {
      const scene = window.__ENGINE_TEST__.scene.getScene('MuseumScene');
      return (stopOnVictory && scene.status === 'victory')
        || sign * (scene.player[axis] - target[axis]) >= -3;
    }, { axis, sign, target, stopOnVictory }, { timeout: 12_000 });
    await page.keyboard.up(key);
    if (stopOnVictory && (await state(page)).status === 'victory') return;
  }
}

test('walk the whole heist, pickup once, exit gating, victory lock, restart', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.evaluate(() => {
    window.engineCounts = { pickup: 0, victory: 0 };
    const scene = window.__ENGINE_TEST__.scene.getScene('MuseumScene');
    scene.events.on('engine:artefact-collected', () => window.engineCounts.pickup++);
    scene.events.on('engine:victory', () => window.engineCounts.victory++);
  });
  await start(page);
  await page.waitForTimeout(150);
  expect((await state(page)).status).toBe('playing'); // Spawn is already inside locked exit.
  await walk(page, route(SPAWN, ARTEFACT));
  expect((await state(page)).hasArtefact).toBe(true);
  // The exit occupies several tiles: overlap may win before the final turn.
  await walk(page, route(ARTEFACT, SPAWN), true);
  expect((await state(page)).status).toBe('victory');
  const won = await state(page);
  await page.evaluate(() => {
    const s = window.__ENGINE_TEST__.scene.getScene('MuseumScene');
    s.startRun();
    s.setPaused(false);
    s.setPaused(true, 'should not replace victory');
    s.catchPlayer();
  });
  expect(await state(page)).toEqual(won);
  await page.keyboard.down('d');
  await page.waitForTimeout(150);
  await page.keyboard.up('d');
  expect((await state(page)).player).toEqual(won.player);
  expect(await page.evaluate(() => window.engineCounts)).toEqual({ pickup: 1, victory: 1 });
  await page.keyboard.press('r');
  await expect.poll(async () => (await state(page)).hasArtefact).toBe(false);
  expect(await state(page)).toMatchObject({ status: 'ready', pauseReason: null, player: SPAWN });
  await page.evaluate(() => {
    const s = window.__ENGINE_TEST__.scene.getScene('MuseumScene');
    s.setPaused(false);
  });
  expect((await state(page)).status).toBe('ready');
  await page.screenshot({ path: testInfo.outputPath('museum.png') });
  expect(errors).toEqual([]);
});

test('pause blocks movement/objectives; caught is idempotent; repeated restarts clean up', async ({ page }) => {
  await start(page);
  await page.evaluate(() => window.__ENGINE_TEST__.scene.getScene('MuseumScene').setPaused(true, 'signal stale'));
  await page.keyboard.down('d');
  await page.waitForTimeout(150);
  await page.keyboard.up('d');
  expect((await state(page)).player).toMatchObject(SPAWN);
  expect(await page.evaluate(() => {
    const s = window.__ENGINE_TEST__.scene.getScene('MuseumScene');
    return [s.collectArtefact(), s.catchPlayer()];
  })).toEqual([false, false]);
  await page.evaluate(() => window.__ENGINE_TEST__.scene.getScene('MuseumScene').setPaused(false));
  expect(await page.evaluate(() => {
    const s = window.__ENGINE_TEST__.scene.getScene('MuseumScene');
    return [s.catchPlayer(), s.catchPlayer(), s.collectArtefact(), s.tryExit()];
  })).toEqual([true, false, false, false]);
  await page.evaluate(() => {
    const s = window.__ENGINE_TEST__.scene.getScene('MuseumScene');
    s.startRun();
    s.setPaused(false);
    s.setPaused(true, 'should not replace caught');
  });
  expect(await state(page)).toMatchObject({ status: 'caught', pauseReason: null });
  const counts = () => page.evaluate(() => {
    const s = window.__ENGINE_TEST__.scene.getScene('MuseumScene');
    return { objects: s.children.length, bodies: s.physics.world.bodies.size,
      staticBodies: s.physics.world.staticBodies.size, colliders: s.physics.world.colliders.getActive().length,
      postUpdateListeners: s.events.listenerCount('postupdate'),
      readyListeners: s.events.listenerCount('engine:ready'),
      stateListeners: s.events.listenerCount('engine:state') };
  });
  const original = await counts();
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.__ENGINE_TEST__.scene.getScene('MuseumScene').restartRun());
    await page.waitForTimeout(100);
    expect((await state(page)).status).toBe('ready');
    // Arcade queues new colliders until its first active physics step.
    await start(page);
    await expect.poll(async () => (await counts()).colliders).toBe(3);
    expect(await counts()).toEqual(original);
  }
  await start(page);
  await page.keyboard.down('d');
  await expect.poll(async () => (await state(page)).player.x).toBeGreaterThan(SPAWN.x + 15);
  await page.keyboard.up('d');
  await expect(page.locator('canvas')).toHaveCount(1);
});

test('ready is gated; snapshots are immutable and idle state does not spam events', async ({ page }) => {
  expect(await state(page)).toEqual({
    status: 'ready', pauseReason: null, hasArtefact: false,
    player: { ...SPAWN, hiding: false },
  });
  const initial = await page.evaluate(() => window.engineEvents.length);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(180);
  await page.keyboard.up('ArrowRight');
  await page.evaluate(() => {
    const s = window.__ENGINE_TEST__.scene.getScene('MuseumScene');
    s.setPaused(false);
    s.setPaused(true, 'not started');
    s.catchPlayer();
  });
  expect((await state(page)).status).toBe('ready');
  expect((await state(page)).player).toMatchObject(SPAWN);
  expect(await page.evaluate(() => window.engineEvents.length)).toBe(initial);
  expect(await page.evaluate(() => {
    const s = window.__ENGINE_TEST__.scene.getScene('MuseumScene');
    return [Object.isFrozen(s.getState()), Object.isFrozen(s.getPlayerState()),
      Object.isFrozen(s.getMapGeometry().walls), Object.isFrozen(s.getMapGeometry().walls[0])];
  })).toEqual([true, true, true, true]);
  await start(page);
  await page.evaluate(() => window.__ENGINE_TEST__.scene.getScene('MuseumScene').startRun());
  expect((await state(page)).status).toBe('playing');
  const events = await page.evaluate(() => window.engineEvents.map(({ event, state }) => [event, state.status]));
  expect(events).toEqual([
    ['engine:state', 'ready'], ['engine:ready', 'ready'], ['engine:state', 'playing'],
  ]);
});

test('pause freezes all Arcade bodies; reason changes and explicit resume preserve the run', async ({ page }) => {
  await start(page);
  await page.evaluate(() => {
    const s = window.__ENGINE_TEST__.scene.getScene('MuseumScene');
    // Physics probe, not guard AI: ensure non-player bodies freeze too.
    window.probe = s.add.rectangle(400, 300, 8, 8);
    s.physics.add.existing(window.probe);
    window.probe.body.setVelocity(50, 0);
  });
  await expect.poll(() => page.evaluate(() => window.probe.x)).toBeGreaterThan(403);
  await page.evaluate(() => window.__ENGINE_TEST__.scene.getScene('MuseumScene').setPaused(true, 'sensor stale'));
  await expect(page.locator('#status')).toHaveText('paused (sensor stale)');
  const paused = await state(page);
  const frozenX = await page.evaluate(() => window.probe.x);
  await page.keyboard.down('d');
  await page.waitForTimeout(200);
  await page.keyboard.up('d');
  expect(await state(page)).toEqual(paused);
  expect(await page.evaluate(() => window.probe.x)).toBe(frozenX);
  await page.evaluate(() => {
    const s = window.__ENGINE_TEST__.scene.getScene('MuseumScene');
    s.setPaused(true, 'sensor disconnected');
    s.startRun(); // Must not bypass the required explicit Resume.
  });
  expect(await state(page)).toMatchObject({ status: 'paused', pauseReason: 'sensor disconnected' });
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  expect(await state(page)).toMatchObject({ status: 'playing', pauseReason: null, hasArtefact: false });
  await expect.poll(() => page.evaluate(() => window.probe.x)).toBeGreaterThan(frozenX + 3);
  await page.evaluate(() => window.__ENGINE_TEST__.scene.getScene('MuseumScene').setPaused(true, 'paused restart'));
  await page.keyboard.press('r');
  await expect.poll(async () => (await state(page)).status).toBe('ready');
  expect((await state(page)).pauseReason).toBe(null);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  expect((await state(page)).status).toBe('ready');
});
