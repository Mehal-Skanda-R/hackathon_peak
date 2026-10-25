import { subscribeToGameState } from '../game/GameState.js';

export function initHUD() {
  const container = document.getElementById('hud-container');
  container.innerHTML = `
    <div style="position:absolute; top:10px; left:10px; color:lime; font-family:monospace; background:rgba(0,0,0,0.7); padding:10px; border: 1px solid lime; z-index:100;">
      <div id="hud-mode">MODE: TEST</div>
      <div id="hud-bpm">BPM: --</div>
      <div id="hud-status">STATUS: READY</div>
      <div id="hud-guards">GUARDS: --</div>
      <button id="start-btn" style="margin-top:10px; padding:5px 10px; background:lime; color:black; font-family:monospace; font-weight:bold; border:none; cursor:pointer;">START RUN</button>
      <button id="ble-btn" style="margin-top:10px; padding:5px 10px; background:cyan; color:black; font-family:monospace; font-weight:bold; border:none; cursor:pointer;">CONNECT BLE</button>
    </div>
  `;

  const modeEl = document.getElementById('hud-mode');
  const bpmEl = document.getElementById('hud-bpm');
  const statusEl = document.getElementById('hud-status');
  const guardsEl = document.getElementById('hud-guards');
  const startBtn = document.getElementById('start-btn');
  const bleBtn = document.getElementById('ble-btn');

  startBtn.addEventListener('click', () => window.dispatchEvent(new Event('hud-start-clicked')));
  bleBtn.addEventListener('click', () => window.dispatchEvent(new Event('hud-ble-clicked')));

  subscribeToGameState((state) => {
    modeEl.innerText = `MODE: ${state.sensor.mode.toUpperCase()}`;
    bpmEl.innerText = `BPM: ${state.sensor.bpm || '--'}`;
    statusEl.innerText = `STATUS: ${state.status.toUpperCase()}`;
    
    // Show guard states in the HUD
    const guardStatus = state.guards && state.guards.length > 0 
        ? state.guards.map(g => g.state).join(', ') 
        : '--';
    guardsEl.innerText = `GUARDS: ${guardStatus}`;

    startBtn.style.display = state.status === 'ready' ? 'block' : 'none';
    bleBtn.style.display = state.sensor.connected ? 'none' : 'block';
  });
}
