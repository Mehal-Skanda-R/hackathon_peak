import Phaser from 'phaser';
import MuseumScene from './game/MuseumScene.js';
import { getGameState, updateGameState } from './game/GameState.js';
import PulseSystem from './game/PulseSystem.js';
import PulseEffects from './game/PulseEffects.js';
import VisibilitySystem from './game/VisibilitySystem.js';
import GuardSystem from './game/GuardSystem.js';
import { initHUD } from './ui/hud.js';
import { subscribeToHeartRate, setSensorMode, connectHeartRate } from './sensor/heartRate.js';

class IntegrationScene extends Phaser.Scene {
    constructor() { super('IntegrationScene'); }
    create() {
        const museum = this.scene.get('MuseumScene');
        const mapGeometry = museum.getMapGeometry();
        
        const pulseSystem = new PulseSystem(museum);
        const visibilitySystem = new VisibilitySystem(museum, mapGeometry);
        const guardSystem = new GuardSystem(museum, mapGeometry);
        
        const pulseEffects = new PulseEffects(museum);
        pulseEffects.graphics.setDepth(51);

        museum.events.on('engine:state', (engineState) => {
            updateGameState(engineState);
        });

        // Wire Shyam's guards:caught event to Soham's catchPlayer API
        museum.events.on('guards:caught', () => {
            museum.catchPlayer();
        });

        // Pass pulses to the guard system only while playing
        museum.events.on('heartbeat:pulse', (pulse) => {
            if (getGameState().status === 'playing') {
                if (typeof guardSystem.handlePulse === 'function') guardSystem.handlePulse(pulse);
            }
        });

        museum.events.on('update', (time, delta) => {
            const state = getGameState();
            pulseSystem.update(delta, state.sensor, state);
            pulseEffects.update(delta);
            visibilitySystem.update(delta);
            
            // Update guards and push their state to the HUD
            if (state.status === 'playing') {
                guardSystem.update(delta, state.player);
            }
            updateGameState({ guards: guardSystem.getStates() });
        });

        window.addEventListener('hud-start-clicked', () => {
            if (getGameState().status === 'ready') museum.startRun();
        });

        window.addEventListener('hud-ble-clicked', async () => {
            try {
                setSensorMode('live');
                if (typeof connectHeartRate === 'function') {
                    await connectHeartRate();
                }
            } catch (err) {
                console.error('BLE Connection failed:', err);
            }
        });

        this.input.keyboard.on('keydown-SPACE', () => {
            if (getGameState().status === 'ready') museum.startRun();
        });

        subscribeToHeartRate((sensorState) => {
            updateGameState({ sensor: sensorState });
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

const game = new Phaser.Game(config);
game.events.once('ready', () => {
    game.scene.add('IntegrationScene', IntegrationScene, true);
});
