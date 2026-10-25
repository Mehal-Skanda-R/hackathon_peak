import Phaser from 'phaser';
import Player from './Player.js';
import { createMuseumArt } from './MuseumArt.js';
import { SCENE_KEY, WORLD_WIDTH, WORLD_HEIGHT, WALLS,
  ARTEFACT, EXIT, MAP_GEOMETRY, canOccupy, hasLineOfSight } from './config.js';

export const ENGINE_EVENTS = Object.freeze({
  READY: 'engine:ready', STATE: 'engine:state', PICKUP: 'engine:artefact-collected',
  VICTORY: 'engine:victory', CAUGHT: 'engine:caught',
});

export default class MuseumScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEY);
  }

  create() {
    this.status = 'ready';
    this.pauseReason = null;
    this.hasArtefact = false;
    this.restartPending = false;
    this.lastSnapshot = null;
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBackgroundColor(0x080f13);
    const art = createMuseumArt(this);
    this.worldArt = art.background;
    this.artefactVisual = art.artefact;
    this.exitVisual = art.exit;
    this.exit = this.add.rectangle(EXIT.x + EXIT.width / 2, EXIT.y + EXIT.height / 2,
      EXIT.width, EXIT.height).setVisible(false);
    this.physics.add.existing(this.exit, true);

    this.walls = this.physics.add.staticGroup();
    for (const wall of WALLS) {
      const object = this.add.rectangle(wall.x + wall.width / 2, wall.y + wall.height / 2,
        wall.width, wall.height).setVisible(false);
      this.walls.add(object);
    }
    this.artefact = this.add.rectangle(ARTEFACT.x, ARTEFACT.y, ARTEFACT.size, ARTEFACT.size)
      .setVisible(false);
    this.physics.add.existing(this.artefact, true);
    this.player = new Player(this);
    this.physics.add.collider(this.player, this.walls);
    this.physics.add.overlap(this.player, this.artefact, this.collectArtefact, undefined, this);
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
    this.publishState(true);
    this.events.emit(ENGINE_EVENTS.READY, this.getState());
  }

  // Engine subset only. Mehal aggregates it into the shared GameState.
  getState() {
    return Object.freeze({ status: this.status, hasArtefact: this.hasArtefact,
      pauseReason: this.pauseReason, player: this.getPlayerState() });
  }

  getPlayerState() { return this.player.getState(); }
  getMapGeometry() { return MAP_GEOMETRY; }
  canOccupy(x, y, width, height) { return canOccupy(x, y, width, height); }
  hasLineOfSight(from, to) { return hasLineOfSight(from, to); }

  collectArtefact() {
    if (this.status !== 'playing' || this.restartPending || this.hasArtefact) return false;
    this.hasArtefact = true;
    this.artefact.body.enable = false;
    this.artefactVisual.setVisible(false);
    this.exitVisual.setTint(0x8bffd0);
    this.events.emit(ENGINE_EVENTS.PICKUP, this.getState());
    this.publishState(true);
    return true;
  }

  tryExit() {
    if (!this.hasArtefact) return false;
    return this.finish('victory');
  }

  catchPlayer() { return this.finish('caught'); }

  finish(status) {
    if (this.status !== 'playing' || this.restartPending || !['victory', 'caught'].includes(status)) return false;
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
    // Phaser queues a restart until the next scene step. Freeze this run now.
    this.restartPending = true;
    this.player.update(false);
    this.physics.world.pause();
    this.scene.restart();
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
    this.player.update(this.status === 'playing');
  }
}
