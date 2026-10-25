import Phaser from 'phaser';
import MuseumScene from './game/MuseumScene.js';
import { getGameState, updateGameState, isSensorUsable } from './game/GameState.js';
import PulseSystem from './game/PulseSystem.js';
import PulseEffects from './game/PulseEffects.js';
import VisibilitySystem from './game/VisibilitySystem.js';
import GuardSystem from './game/GuardSystem.js';
import { initHUD } from './ui/hud.js';
import { initHome } from './ui/home.js';
import { initAudio, playDoorVictory, toggleMute } from './ui/audio.js';
import { initEndScreens } from './ui/endscreens.js';
import { recordLevelComplete } from './ui/progress.js';
import { LEVELS } from './game/config.js';
import { subscribeToHeartRate, setSensorMode, connectHeartRate, setTestBpm } from './sensor/heartRate.js';

class IntegrationScene extends Phaser.Scene {
    constructor() { super('IntegrationScene'); }
    create() {
        const museum = this.scene.get('MuseumScene');
        
        let pulseSystem, visibilitySystem, guardSystem, pulseEffects;

        const initSystems = () => {
            if (visibilitySystem && typeof visibilitySystem.destroy === 'function') visibilitySystem.destroy();
            if (guardSystem && typeof guardSystem.destroy === 'function') guardSystem.destroy();
            if (pulseEffects && typeof pulseEffects.destroy === 'function') pulseEffects.destroy();
            if (pulseSystem && typeof pulseSystem.destroy === 'function') pulseSystem.destroy();
            
            // Each level has its own geometry; fetch it on every (re)build.
            const mapGeometry = museum.getMapGeometry();
            pulseSystem = new PulseSystem(museum);
            visibilitySystem = new VisibilitySystem(museum, mapGeometry);
            guardSystem = new GuardSystem(museum, mapGeometry);
            // Guards show only in pulse light, never in the dim ambient circle.
            guardSystem.setVisibilityProbe((x, y) => visibilitySystem.revealAt(x, y));
            pulseEffects = new PulseEffects(museum);
            pulseEffects.graphics.setDepth(51);
        };

        initSystems();

        museum.events.on('engine:ready', () => {
            initSystems();
        });

        // Show the whole museum for two seconds whenever a round starts.
        let lastStatus = museum.status;
        // The engine's first state was published before this scene existed;
        // seed the shared snapshot so the HUD shows the level before Start.
        updateGameState(museum.getState());
        museum.events.on('engine:state', (engineState) => {
            if (lastStatus === 'ready' && engineState.status === 'playing') visibilitySystem?.revealAll(2000, 500);
            lastStatus = engineState.status;
            updateGameState(engineState);
        });

        // Door: light the whole room for the animation, then auto-start the
        // next level once it is built (no way back, no extra Start click).
        museum.events.on('engine:door-locked', (s) => {
            window.dispatchEvent(new CustomEvent('hud-door-locked', { detail: s }));
        });
        museum.events.on('engine:door', () => {
            visibilitySystem?.revealAll(3000, 400);
            playDoorVictory();
        });
        // Campaign progress: finishing a floor unlocks the next one.
        museum.events.on('engine:level-complete', (s) => recordLevelComplete(s.level, s.coins, LEVELS.length));
        museum.events.on('engine:victory', (s) => recordLevelComplete(s.level, s.coins, LEVELS.length));

        // Home screen: play a floor (or continue the paused one); menu pauses play.
        const homeOpen = () => document.body.classList.contains('home-open');
        window.addEventListener('hud-play-level', (event) => {
            const level = event.detail;
            const state = getGameState();
            window.dispatchEvent(new Event('hud-hide-home'));
            if (state.status === 'paused' && state.pauseReason === 'Menu open' && state.level === level) {
                if (isSensorUsable(state.sensor)) museum.setPaused(false);
                return;
            }
            if (level === 1) setRunDeaths(0); // a fresh run
            museum.events.once('engine:ready', () => {
                if (isSensorUsable(getGameState().sensor)) museum.startRun();
            });
            museum.startAtLevel(level - 1);
        });
        window.addEventListener('hud-open-menu', () => {
            // A door transition must finish before opening another screen.
            if (getGameState().status === 'transition') return;
            if (getGameState().status === 'playing') museum.setPaused(true, 'Menu open');
            window.dispatchEvent(new Event('hud-show-home'));
        });

        museum.events.on('engine:level-complete', () => {
            museum.events.once('engine:ready', () => {
                if (isSensorUsable(getGameState().sensor)) museum.startRun();
            });
        });

        // Deaths in the current run (since the last start from level 1).
        let runDeaths = 0;
        const setRunDeaths = (n) => { runDeaths = n; updateGameState({ runDeaths }); };
        setRunDeaths(0);
        museum.events.on('engine:caught', () => setRunDeaths(runDeaths + 1));
        const startWhenReady = () => museum.events.once('engine:ready', () => {
            if (isSensorUsable(getGameState().sensor)) museum.startRun();
        });
        // End screens: Replay level, Restart from level 1, Home.
        window.addEventListener('hud-end-replay', () => { startWhenReady(); museum.restartRun(); });
        window.addEventListener('hud-end-restart', () => { setRunDeaths(0); startWhenReady(); museum.restartGame(); });
        window.addEventListener('hud-end-home', () => window.dispatchEvent(new Event('hud-show-home')));

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

            // While the start-of-level map is shown, everything waits: the thief
            // cannot move and no pulses fire or guards act.
            const previewing = Boolean(visibilitySystem?.isHolding());
            museum.setInputLocked(previewing);

            if (pulseSystem && !previewing) {
                const sensorData = { ...state.sensor, bpm: state.sensor.smoothedBpm || state.sensor.bpm };
                pulseSystem.update(delta, sensorData, state);
            }
            if (pulseEffects) pulseEffects.update(delta);
            if (visibilitySystem) visibilitySystem.update(delta);
            
            if (state.status === 'playing' && guardSystem && !previewing) {
                guardSystem.update(delta, state.player);
            }
            if (guardSystem) {
                updateGameState({ guards: guardSystem.getStates() });
            }
        });

        window.addEventListener('hud-start-clicked', () => {
            if (homeOpen()) return;
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
            // Caught: retry this level. Final victory: start again from level 1.
            if (status === 'victory') museum.restartGame();
            else museum.restartRun();
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
            if (homeOpen()) return;
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
initHome();
initEndScreens();
initAudio(); // after the HUD/home so their sound buttons get the saved mute state
window.addEventListener('hud-toggle-sound', () => toggleMute());

const game = new Phaser.Game(config);
game.events.once('ready', () => {
    game.scene.add('IntegrationScene', IntegrationScene, true);
});
