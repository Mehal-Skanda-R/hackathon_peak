import { subscribeToGameState } from '../game/GameState.js';

// First-time hints on floor 01: each shows once per browser, when its moment
// first happens, queued so they never overwrite each other. Presentation only.
const KEY = 'hh-hints-v1';
const HINTS = {
  pulse: 'Each heartbeat sends a pulse: it lights the room, and nearby guards hear it.',
  suspicious: 'A guard heard you (?). Duck into a green rug to hide.',
  hidden: 'Hidden. Stay put for 3 seconds and alerted guards give up.',
};
const SHOW_MS = 4500;

export function initHints(museum) {
  let seen = {};
  try { seen = JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { /* storage unavailable */ }
  const queue = [];
  let busyUntil = 0;
  let timer = null;

  const pump = () => {
    clearTimeout(timer);
    if (!queue.length) return;
    const wait = busyUntil - performance.now();
    if (wait > 0) { timer = setTimeout(pump, wait); return; }
    window.dispatchEvent(new CustomEvent('hud-notice', { detail: { text: queue.shift(), tone: 'hint', ms: SHOW_MS } }));
    busyUntil = performance.now() + SHOW_MS + 300;
    if (queue.length) timer = setTimeout(pump, SHOW_MS + 300);
  };
  const hint = id => {
    if (seen[id]) return;
    seen[id] = true;
    try { localStorage.setItem(KEY, JSON.stringify(seen)); } catch { /* ignore */ }
    queue.push(HINTS[id]);
    pump();
  };

  let floorOne = false;
  museum.events.on('heartbeat:pulse', () => { if (floorOne) hint('pulse'); });
  subscribeToGameState(state => {
    floorOne = state.level === 1 && state.status === 'playing';
    if (!floorOne) {
      // Leaving floor 01 (door, caught, menu) drops hints that never showed.
      if (state.level !== 1) queue.length = 0;
      return;
    }
    if ((state.guards ?? []).some(g => g.state === 'suspicious' || g.state === 'chase')) hint('suspicious');
    if (state.player?.hiding) hint('hidden');
  });
}
