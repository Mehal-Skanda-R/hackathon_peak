// Combined-game fairness/regression check. Uses real keyboard movement, no teleports,
// no guard tuning changes and no injected sensor/calibration values.
// Start the production dev server separately, then from tests/engine:
//   npm ci && node combined-heist.cjs http://127.0.0.1:5176/
// Optional third argument (e.g. 110): one higher-BPM balance trial after 72 BPM
// calibration. A legitimate caught result is recorded, not treated as a test failure.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const url = process.argv[2] || 'http://127.0.0.1:5176/';
const trialBpm = Number(process.argv[3] || 0);
assert.ok(trialBpm === 0 || (Number.isFinite(trialBpm) && trialBpm >= 40 && trialBpm <= 200));
const output = path.join(__dirname, 'test-results', trialBpm ? `combined-heist-${trialBpm}` : 'combined-heist');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Same test-only Phaser instance capture used in Shyam's integrated-play harness.
  await page.addInitScript(() => {
    let Phaser;
    Object.defineProperty(window, 'Phaser', { configurable: true, get: () => Phaser, set(value) {
      Phaser = value;
      const init = value.Scenes.Systems.prototype.init;
      value.Scenes.Systems.prototype.init = function (game) {
        window.__game = game;
        return init.apply(this, arguments);
      };
    } });
  });
  const report = { url, errors, runs: [] };
  try {
    await page.goto(url);
    await page.waitForFunction(() => window.__game?.scene.getScene('MuseumScene')?.player);
    await page.evaluate(async () => {
      window.GS = await import('/src/game/GameState.js');
      window.HR = await import('/src/sensor/heartRate.js');
      window.CFG = await import('/src/game/config.js');
      window.M = () => window.__game.scene.getScene('MuseumScene');
      window.observations = { pulses: [], maxSuspicion: {}, doorwayFrames: 0, frames: 0 };
      M().events.on('heartbeat:pulse', pulse => observations.pulses.push(pulse));
      M().events.on('postupdate', () => {
        if (M().status !== 'playing') return;
        observations.frames++;
        for (const g of GS.getGameState().guards) {
          observations.maxSuspicion[g.id] = Math.max(observations.maxSuspicion[g.id] || 0, g.suspicion);
          // The west opening into the artefact room is tile (17,3).
          if (Math.abs(g.x - 560) < 16 && Math.abs(g.y - 112) < 16) observations.doorwayFrames++;
        }
      });
      // Static BFS supplies a repeatable route; the player still follows it using keys.
      window.route = (from, to) => {
        const t = CFG.TILE_SIZE;
        const start = [Math.floor(from.x / t), Math.floor(from.y / t)];
        const end = `${Math.floor(to.x / t)},${Math.floor(to.y / t)}`;
        const queue = [start], previous = new Map([[start.join(','), null]]);
        for (let i = 0; i < queue.length && !previous.has(end); i++) {
          const [x, y] = queue[i];
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const next = [x + dx, y + dy], key = next.join(',');
            if (previous.has(key) || !CFG.canOccupy((next[0] + .5) * t, (next[1] + .5) * t)) continue;
            previous.set(key, [x, y]); queue.push(next);
          }
        }
        if (!previous.has(end)) throw new Error('No route');
        const tiles = [];
        for (let tile = end.split(',').map(Number); tile; tile = previous.get(tile.join(','))) tiles.unshift(tile);
        return tiles.filter((tile, i) => i === 0 || i === tiles.length - 1
          || tiles[i + 1][0] - tile[0] !== tile[0] - tiles[i - 1][0]
          || tiles[i + 1][1] - tile[1] !== tile[1] - tiles[i - 1][1])
          .map(([x, y]) => ({ x: (x + .5) * t, y: (y + .5) * t }));
      };
    });
    const state = () => page.evaluate(() => GS.getGameState());
    const initial = await state();
    report.initialGuards = initial.guards;
    report.initialSensor = initial.sensor;
    await page.waitForTimeout(1200);
    report.testStartupWorkaround = !(await state()).sensor.bpm;
    if (report.testStartupWorkaround) {
      await page.evaluate(() => { HR.setSensorMode('live'); HR.setSensorMode('test'); HR.setTestBpm(72); });
    }
    console.log('Waiting for real 45-second TEST calibration; workaround:', report.testStartupWorkaround);
    await page.waitForFunction(() => {
      const s = GS.getGameState().sensor;
      return s.calibrated && !s.stale && s.smoothedBpm !== null;
    }, null, { timeout: 55_000 });
    report.calibratedSensor = (await state()).sensor;
    if (trialBpm) {
      await page.evaluate(bpm => HR.setTestBpm(bpm), trialBpm);
      await page.waitForFunction(bpm => Math.abs(GS.getGameState().sensor.smoothedBpm - bpm) <= 2,
        trialBpm, { timeout: 25_000 });
    }
    console.log('Calibration complete; beginning keyboard-only heists');

    const walk = async points => {
      for (let i = 1; i < points.length; i++) {
        if ((await state()).status !== 'playing') return;
        const previous = points[i - 1], target = points[i];
        const axis = previous.x === target.x ? 'y' : 'x';
        const sign = Math.sign(target[axis] - previous[axis]);
        const key = axis === 'x' ? (sign > 0 ? 'ArrowRight' : 'ArrowLeft') : (sign > 0 ? 'ArrowDown' : 'ArrowUp');
        await page.keyboard.down(key);
        try {
          await page.waitForFunction(({ axis, sign, target }) => M().status !== 'playing'
            || sign * (M().getPlayerState()[axis] - target[axis]) >= -3,
          { axis, sign, target }, { timeout: 12_000 });
        } finally { await page.keyboard.up(key); }
      }
    };

    for (let run = 1; run <= (trialBpm ? 1 : 2); run++) {
      const ready = await state();
      assert.equal(ready.status, 'ready');
      assert.deepEqual(ready.guards, initial.guards, 'Guards must reset before the next heist');
      await page.evaluate(() => { observations = { pulses: [], maxSuspicion: {}, doorwayFrames: 0, frames: 0 }; });
      await page.locator('#start-btn').click();
      await page.waitForFunction(() => M().status === 'playing');
      const began = Date.now();
      await walk(await page.evaluate(() => route(CFG.SPAWN, CFG.ARTEFACT)));
      const atArtefact = await state();
      if (atArtefact.status === 'playing') {
        assert.equal(atArtefact.hasArtefact, true);
        await walk(await page.evaluate(() => route(CFG.ARTEFACT, CFG.SPAWN)));
      }
      const outcome = await state();
      const entry = { run, scenario: trialBpm ? `balance-${trialBpm}-bpm` : 'baseline-72-bpm',
        status: outcome.status, hasArtefact: outcome.hasArtefact,
        elapsedSeconds: (Date.now() - began) / 1000, sensor: outcome.sensor,
        observations: await page.evaluate(() => ({ ...observations, pulses: observations.pulses.length })),
      };
      if (outcome.status === 'victory') {
        const guards = outcome.guards;
        const pulses = await page.evaluate(() => observations.pulses.length);
        await page.waitForTimeout(2500);
        entry.guardsFrozenAfterVictory = JSON.stringify(guards) === JSON.stringify((await state()).guards);
        entry.pulsesStoppedAfterVictory = pulses === await page.evaluate(() => observations.pulses.length);
        assert.equal(entry.guardsFrozenAfterVictory, true);
        assert.equal(entry.pulsesStoppedAfterVictory, true);
      }
      report.runs.push(entry);
      await page.screenshot({ path: path.join(output, `run-${run}-${outcome.status}.png`), fullPage: true });
      console.log(JSON.stringify(entry));
      if (trialBpm) assert.ok(['victory', 'caught'].includes(outcome.status));
      else assert.equal(outcome.status, 'victory', `Keyboard route failed on run ${run}`);
      await page.keyboard.press('r');
      await page.waitForFunction(() => M().status === 'ready');
      await page.waitForTimeout(100);
    }
    assert.deepEqual(errors, []);
    report.canvasCount = await page.locator('canvas').count();
    assert.equal(report.canvasCount, 1);
    report.passed = true;
  } catch (error) {
    report.failure = error.stack;
    await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
    process.exitCode = 1;
  } finally {
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    await browser.close();
  }
})();
