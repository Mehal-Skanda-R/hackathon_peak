import Phaser from 'phaser';
import { getGameState, updateGameState } from './game/GameState.js';
import PulseSystem from './game/PulseSystem.js';
import PulseEffects from './game/PulseEffects.js';
import { initHUD } from './ui/hud.js';

class DemoScene extends Phaser.Scene {
    constructor() {
        super('DemoScene');
    }
    
    create() {
        this.pulseSystem = new PulseSystem(this);
        this.pulseEffects = new PulseEffects(this);
        
        updateGameState({
            status: 'playing',
            player: { x: 400, y: 272, hiding: false },
            sensor: { mode: 'test', bpm: 75, pulseDelta: 0 }
        });
        
        this.time.addEvent({
            delay: 3000,
            loop: true,
            callback: () => {
                const currentBpm = getGameState().sensor.bpm;
                const newBpm = currentBpm === 75 ? 120 : 75;
                const newDelta = currentBpm === 75 ? 20 : 0;
                updateGameState({
                    sensor: { mode: 'test', bpm: newBpm, pulseDelta: newDelta }
                });
            }
        });
    }
    
    update(time, delta) {
        const state = getGameState();
        this.pulseSystem.update(delta, state.sensor, state);
        this.pulseEffects.update(delta);
    }
}

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 544,
    parent: 'game-container',
    pixelArt: true,
    physics: {
        default: 'arcade',
        arcade: { debug: false }
    },
    scene: [DemoScene]
};

initHUD();
new Phaser.Game(config);
