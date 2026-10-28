import { ACTS } from '../game/config.js';
import { subscribeToGameState } from '../game/GameState.js';
import { loadProgress, catacombProgress } from './progress.js';
import { ENDINGS } from '../story/script.js';

// Full-screen "Mission failed" (caught) and "Heist complete" (final victory)
// screens. The team's artwork is the backdrop, with its stat boxes and buttons
// erased; live stats and working buttons sit where they were. Positions are in
// artwork pixels and scale with it. Buttons dispatch window events for main.js.
const W = 1600, H = 900;
const box = ([l, t, r, b]) =>
  `left:${(l / W * 100).toFixed(3)}%;top:${(t / H * 100).toFixed(3)}%;width:${((r - l) / W * 100).toFixed(3)}%;height:${((b - t) / H * 100).toFixed(3)}%`;

const ICONS = {
  tower: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 44V18h4v-6h5v6h4v-8h2v8h4v-6h5v6h4v26z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M21 44v-9a3 3 0 0 1 6 0v9" fill="none" stroke="currentColor" stroke-width="2.4"/><rect x="22.5" y="23" width="3" height="5" rx="1.5" fill="currentColor"/></svg>',
  skull: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5C13 5 6 12 6 22c0 6 3 10 7 12v6h22v-6c4-2 7-6 7-12C42 12 35 5 24 5z" fill="currentColor"/><circle cx="17" cy="22" r="5" fill="#140405"/><circle cx="31" cy="22" r="5" fill="#140405"/><path d="M24 27l-3 5h6z" fill="#140405"/><path d="M18 40v-5M24 40v-5M30 40v-5" stroke="#140405" stroke-width="2"/></svg>',
  coins: '<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="currentColor" stroke="#3b2a06" stroke-width="1.4"><ellipse cx="30" cy="12" rx="12" ry="5"/><path d="M18 12v12c0 3 5 5 12 5s12-2 12-5V12c0 3-5 5-12 5s-12-2-12-5z"/><ellipse cx="16" cy="28" rx="12" ry="5"/><path d="M4 28v9c0 3 5 5 12 5s12-2 12-5v-9c0 3-5 5-12 5S4 31 4 28z"/></g></svg>',
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11l9-8 9 8M5 9v12h5v-7h4v7h5V9" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  replay: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  forward: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5l7 7-7 7M12 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const stat = (icon, cls, label, id) => `<div class="end-stat"><span class="end-icon ${cls}">${ICONS[icon]}</span>
  <span class="end-stat-text"><small>${label}</small><b id="${id}">--</b></span></div>`;

export function initEndScreens() {
  const el = document.createElement('section');
  el.id = 'end-screen';
  el.innerHTML = `
    <div class="end-art end-victory" id="end-victory" aria-label="Heist complete">
      <img src="/assets/screens/heist-complete.webp" alt="Heist complete. You conquered the castle." draggable="false">
      <div class="end-ending" id="end-v-ending" style="${box([470, 416, 1130, 460])}"></div>
      <div class="end-stats gold" style="${box([242, 474, 1358, 668])}">
        ${stat('tower', 'ivory', 'LEVELS FINISHED', 'end-v-levels')}
        ${stat('skull', 'red', 'TOTAL DEATHS', 'end-v-deaths')}
        ${stat('coins', 'gold', 'TOTAL COINS', 'end-v-coins')}
      </div>
      <button class="end-btn gold" id="end-v-home" style="${box([505, 722, 1095, 820])}">${ICONS.home}<span>RETURN TO HOME</span></button>
    </div>
    <div class="end-art end-failed" id="end-failed" aria-label="Mission failed">
      <img src="/assets/screens/mission-failed.webp" alt="Mission failed. You were caught." draggable="false">
      <div class="end-stats red" style="${box([405, 370, 1195, 530])}">
        ${stat('tower', 'ivory', 'LEVEL', 'end-f-level')}
        ${stat('skull', 'red', 'DEATHS', 'end-f-deaths')}
        ${stat('coins', 'gold', 'COINS', 'end-f-coins')}
      </div>
      <button class="end-btn red primary-red" id="end-f-replay" style="${box([543, 578, 1057, 662])}">${ICONS.replay}<span>REPLAY LEVEL</span></button>
      <button class="end-btn red" id="end-f-home" style="${box([409, 692, 718, 765])}">${ICONS.home}<span>HOME</span></button>
      <button class="end-btn red" id="end-f-restart" style="${box([753, 692, 1190, 765])}">${ICONS.forward}<span id="end-f-restart-label">RESTART FROM LEVEL 1</span></button>
    </div>
  `;
  document.body.appendChild(el);
  const $ = id => el.querySelector(`#${id}`);
  const fire = name => window.dispatchEvent(new Event(name));
  $('end-v-home').addEventListener('click', () => fire('hud-end-home'));
  $('end-f-home').addEventListener('click', () => fire('hud-end-home'));
  $('end-f-replay').addEventListener('click', () => fire('hud-end-replay'));
  $('end-f-restart').addEventListener('click', () => fire('hud-end-restart'));

  const pad = n => String(n).padStart(2, '0');
  subscribeToGameState(state => {
    const failed = state.status === 'caught';
    const won = state.status === 'victory';
    el.classList.toggle('show', failed || won);
    // The end screen lives outside the full-screen museum frame: leave full screen to show it.
    if ((failed || won) && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    $('end-failed').hidden = !failed;
    $('end-victory').hidden = !won;
    const deaths = state.runDeaths ?? 0;
    const coins = (state.coins ?? 0).toLocaleString();
    if (failed) {
      // Act III counts depths: "03" and "Restart from depth 1".
      $('end-f-level').textContent = pad(state.actFloor ?? state.level ?? 1);
      $('end-f-restart-label').textContent = state.actUnit === 'DEPTH' ? 'RESTART FROM DEPTH 1' : 'RESTART FROM LEVEL 1';
      $('end-f-deaths').textContent = pad(deaths);
      $('end-f-coins').textContent = coins;
    }
    if (won) {
      const act = ACTS.find(a => a.id === state.act) ?? ACTS[0];
      const floors = act.last - act.first + 1;
      const done = act.id === 1 ? Math.max(loadProgress().completed, state.level ?? 0) : catacombProgress().completed;
      $('end-v-levels').textContent = `${Math.min(done, floors)} / ${floors}`;
      const ending = ENDINGS[state.ending];
      $('end-v-ending').textContent = ending ? `ENDING · ${ending.title.toUpperCase()}${state.ending === 'last' ? ' · THE TRUE ENDING' : ''}` : '';
      $('end-v-ending').hidden = !ending;
      $('end-v-deaths').textContent = deaths;
      $('end-v-coins').textContent = coins;
    }
  });
}
