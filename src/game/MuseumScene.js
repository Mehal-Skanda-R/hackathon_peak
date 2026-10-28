import Phaser from 'phaser';
import Player from './Player.js';
import { createMuseumArt, coinTexture } from './MuseumArt.js';
import { SCENE_KEY, WORLD_WIDTH, WORLD_HEIGHT, WALLS, LEVELS, LEVEL, COINS, COINS_REQUIRED,
  ARTEFACT, SHRINE, EXIT, MAP_GEOMETRY, setLevel, actOf, canOccupy, hasLineOfSight } from './config.js';

const COIN_PICKUP_DISTANCE = 18;

export const ENGINE_EVENTS = Object.freeze({
  READY: 'engine:ready', STATE: 'engine:state', PICKUP: 'engine:artefact-collected',
  VICTORY: 'engine:victory', CAUGHT: 'engine:caught',
  COIN: 'engine:coin', DOOR: 'engine:door', LEVEL_COMPLETE: 'engine:level-complete',
  DOOR_LOCKED: 'engine:door-locked', SHRINE: 'engine:shrine',
});

export default class MuseumScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEY);
  }

  // data.level / data.coinsBefore carry progress across scene restarts.
  create(data = {}) {
    this.levelIndex = data.level ?? 0;
    this.coinsBefore = data.coinsBefore ?? 0;
    this.coinsCollected = 0;
    this.inputLocked = false;
    setLevel(this.levelIndex);
    this.status = 'ready';
    this.pauseReason = null;
    this.hasArtefact = false;
    // Story state (src/story): the Golden Heart's lock, a door the Warden has
    // sealed, Aurel's shrine, and coins taken by the rival thief.
    this.artefactLocked = Boolean(LEVEL.heartLock);
    this.doorSealed = false;
    this.shrineLit = false;
    this.rivalCoins = 0;
    this.restartPending = false;
    this.lastSnapshot = null;
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBackgroundColor(0x080f13);
    const art = createMuseumArt(this);
    this.worldArt = art.background;
    this.artefactVisual = art.artefact;
    this.exitVisual = art.exit;
    this.exitLeaf = art.exitLeaf;
    // The door stays shut (dimmed) until enough coins, and on the final level
    // the crystal, are carried.
    this.lastLockNotice = -Infinity;
    this.updateDoorLook();
    this.exit = this.add.rectangle(EXIT.x + EXIT.width / 2, EXIT.y + EXIT.height / 2,
      EXIT.width, EXIT.height).setVisible(false);
    this.physics.add.existing(this.exit, true);

    this.walls = this.physics.add.staticGroup();
    for (const wall of WALLS) {
      const object = this.add.rectangle(wall.x + wall.width / 2, wall.y + wall.height / 2,
        wall.width, wall.height).setVisible(false);
      this.walls.add(object);
    }
    this.coins = COINS.map(coin => this.add.image(coin.x, coin.y, coinTexture(this)).setDepth(3));
    this.tweens.add({ targets: this.coins, y: '-=2', duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.player = new Player(this);
    this.physics.add.collider(this.player, this.walls);
    if (ARTEFACT) {
      this.artefact = this.add.rectangle(ARTEFACT.x, ARTEFACT.y, ARTEFACT.size, ARTEFACT.size)
        .setVisible(false);
      this.physics.add.existing(this.artefact, true);
      this.physics.add.overlap(this.player, this.artefact, this.collectArtefact, undefined, this);
    }
    this.physics.add.overlap(this.player, this.exit, this.tryExit, undefined, this);

    this.restartKey = this.input.keyboard.addKey('R');
    // Event-driven so a down/up pair within one frame is not lost.
    this.restartKey.on('down', this.restartRun, this);
    // Keep state events aligned with the completed physics step.
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.publishState, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.publishState, this);
      // Only release engine-owned keys; integration may register other shortcuts.
      for (const key of [...Object.values(this.player.keys), this.restartKey]) {
        this.input.keyboard.removeKey(key, true, true);
      }
    });
    this.physics.world.pause();
    if (data.fromDoor) this.cameras.main.fadeIn(450, 0, 0, 0);
    this.publishState(true);
    this.events.emit(ENGINE_EVENTS.READY, this.getState());
  }

  // Engine subset only. Mehal aggregates it into the shared GameState.
  getState() {
    const act = actOf(this.levelIndex);
    return Object.freeze({ status: this.status, hasArtefact: this.hasArtefact,
      pauseReason: this.pauseReason, player: this.getPlayerState(),
      level: this.levelIndex + 1, levelCount: LEVELS.length, levelName: LEVEL.name, levelId: LEVEL.id,
      act: act.id, actName: act.name, operation: act.operation, actUnit: act.unit,
      actFloor: this.levelIndex - act.first + 1, actFloorCount: act.last - act.first + 1,
      finalFloor: Boolean(LEVEL.final),
      // The Golden Heart is optional (take it or leave it); the door never needs it.
      needsArtefact: false, heartLock: Boolean(LEVEL.heartLock), artefactLocked: this.artefactLocked,
      hasShrine: Boolean(SHRINE), shrineLit: this.shrineLit, doorSealed: this.doorSealed,
      coins: this.coinsBefore + this.coinsCollected,
      levelCoins: this.coinsCollected, levelCoinTotal: COINS.length, rivalCoins: this.rivalCoins,
      coinsRequired: COINS_REQUIRED, doorOpen: this.doorOpen() });
  }

  getPlayerState() { return this.player.getState(); }
  // Integration can hold the thief still (e.g. during the start-of-level map preview).
  setInputLocked(locked) { this.inputLocked = Boolean(locked); }
  getMapGeometry() { return MAP_GEOMETRY; }
  canOccupy(x, y, width, height) { return canOccupy(x, y, width, height); }
  hasLineOfSight(from, to) { return hasLineOfSight(from, to); }

  collectArtefact() {
    if (this.status !== 'playing' || this.restartPending || this.hasArtefact || this.artefactLocked) return false;
    this.hasArtefact = true;
    this.artefact.body.enable = false;
    this.artefactVisual.setVisible(false);
    this.updateDoorLook();
    this.events.emit(ENGINE_EVENTS.PICKUP, this.getState());
    this.publishState(true);
    return true;
  }

  // Story hooks (src/story/StorySystem.js).
  setArtefactLocked(locked) {
    this.artefactLocked = Boolean(locked);
    this.publishState(true);
  }

  setDoorSealed(sealed) {
    this.doorSealed = Boolean(sealed);
    this.updateDoorLook();
    this.publishState(true);
  }

  lightShrine() {
    if (!SHRINE || this.shrineLit || this.status !== 'playing') return false;
    this.shrineLit = true;
    this.updateDoorLook();
    this.events.emit(ENGINE_EVENTS.SHRINE, this.getState());
    this.publishState(true);
    return true;
  }

  // Coins still on the floor, for the rival thief.
  activeCoins() {
    return this.coins.filter(coin => coin.active && !coin.collected);
  }

  // The rival takes a coin: it is gone for the player, but never so many that
  // the door's coin requirement becomes impossible.
  takeCoinByRival(coin) {
    if (this.status !== 'playing' || !coin?.active || coin.collected) return false;
    if (this.activeCoins().length + this.coinsCollected - 1 < COINS_REQUIRED) return false;
    coin.collected = true;
    this.rivalCoins++;
    this.tweens.add({ targets: coin, scale: 0.2, alpha: 0, duration: 260, onComplete: () => coin.destroy() });
    this.publishState(true);
    return true;
  }

  // Entering the door ends the level: on to the next one (no way back), or the
  // end of the act on its final floor. The door needs this floor's coins, and
  // stays shut while the Warden has sealed it or before the shrine is lit.
  doorOpen() {
    return this.coinsCollected >= COINS_REQUIRED && (!SHRINE || this.shrineLit) && !this.doorSealed;
  }

  updateDoorLook() {
    if (this.doorOpen()) { this.exitLeaf.clearTint(); this.exitVisual.setTint(0x8bffd0); }
    else { this.exitLeaf.setTint(0x6f655c); this.exitVisual.clearTint(); }
  }

  tryExit() {
    if (this.status !== 'playing' || this.restartPending) return false;
    if (!this.doorOpen()) {
      // Overlap fires every frame; tell the HUD at most once a second.
      if (this.time.now - this.lastLockNotice > 1000) {
        this.lastLockNotice = this.time.now;
        this.events.emit(ENGINE_EVENTS.DOOR_LOCKED, this.getState());
      }
      return false;
    }
    return this.enterDoor();
  }

  enterDoor() {
    this.status = 'transition';
    this.pauseReason = null;
    this.player.update(false);
    this.physics.world.pause();
    this.events.emit(ENGINE_EVENTS.DOOR, this.getState());
    this.publishState(true);
    const door = { x: EXIT.x + EXIT.width / 2, y: EXIT.y + EXIT.height / 2 };
    const finalLevel = Boolean(LEVEL.final);
    // Door swings open, the thief walks in and disappears, the view fades out.
    this.tweens.add({ targets: this.exitLeaf, scaleX: 0.08, duration: 350, ease: 'Sine.easeInOut' });
    this.tweens.add({
      targets: this.player, x: door.x, y: door.y, duration: 450, delay: 150, ease: 'Sine.easeInOut',
      onComplete: () => this.tweens.add({
        targets: this.player, scale: 0.3, alpha: 0, duration: 400, ease: 'Quad.easeIn',
        onComplete: () => {
          this.tweens.add({ targets: this.exitLeaf, scaleX: 1, duration: 250 });
          this.cameras.main.fadeOut(400, 0, 0, 0);
          this.cameras.main.once('camerafadeoutcomplete', () => {
            if (finalLevel) {
              this.cameras.main.fadeIn(300, 0, 0, 0);
              this.finish('victory');
            } else {
              this.goToLevel(this.levelIndex + 1);
            }
          });
        },
      }),
    });
    return true;
  }

  goToLevel(index) {
    if (this.restartPending) return;
    this.restartPending = true;
    this.events.emit(ENGINE_EVENTS.LEVEL_COMPLETE, this.getState());
    this.scene.restart({ level: index, coinsBefore: this.coinsBefore + this.coinsCollected, fromDoor: true });
  }

  collectCoins() {
    const me = this.getPlayerState();
    for (const coin of this.coins) {
      if (!coin.active || coin.collected) continue;
      if (Math.hypot(coin.x - me.x, coin.y - me.y) > COIN_PICKUP_DISTANCE) continue;
      coin.collected = true;
      this.coinsCollected++;
      if (this.coinsCollected === COINS_REQUIRED) this.updateDoorLook();
      this.tweens.add({ targets: coin, scale: 1.8, alpha: 0, y: coin.y - 10, duration: 260, onComplete: () => coin.destroy() });
      this.events.emit(ENGINE_EVENTS.COIN, this.getState());
      this.publishState(true);
    }
  }

  catchPlayer() { return this.finish('caught'); }

  finish(status) {
    // Victory is reached from the final door's transition; capture only while playing.
    const allowed = status === 'victory' ? ['playing', 'transition'] : ['playing'];
    if (!allowed.includes(this.status) || this.restartPending || !['victory', 'caught'].includes(status)) return false;
    this.status = status;
    this.pauseReason = null;
    this.player.update(false);
    this.physics.world.pause();
    this.events.emit(status === 'victory' ? ENGINE_EVENTS.VICTORY : ENGINE_EVENTS.CAUGHT, this.getState());
    this.publishState(true);
    return true;
  }

  startRun() {
    // Sensor/calibration readiness is enforced by Mehal's caller, not duplicated here.
    if (this.status !== 'ready' || this.restartPending) return;
    this.status = 'playing';
    this.pauseReason = null;
    this.physics.world.resume();
    this.publishState(true);
  }

  setPaused(paused, reason = null) {
    if (this.restartPending) return;
    if (paused) {
      if (this.status !== 'playing' && this.status !== 'paused') return;
      this.status = 'paused';
      this.pauseReason = reason;
      this.physics.world.pause();
    } else {
      // A resume cannot bypass ready, caught or victory.
      if (this.status !== 'paused') return;
      this.status = 'playing';
      this.pauseReason = null;
      this.physics.world.resume();
    }
    this.player.update(false);
    this.publishState();
  }

  restartRun() {
    if (this.restartPending) return;
    if (this.status === 'transition') return; // never undo a door already entered
    if (this.status === 'victory') return this.restartGame(); // game finished: from level 1
    // Phaser queues a restart until the next scene step. Freeze this run now.
    this.restartPending = true;
    this.player.update(false);
    this.physics.world.pause();
    // Retry the current level, keeping coins banked from earlier levels.
    this.scene.restart({ level: this.levelIndex, coinsBefore: this.coinsBefore });
  }

  // Home screen floor selection: load a level directly (fresh coin count).
  startAtLevel(index) {
    if (this.restartPending) return;
    this.restartPending = true;
    this.player.update(false);
    this.physics.world.pause();
    this.scene.restart({ level: index, coinsBefore: 0 });
  }

  // Restart from the first floor of the current act (floor 01, or depth 01 in Act III).
  restartGame() {
    if (this.restartPending) return;
    this.restartPending = true;
    this.player.update(false);
    this.physics.world.pause();
    this.scene.restart({ level: actOf(this.levelIndex).first, coinsBefore: 0 });
  }

  publishState(force = false) {
    const state = this.getState();
    const serialized = JSON.stringify(state);
    if (force === true || serialized !== this.lastSnapshot) {
      this.lastSnapshot = serialized;
      this.events.emit(ENGINE_EVENTS.STATE, state);
    }
  }

  update() {
    if (this.restartPending) return;
    if (this.status === 'transition') return; // door animation owns the player
    this.player.update(this.status === 'playing' && !this.inputLocked);
    if (this.status === 'playing') this.collectCoins();
  }
}
