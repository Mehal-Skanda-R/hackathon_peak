import Phaser from 'phaser';
import { PLAYER_SIZE, SPAWN, getHidingZone, movementVelocity } from './config.js';
import { thiefTexture } from './MuseumArt.js';

export default class Player extends Phaser.GameObjects.Sprite {
  constructor(scene, x = SPAWN.x, y = SPAWN.y) {
    super(scene, x, y, thiefTexture(scene, 'down', 0));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    this.body.setSize(PLAYER_SIZE, PLAYER_SIZE);
    // Apply the inset immediately: ready state pauses physics before its first step.
    this.body.updateFromGameObject();
    this.body.setCollideWorldBounds(true);
    this.body.setAllowGravity(false);
    this.facing = 'down';
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
    if (velocity.x) this.facing = velocity.x > 0 ? 'right' : 'left';
    else if (velocity.y) this.facing = velocity.y > 0 ? 'down' : 'up';
    const stride = velocity.x || velocity.y ? Math.floor(this.scene.time.now / 140) % 2 : 0;
    this.setTexture(thiefTexture(this.scene, this.facing, stride));
    if (this.hiding) this.setTint(0x91cdb7);
    else this.clearTint();
  }
}
