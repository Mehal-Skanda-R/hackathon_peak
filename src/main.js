import Phaser from 'phaser';
import MuseumScene from './game/MuseumScene.js';
import { getGameState, updateGameState, isSensorUsable } from './game/GameState.js';
import PulseSystem from './game/PulseSystem.js';
import PulseEffects from './game/PulseEffects.js';
import VisibilitySystem from './game/VisibilitySystem.js';
import GuardSystem from './game/GuardSystem.js';
import { initHUD } from './ui/hud.js';
import { subscribeToHeartRate, setSensorMode, connectHeartRate, setTestBpm } from './sensor/heartRate.js';

class IntegrationScene extends Phaser.Scene {
    constructor() { super('IntegrationScene'); }
    create() {
        const museum = this.scene.get('MuseumScene');
        const mapGeometry = museum.getMapGeometry();
        
        let pulseSystem, visibilitySystem, guardSystem, pulseEffects;

        const initSystems = () => {
            if (visibilitySystem && typeof visibilitySystem.destroy === 'function') visibilitySystem.destroy();
            if (guardSystem && typeof guardSystem.destroy === 'function') guardSystem.destroy();
            if (pulseEffects && typeof pulseEffects.destroy === 'function') pulseEffects.destroy();
            if (pulseSystem && typeof pulseSystem.destroy === 'function') pulseSystem.destroy();
            
            pulseSystem = new PulseSystem(museum);
            visibilitySystem = new VisibilitySystem(museum, mapGeometry);
            guardSystem = new GuardSystem(museum, mapGeometry);
            pulseEffects = new PulseEffects(museum);
            pulseEffects.graphics.setDepth(51);
        };

        initSystems();

        museum.events.on('engine:ready', () => {
            initSystems();
        });

        museum.events.on('engine:state', (engineState) => {
            updateGameState(engineState);
        });

        museum.events.on('guards:caught', () => {
            museum.catchPlayer();
        });

        museum.events.on('heartbeat:pulse', (pulse) => {
            if (getGameState().status === 'playing' && guardSystem) {
                if (typeof guardSystem.handlePulse === 'function') guardSystem.handlePulse(pulse);
            }
        });

        museum.events.on('update', (time, delta) => {
            const state = getGameState();
            
            if (state.status === 'playing' && !isSensorUsable(state.sensor)) {
                museum.setPaused(true, 'Sensor input lost or stale');
            }

            if (pulseSystem) {
                const sensorData = { ...state.sensor, bpm: state.sensor.smoothedBpm || state.sensor.bpm };
                pulseSystem.update(delta, sensorData, state);
            }
            if (pulseEffects) pulseEffects.update(delta);
            if (visibilitySystem) visibilitySystem.update(delta);
            
            if (state.status === 'playing' && guardSystem) {
                guardSystem.update(delta, state.player);
            }
            if (guardSystem) {
                updateGameState({ guards: guardSystem.getStates() });
            }
        });

        window.addEventListener('hud-start-clicked', () => {
            const state = getGameState();
            if (state.status === 'ready' && isSensorUsable(state.sensor)) museum.startRun();
        });

        // Explicit resume only; setPaused(false) itself refuses terminal states.
        window.addEventListener('hud-resume-clicked', () => {
            const state = getGameState();
            if (state.status === 'paused' && isSensorUsable(state.sensor)) museum.setPaused(false);
        });

        // PLAY AGAIN: full round reset (scene restart recreates player, artefact,
        // guards, pulses and darkness via engine:ready), then start immediately
        // if the sensor is still usable; otherwise wait in ready for Start.
        window.addEventListener('hud-restart-clicked', () => {
            const { status } = getGameState();
            if (status !== 'caught' && status !== 'victory') return;
            museum.events.once('engine:ready', () => {
                if (isSensorUsable(getGameState().sensor)) museum.startRun();
            });
            museum.restartRun();
        });

        window.addEventListener('hud-test-mode-clicked', () => setSensorMode('test'));
        // Step from the chosen value, not the jittered reading; TestSensor clamps 40..200.
        let testBpm = 72;
        window.addEventListener('hud-test-bpm', (event) => {
            testBpm = Math.max(40, Math.min(200, testBpm + event.detail));
            setTestBpm(testBpm);
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
            const { status } = getGameState();
            if (status === 'ready') window.dispatchEvent(new Event('hud-start-clicked'));
            else if (status === 'paused') window.dispatchEvent(new Event('hud-resume-clicked'));
        });

        subscribeToHeartRate((sensorState) => {
            updateGameState({ sensor: sensorState });
        });

        setSensorMode('test');
        setTestBpm(72);
    }
}

const config = {
    type: Phaser.AUTO,
    width: 800, height: 544,
    parent: 'game-container', pixelArt: true,
    // Fit the 800x544 world into the frame (and the whole screen in full screen).
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { debug: false } },
    scene: [MuseumScene]
};

initHUD();

const game = new Phaser.Game(config);
game.events.once('ready', () => {
    game.scene.add('IntegrationScene', IntegrationScene, true);
});
