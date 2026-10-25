import { LEVELS } from '../game/config.js';
import { getGameState } from '../game/GameState.js';
import { loadProgress } from './progress.js';

// Home screen: the team's castle artwork (public/assets/home/home-screen.webp)
// with buttons laid over its labels. Progress is live UI over the artwork;
// the image's example counts/locks must never override saved progress. Presentation only;
// buttons dispatch window events that src/main.js turns into engine calls.
const ART = { src: '/assets/home/home-screen.webp', width: 1600, height: 901 };

// Label hotspots in image pixels: [left, top, right, bottom].
const SPOTS = {
  continue: [68, 178, 312, 246],
  floors: [48, 260, 332, 328],
  howto: [68, 343, 280, 412],
  enter: [1377, 620, 1563, 670],
  floor7: [975, 157, 1310, 226],
  floor6: [975, 247, 1310, 316],
  floor5: [975, 342, 1310, 411],
  floor4: [975, 432, 1310, 500],
  floor3: [975, 521, 1310, 590],
  floor2: [975, 613, 1310, 683],
  floor1: [975, 713, 1310, 782],
};

const place = ([left, top, right, bottom]) =>
  `left:${(left / ART.width * 100).toFixed(3)}%;top:${(top / ART.height * 100).toFixed(3)}%;`
  + `width:${((right - left) / ART.width * 100).toFixed(3)}%;height:${((bottom - top) / ART.height * 100).toFixed(3)}%`;

