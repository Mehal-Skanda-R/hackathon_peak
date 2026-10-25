import Phaser from 'phaser';
import MuseumScene from './game/MuseumScene.js';
import { getGameState, updateGameState } from './game/GameState.js';
import PulseSystem from './game/PulseSystem.js';
import PulseEffects from './game/PulseEffects.js';
import VisibilitySystem from './game/VisibilitySystem.js';
import { initHUD } from './ui/hud.js';

class IntegrationScene extends Phaser.Scene {
    constructor() { super('IntegrationScene'); }
    create() {
        const museum = this.scene.get('MuseumScene');
        const mapGeometry = museum.getMapGeometry();
        
        const pulseSystem = new PulseSystem(museum);
        const visibilitySystem = new VisibilitySystem(museum, mapGeometry);
        // PulseEffects sits on top of the darkness
        const pulseEffects = new PulseEffects(museum);
        pulseEffects.graphics.setDepth(51);

        museum.events.on('engine:state', (engineState) => {
            updateGameState(engineState);
        });

        museum.events.on('update', (time, delta) => {
            const state = getGameState();
            pulseSystem.update(delta, state.sensor, state);
            pulseEffects.update(delta);
            visibilitySystem.update(delta);
        });

        window.addEventListener('hud-start-clicked', () => {
            if (getGameState().status === 'ready') museum.startRun();
        });

        this.input.keyboard.on('keydown-SPACE', () => {
            if (getGameState().status === 'ready') museum.startRun();
        });

        this.time.addEvent({
            delay: 3000, loop: true,
            callback: () => {
                const s = getGameState().sensor;
                const newBpm = s.bpm === 75 ? 120 : 75;
                updateGameState({ sensor: { ...s, bpm: newBpm, pulseDelta: newBpm === 75 ? 0 : 20 }});
            }
        });
    }
}

const config = {
    type: Phaser.AUTO,
    width: 800, height: 544,
    parent: 'game-container', pixelArt: true,
    physics: { default: 'arcade', arcade: { debug: false } },
    scene: [MuseumScene]
};

initHUD();
updateGameState({ sensor: { mode: 'test', bpm: 75, pulseDelta: 0, connected: false } });

const game = new Phaser.Game(config);
game.events.once('ready', () => {
    game.scene.add('IntegrationScene', IntegrationScene, true);
});
