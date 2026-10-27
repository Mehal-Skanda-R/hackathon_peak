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
    const level = guards.some(g => g.state === 'chase') ? 'chase'
      : guards.some(g => g.state === 'suspicious') ? 'suspicious' : '';
    if (vignette.dataset.level !== level) vignette.dataset.level = level;
  });
}