export function initHome() {
  const home = document.createElement('section');
  home.id = 'home';
  home.setAttribute('aria-label', 'Heartbeat Heist home');
  const floorButtons = LEVELS.map((level, i) => `<button class="hotspot floor-spot" data-level="${i + 1}"
    style="${place(SPOTS[`floor${i + 1}`].map((value, edge) => value + (edge < 2 ? -2 : 2)))}" aria-label="Floor ${i + 1}: ${level.name}">
    <span class="floor-label"><small>FLOOR ${String(i + 1).padStart(2, '0')}</small>${level.name}</span>
    <span class="floor-state" aria-hidden="true"></span></button>`).join('');
  home.innerHTML = `
    <div class="home-art">
      <img src="${ART.src}" alt="" draggable="false">
      <button class="hotspot" id="home-play" style="${place(SPOTS.continue)}" aria-label="Continue"></button>
      <button class="hotspot" id="home-floors" style="${place(SPOTS.floors)}" aria-label="Floors"></button>
      <button class="hotspot" id="home-howto" style="${place(SPOTS.howto)}" aria-label="How to play"></button>
      <button class="hotspot" id="home-enter" style="${place(SPOTS.enter)}" aria-label="Enter floor"></button>
      ${floorButtons}
      <div class="home-progress" aria-label="Campaign progress">
        <h3 id="home-selected-floor"></h3>
        <p>Progress <strong id="home-progress-count"></strong></p>
        <div class="home-progress-bar" role="progressbar" aria-label="Completed floors" aria-valuemin="0"
          aria-valuemax="${LEVELS.length}" aria-valuenow="0"><span></span></div>
        <p>Best coins <strong id="home-best-coins"></strong></p>
        <p class="home-progress-note">Finish floors to unlock the next.</p>
      </div>
      <div class="home-toast" id="home-toast" role="status" aria-live="polite"></div>
      <div class="home-modal" id="home-modal" hidden>
        <div class="home-modal-card">
          <h3>HOW TO PLAY</h3>
          <ul class="intel">
            <li><b>Move</b> W A S D or arrow keys.</li>
            <li><b>Your heartbeat</b> sends out pulses that light up the dark museum and alert nearby guards. A faster heart rate means bigger pulses.</li>
            <li><b>Hide</b> in the green rugs. Stay hidden for 3 s and guards give up.</li>
            <li><b>Coins</b>: each floor's <b>exit door</b> opens only after you collect enough of them (shown at the top of the game). The door takes you up a floor. There is no way back.</li>
            <li><b>Floor 07</b>: take the crystal by the door, then escape.</li>
          </ul>
          <button class="primary" id="home-modal-close">Got it <span>✓</span></button>
        </div>
      </div>
    </div>
    <button class="home-sound sound-btn" id="home-sound" aria-label="Toggle sound"><span class="sound-label">SOUND ON</span></button>
  `;
  document.body.appendChild(home);
  const $ = id => home.querySelector(`#${id}`);
  const play = level => window.dispatchEvent(new CustomEvent('hud-play-level', { detail: level }));
  let toastTimer = null;
  const toast = text => {
    const el = $('home-toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  };
  const resumable = () => {
    const s = getGameState();
    return s.status === 'paused' && s.pauseReason === 'Menu open';
  };

  const continueLevel = () => {
    if (resumable()) return getGameState().level;
    const { unlocked, completed } = loadProgress();
    return completed >= LEVELS.length ? 1 : unlocked; // castle done: new run from floor 1
  };
  $('home-play').addEventListener('click', () => play(continueLevel()));
  $('home-enter').addEventListener('click', () => play(continueLevel()));
  $('home-floors').addEventListener('click', () => toast('Pick a floor on the right.'));
  $('home-howto').addEventListener('click', () => { $('home-modal').hidden = false; $('home-modal-close').focus(); });
  $('home-modal-close').addEventListener('click', () => { $('home-modal').hidden = true; });
  $('home-sound').addEventListener('click', () => window.dispatchEvent(new Event('hud-toggle-sound')));
  for (const button of home.querySelectorAll('.floor-spot')) {
    button.addEventListener('click', () => {
      const level = Number(button.dataset.level);
      const { unlocked } = loadProgress();
      if (level > unlocked) toast(`Floor ${String(level).padStart(2, '0')} is locked. Finish floor ${String(level - 1).padStart(2, '0')} first.`);
      else play(level);
    });
  }

  const render = () => {
    const { unlocked, completed, bestCoins } = loadProgress();
    const selected = continueLevel();
    const floor = String(selected).padStart(2, '0');
    $('home-play').innerHTML = `<span aria-hidden="true">▷</span><span>CONTINUE<small>FLOOR ${floor}</small></span>`;
    $('home-play').setAttribute('aria-label', `Continue floor ${floor}`);
    $('home-enter').textContent = `Enter floor ${floor} ↗`;
    $('home-enter').setAttribute('aria-label', `Enter floor ${floor}`);
    $('home-selected-floor').textContent = `FLOOR ${floor} · ${LEVELS[selected - 1].name}`;
    $('home-progress-count').textContent = `${completed} / ${LEVELS.length}`;
    $('home-best-coins').textContent = String(bestCoins);
    const bar = home.querySelector('.home-progress-bar');
    bar.setAttribute('aria-valuenow', String(completed));
    bar.firstElementChild.style.width = `${completed / LEVELS.length * 100}%`;
    for (const button of home.querySelectorAll('.floor-spot')) {
      const level = Number(button.dataset.level);
      const locked = level > unlocked;
      button.classList.toggle('locked', locked);
      button.classList.toggle('selected', level === selected);
      button.classList.toggle('completed', level <= completed);
      button.setAttribute('aria-current', level === selected ? 'step' : 'false');
      button.querySelector('.floor-state').textContent = locked ? '🔒' : level === selected ? '▷' : level <= completed ? '✓' : '';
    }
  };
  const show = () => { render(); $('home-modal').hidden = true; document.body.classList.add('home-open'); };
  const hide = () => document.body.classList.remove('home-open');
  // While home is open, R must not restart the (paused) level behind it.
  window.addEventListener('keydown', event => {
    if (document.body.classList.contains('home-open') && (event.key === 'r' || event.key === 'R')) {
      event.stopPropagation();
    }
  }, { capture: true });
  window.addEventListener('hud-show-home', show);
  window.addEventListener('hud-hide-home', hide);
  show();
}
