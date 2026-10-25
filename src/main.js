import Phaser from 'phaser';
import MuseumScene from './game/MuseumScene.js';
import { getGameState, updateGameState } from './game/GameState.js';
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
            
            if (state.status === 'playing') {
                const s = state.sensor;
                const isUsable = s.mode === 'test' 
                    ? (s.calibrated && !s.stale && s.smoothedBpm !== null)
                    : (s.connected && s.calibrated && !s.stale && s.smoothedBpm !== null);
                
                if (!isUsable) {
                    museum.setPaused(true, 'Sensor input lost or stale');
                }
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
            const s = state.sensor;
            const canStart = s.mode === 'test'
                ? (s.calibrated && !s.stale && s.smoothedBpm !== null)
                : (s.connected && s.calibrated && !s.stale && s.smoothedBpm !== null);

            if (state.status === 'ready' && canStart) {
                museum.startRun();
            }
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
            const state = getGameState();
            if (state.status === 'ready') {
                window.dispatchEvent(new Event('hud-start-clicked'));
            }
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
    physics: { default: 'arcade', arcade: { debug: false } },
    scene: [MuseumScene]
};

initHUD();

const game = new Phaser.Game(config);
game.events.once('ready', () => {
    game.scene.add('IntegrationScene', IntegrationScene, true);
});
