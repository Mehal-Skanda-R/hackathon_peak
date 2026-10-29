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
import { recordLevelComplete, recordFloorResult, floorStars, starText, formatTime } from './ui/progress.js';
import { initDanger } from './ui/danger.js';
import { initHeartbeatSound, playHeartbeat } from './ui/heartbeatSound.js';
import { initHints } from './ui/hints.js';
import { LEVELS } from './game/config.js';
import { subscribeToHeartRate, setSensorMode, connectHeartRate, setTestBpm } from './sensor/heartRate.js';
import { initAfterHours } from './afterhours/ui.js';

// The optional mission sleeps the campaign. Its controls must never restart or
// advance the sleeping scene; Bluetooth continues through the one sensor facade.
const campaignEvent = (name, callback) => window.addEventListener(name, event => {
    if (!document.body.classList.contains('after-hours-open')) callback(event);
});

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

        // Floor clock and "spotted" flag for the floor rating; reset per floor.
        let floorMs = 0, floorSeconds = -1, spotted = false;
        const resetFloorClock = () => { floorMs = 0; spotted = false; floorSeconds = 0; updateGameState({ floorSeconds: 0 }); };
        resetFloorClock();

        museum.events.on('engine:ready', () => {
            initSystems();
            resetFloorClock();
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
        museum.events.on('engine:door', (s) => {
            visibilitySystem?.revealAll(3000, 400);
            const stars = floorStars({ allCoins: s.levelCoins >= s.levelCoinTotal, spotted });
            const record = recordFloorResult(s.level, { timeMs: floorMs, stars });
            window.dispatchEvent(new CustomEvent('hud-notice', { detail: {
                tone: 'cleared', ms: 3600,
                text: `Floor ${String(s.level).padStart(2, '0')} cleared · ${starText(stars)} · ${formatTime(floorMs)}`
                    + (record.newBest ? ' · best time!' : ''),
            } }));
            // Between floors the door plays the victory sound; on the final floor
            // it is saved for the Heist Complete screen (engine:victory below).
            if (s.level < s.levelCount) playDoorVictory();
        });
        // Campaign progress: finishing a floor unlocks the next one.
        museum.events.on('engine:level-complete', (s) => recordLevelComplete(s.level, s.coins, LEVELS.length));
        museum.events.on('engine:victory', (s) => {
            recordLevelComplete(s.level, s.coins, LEVELS.length);
            playDoorVictory(); // as the Heist Complete screen appears
        });

        // Home screen: play a floor (or continue the paused one); menu pauses play.
        const homeOpen = () => document.body.classList.contains('home-open');
        campaignEvent('hud-play-level', (event) => {
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
        campaignEvent('hud-open-menu', () => {
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
        campaignEvent('hud-end-replay', () => { startWhenReady(); museum.restartRun(); });
        campaignEvent('hud-end-restart', () => { setRunDeaths(0); startWhenReady(); museum.restartGame(); });
        campaignEvent('hud-end-home', () => window.dispatchEvent(new Event('hud-show-home')));

        museum.events.on('guards:caught', () => {
            museum.catchPlayer();
        });

        museum.events.on('heartbeat:pulse', (pulse) => {
            if (getGameState().status === 'playing' && guardSystem) {
                if (typeof guardSystem.handlePulse === 'function') guardSystem.handlePulse(pulse);
                // Louder, higher thump the more the pulse grew above its base size.
                playHeartbeat((pulse.radius - 100) / 160);
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
                const guards = guardSystem.getStates();
                if (state.status === 'playing' && guards.some(g => g.state === 'chase')) spotted = true;
                updateGameState({ guards });
            }
            // The floor clock runs only while the thief can actually play.
            if (state.status === 'playing' && !previewing) {
                floorMs += delta;
                const seconds = Math.floor(floorMs / 1000);
                if (seconds !== floorSeconds) { floorSeconds = seconds; updateGameState({ floorSeconds }); }
            }
        });

        campaignEvent('hud-start-clicked', () => {
            if (homeOpen()) return;
            const state = getGameState();
            if (state.status === 'ready' && isSensorUsable(state.sensor)) museum.startRun();
        });

        // Explicit resume only; setPaused(false) itself refuses terminal states.
        campaignEvent('hud-resume-clicked', () => {
            const state = getGameState();
            if (state.status === 'paused' && isSensorUsable(state.sensor)) museum.setPaused(false);
        });

        // PLAY AGAIN: full round reset (scene restart recreates player, artefact,
        // guards, pulses and darkness via engine:ready), then start immediately
        // if the sensor is still usable; otherwise wait in ready for Start.
        campaignEvent('hud-restart-clicked', () => {
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

        const notice = (text) => window.dispatchEvent(new CustomEvent('hud-notice', { detail: text }));
        window.addEventListener('hud-ble-clicked', async () => {
            // Safari/Firefox and plain http have no Web Bluetooth: say so instead
            // of switching to a LIVE mode that can never connect.
            if (!navigator.bluetooth) {
                notice('Bluetooth is not available here. Use Chrome or Edge on a desktop (https).');
                return;
            }
            const previousMode = getGameState().sensor.mode;
            try {
                setSensorMode('live');
                await connectHeartRate();
                notice('Heart-rate sensor connected. Calibrating…');
            } catch (err) {
                console.warn('BLE connection failed:', err);
                notice(err?.name === 'NotFoundError' ? 'No sensor selected.' : `Could not connect: ${err?.message ?? err}`);
                // A failed/cancelled connect returns to the simulator the player was using.
                if (previousMode === 'test') setSensorMode('test');
            }
        });

        // P or Esc pauses in place; pressing it again (or Space) resumes.
        const PAUSED_BY_PLAYER = 'Game paused';
        campaignEvent('keydown', (event) => {
            if (event.repeat || homeOpen() || !['p', 'P', 'Escape'].includes(event.key)) return;
            const state = getGameState();
            if (state.status === 'playing') museum.setPaused(true, PAUSED_BY_PLAYER);
            else if (state.status === 'paused' && state.pauseReason === PAUSED_BY_PLAYER) {
                window.dispatchEvent(new Event('hud-resume-clicked'));
            }
        });

        initHints(museum);

        this.input.keyboard.on('keydown-SPACE', () => {
            if (homeOpen() || document.body.classList.contains('after-hours-open')) return;
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
initDanger();
initAudio(); // after the HUD/home so their sound buttons get the saved mute state
initHeartbeatSound();
window.addEventListener('hud-toggle-sound', () => toggleMute());

const game = new Phaser.Game(config);
game.events.once('ready', () => {
    game.scene.add('IntegrationScene', IntegrationScene, true);
    initAfterHours(game);
});
