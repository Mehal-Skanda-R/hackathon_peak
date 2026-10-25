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
    <p id="objective">Reach the exit door.<br>Grab coins on the way.</p>
    <button class="primary" id="start-btn">Enter the museum <span>↗</span></button>
    <button class="primary resume" id="resume-btn" style="display:none">Resume the heist <span>▸</span></button>
    <button class="secondary" id="ble-btn">Connect heart-rate sensor <span>❤</span></button>
    <dl class="readout">
      <dt>LEVEL</dt><dd id="hud-level">--</dd>
      <dt>COINS</dt><dd id="hud-coins">--</dd>
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
      <li><span class="legend-icon gold">●</span><div><b>Coins</b><small>Collect enough to open the exit door</small></div></li>
      <li><span class="legend-icon gold">◇</span><div><b>The crystal</b><small>Final level only, in the vault</small></div></li>
      <li><span class="legend-icon guard">◉</span><div><b>The guards</b><small>Yellow coats. <b style="display:inline;color:#ffa133">?</b> suspicious, <b style="display:inline;color:#ff5d6c">!</b> chasing</small></div></li>
      <li><span class="legend-icon cover">❧</span><div><b>Cover</b><small>Hide inside the leafy green rugs</small></div></li>
      <li><span class="legend-icon exit">⇥</span><div><b>The exit door</b><small>Walk in to reach the next level. No way back.</small></div></li>
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
    <button class="primary" id="banner-start-btn">Enter the museum <span>↗</span></button>
    <button class="primary resume" id="banner-resume-btn">Resume the heist <span>▸</span></button>
    <button class="primary" id="restart-btn">Play again <span>↺</span></button>
    <button class="secondary" id="banner-ble-btn">Connect heart-rate sensor <span>❤</span></button>
    <div class="hint" id="round-hint"></div>
  `;
  game.appendChild(banner);

  // Coin goal chip over the canvas (also visible in full screen) and a short
  // notice when the player walks into a door that is still locked.
  const coinChip = document.createElement('div');
  coinChip.id = 'coin-chip';
  coinChip.setAttribute('aria-live', 'polite');
  game.appendChild(coinChip);
  const doorNotice = document.createElement('div');
  doorNotice.id = 'door-notice';
  doorNotice.setAttribute('role', 'status');
  game.appendChild(doorNotice);
  let noticeTimer = null;
  window.addEventListener('hud-door-locked', event => {
    const s = event.detail;
    const missing = Math.max(0, s.coinsRequired - s.levelCoins);
    doorNotice.textContent = missing > 0
      ? `Door locked: collect ${missing} more coin${missing === 1 ? '' : 's'}`
      : 'Door locked: take the crystal first';
    doorNotice.classList.add('show');
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => doorNotice.classList.remove('show'), 1800);
  });

  const $ = id => document.getElementById(id);
  const fire = (name, detail) => window.dispatchEvent(
    detail === undefined ? new Event(name) : new CustomEvent(name, { detail }));
  $('start-btn').addEventListener('click', () => fire('hud-start-clicked'));
  $('resume-btn').addEventListener('click', () => fire('hud-resume-clicked'));
  $('restart-btn').addEventListener('click', () => fire('hud-restart-clicked'));
  $('banner-start-btn').addEventListener('click', () => fire('hud-start-clicked'));
  $('banner-resume-btn').addEventListener('click', () => fire('hud-resume-clicked'));
  $('banner-ble-btn').addEventListener('click', () => fire('hud-ble-clicked'));
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
    if (document.body.classList.contains('home-open')) return; // home screen is up
    if ((event.key === 'f' || event.key === 'F') && !event.repeat && !event.ctrlKey && !event.metaKey) toggleFullscreen();
  });
  $('sound-btn').addEventListener('click', () => fire('hud-toggle-sound'));
  // Both sound buttons (frame + home) follow the mute state.
  window.addEventListener('audio-muted-changed', event => {
    for (const el of document.querySelectorAll('#sound-btn, #home-sound .sound-label')) {
      el.textContent = el.id === 'sound-btn'
        ? (event.detail ? '♪ SOUND OFF' : '♪ SOUND ON') : (event.detail ? 'SOUND OFF' : 'SOUND ON');
    }
  });
  $('menu-btn').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    fire('hud-open-menu');
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
      playing: state.hasArtefact ? 'Crystal taken · get to the exit door' : 'Heist in progress',
      transition: 'Through the door…',
      paused: `Paused · ${state.pauseReason ?? 'input unavailable'}`,
      caught: 'Caught by a guard',
      victory: 'Escaped with the crystal',
    }[state.status] ?? state.status;
    $('hud-status').textContent = statusText;
    const dot = $('status-dot');
    dot.classList.toggle('warn', state.status === 'paused' || (state.status === 'ready' && !usable));
    dot.classList.toggle('bad', state.status === 'caught');

    const coinGoal = state.coinsRequired ?? 0;
    const coinsLeft = Math.max(0, coinGoal - (state.levelCoins ?? 0));
    $('objective').innerHTML = coinsLeft > 0
      ? `Collect ${coinGoal} coins to open the exit door.<br>${coinsLeft} to go. No way back.`
      : state.needsArtefact && !state.hasArtefact
        ? 'Coins done. Take the crystal by the door,<br>then escape.'
        : 'The exit door is open.<br>Get through it.';
    const levelLabel = state.level ? `${state.level} / ${state.levelCount} · ${state.levelName}` : '--';
    $('hud-level').textContent = levelLabel;
    // Frame title above the game: "MUSEUM FLOOR · LEVEL 03 · THE GALLERY HALL".
    if (state.level) {
      $('frame-level').textContent = `MUSEUM FLOOR · LEVEL ${String(state.level).padStart(2, '0')}`
        + ` · ${state.levelName.toUpperCase()}`;
    }
    $('hud-coins').textContent = state.level
      ? `${state.levelCoins} / ${coinGoal} needed (${state.levelCoinTotal} here) · ${state.coins} total` : '--';
    const showChip = state.level && ['playing', 'paused', 'ready'].includes(state.status);
    coinChip.style.display = showChip ? 'flex' : 'none';
    coinChip.classList.toggle('done', coinsLeft === 0);
    if (state.doorOpen) doorNotice.classList.remove('show'); // stale "locked" notice
    const note = coinsLeft > 0 ? `${coinsLeft} more to open the door`
      : state.needsArtefact && !state.hasArtefact ? 'now take the crystal' : '✓ door open';
    coinChip.innerHTML = `<span class="coin-row"><span class="coin-dot"></span><span class="coin-label">COINS</span>`
      + `<b>${coinsLeft > 0 ? `${state.levelCoins} / ${coinGoal}` : state.levelCoins}</b></span>`
      + `<span class="coin-note">${note}</span>`;

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

    // On-canvas screen for every non-playing state (also visible in full screen),
    // so the dark museum is never a silent black box.
    const sensorHint = usable ? null
      : sensor.stale ? (live && !sensor.connected ? 'Connect the heart-rate sensor.'
        : 'Waiting for a heart-rate signal…')
      : `Calibrating your resting heart rate (~${live ? 20 : 3}s)…`;
    const screen = {
      ready: {
        eyebrow: state.level ? `LEVEL ${state.level} OF ${state.levelCount} · ${state.levelName.toUpperCase()}` : 'THE MUSEUM JOB',
        title: usable ? 'Ready when you are.' : 'Waiting for heart-rate input.',
        subtitle: sensorHint ?? (state.needsArtefact
          ? `Collect ${state.coinsRequired} coins and take the crystal, then escape through the exit door.`
          : `Collect ${state.coinsRequired} coins to open the exit door. There is no way back.`),
        button: 'banner-start-btn', hint: usable ? 'OR PRESS SPACE' : '', tone: 'victory',
      },
      paused: {
        eyebrow: 'HEIST PAUSED',
        title: 'Paused.',
        subtitle: (state.pauseReason ? `${state.pauseReason}. ` : '')
          + (sensorHint ?? 'Input is back. Resume when you are ready.'),
        button: 'banner-resume-btn', hint: usable ? 'OR PRESS SPACE' : '', tone: 'victory',
      },
      caught: {
        eyebrow: 'OPERATION FAILED', title: 'Caught.',
        subtitle: `A guard got you on level ${state.level ?? 1}. Try this level again.`,
        button: 'restart-btn', hint: 'OR PRESS R', tone: 'caught',
      },
      victory: {
        eyebrow: 'OPERATION COMPLETE', title: 'You escaped.',
        subtitle: `The golden heart of the museum is yours, with ${state.coins ?? 0} coins. Play again starts from level 1.`,
        button: 'restart-btn', hint: 'OR PRESS R', tone: 'victory',
      },
    }[state.status];
    banner.style.display = screen ? 'flex' : 'none';
    if (screen) {
      $('round-eyebrow').textContent = screen.eyebrow;
      $('round-title').textContent = screen.title;
      $('round-title').className = screen.tone;
      $('round-subtitle').textContent = screen.subtitle;
      $('round-hint').textContent = screen.hint;
      for (const id of ['banner-start-btn', 'banner-resume-btn', 'restart-btn']) {
        $(id).style.display = id === screen.button ? 'flex' : 'none';
      }
      $('banner-start-btn').disabled = !usable;
      $('banner-resume-btn').disabled = !usable;
      const waiting = state.status === 'ready' || state.status === 'paused';
      banner.classList.toggle('waiting', waiting);
      // Reachable in full screen too, where the side panel is hidden.
      $('banner-ble-btn').style.display = waiting && live && !sensor.connected ? 'flex' : 'none';
    }
  });
}
