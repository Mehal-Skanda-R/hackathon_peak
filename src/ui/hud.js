import { subscribeToGameState, isSensorUsable } from '../game/GameState.js';

// Presentation only: renders the briefing panel, live readout, end-of-round
// screen and full-screen toggle. Buttons dispatch window events that
// src/main.js turns into engine/sensor calls; no game logic lives here.
const GUARD_WORDS = { patrol: 'patrolling', return: 'patrolling', suspicious: 'suspicious', chase: 'CHASING' };

export function initHUD() {
  const panel = document.getElementById('hud-container');
  panel.innerHTML = `
    <div class="briefing-top"><span class="eyebrow">YOUR ASSIGNMENT</span><span class="number">01</span></div>
    <div class="crystal" aria-hidden="true">◇</div>
    <h2>The golden<br>heart of the museum.</h2>
    <p id="objective">Find the crystal. Take it.<br>Get back to the exit.</p>
    <button class="primary" id="start-btn">Enter the museum <span>↗</span></button>
    <button class="primary resume" id="resume-btn" style="display:none">Resume the heist <span>▸</span></button>
    <button class="secondary" id="ble-btn">Connect heart-rate sensor <span>❤</span></button>
    <dl class="readout">
      <dt>HEART RATE</dt><dd><span class="bpm-big" id="hud-bpm">--</span><small class="bpm-unit"> BPM</small></dd>
      <dt>ABOVE BASELINE</dt><dd id="hud-delta">--</dd>
      <dt>SENSOR</dt><dd id="hud-sensor">--</dd>
      <dt>INPUT</dt><dd id="hud-mode">--</dd>
      <dt>GUARDS</dt><dd id="hud-guards">--</dd>
    </dl>
    <div class="rule"></div>
    <h3>KNOW YOUR SURROUNDINGS</h3>
    <ul class="legend">
      <li><span class="legend-icon thief">◈</span><div><b>The thief</b><small>Your cyan-cloaked character</small></div></li>
      <li><span class="legend-icon gold">◇</span><div><b>The prize</b><small>Touch the golden crystal</small></div></li>
      <li><span class="legend-icon guard">◉</span><div><b>The guards</b><small>Yellow coats. <b style="display:inline;color:#ffa133">?</b> suspicious, <b style="display:inline;color:#ff5d6c">!</b> chasing</small></div></li>
      <li><span class="legend-icon cover">❧</span><div><b>Cover</b><small>Hide inside the leafy green rugs</small></div></li>
      <li><span class="legend-icon exit">↙</span><div><b>Your way out</b><small>Return with the crystal to escape</small></div></li>
    </ul>
    <div class="dev-panel" id="dev-panel">
      <h3>DEVELOPER SIMULATOR · TEST</h3>
      <p>Simulated heart rate for development only. It is not real sensing.</p>
      <div class="dev-row" id="test-controls">SIM BPM
        <button id="bpm-down">−5</button><button id="bpm-up">+5</button>
      </div>
      <button class="secondary" id="test-btn" style="display:none">Use test simulator <span>⚙</span></button>
    </div>
  `;

  // End-of-round screen lives over the canvas (also visible in full screen).
  const game = document.getElementById('game-container');
  const banner = document.createElement('div');
  banner.id = 'round-banner';
  banner.innerHTML = `
    <p class="eyebrow" id="round-eyebrow"></p>
    <div id="round-title"></div>
    <div id="round-subtitle"></div>
    <button class="primary" id="restart-btn">Play again <span>↺</span></button>
    <div class="hint">OR PRESS R</div>
  `;
  game.appendChild(banner);

  const $ = id => document.getElementById(id);
  const fire = (name, detail) => window.dispatchEvent(
    detail === undefined ? new Event(name) : new CustomEvent(name, { detail }));
  $('start-btn').addEventListener('click', () => fire('hud-start-clicked'));
  $('resume-btn').addEventListener('click', () => fire('hud-resume-clicked'));
  $('restart-btn').addEventListener('click', () => fire('hud-restart-clicked'));
  $('ble-btn').addEventListener('click', () => fire('hud-ble-clicked'));
  $('test-btn').addEventListener('click', () => fire('hud-test-mode-clicked'));
  // Buttons, not arrow keys: arrows move the player.
  $('bpm-down').addEventListener('click', () => fire('hud-test-bpm', -5));
  $('bpm-up').addEventListener('click', () => fire('hud-test-bpm', 5));
  // A focused button would also "click" on Space, which starts/resumes the game.
  document.addEventListener('click', event => {
    if (event.target.closest('button')) event.target.closest('button').blur();
  });

  // Full screen: the museum frame (canvas + round screen) fills the display.
  const frame = $('museum-frame');
  const fullscreenBtn = $('fullscreen-btn');
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else frame.requestFullscreen?.().catch(() => {});
  };
  fullscreenBtn.addEventListener('click', toggleFullscreen);
  window.addEventListener('keydown', event => {
    if ((event.key === 'f' || event.key === 'F') && !event.repeat && !event.ctrlKey && !event.metaKey) toggleFullscreen();
  });
  document.addEventListener('fullscreenchange', () => {
    fullscreenBtn.innerHTML = document.fullscreenElement
      ? '✕ EXIT FULL SCREEN <kbd>F</kbd>' : '⛶ FULL SCREEN <kbd>F</kbd>';
    window.dispatchEvent(new Event('resize')); // let Phaser refit the canvas
  });

  const setClass = (el, cls) => { el.classList.remove('ok', 'warn', 'bad'); if (cls) el.classList.add(cls); };

  subscribeToGameState((state) => {
    const sensor = state.sensor;
    const usable = isSensorUsable(sensor);
    const live = sensor.mode === 'live';

    // Heading status
    const statusText = {
      ready: usable ? 'Ready · press Enter the museum' : 'Waiting for heart-rate input',
      playing: state.hasArtefact ? 'Crystal taken · get to the exit' : 'Heist in progress',
      paused: `Paused · ${state.pauseReason ?? 'input unavailable'}`,
      caught: 'Caught by a guard',
      victory: 'Escaped with the crystal',
    }[state.status] ?? state.status;
    $('hud-status').textContent = statusText;
    const dot = $('status-dot');
    dot.classList.toggle('warn', state.status === 'paused' || (state.status === 'ready' && !usable));
    dot.classList.toggle('bad', state.status === 'caught');

    $('objective').innerHTML = state.hasArtefact
      ? 'The crystal is yours.<br>Return to the marked exit.'
      : 'Find the crystal. Take it.<br>Get back to the exit.';

    // Readout
    $('hud-bpm').textContent = sensor.smoothedBpm ?? sensor.bpm ?? '--';
    $('hud-delta').textContent = sensor.calibrated
      ? `+${sensor.pulseDelta ?? 0} BPM (baseline ${sensor.baselineBpm})` : '--';
    const sensorEl = $('hud-sensor');
    if (usable) { sensorEl.textContent = 'Ready'; setClass(sensorEl, 'ok'); }
    else if (sensor.stale) {
      sensorEl.textContent = live && !sensor.connected ? 'Not connected' : 'No signal';
      setClass(sensorEl, 'bad');
    } else {
      sensorEl.textContent = `Calibrating (~${live ? 20 : 3}s)`;
      setClass(sensorEl, 'warn');
    }
    const modeEl = $('hud-mode');
    modeEl.textContent = live ? (sensor.connected ? 'LIVE · BLE sensor' : 'LIVE · no device') : 'TEST · simulator';
    setClass(modeEl, live ? (sensor.connected ? 'ok' : 'bad') : 'warn');
    const guards = state.guards ?? [];
    const guardsEl = $('hud-guards');
    guardsEl.textContent = guards.length
      ? guards.map(g => GUARD_WORDS[g.state] ?? g.state).join(' · ') : '--';
    setClass(guardsEl, guards.some(g => g.state === 'chase') ? 'bad'
      : guards.some(g => g.state === 'suspicious') ? 'warn' : null);

    // Buttons
    $('start-btn').style.display = state.status === 'ready' ? 'flex' : 'none';
    $('start-btn').disabled = !usable;
    $('resume-btn').style.display = state.status === 'paused' ? 'flex' : 'none';
    $('resume-btn').disabled = !usable;
    $('ble-btn').style.display = sensor.connected ? 'none' : 'flex';
    $('test-controls').style.display = live ? 'none' : 'flex';
    $('test-btn').style.display = live ? 'flex' : 'none';

    // End-of-round screen
    const ended = state.status === 'caught' || state.status === 'victory';
    banner.style.display = ended ? 'flex' : 'none';
    if (ended) {
      const caught = state.status === 'caught';
      $('round-eyebrow').textContent = caught ? 'OPERATION FAILED' : 'OPERATION COMPLETE';
      $('round-title').textContent = caught ? 'Caught.' : 'You escaped.';
      $('round-title').className = caught ? 'caught' : 'victory';
      $('round-subtitle').textContent = caught
        ? 'A guard got you. The crystal stays in the museum.'
        : 'The golden heart of the museum is yours.';
    }
  });
}
