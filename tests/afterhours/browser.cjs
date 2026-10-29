// Root Vite server required. npm ci --prefix tests/engine installs Playwright.
// PLAYWRIGHT_PACKAGE can select another isolated, already-installed harness.
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const path = require('node:path'), fs = require('node:fs');
const { chromium } = createRequire(path.resolve(process.env.PLAYWRIGHT_PACKAGE || 'tests/engine/package.json'))('@playwright/test');
const url = process.argv[2] || 'http://127.0.0.1:5190';
const out = path.resolve('tests/engine/test-results/after-hours'); fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } }), errors = [];
    page.on('pageerror', e => errors.push(e.stack));
    await page.addInitScript(() => {
      let phaser;
      Object.defineProperty(window, 'Phaser', { configurable: true, get: () => phaser, set(v) {
        phaser = v; const init = v.Scenes.Systems.prototype.init;
        v.Scenes.Systems.prototype.init = function(game) { window.__game = game; return init.apply(this, arguments); };
      } });
    });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__game?.scene.getScene('MuseumScene')?.player);
    await page.evaluate(async () => {
      window.GS = await import('/src/game/GameState.js'); window.RULES = await import('/src/afterhours/rules.js');
      window.SENSOR = await import('/src/sensor/heartRate.js');
      window.AH = () => __game.scene.getScene('AfterHoursScene');
      window.M = () => __game.scene.getScene('MuseumScene');
      window.tp = p => { AH().player.setPosition(p.x, p.y); AH().player.body.updateFromGameObject(); };
    });
    await page.waitForFunction(() => GS.getGameState().sensor.calibrated);
    await page.locator('#home-play').click();
    await page.waitForFunction(() => GS.getGameState().status === 'playing');
    await page.waitForTimeout(2400);
    // Preserve Shyam's campaign pause controls and floor clock after integration.
    await page.keyboard.press('p'); await page.waitForFunction(() => GS.getGameState().status === 'paused');
    const pausedClock = await page.evaluate(() => GS.getGameState().floorSeconds);
    await page.waitForTimeout(1100);
    assert.equal(await page.evaluate(() => GS.getGameState().floorSeconds), pausedClock);
    await page.keyboard.press('Escape'); await page.waitForFunction(() => GS.getGameState().status === 'playing');
    await page.keyboard.down('d'); await page.waitForTimeout(250); await page.keyboard.up('d');
    await page.locator('#menu-btn').click();
    const campaign = await page.evaluate(() => structuredClone(GS.getGameState()));
    assert.equal(campaign.status, 'paused');
    await page.locator('#ah-entry').click();
    await page.screenshot({ path: path.join(out, 'contract.png') });
    assert.equal(await page.locator('#ah-dialog').isVisible(), true);
    await page.locator('#ah-gear').selectOption('lens');
    assert.equal(await page.locator('#ah-launch').isDisabled(), true);
    assert.equal(await page.locator('#ah-buy').isDisabled(), true);
    await page.locator('#ah-gear').selectOption('standard');
    await page.locator('#ah-style').selectOption('director');
    await page.locator('#ah-launch').click();
    await page.waitForFunction(() => AH().player && AH().status === 'ready');
    await page.locator('#ah-resume').click();
    await page.waitForFunction(() => AH().status === 'playing');
    await page.waitForTimeout(700);
    assert.equal(await page.evaluate(() => AH().elapsed), 0);
    assert.deepEqual(await page.evaluate(() => AH().getPlayerState()), { ...campaign.player, x: 112, y: 464, hiding: true });
    await page.waitForTimeout(1600);
    await page.screenshot({ path: path.join(out, 'mission.png') });
    assert.equal(await page.evaluate(() => AH().guards.getStates().length), 2);
    assert.equal(await page.evaluate(() => AH().visibility.lamps.length), 8);
    assert.equal(await page.evaluate(() => AH().visibility.lamps[0].x), 53);
    assert.equal(await page.locator('#danger-vignette').isVisible(), false);
    await page.keyboard.press('r');
    assert.equal(await page.evaluate(() => M().restartPending), false);
    assert.equal(await page.evaluate(() => __game.scene.isSleeping('MuseumScene')), true);
    // Sleeping campaign cannot respond to terminal controls from another mode.
    await page.evaluate(() => window.dispatchEvent(new Event('hud-end-restart')));
    assert.deepEqual(await page.evaluate(() => GS.getGameState().player), campaign.player);
    assert.deepEqual(await page.evaluate(() => M().getPlayerState()), campaign.player);
    // Actual keyboard input + Arcade collision against a border wall.
    await page.evaluate(() => tp({ x: 48, y: 464 }));
    await page.keyboard.down('a'); await page.waitForTimeout(450); await page.keyboard.up('a');
    assert.ok(await page.evaluate(() => AH().getPlayerState().x >= 41));
    await page.evaluate(() => tp(RULES.SPAWN));
    await page.locator('#ah-pause').click();
    const clock = await page.evaluate(() => AH().elapsed);
    await page.waitForTimeout(300); assert.equal(await page.evaluate(() => AH().elapsed), clock);
    await page.locator('#ah-resume').click();
    await page.keyboard.press('p'); await page.waitForFunction(() => AH().status === 'paused');
    assert.equal(await page.evaluate(() => M().status), 'paused');
    await page.locator('#ah-resume').click();
    // Director warnings precede danger and a rapid second action is rejected.
    await page.keyboard.press('l'); assert.equal(await page.evaluate(() => AH().directorLane), 1);
    const attack = await page.evaluate(() => {
      const a = AH(); const accepted = a.direct('sweep'), second = a.direct('lure');
      return { accepted, second, warning: a.directorAttack.starts - a.elapsed, charges: a.directorClock.charges };
    });
    assert.equal(attack.accepted, true); assert.equal(attack.second, false); assert.equal(attack.warning, 1500);
    const shift = await page.evaluate(() => {
      const a = AH(); a.guards.guards[0].x = 592; a.guards.guards[0].y = 464;
      a.guards.guards[1].x = 752; a.guards.guards[1].y = 464;
      a.lastPulse = -Infinity; const changed = a.tryShift();
      return { changed, variant: a.variant, physicsX: a.shiftBody.body.x,
        blocked: a.canOccupy(432, 208, 18), freed: a.canOccupy(400, 208, 18) };
    });
    assert.equal(shift.changed, true); assert.equal(shift.variant, 1);
    assert.equal(shift.physicsX, 416); assert.equal(shift.blocked, false); assert.equal(shift.freed, true);
    await page.evaluate(() => tp({ x: 432, y: 176 }));
    await page.keyboard.down('s'); await page.waitForTimeout(240); await page.keyboard.up('s');
    assert.ok(await page.evaluate(() => AH().getPlayerState().y <= 183.1));
    await page.evaluate(() => tp(RULES.SPAWN));
    const distraction = await page.evaluate(() => {
      const a = AH(), g = a.guards.guards[0]; g.state = 'return'; g.suspicion = .6;
      a.investigate({ x: g.x, y: g.y }); const suspicion = g.suspicion, state = g.state;
      g.state = 'chase'; a.investigate({ x: g.x, y: g.y });
      return { suspicion, state, chase: g.state };
    });
    assert.equal(distraction.suspicion, .6); assert.equal(distraction.state, 'suspicious'); assert.equal(distraction.chase, 'chase');
    // Controlled objective placement checks curse/return/reward, not natural balance.
    for (const coin of await page.evaluate(() => RULES.LOOT.slice(0, 2))) {
      await page.evaluate(p => tp(p), coin); await page.waitForTimeout(80);
    }
    await page.evaluate(() => tp(RULES.TREASURE));
    await page.waitForFunction(() => AH().hasArtefact);
    assert.ok(await page.evaluate(() => AH().pulses.baseRadius === 165));
    await page.waitForFunction(() => document.getElementById('ah-objective').textContent.includes('Return'));
    await page.evaluate(() => tp(RULES.SPAWN));
    await page.waitForFunction(() => AH().status === 'victory');
    const marks = await page.evaluate(() => JSON.parse(localStorage.getItem('hh-after-hours-v1')).marks);
    assert.ok(marks >= 8);
    await page.screenshot({ path: path.join(out, 'escape.png') });
    // Terminal update gating freezes guards/security and pays reward exactly once.
    const guards = await page.evaluate(() => AH().guards.getStates());
    await page.waitForTimeout(400);
    assert.deepEqual(await page.evaluate(() => AH().guards.getStates()), guards);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('hh-after-hours-v1')).marks), marks);
    assert.equal(await page.evaluate(() => AH().finish('victory')), false);
    // Three retries exercise shutdown disposal; the failed run supplies a ghost.
    for (let i = 0; i < 3; i++) {
      if (i === 1) await page.keyboard.press('r'); else await page.locator('#ah-retry').click();
      await page.waitForFunction(() => AH().status === 'ready');
      await page.locator('#ah-resume').click(); await page.waitForTimeout(2400);
      if (i) assert.equal(await page.evaluate(() => Boolean(AH().echo.record)), true);
      if (i) assert.ok(await page.evaluate(() => AH().echo.count > 0));
      await page.evaluate(() => AH().catchPlayer());
      await page.waitForFunction(() => AH().status === 'caught');
      assert.equal(await page.evaluate(() => AH().events.listenerCount('heartbeat:pulse')), 3);
      assert.equal(await page.locator('canvas').count(), 1);
    }
    // Returning restores the actual paused campaign, including its guard state.
    await page.locator('#ah-castle').click();
    assert.equal(await page.locator('body').evaluate(e => e.classList.contains('home-open')), true);
    assert.deepEqual(await page.evaluate(() => GS.getGameState().player), campaign.player);
    assert.deepEqual(await page.evaluate(() => GS.getGameState().guards), campaign.guards);
    await page.locator('#home-play').click();
    await page.waitForFunction(() => GS.getGameState().status === 'playing');
    await page.locator('#menu-btn').click(); await page.locator('#ah-entry').click();
    await page.locator('#ah-launch').click(); await page.waitForFunction(() => AH().status === 'ready');
    await page.locator('#ah-resume').click(); await page.waitForTimeout(2400);
    // Real sensor facade switching invalidates readiness and pauses active mode.
    await page.evaluate(() => SENSOR.setSensorMode('live'));
    await page.waitForFunction(() => AH().status === 'paused');
    assert.equal(await page.locator('#ah-resume').isDisabled(), true);
    const pausedAt = await page.evaluate(() => AH().elapsed);
    await page.waitForTimeout(150); assert.equal(await page.evaluate(() => AH().elapsed), pausedAt);
    await page.evaluate(() => SENSOR.setSensorMode('test'));
    await page.waitForFunction(() => SENSOR.getHeartRateState().calibrated);
    assert.equal(await page.evaluate(() => AH().status), 'paused');
    await page.locator('#ah-resume').click(); await page.waitForFunction(() => AH().status === 'playing');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForFunction(() => AH().status === 'paused');
    await page.locator('#ah-resume').click();
    // A warning is safe; the same actual beam catches at its active phase.
    await page.evaluate(() => { AH().elapsed = 4000; tp({ x: 128, y: 336 }); });
    await page.waitForTimeout(120);
    assert.equal(await page.evaluate(() => AH().status), 'playing');
    assert.equal(await page.evaluate(() => AH().security.phase), 'warning');
    await page.evaluate(() => { AH().elapsed = 5000; });
    await page.waitForFunction(() => AH().status === 'caught');
    assert.ok(await page.evaluate(() => AH().recording.events.some(e => e.type === 'laser-hit')));
    await page.locator('#ah-change').click(); await page.locator('#ah-gear').selectOption('velvet');
    await page.locator('#ah-buy').click();
    assert.equal(await page.locator('#ah-launch').isDisabled(), false);
    assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('hh-after-hours-v1')).owned.includes('velvet')));
    await page.locator('#ah-launch').click(); await page.waitForFunction(() => AH().status === 'ready');
    assert.equal(await page.evaluate(() => AH().gear.speed), 140);
    assert.equal(await page.evaluate(() => AH().recording.frames.some(f => 'bpm' in f || 'input' in f)), false);
    await page.locator('#ah-clear').click(); assert.equal(await page.evaluate(() => AH().echo.record), null);
    // Exercise the other two artefacts through the actual pickup path too.
    for (const [curse, duration, cycle] of [['eclipse', 320, 6000], ['quicksilver', 600, 3800]]) {
      await page.locator('#ah-change').click(); await page.locator('#ah-curse').selectOption(curse);
      await page.locator('#ah-launch').click(); await page.waitForFunction(() => AH().status === 'ready');
      await page.locator('#ah-resume').click(); await page.waitForTimeout(2600);
      await page.evaluate(() => tp(RULES.TREASURE)); await page.waitForFunction(() => AH().hasArtefact);
      assert.equal(await page.evaluate(() => AH().pulses.durationMs), duration);
      assert.equal(await page.evaluate(() => AH().curse.cycle), cycle);
      assert.equal(await page.evaluate(() => AH().security.phase), 'quiet');
      await page.locator('#ah-pause').click();
    }
    await page.locator('#ah-castle').click();
    assert.deepEqual(errors, []);
    console.log('PASS campaign preservation, scene isolation, movement/collision, preview, pause, director warning/budget, physical room shift, ghost distraction without cancelling chase, curse/extraction, reward-once, 3 retries/ghosts/disposal, one canvas, sensor loss/recovery, warning-to-laser capture, equipment purchase and no page errors');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
