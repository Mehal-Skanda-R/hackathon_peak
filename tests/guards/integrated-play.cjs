// Integrated-play check for guards in the real combined game (TEST mode).
// Usage: npm run dev -- --port 5199   (separate terminal)
//        node tests/guards/integrated-play.cjs [screenshot-dir]
// Needs Playwright + Chromium available to Node. Test harness only: it captures
// the Phaser game via window.Phaser, may switch the sensor live->test to start
// TEST readings, and teleports the player next to guards to provoke pulses.
const { chromium } = require('playwright');
const S = process.argv[2] ?? '.';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1100, height: 760 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  // Capture the Phaser game instance (test harness only; app code untouched).
  await p.addInitScript(() => {
    let P; Object.defineProperty(window, 'Phaser', { configurable: true, get: () => P, set(v) {
      P = v; const init = v.Scenes.Systems.prototype.init;
      v.Scenes.Systems.prototype.init = function (game) { window.__game = game; return init.apply(this, arguments); };
    } });
  });
  await p.goto('http://localhost:5199/');
  await p.waitForFunction(() => window.__game?.scene.getScene('MuseumScene')?.player);
  await p.evaluate(async () => {
    window.GS = await import('/src/game/GameState.js');
    window.HR = await import('/src/sensor/heartRate.js');
    window.CFG = await import('/src/game/config.js');
    window.M = () => window.__game.scene.getScene('MuseumScene');
    window.log = { caught: 0, pulses: [] };
    window.hook = () => { // museum.events persist across restart; hook once
      M().events.on('guards:caught', () => window.log.caught++);
      M().events.on('heartbeat:pulse', p => window.log.pulses.push(p));
    };
    window.hook();
    window.guards = () => GS.getGameState().guards ?? [];
    window.views = () => M().children.list.filter(o => o.type === 'Rectangle' && o.depth === 9 && o.active).length;
    window.tp = (x, y) => { const pl = M().player; pl.body.reset(x, y); };
    // Place the player 40 px from a guard, on open floor with line of sight.
    window.near = g => { for (const [dx, dy] of [[40,0],[-40,0],[0,40],[0,-40]]) {
      const x = g.x + dx, y = g.y + dy;
      if (CFG.canOccupy(x, y, 18) && CFG.hasLineOfSight(g, { x, y })) return tp(x, y); } };
    window.wallHits = () => guards().filter(g => !CFG.canOccupy(g.x, g.y, 20)).length;
  });
  const R = {}; const wait = ms => p.waitForTimeout(ms);
  const ev = (f, a) => p.evaluate(f, a);
  const shot = n => p.screenshot({ path: `${S}/${n}.png` });

  R.initialSensor = await ev(() => { const s = GS.getGameState().sensor; return { mode: s?.mode, bpm: s?.bpm }; });
  await wait(1500);
  R.sensorAfter1500ms = await ev(() => GS.getGameState().sensor?.bpm ?? null);
  // A. ready: guards idle
  const g0 = await ev(() => guards()); await wait(1500); const g0b = await ev(() => guards());
  R.readyIdle = JSON.stringify(g0) === JSON.stringify(g0b); R.initialGuards = g0; R.viewsRun1 = await ev(() => views());
  // Activate TEST readings (normal startup path does not, per audit) — harness workaround.
  if (!R.sensorAfter1500ms) await ev(() => { HR.setSensorMode('live'); HR.setSensorMode('test'); });
  await ev(() => HR.setTestBpm(150)); await wait(2500);
  R.sensorActivated = await ev(() => GS.getGameState().sensor.bpm);
  await ev(() => window.dispatchEvent(new Event('hud-start-clicked'))); await wait(200);
  R.statusAfterStart = await ev(() => GS.getGameState().status);
  // B. patrol with player far away in west spawn
  let maxWall = 0; for (let i = 0; i < 20; i++) { await wait(250); maxWall = Math.max(maxWall, await ev(() => wallHits())); }
  const g1 = await ev(() => guards());
  R.patrol = { moved: g1.map((g, i) => Math.hypot(g.x - g0[i].x, g.y - g0[i].y) > 50), states: g1.map(g => g.state), maxSuspicion: Math.max(...g1.map(g => g.suspicion)), guardsInWalls: maxWall };
  await shot('1-patrol');
  // C. hiding vs exposed: east guard; compare one-pulse gain
  const gainTest = async (x, y) => ev(async ([x, y]) => {
    const east = () => guards().find(g => g.id === 'guard-east');
    // put player within pulse radius of the east guard
    const e = east(); tp(x, y);
    const n = log.pulses.length; while (log.pulses.length === n) await new Promise(r => setTimeout(r, 5));
    const before = east().suspicion; await new Promise(r => setTimeout(r, 60));
    const pl = log.pulses.at(-1);
    return { hiding: pl.hidingAtEmission, radius: pl.radius, dist: Math.round(Math.hypot(e.x - pl.x, e.y - pl.y)), suspicion: east().suspicion };
  }, [x, y]);
  R.hidden = await gainTest(704, 288);   // east-cover (21-22, 8-9) center
  await ev(() => tp(80, 464)); await wait(9000); // let suspicion decay away
  R.exposed = await gainTest(624, 288);  // open floor next to cover
  await shot('2-pulse');
  // D. chase + catch: stand next to east guard
  R.chase = await ev(async () => {
    const t0 = performance.now(); let sawChase = false;
    while (GS.getGameState().status === 'playing' && performance.now() - t0 < 20000) {
      const e = guards().find(g => g.id === 'guard-east');
      if (e.state === 'chase') sawChase = true; else near(e);
      await new Promise(r => setTimeout(r, 50));
    }
    return { sawChase, status: GS.getGameState().status, caughtEvents: log.caught };
  });
  await shot('3-caught');
  const gc = await ev(() => guards()); await wait(1500);
  R.frozenWhenCaught = JSON.stringify(gc) === JSON.stringify(await ev(() => guards()));
  R.caughtEventsAfterWait = await ev(() => log.caught);
  // E. restart with R
  await p.keyboard.press('r'); await wait(800);
  R.afterRestart = await ev(() => ({ status: GS.getGameState().status, guards: guards(), views: views() }));
  R.restartPositionsMatch = JSON.stringify(R.afterRestart.guards) === JSON.stringify(R.initialGuards);
  await shot('4-restart-ready');
  // F. second run: patrol, pause, catch again
  await ev(() => window.dispatchEvent(new Event('hud-start-clicked'))); await wait(4000);
  const g2 = await ev(() => guards());
  R.run2Patrol = { status: await ev(() => GS.getGameState().status), states: g2.map(g => g.state), moved: g2.map((g, i) => Math.hypot(g.x - g0[i].x, g.y - g0[i].y) > 30), views: await ev(() => views()), guardsInWalls: await ev(() => wallHits()) };
  await ev(() => M().setPaused(true, 'harness')); const gp = await ev(() => guards()); await wait(1500);
  R.run2PausedIdle = JSON.stringify(gp) === JSON.stringify(await ev(() => guards()));
  await ev(() => M().setPaused(false));
  R.run2Catch = await ev(async () => {
    const before = log.caught; const p0 = log.pulses.length; const t0 = performance.now(); const trace = [];
    while (GS.getGameState().status === 'playing' && performance.now() - t0 < 20000) {
      const e = guards().find(g => g.id === 'guard-gallery');
      if (e.state !== 'chase') near(e);
      if (trace.length < 400) { const pl = GS.getGameState().player; trace.push([Math.round(performance.now()-t0), e.state, +e.suspicion.toFixed(2), Math.round(e.x), Math.round(e.y), Math.round(pl.x), Math.round(pl.y)]); }
      await new Promise(r => setTimeout(r, 50));
    }
    return { status: GS.getGameState().status, newCaughtEvents: log.caught - before, pulsesRun2: log.pulses.length - p0,
      lastPulse: log.pulses.at(-1), trace: trace.filter((_, i) => i % 20 === 0) };
  });
  await shot('5-run2-caught');
  R.errors = errs;
  console.log(JSON.stringify(R, null, 1));
  await b.close();
})();
