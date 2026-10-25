import { subscribeToGameState } from '../game/GameState.js';

export function initHUD() {
  const container = document.getElementById('hud-container');
  container.innerHTML = `
    <div style="position:absolute; top:10px; left:10px; color:lime; font-family:monospace; background:rgba(0,0,0,0.7); padding:10px; border: 1px solid lime;">
      <div id="hud-mode">MODE: TEST</div>
      <div id="hud-bpm">BPM: --</div>
      <div id="hud-status">STATUS: READY</div>
    </div>
  `;

  const modeEl = document.getElementById('hud-mode');
  const bpmEl = document.getElementById('hud-bpm');
  const statusEl = document.getElementById('hud-status');

  subscribeToGameState((state) => {
    modeEl.innerText = `MODE: ${state.sensor.mode.toUpperCase()}`;
    bpmEl.innerText = `BPM: ${state.sensor.bpm || '--'}`;
    statusEl.innerText = `STATUS: ${state.status.toUpperCase()}`;
  });
}
