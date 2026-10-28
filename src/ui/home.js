import { LEVELS, ACTS } from '../game/config.js';
import { getGameState } from '../game/GameState.js';
import { loadProgress, starText, formatTime, journalFound, endingsFound, act3Unlocked, catacombProgress, wallet } from './progress.js';
import { JOURNAL, ENDINGS } from '../story/script.js';

// Act I's seven floors have cards on the castle artwork; Act III's depths
// are listed in their own panel (not part of the artwork).
const ACT1 = LEVELS.slice(ACTS[0].first, ACTS[0].last + 1);
const ACT3 = ACTS[1];

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
  // Story buttons on the empty left side of the artwork, below How to play.
  archive: [68, 436, 312, 496],
  act3: [68, 512, 312, 572],
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
  const floorButtons = ACT1.map((level, i) => `<button class="hotspot floor-spot" data-level="${i + 1}"
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
      <button class="hotspot story-spot" id="home-archive" style="${place(SPOTS.archive)}" aria-label="Archive"></button>
      <button class="hotspot story-spot" id="home-act3" style="${place(SPOTS.act3)}" aria-label="Act III: The Catacombs"></button>
      <div class="home-progress" aria-label="Campaign progress">
        <h3 id="home-selected-floor"></h3>
        <p>Progress <strong id="home-progress-count"></strong></p>
        <div class="home-progress-bar" role="progressbar" aria-label="Completed floors" aria-valuemin="0"
          aria-valuemax="${ACT1.length}" aria-valuenow="0"><span></span></div>
        <p>Best coins <strong id="home-best-coins"></strong></p>
        <p class="home-progress-note" id="home-story-note">Finish floors to unlock the next.</p>
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
            <li><b>Floor 07</b>: the Golden Heart sits by the door behind the <b>Heart Lock</b>. Raise your heart rate, then let it settle (or pick it slowly). Take it, or leave clean.</li>
            <li><b>The Warden</b> hears every beat. Hide in cover and keep your heart within +8 of baseline while he listens.</li>
            <li><b>Story</b>: Wren talks you through on the radio. Find a journal page on every floor in pulse light. Coins you bank buy intel on a floor's ready screen.</li>
          </ul>
          <button class="primary" id="home-modal-close">Got it <span>✓</span></button>
        </div>
      </div>
      <div class="home-modal" id="home-archive-modal" hidden>
        <div class="home-modal-card wide">
          <h3>THE ARCHIVE · <span id="archive-count"></span></h3>
          <ol class="archive-pages" id="archive-pages"></ol>
          <h3>ENDINGS</h3>
          <ul class="archive-endings" id="archive-endings"></ul>
          <button class="primary" id="home-archive-close">Close <span>✓</span></button>
        </div>
      </div>
      <div class="home-modal" id="home-act3-modal" hidden>
        <div class="home-modal-card">
          <h3>${ACT3.operation} · ACT III · ${ACT3.name.toUpperCase()}</h3>
          <p class="act3-lead" id="act3-lead"></p>
          <div class="act3-depths" id="act3-depths"></div>
          <button class="secondary" id="home-act3-close">Close</button>
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
    return completed >= ACT1.length ? 1 : unlocked; // castle done: new run from floor 1
  };
  $('home-play').addEventListener('click', () => play(continueLevel()));
  $('home-enter').addEventListener('click', () => play(continueLevel()));
  $('home-floors').addEventListener('click', () => toast('Pick a floor on the right.'));
  $('home-howto').addEventListener('click', () => { $('home-modal').hidden = false; $('home-modal-close').focus(); });
  $('home-modal-close').addEventListener('click', () => { $('home-modal').hidden = true; });

  // Archive: journal pages found and endings reached.
  const renderArchive = () => {
    const found = journalFound();
    $('archive-count').textContent = `${found.size} / ${JOURNAL.length} PAGES`;
    $('archive-pages').innerHTML = JOURNAL.map((page, i) => {
      const level = LEVELS.find(l => l.id === page.level);
      const where = `${level.act === 1 ? 'Floor' : 'Depth'} ${String(level.act === 1 ? i + 1 : i - ACT3.first + 1).padStart(2, '0')} · ${level.name}`;
      return found.has(page.level)
        ? `<li class="found"><b>${page.title}</b><small>${where}</small><p>${page.text}</p></li>`
        : `<li><b>Missing page</b><small>${where}</small><p>Look for it in pulse light.</p></li>`;
    }).join('');
    const endings = endingsFound();
    $('archive-endings').innerHTML = Object.entries(ENDINGS).map(([id, ending]) =>
      `<li class="${endings[id] ? 'found' : ''}"><b>${endings[id] ? ending.title : '???'}</b><small>${ending.note}</small></li>`).join('');
  };
  $('home-archive').addEventListener('click', () => { renderArchive(); $('home-archive-modal').hidden = false; $('home-archive-close').focus(); });
  $('home-archive-close').addEventListener('click', () => { $('home-archive-modal').hidden = true; });

  // Act III: three depths, unlocked by escaping floor 07 with the Golden Heart.
  const renderAct3 = () => {
    const open = act3Unlocked();
    const deep = catacombProgress();
    const { floors = {} } = loadProgress();
    $('act3-lead').textContent = open
      ? "The Heart pulls you down the Bone Stair. Carry it to Aurel's shrine."
      : 'Locked. Escape floor 07 with the Golden Heart to open the stair.';
    $('act3-depths').innerHTML = LEVELS.slice(ACT3.first, ACT3.last + 1).map((level, i) => {
      const record = floors[ACT3.first + i + 1];
      const locked = !open || i + 1 > deep.unlocked;
      return `<button class="act3-depth ${locked ? 'locked' : ''}" data-level="${ACT3.first + i + 1}" ${locked ? 'disabled' : ''}>
        <small>DEPTH ${String(i + 1).padStart(2, '0')}${record ? ` · ${starText(record.stars)} · ${formatTime(record.bestMs)}` : ''}</small>
        <span>${level.name}</span><i aria-hidden="true">${locked ? '🔒' : i + 1 <= deep.completed ? '✓' : '▷'}</i></button>`;
    }).join('');
  };
  $('home-act3').addEventListener('click', () => { renderAct3(); $('home-act3-modal').hidden = false; $('home-act3-close').focus(); });
  $('home-act3-close').addEventListener('click', () => { $('home-act3-modal').hidden = true; });
  $('act3-depths').addEventListener('click', event => {
    const button = event.target.closest('.act3-depth:not(.locked)');
    if (button) { $('home-act3-modal').hidden = true; play(Number(button.dataset.level)); }
  });
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
    const { unlocked, completed, bestCoins, floors = {} } = loadProgress();
    const selected = continueLevel();
    // A paused Act III depth continues as "DEPTH 0N"; Act I floors as "FLOOR 0N".
    const deep = selected > ACT1.length;
    const floor = String(deep ? selected - ACT3.first : selected).padStart(2, '0');
    const unit = deep ? 'depth' : 'floor';
    $('home-play').innerHTML = `<span aria-hidden="true">▷</span><span>CONTINUE<small>${unit.toUpperCase()} ${floor}</small></span>`;
    $('home-play').setAttribute('aria-label', `Continue ${unit} ${floor}`);
    $('home-enter').textContent = `Enter ${unit} ${floor} ↗`;
    $('home-enter').setAttribute('aria-label', `Enter ${unit} ${floor}`);
    $('home-selected-floor').textContent = `${unit.toUpperCase()} ${floor} · ${LEVELS[selected - 1].name}`;
    $('home-progress-count').textContent = `${Math.min(completed, ACT1.length)} / ${ACT1.length}`;
    $('home-story-note').textContent = `Wallet ${wallet()} coins · Journal ${journalFound().size} / ${JOURNAL.length}`;
    $('home-archive').innerHTML = `<span aria-hidden="true">▤</span><span>ARCHIVE<small>${journalFound().size} / ${JOURNAL.length} PAGES</small></span>`;
    $('home-act3').innerHTML = `<span aria-hidden="true">${act3Unlocked() ? '↓' : '🔒'}</span><span>ACT III<small>THE CATACOMBS</small></span>`;
    $('home-act3').classList.toggle('locked', !act3Unlocked());
    $('home-best-coins').textContent = String(bestCoins);
    const bar = home.querySelector('.home-progress-bar');
    bar.setAttribute('aria-valuenow', String(completed));
    bar.firstElementChild.style.width = `${Math.min(1, completed / ACT1.length) * 100}%`;
    for (const button of home.querySelectorAll('.floor-spot')) {
      const level = Number(button.dataset.level);
      const locked = level > unlocked;
      button.classList.toggle('locked', locked);
      button.classList.toggle('selected', level === selected);
      button.classList.toggle('completed', level <= completed);
      button.setAttribute('aria-current', level === selected ? 'step' : 'false');
      button.querySelector('.floor-state').textContent = locked ? '🔒' : level === selected ? '▷' : level <= completed ? '✓' : '';
      // Best rating and time, once the floor has been cleared with this version.
      const record = floors[level];
      button.querySelector('.floor-label small').textContent = `FLOOR ${String(level).padStart(2, '0')}`
        + (record ? ` · ${starText(record.stars)} · ${formatTime(record.bestMs)}` : '');
    }
  };
  const show = () => {
    render();
    for (const id of ['home-modal', 'home-archive-modal', 'home-act3-modal']) $(id).hidden = true;
    document.body.classList.add('home-open');
  };
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
