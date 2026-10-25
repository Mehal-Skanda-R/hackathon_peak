import { LEVELS } from '../game/config.js';
import { getGameState } from '../game/GameState.js';
import { loadProgress } from './progress.js';

// Home screen: night-time castle whose floors are the levels. Presentation
// only; buttons dispatch window events that src/main.js turns into engine calls.
const FLOOR_H = 62;
const TOWER = { x: 190, width: 240, bottom: 640 };
const floorY = level => TOWER.bottom - level * FLOOR_H; // level is 1-based

const lockIcon = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="8" rx="1.5"/><path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none"/></svg>';

function seeded(i) {
  const n = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function castleSvg() {
  const stars = Array.from({ length: 70 }, (_, i) =>
    `<circle cx="${(seeded(i) * 620).toFixed(1)}" cy="${(seeded(i + 99) * 300).toFixed(1)}" r="${(0.4 + seeded(i + 7) * 1.2).toFixed(2)}" opacity="${(0.3 + seeded(i + 3) * 0.6).toFixed(2)}"/>`).join('');
  const floors = LEVELS.map((level, i) => {
    const n = i + 1, y = floorY(n);
    const arches = Array.from({ length: 6 }, (_, k) => {
      const ax = TOWER.x + 18 + k * 36;
      return `<path class="arch" d="M${ax} ${y + 50} v-24 a10 10 0 0 1 20 0 v24 z"/>`;
    }).join('');
    return `<g class="floor" data-level="${n}">
      <rect class="floor-body" x="${TOWER.x}" y="${y}" width="${TOWER.width}" height="${FLOOR_H}"/>
      <rect class="floor-glow" x="${TOWER.x + 8}" y="${y + 10}" width="${TOWER.width - 16}" height="${FLOOR_H - 14}"/>
      ${arches}
      <rect class="floor-ledge" x="${TOWER.x - 8}" y="${y + FLOOR_H - 5}" width="${TOWER.width + 16}" height="6"/>
    </g>`;
  }).join('');
  const top = floorY(LEVELS.length);
  return `<svg class="castle" viewBox="0 0 620 720" role="img" aria-label="Castle tower; each floor is a level">
    <defs>
      <radialGradient id="moonGlow"><stop offset="0" stop-color="#e9f1ff" stop-opacity=".55"/><stop offset="1" stop-color="#e9f1ff" stop-opacity="0"/></radialGradient>
      <linearGradient id="stone" x1="0" x2="1"><stop offset="0" stop-color="#1a2229"/><stop offset=".5" stop-color="#26313a"/><stop offset="1" stop-color="#141b20"/></linearGradient>
      <linearGradient id="warm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffcf73"/><stop offset="1" stop-color="#b9661d"/></linearGradient>
    </defs>
    <g class="stars">${stars}</g>
    <circle cx="150" cy="120" r="90" fill="url(#moonGlow)"/>
    <circle class="moon" cx="150" cy="120" r="44"/>
    <ellipse class="cloud" cx="120" cy="150" rx="90" ry="12"/><ellipse class="cloud" cx="470" cy="90" rx="110" ry="10"/>
    <path class="mountains" d="M0 560 L80 470 L150 520 L240 430 L330 500 L420 440 L520 520 L620 460 L620 720 L0 720Z"/>
    <!-- side turrets -->
    <rect class="turret" x="130" y="${top + 90}" width="52" height="${TOWER.bottom - top - 90}"/>
    <path class="roof" d="M124 ${top + 92} L156 ${top + 10} L188 ${top + 92}Z"/>
    <rect class="turret" x="438" y="${top + 120}" width="52" height="${TOWER.bottom - top - 120}"/>
    <path class="roof" d="M432 ${top + 122} L464 ${top + 40} L496 ${top + 122}Z"/>
    <path class="flag" d="M156 ${top + 10} v-26 l22 8 -22 8"/><path class="flag" d="M464 ${top + 40} v-26 l22 8 -22 8"/>
    <rect class="slit" x="152" y="${top + 150}" width="8" height="18" rx="4"/><rect class="slit" x="460" y="${top + 180}" width="8" height="18" rx="4"/>
    <!-- tower crown -->
    <path class="roof" d="M${TOWER.x - 6} ${top} L${TOWER.x + TOWER.width / 2} ${top - 120} L${TOWER.x + TOWER.width + 6} ${top}Z"/>
    <path class="roof small" d="M${TOWER.x + 10} ${top} L${TOWER.x + 40} ${top - 70} L${TOWER.x + 70} ${top}Z"/>
    <path class="roof small" d="M${TOWER.x + TOWER.width - 70} ${top} L${TOWER.x + TOWER.width - 40} ${top - 70} L${TOWER.x + TOWER.width - 10} ${top}Z"/>
    <path class="flag" d="M${TOWER.x + TOWER.width / 2} ${top - 120} v-30 l26 9 -26 9"/>
    ${floors}
    <!-- stairs and balustrade -->
    <path class="stairs" d="M${TOWER.x + 70} ${TOWER.bottom} h100 l20 40 h-140z"/>
    <rect class="balustrade" x="0" y="${TOWER.bottom + 34}" width="620" height="10"/>
    ${Array.from({ length: 26 }, (_, k) => `<rect class="baluster" x="${6 + k * 24}" y="${TOWER.bottom + 44}" width="8" height="26" rx="3"/>`).join('')}
    <rect class="balustrade" x="0" y="${TOWER.bottom + 68}" width="620" height="8"/>
  </svg>`;
}

export function initHome() {
  const home = document.createElement('section');
  home.id = 'home';
  home.setAttribute('aria-label', 'Heartbeat Heist home');
  home.innerHTML = `
    <div class="home-left">
      <div class="home-logo">
        <svg viewBox="0 0 42 30" aria-hidden="true"><path d="M1 16h9l5-12 7 23 6-15 4 4h9" /></svg>
        <span>HEARTBEAT<br>HEIST</span>
      </div>
      <nav class="home-menu">
        <button data-view="play" id="home-play"><span class="ico">▷</span><span id="home-play-label">PLAY</span></button>
        <button data-view="floors" class="active"><span class="ico">◇</span>FLOORS</button>
        <button data-view="intel"><span class="ico">☰</span>HOW TO PLAY</button>
      </nav>
      <p class="home-tag">Your heartbeat reveals the world.<br>It also reveals you.</p>
    </div>
    <div class="home-stage">${castleSvg()}</div>
    <div class="home-right">
      <p class="home-series">THE MUSEUM HEIST SERIES</p>
      <div class="home-columns">
        <ol class="floor-list" id="floor-list"></ol>
        <aside class="home-panel" id="home-panel"></aside>
      </div>
    </div>
  `;
  document.body.appendChild(home);
  const list = home.querySelector('#floor-list');
  const panel = home.querySelector('#home-panel');
  let selected = null;
  let view = 'floors';

  const play = level => window.dispatchEvent(new CustomEvent('hud-play-level', { detail: level }));

  const render = () => {
    const progress = loadProgress();
    const state = getGameState();
    const resumable = state.status === 'paused' && state.pauseReason === 'Menu open';
    selected ??= progress.unlocked;
    home.querySelector('#home-play-label').textContent = resumable ? `CONTINUE · FLOOR ${String(state.level).padStart(2, '0')}` : 'PLAY';
    list.innerHTML = [...LEVELS].map((level, i) => ({ level, n: i + 1 })).reverse().map(({ level, n }) => {
      const status = n <= progress.completed ? 'done' : n <= progress.unlocked ? 'open' : 'locked';
      const icon = status === 'done' ? '✓' : status === 'open' ? '▸' : lockIcon;
      return `<li><button class="floor-card ${status} ${n === selected ? 'selected' : ''}" data-level="${n}" ${status === 'locked' ? 'disabled' : ''}
        aria-label="Floor ${n}: ${level.name}${status === 'locked' ? ' (locked)' : ''}">
        <span class="floor-dots" aria-hidden="true"></span>
        <span class="floor-text"><small>FLOOR ${String(n).padStart(2, '0')}</small>${level.name}</span>
        <span class="floor-state">${icon}</span></button></li>`;
    }).join('');
    for (const g of home.querySelectorAll('.floor')) {
      const n = Number(g.dataset.level);
      g.classList.toggle('lit', n <= progress.unlocked);
      g.classList.toggle('selected', n === selected);
    }
    const pct = Math.round(progress.completed / LEVELS.length * 100);
    panel.innerHTML = view === 'intel' ? `
      <h3>HOW TO PLAY</h3>
      <ul class="intel">
        <li><b>Move</b> W A S D or arrow keys.</li>
        <li><b>Your heartbeat</b> sends out pulses that light up the dark museum and alert nearby guards. A faster heart rate means bigger pulses.</li>
        <li><b>Hide</b> in the green rugs. Stay hidden for 3 s and guards give up.</li>
        <li><b>Coins</b> are optional loot. The <b>exit door</b> takes you up a floor. There is no way back.</li>
        <li><b>Floor 07</b>: take the crystal by the door, then escape.</li>
      </ul>` : `
      <div class="panel-castle" aria-hidden="true">♜</div>
      <h3>SELECT A FLOOR</h3>
      <p class="panel-label">Progress</p>
      <p class="panel-value">${progress.completed} / ${LEVELS.length}</p>
      <div class="panel-bar"><span style="width:${Math.max(4, pct)}%"></span></div>
      <p class="panel-label">Best coins</p><p class="panel-value">${progress.bestCoins}</p>
      <p class="panel-note">Infiltrate higher floors, face tougher security, and steal the crown crystal.</p>
      <button class="primary" id="home-start">Enter floor ${String(selected).padStart(2, '0')} <span>↗</span></button>`;
    panel.querySelector('#home-start')?.addEventListener('click', () => play(selected));
    for (const b of home.querySelectorAll('.home-menu button')) b.classList.toggle('active', b.dataset.view === view);
  };

  list.addEventListener('click', event => {
    const card = event.target.closest('.floor-card');
    if (!card || card.disabled) return;
    const n = Number(card.dataset.level);
    if (n === selected) play(n); else { selected = n; render(); }
  });
  list.addEventListener('dblclick', event => {
    const card = event.target.closest('.floor-card');
    if (card && !card.disabled) play(Number(card.dataset.level));
  });
  home.querySelector('.home-menu').addEventListener('click', event => {
    const b = event.target.closest('button');
    if (!b) return;
    if (b.dataset.view === 'play') {
      const state = getGameState();
      const resumable = state.status === 'paused' && state.pauseReason === 'Menu open';
      play(resumable ? state.level : loadProgress().unlocked);
      return;
    }
    view = b.dataset.view;
    render();
  });

  const show = () => { selected = null; view = 'floors'; render(); document.body.classList.add('home-open'); };
  const hide = () => document.body.classList.remove('home-open');
  window.addEventListener('hud-show-home', show);
  window.addEventListener('hud-hide-home', hide);
  show();
}
