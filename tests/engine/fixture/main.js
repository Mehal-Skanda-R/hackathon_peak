// Test-only bootstrap. Mehal owns the production bootstrap and sensor gating.
import Phaser from 'phaser';
import MuseumScene, { ENGINE_EVENTS } from '../../../src/game/MuseumScene.js';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../../../src/game/config.js';

window.engineEvents = [];
class TestScene extends MuseumScene {
  create() {
    // Install subscribers before initial STATE/READY; remove them on each shutdown.
    const listeners = Object.values(ENGINE_EVENTS).map(event => {
      const listener = state => {
        window.engineEvents.push({ event, state });
        document.querySelector('#status').textContent = state.status
          + (state.pauseReason ? ` (${state.pauseReason})` : '');
        document.querySelector('#objective').textContent = state.hasArtefact
          ? 'The crystal is yours. Return to the marked exit.'
          : 'Find the crystal. Take it. Get back to the exit.';
      };
      this.events.on(event, listener);
      return [event, listener];
    });
    this.events.once('shutdown', () => {
      for (const [event, listener] of listeners) this.events.off(event, listener);
    });
    super.create();
  }
}

const game = new Phaser.Game({
  // This art/engine fixture uses no WebGL masks. Canvas avoids embedded-browser
  // GPU context loss leaving a white, disabled drawing surface after play.
  // Production keeps its own WebGL renderer for the visibility system.
  type: Phaser.CANVAS, parent: 'game', width: WORLD_WIDTH, height: WORLD_HEIGHT,
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 } } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [TestScene],
});
window.__ENGINE_TEST__ = game;
const scene = () => game.scene.getScene('MuseumScene');
document.querySelector('#start').onclick = () => scene().startRun();
document.querySelector('#pause').onclick = () => scene().setPaused(true, 'engine test');
document.querySelector('#resume').onclick = () => scene().setPaused(false);
document.querySelector('#catch').onclick = () => scene().catchPlayer();
document.querySelector('#restart').onclick = () => scene().restartRun();
if (import.meta.hot) import.meta.hot.dispose(() => game.destroy(true));
