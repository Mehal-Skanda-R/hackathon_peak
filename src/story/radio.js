import { CHARACTERS } from './script.js';
import { subscribeToGameState } from '../game/GameState.js';

// Radio panel over the canvas (top left, also in full screen): who is
// speaking and what they say, typed out, one line at a time. Lines queue so
// they never overwrite each other. Presentation only.
const CHARS_PER_SECOND = 70;
const HOLD_MS = 1600;      // plus reading time per character
const READ_MS_PER_CHAR = 30;

let panel = null;
const queue = [];
let busy = false;
let typing = null;
let generation = 0; // a cleared or newer line cancels the older line's timers

export function initRadio() {
  panel = document.createElement('div');
  panel.id = 'radio';
  panel.setAttribute('role', 'status');
  panel.setAttribute('aria-live', 'polite');
  panel.innerHTML = '<span class="radio-who"><i aria-hidden="true"></i><b></b><small></small></span><span class="radio-text"></span>';
  document.getElementById('game-container').appendChild(panel);
  // Keep the panel away from the thief: bottom left while they are in the top half.
  subscribeToGameState(state => {
    const low = (state.player?.y ?? 544) < 272;
    if (panel.classList.contains('low') !== low) panel.classList.toggle('low', low);
  });
  // A new floor (or a home visit) drops lines that no longer apply.
  window.addEventListener('hud-show-home', clearRadio);
}

export function clearRadio() {
  generation++;
  queue.length = 0;
  clearInterval(typing);
  busy = false;
  panel?.classList.remove('show');
}

// line: { text, who = 'wren' }. `fresh` drops lines still waiting in the
// queue (the one on screen finishes): used for a floor's opening line.
// `urgent` also cuts the line on screen: for moments that need it now.
export function say(line, { fresh = false, urgent = false } = {}) {
  if (!panel || !line?.text) return;
  if (fresh || urgent) queue.length = 0;
  queue.push(line);
  if (urgent) { generation++; next(); return; }
  if (!busy) next();
}

function next() {
  const line = queue.shift();
  if (!line) { busy = false; panel.classList.remove('show'); return; }
  busy = true;
  const gen = ++generation;
  const who = CHARACTERS[line.who ?? 'wren'] ?? CHARACTERS.wren;
  panel.style.setProperty('--radio-color', who.color);
  panel.querySelector('.radio-who b').textContent = who.name;
  panel.querySelector('.radio-who small').textContent = who.role;
  const textEl = panel.querySelector('.radio-text');
  textEl.textContent = '';
  panel.classList.add('show');
  let shown = 0;
  clearInterval(typing);
  const handle = setInterval(() => {
    if (gen !== generation) { clearInterval(handle); return; }
    shown = Math.min(line.text.length, shown + 2);
    textEl.textContent = line.text.slice(0, shown);
    if (shown >= line.text.length) {
      clearInterval(handle);
      setTimeout(() => { if (gen === generation) next(); }, HOLD_MS + line.text.length * READ_MS_PER_CHAR);
    }
  }, 2000 / CHARS_PER_SECOND);
  typing = handle;
}
