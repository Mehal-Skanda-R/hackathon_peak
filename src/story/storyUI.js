import { subscribeToGameState } from '../game/GameState.js';
import { INTEL, wallet, hasIntel } from '../ui/progress.js';

// On-canvas story panels (also visible in full screen): the Heart Lock meter
// and The Inspection meter from state.story (StorySystem), plus the intel
// shop on a floor's ready screen. Presentation only; buttons dispatch window
// events that src/main.js handles.
export function initStoryUI() {
  const game = document.getElementById('game-container');
  const panel = document.createElement('div');
  panel.id = 'story-panel';
  panel.setAttribute('aria-live', 'polite');
  game.appendChild(panel);

  // Intel row inside the ready banner (src/ui/hud.js builds the banner first).
  const intel = document.createElement('div');
  intel.id = 'intel-row';
  intel.innerHTML = `<span class="intel-title">INTEL · <b id="intel-wallet">0</b> coins banked</span>
    ${Object.entries(INTEL).map(([id, item]) => `<button class="intel-btn" data-intel="${id}" title="${item.detail}">
      ${item.name} <small>${item.cost}</small></button>`).join('')}`;
  document.getElementById('round-banner')?.insertBefore(intel, document.getElementById('round-hint'));
  intel.addEventListener('click', event => {
    const button = event.target.closest('[data-intel]');
    if (button) window.dispatchEvent(new CustomEvent('hud-buy-intel', { detail: button.dataset.intel }));
  });

  // Progress is read only when the floor or the purchases change.
  let shopKey = '';
  window.addEventListener('hud-intel-changed', () => { shopKey = ''; });

  const bar = (value, cls = '') => `<span class="story-bar ${cls}"><i style="width:${Math.round(Math.min(1, Math.max(0, value)) * 100)}%"></i></span>`;
  let last = '';
  subscribeToGameState(state => {
    const story = state.status === 'playing' ? state.story : null;
    let html = '';
    if (story?.inspection) {
      const s = story.inspection;
      const strikes = Array.from({ length: s.maxStrikes }, (_, i) => i < s.strikes ? '●' : '○').join(' ');
      html = `<b class="story-panel-title danger">THE INSPECTION</b>
        <span>Keep your heart within <b>+8</b> of baseline. He leaves in <b>${(s.leftMs / 1000).toFixed(1)} s</b>.</span>
        <span>Your heart <b class="${s.delta > 8 ? 'loud' : 'quiet'}">+${s.delta}</b> · loud beats ${strikes}</span>`;
    } else if (story?.heartLock) {
      const l = story.heartLock;
      html = l.phase === 'raise'
        ? `<b class="story-panel-title">THE HEART LOCK</b>
          <span>Raise your heart rate to <b>+${l.raise}</b> above baseline. Now <b>+${l.delta}</b>.</span>
          ${bar(l.delta / l.raise)}
          <small>Or pick it slowly: stay at the case. ${bar(l.pick, 'slow')}</small>`
        : `<b class="story-panel-title">THE HEART LOCK · ARMED</b>
          <span>Now let it settle to <b>+${l.settle}</b> or less. Now <b>+${l.delta}</b>.</span>
          ${bar(l.settled, 'calm')}
          <small>Nearby cover counts. Slow pick ${bar(l.pick, 'slow')}</small>`;
    }
    if (html !== last) {
      last = html;
      panel.innerHTML = html;
      panel.classList.toggle('show', Boolean(html));
    }

    // Intel shop: only on a floor's ready screen.
    const ready = state.status === 'ready' && state.levelId;
    intel.style.display = ready ? 'flex' : 'none';
    if (!ready) shopKey = '';
    else if (shopKey !== state.levelId) {
      shopKey = state.levelId;
      const coins = wallet();
      intel.querySelector('#intel-wallet').textContent = String(coins);
      for (const button of intel.querySelectorAll('[data-intel]')) {
        const id = button.dataset.intel;
        const owned = hasIntel(state.levelId, id);
        button.classList.toggle('owned', owned);
        button.disabled = owned || coins < INTEL[id].cost;
        button.querySelector('small').textContent = owned ? '✓' : `${INTEL[id].cost}`;
      }
    }
  });
}
