import Phaser from 'phaser';
import { PLAYER_SIZE, SPAWN, getHidingZone, movementVelocity } from './config.js';

export default class Player extends Phaser.GameObjects.Rectangle {
  constructor(scene, x = SPAWN.x, y = SPAWN.y) {
    super(scene, x, y, PLAYER_SIZE, PLAYER_SIZE, 0x83f5ce);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    this.body.setSize(PLAYER_SIZE, PLAYER_SIZE);
    this.body.setCollideWorldBounds(true);
    this.body.setAllowGravity(false);
    this.keys = scene.input.keyboard.addKeys({
      w: 'W', a: 'A', s: 'S', d: 'D',
      up: 'UP', left: 'LEFT', down: 'DOWN', right: 'RIGHT',
    });
  }

  get hiding() {
    return getHidingZone(this.body.center.x, this.body.center.y) !== null;
  }

  getState() {
    // Body coordinates are current even inside an Arcade overlap callback,
    // before Phaser copies them back to the display object in postUpdate.
    return Object.freeze({ x: this.body.center.x, y: this.body.center.y, hiding: this.hiding });
  }

  update(enabled = true) {
    const k = this.keys;
    const velocity = enabled
      ? movementVelocity(k.a.isDown || k.left.isDown, k.d.isDown || k.right.isDown,
        k.w.isDown || k.up.isDown, k.s.isDown || k.down.isDown)
      : { x: 0, y: 0 };
    this.body.setVelocity(velocity.x, velocity.y);
    this.setFillStyle(this.hiding ? 0x39aeb7 : 0x83f5ce);
  }
}
