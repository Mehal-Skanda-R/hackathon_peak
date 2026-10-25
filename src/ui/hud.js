import { subscribeToGameState, isSensorUsable } from '../game/GameState.js';

export function initHUD() {
  const container = document.getElementById('hud-container');
  container.innerHTML = `
    <div style="position:absolute; top:10px; left:10px; color:lime; font-family:monospace; background:rgba(0,0,0,0.7); padding:10px; border: 1px solid lime; z-index:100;">
      <div id="hud-mode">MODE: TEST</div>
      <div id="hud-bpm">BPM: --</div>
      <div id="hud-sensor">SENSOR: --</div>
      <div id="hud-status">STATUS: READY</div>
      <div id="hud-guards">GUARDS: --</div>
      <button id="start-btn" style="margin-top:10px; padding:5px 10px; background:lime; color:black; font-family:monospace; font-weight:bold; border:none; cursor:pointer;">START RUN</button>
      <button id="resume-btn" style="display:none; margin-top:10px; padding:5px 10px; background:gold; color:black; font-family:monospace; font-weight:bold; border:none; cursor:pointer;">RESUME</button>
      <div id="test-controls" style="margin-top:10px;">
        TEST BPM
        <button id="bpm-down" style="font-family:monospace; cursor:pointer;">-5</button>
        <button id="bpm-up" style="font-family:monospace; cursor:pointer;">+5</button>
      </div>
      <button id="test-btn" style="display:none; margin-top:10px; padding:5px 10px; background:#ccc; color:black; font-family:monospace; font-weight:bold; border:none; cursor:pointer;">USE TEST MODE</button>
      <button id="ble-btn" style="margin-top:10px; padding:5px 10px; background:cyan; color:black; font-family:monospace; font-weight:bold; border:none; cursor:pointer;">CONNECT BLE</button>
    </div>
  `;

  const modeEl = document.getElementById('hud-mode');
  const bpmEl = document.getElementById('hud-bpm');
  const statusEl = document.getElementById('hud-status');
  const guardsEl = document.getElementById('hud-guards');
  const startBtn = document.getElementById('start-btn');
  const bleBtn = document.getElementById('ble-btn');
  const sensorEl = document.getElementById('hud-sensor');
  const resumeBtn = document.getElementById('resume-btn');
  const testControls = document.getElementById('test-controls');
  const testBtn = document.getElementById('test-btn');

  startBtn.addEventListener('click', () => window.dispatchEvent(new Event('hud-start-clicked')));
  bleBtn.addEventListener('click', () => window.dispatchEvent(new Event('hud-ble-clicked')));
  resumeBtn.addEventListener('click', () => window.dispatchEvent(new Event('hud-resume-clicked')));
  testBtn.addEventListener('click', () => window.dispatchEvent(new Event('hud-test-mode-clicked')));
  // HUD buttons, not arrow keys: arrows move the player.
  const bump = delta => window.dispatchEvent(new CustomEvent('hud-test-bpm', { detail: delta }));
  document.getElementById('bpm-down').addEventListener('click', () => bump(-5));
  document.getElementById('bpm-up').addEventListener('click', () => bump(5));

  subscribeToGameState((state) => {
    modeEl.innerText = `MODE: ${state.sensor.mode.toUpperCase()}`;
    bpmEl.innerText = `BPM: ${state.sensor.bpm || '--'}`;
    const sensor = state.sensor;
    const usable = isSensorUsable(sensor);
    sensorEl.innerText = `SENSOR: ${usable ? 'READY'
      : sensor.stale ? (sensor.mode === 'live' && !sensor.connected ? 'NOT CONNECTED' : 'NO SIGNAL')
      : 'CALIBRATING (~45s)'}`;
    statusEl.innerText = `STATUS: ${state.status.toUpperCase()}`
      + (state.status === 'paused' && state.pauseReason ? ` (${state.pauseReason})` : '');
    
    // Show guard states in the HUD
    const guardStatus = state.guards && state.guards.length > 0 
        ? state.guards.map(g => g.state).join(', ') 
        : '--';
    guardsEl.innerText = `GUARDS: ${guardStatus}`;

    startBtn.style.display = state.status === 'ready' ? 'block' : 'none';
    startBtn.disabled = !usable;
    startBtn.style.opacity = usable ? '1' : '0.5';
    resumeBtn.style.display = state.status === 'paused' ? 'block' : 'none';
    resumeBtn.disabled = !usable;
    resumeBtn.style.opacity = usable ? '1' : '0.5';
    testControls.style.display = sensor.mode === 'test' ? 'block' : 'none';
    testBtn.style.display = sensor.mode === 'live' ? 'block' : 'none';
    bleBtn.style.display = state.sensor.connected ? 'none' : 'block';
  });
}
