import Phaser from 'phaser';

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 544,
    parent: 'game-container',
    pixelArt: true,
    physics: {
        default: 'arcade',
        arcade: { debug: false }
    }
};
const game = new Phaser.Game(config);
console.log('Engine initialized. Awaiting shared state and module wiring.');
