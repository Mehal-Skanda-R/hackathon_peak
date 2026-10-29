// Movement-driven playthrough: real Arcade collisions, both guards and lasers
// stay active. The controller only presses movement keys and waits for danger.
const { createRequire } = require('node:module');
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const { chromium } = createRequire(path.resolve(process.env.PLAYWRIGHT_PACKAGE || 'tests/engine/package.json'))('@playwright/test');
const url = process.argv[2] || 'http://127.0.0.1:5190';
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      let phaser; Object.defineProperty(window, 'Phaser', { configurable: true, get: () => phaser, set(v) {
        phaser = v; const init = v.Scenes.Systems.prototype.init;
        v.Scenes.Systems.prototype.init = function(game) { window.__game = game; return init.apply(this, arguments); };
      } });
    });
    await page.goto(url, { waitUntil: 'networkidle' }); await page.locator('#ah-entry').click();
    await page.locator('#ah-launch').click(); await page.waitForFunction(() => !document.querySelector('#ah-resume').disabled);
    await page.locator('#ah-resume').click();
    let result; const attempts = [];
    for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) {
      await page.locator('#ah-retry').click(); await page.waitForFunction(() => __game.scene.getScene('AfterHoursScene').status === 'ready');
      await page.locator('#ah-resume').click();
    }
    result = await page.evaluate(async () => {
      const { findPath } = await import('/src/game/Guard.js');
      const r = await import('/src/afterhours/rules.js');
      const a = __game.scene.getScene('AfterHoursScene');
      return await new Promise(resolve => {
        let route = [], lastPlan = -1000, ticks = 0, maxChasing = 0, maxPulse = 0, stage = 0, hiddenSince = null;
        const goals = [r.at(15, 6), r.at(19, 9), r.TREASURE, r.at(19, 9), r.at(15, 6), r.SPAWN];
        const down = (name, value) => { a.keys[name].isDown = value; a.keys[name].isUp = !value; };
        const stop = () => ['w', 'a', 's', 'd'].forEach(k => down(k, false));
        const listener = () => {
          ticks++; const me = a.getPlayerState(), guards = a.guards.getStates();
          maxChasing = Math.max(maxChasing, guards.filter(g => g.state === 'chase').length);
          maxPulse = Math.max(maxPulse, a.pulses.baseRadius);
          if (a.status === 'caught' || a.status === 'victory' || a.elapsed > 110000) {
            stop(); a.events.off('postupdate', listener);
            resolve({ status: a.status, elapsed: a.elapsed, loot: a.lootCount, ticks, maxChasing, maxPulse,
              ghosts: a.echo.count, pulses: a.recording.events.filter(e => e.type === 'pulse').length,
              shifts: a.recording.events.filter(e => e.type === 'room-shift').length,
              player: me, guards, lastEvents: a.recording.events.slice(-5) }); return;
          }
          if (a.status !== 'playing' || a.visibility.isHolding()) { stop(); return; }
          if (stage === 2 && a.hasArtefact) { stage = 3; route = []; }
          const goal = goals[stage];
          if (stage !== 2 && stage !== 5 && Math.hypot(me.x - goal.x, me.y - goal.y) < 8) {
            stop(); hiddenSince ??= a.elapsed;
            if (a.elapsed - hiddenSince >= 8200) { stage++; hiddenSince = null; route = []; }
            return;
          }
          if (a.elapsed - lastPlan > 160 || !route.length) {
            lastPlan = a.elapsed;
            const safe = (x, y, w, h) => {
              if (!a.canOccupy(x, y, w, h)) return false;
              const p = { x, y };
              if (a.security?.phase !== 'quiet' && r.intersects(r.bodyAt(p, 30), r.LASERS[a.security.lane])) return false;
              for (const g of guards) {
                const distance = Math.hypot(x - g.x, y - g.y), here = Math.hypot(me.x - g.x, me.y - g.y);
                if (distance < 45 && distance < here - 3 && a.hasLineOfSight(g, p) && !r.hiddenAt(p)) return false;
              }
              return true;
            };
            route = findPath(me, goal, a.map, safe, 20);
            // BFS includes the current tile centre. Replanning must not steer
            // backwards to it on every frame and stall a corridor crossing.
            if (route.length > 1) route.shift();
            // Do not stand still beside a pursuing guard if the long route is
            // temporarily unsafe. Sidestep to a free neighbour and plan again.
            if (!route.length && guards.some(g => g.state === 'chase' && Math.hypot(g.x - me.x, g.y - me.y) < 130)) {
              const c = Math.floor(me.x / 32), row = Math.floor(me.y / 32);
              const neighbours = [[1,0],[-1,0],[0,1],[0,-1]].map(([dc, dr]) => r.at(c + dc, row + dr))
                .filter(p => a.canOccupy(p.x, p.y, 30) && !(a.security?.phase !== 'quiet' && r.intersects(r.bodyAt(p, 30), r.LASERS[a.security.lane])))
                .sort((p, q) => Math.min(...guards.map(g => Math.hypot(q.x - g.x, q.y - g.y))) - Math.min(...guards.map(g => Math.hypot(p.x - g.x, p.y - g.y))));
              for (const n of neighbours) { const escape = findPath(me, n, a.map, (x,y,w,h) => a.canOccupy(x,y,w,h), 20);
                if (escape.length > 1) { route = escape.slice(1); break; } }
            }
          }
          while (route.length && Math.hypot(route[0].x - me.x, route[0].y - me.y) < 3.2) route.shift();
          stop(); if (!route.length) return;
          const dx = route[0].x - me.x, dy = route[0].y - me.y;
          if (Math.abs(dx) > 2 && a.canOccupy(me.x + Math.sign(dx) * 3, me.y, 18)) down(dx > 0 ? 'd' : 'a', true);
          else if (Math.abs(dy) > 2) down(dy > 0 ? 's' : 'w', true);
        };
        a.events.on('postupdate', listener);
      });
    });
    attempts.push(result); console.log(`Movement attempt ${attempt + 1}: ${result.status}`);
    if (result.status === 'victory') break;
    }
    fs.mkdirSync('tests/engine/test-results/after-hours', { recursive: true });
    fs.writeFileSync('tests/engine/test-results/after-hours/playthrough.json', JSON.stringify({ result, attempts, errors }, null, 2));
    await page.screenshot({ path: 'tests/engine/test-results/after-hours/playthrough.png' });
    console.log(JSON.stringify(result)); assert.deepEqual(errors, []); assert.equal(result.status, 'victory');
    assert.ok(result.pulses > 5); assert.equal(result.maxPulse, 165);
    console.log('PASS movement-driven steal and return with both guards and museum lasers active');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
