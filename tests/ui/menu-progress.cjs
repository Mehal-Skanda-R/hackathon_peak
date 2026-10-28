// Run with the root Vite server active. Install the existing isolated engine
// test dependencies first: npm ci --prefix tests/engine
// node tests/ui/menu-progress.cjs http://127.0.0.1:5173
// PLAYWRIGHT_PACKAGE may point to another installed package.json for local checks.
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = createRequire(path.resolve(process.env.PLAYWRIGHT_PACKAGE || 'tests/engine/package.json'))('@playwright/test');
const url = process.argv[2] || 'http://127.0.0.1:5173';
const output = path.resolve('tests/engine/test-results/menu-progress');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      let phaser;
      Object.defineProperty(window, 'Phaser', { configurable: true, get: () => phaser, set(v) {
        phaser = v;
        const init = v.Scenes.Systems.prototype.init;
        v.Scenes.Systems.prototype.init = function (game) { window.__game = game; return init.apply(this, arguments); };
      } });
    });
    const boot = async () => {
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__game?.scene.getScene('MuseumScene')?.player);
      await page.evaluate(async () => {
        window.GS = await import('/src/game/GameState.js');
        window.CFG = await import('/src/game/config.js');
        window.M = () => window.__game.scene.getScene('MuseumScene');
        window.tp = c => { M().player.setPosition(c.x, c.y); M().player.body.updateFromGameObject(); };
      });
    };
    const read = () => page.evaluate(() => ({
      continue: document.getElementById('home-play').textContent,
      enter: document.getElementById('home-enter').textContent,
      count: document.getElementById('home-progress-count').textContent,
      coins: document.getElementById('home-best-coins').textContent,
      selected: document.querySelector('.floor-spot.selected').dataset.level,
      locked: document.querySelectorAll('.floor-spot.locked').length,
      completed: document.querySelectorAll('.floor-spot.completed').length,
      bar: document.querySelector('.home-progress-bar').getAttribute('aria-valuenow'),
    }));
    await boot();
    const fresh = await read();
    assert.match(fresh.continue, /FLOOR 01/); assert.match(fresh.enter, /floor 01/);
    assert.equal(fresh.count, '0 / 7'); assert.equal(fresh.coins, '0');
    assert.equal(fresh.selected, '1'); assert.equal(fresh.locked, 6); assert.equal(fresh.completed, 0);
    await page.screenshot({ path: path.join(output, 'fresh-home.png') });
    await page.locator('[data-level="7"]').click();
    assert.match(await page.locator('#home-toast').innerText(), /locked/);
    assert.equal(await page.locator('body').evaluate(e => e.classList.contains('home-open')), true);
    console.log('PASS fresh progress, labels, selection and locked-floor rejection');

    await page.waitForFunction(() => GS.getGameState().sensor.calibrated);
    await page.locator('#home-play').click();
    // The first start plays the story intro; Esc skips it.
    await page.waitForFunction(() => document.body.classList.contains('story-open'));
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => GS.getGameState().status === 'playing');
    await page.waitForTimeout(2600);
    // Leave the new coin requirement intact: a door must stay locked until paid.
    await page.evaluate(() => tp({ x: CFG.EXIT.x + CFG.EXIT.width / 2, y: CFG.EXIT.y + CFG.EXIT.height / 2 }));
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => GS.getGameState().status), 'playing');
    const coins = await page.evaluate(() => CFG.COINS.slice(0, GS.getGameState().coinsRequired));
    for (const coin of coins) { await page.evaluate(c => tp(c), coin); await page.waitForTimeout(70); }
    assert.equal(await page.evaluate(() => GS.getGameState().doorOpen), true);
    await page.evaluate(() => tp({ x: CFG.EXIT.x + CFG.EXIT.width / 2, y: CFG.EXIT.y + CFG.EXIT.height / 2 }));
    await page.waitForFunction(() => GS.getGameState().status === 'transition');
    assert.equal(await page.locator('#menu-btn').isDisabled(), true);
    // Defensive event gate also protects callers other than the disabled button.
    await page.evaluate(() => window.dispatchEvent(new Event('hud-open-menu')));
    assert.equal(await page.locator('body').evaluate(e => e.classList.contains('home-open')), false);
    await page.waitForFunction(() => GS.getGameState().level === 2 && GS.getGameState().status === 'playing');
    await page.waitForTimeout(2600);
    assert.equal(await page.locator('#menu-btn').isDisabled(), false);
    await page.locator('#menu-btn').click();
    const paused = await page.evaluate(() => GS.getGameState());
    assert.equal(paused.status, 'paused'); assert.equal(paused.pauseReason, 'Menu open');
    await page.waitForTimeout(500);
    assert.deepEqual(await page.evaluate(() => GS.getGameState().guards), paused.guards);
    const unlocked = await read();
    assert.equal(unlocked.count, '1 / 7'); assert.equal(unlocked.selected, '2');
    assert.equal(unlocked.locked, 5); assert.equal(unlocked.completed, 1);
    assert.equal(Number(unlocked.coins), paused.coins);
    await page.screenshot({ path: path.join(output, 'unlocked-home.png') });
    await page.locator('#home-play').click();
    await page.waitForFunction(() => GS.getGameState().status === 'playing');
    assert.equal(await page.evaluate(() => GS.getGameState().coins), paused.coins);
    console.log('PASS coin gate preserved, transition menu blocked, ordinary Menu pauses/resumes and updates progress');

    // Persistence/UI completion state, without pretending to win seven levels.
    await page.evaluate(() => localStorage.setItem('hh-progress-v1', JSON.stringify({ unlocked: 7, completed: 7, bestCoins: 42, seen: { intro: true } })));
    await boot();
    const complete = await read();
    assert.equal(complete.count, '7 / 7'); assert.equal(complete.coins, '42');
    assert.equal(complete.locked, 0); assert.equal(complete.completed, 7);
    // A finished castle starts a new run from floor 1.
    assert.equal(complete.selected, '1'); assert.match(complete.enter, /floor 01/);
    assert.equal(complete.bar, '7');
    await page.screenshot({ path: path.join(output, 'complete-home.png') });
    // Continuing a paused earlier floor must match its displayed action.
    await page.waitForFunction(() => GS.getGameState().sensor.calibrated);
    await page.locator('[data-level="1"]').click();
    await page.waitForFunction(() => GS.getGameState().status === 'playing');
    await page.waitForTimeout(2600);
    await page.locator('#menu-btn').click();
    const earlier = await read();
    assert.match(earlier.continue, /FLOOR 01/); assert.match(earlier.enter, /floor 01/);
    assert.equal(earlier.selected, '1');
    await page.locator('#home-enter').click();
    assert.equal(await page.evaluate(() => GS.getGameState().level), 1);
    assert.equal(await page.evaluate(() => GS.getGameState().status), 'playing');
    assert.deepEqual(errors, []);
    assert.equal(await page.locator('canvas').count(), 1);
    console.log('PASS saved completion, dynamic locks/counts, earlier-floor Continue/Enter consistency; no page errors');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
