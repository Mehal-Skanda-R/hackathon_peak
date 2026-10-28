import { subscribeToGameState } from '../game/GameState.js';

// Edge vignette over the canvas: amber while a guard is suspicious, a red
// pulse while one is chasing. Presentation only; also shown in full screen.
export function initDanger() {
  const vignette = document.createElement('div');
  vignette.id = 'danger-vignette';
  vignette.setAttribute('aria-hidden', 'true');
  document.getElementById('game-container').appendChild(vignette);
  subscribeToGameState(state => {
    const guards = state.status === 'playing' ? (state.guards ?? []) : [];
    // The Warden hunting or searching is a constant amber threat; inspecting is red.
    const level = guards.some(g => g.state === 'chase' || g.state === 'inspect') ? 'chase'
      : guards.some(g => ['suspicious', 'hunt', 'search'].includes(g.state)) ? 'suspicious' : '';
    if (vignette.dataset.level !== level) vignette.dataset.level = level;
  });
}
