import Phaser from 'phaser';
import GuardSystem from '../game/GuardSystem.js';
import PulseSystem from '../game/PulseSystem.js';
import PulseEffects from '../game/PulseEffects.js';
import VisibilitySystem from '../game/VisibilitySystem.js';
import { thiefTexture, coinTexture } from '../game/MuseumArt.js';
import { movementVelocity } from '../game/config.js';
import { getHeartRateState } from '../sensor/heartRate.js';
import { isSensorUsable } from '../game/GameState.js';
import { playHeartbeat } from '../ui/heartbeatSound.js';
import { createAfterHoursArt } from './art.js';
import { GEAR, CURSES, SPAWN, TREASURE, EXIT, LOOT, SHIFTS, LASERS, ROUTES, LAMPS,
  makeMap, canFit, lineOfSight, hiddenAt, intersects, bodyAt, canShift, securityAt, pulseSettings, DirectorBudget } from './rules.js';
import { RunRecording, EchoPlayback } from './recording.js';

export default class AfterHoursScene extends Phaser.Scene {
  constructor() { super('AfterHoursScene'); }
  create(options = {}) {
    this.options = options; this.gear = GEAR[options.gearId] ?? GEAR.standard;
    this.curse = CURSES[options.curseId] ?? CURSES.bellheart;
    this.status = 'ready'; this.pauseReason = ''; this.elapsed = 0; this.variant = 0;
    this.hasArtefact = false; this.lootCount = 0; this.lastPulse = -Infinity; this.nextShift = 8000;
    this.directorClock = new DirectorBudget(); this.directorLane = 0;
    this.directorAttack = null; this.nearMisses = 0; this.nearMissCooldown = 0; this.lastUI = -100;
    this.map = makeMap(); this.recording = new RunRecording({ mapId: 'after-hours-v1', gear: this.gear.id,
      curse: this.curse.id, director: Boolean(options.director), input: getHeartRateState().mode });
    this.echo = new EchoPlayback(options.previous?.meta.outcome === 'caught' ? options.previous : null);
    createAfterHoursArt(this);
    this.wallBodies = this.physics.add.staticGroup();
    for (const wall of this.map.walls) {
      const object = this.add.rectangle(wall.x + wall.width / 2, wall.y + wall.height / 2, wall.width, wall.height).setVisible(false);
      this.wallBodies.add(object);
      if (wall === this.map.walls.at(-1)) this.shiftBody = object;
    }
    const sw = SHIFTS[0];
    this.shiftView = this.add.rectangle(sw.x + 16, sw.y + 16, 32, 32, 0x4b3b57).setStrokeStyle(2, 0xb898da).setDepth(3);
    this.player = this.physics.add.sprite(SPAWN.x, SPAWN.y, thiefTexture(this, 'up', 0)).setDepth(10);
    this.player.body.setSize(18, 18).setCollideWorldBounds(true).setAllowGravity(false);
    this.player.body.updateFromGameObject();
    this.physics.world.setBounds(0, 0, 800, 544);
    this.physics.add.collider(this.player, this.wallBodies);
    this.loot = LOOT.map(p => this.add.image(p.x, p.y, coinTexture(this)).setDepth(3));
    this.artefactView = this.add.graphics().setDepth(4);
    this.artefactView.fillStyle(this.curse.color, .16).fillCircle(TREASURE.x, TREASURE.y, 30);
    this.artefactView.lineStyle(2, this.curse.color, 1).strokeCircle(TREASURE.x, TREASURE.y, 23);
    this.artefactView.fillStyle(this.curse.color).fillPoints([
      { x: TREASURE.x, y: TREASURE.y - 17 }, { x: TREASURE.x + 12, y: TREASURE.y },
      { x: TREASURE.x, y: TREASURE.y + 17 }, { x: TREASURE.x - 12, y: TREASURE.y },
    ], true);
    this.exitGlow = this.add.rectangle(EXIT.x + EXIT.width / 2, EXIT.y + EXIT.height / 2, 48, 48, 0x70efd1, .05).setDepth(2);
    this.pulses = new PulseSystem(this);
    this.visibility = new VisibilitySystem(this, this.map, { lamps: LAMPS });
    this.effects = new PulseEffects(this); this.effects.graphics.setDepth(51);
    this.guards = new GuardSystem(this, this.map, { routes: ROUTES, tuning: { patrolSpeed: 62, chaseSpeed: 122 } });
    this.guards.setVisibilityProbe((x, y) => this.visibility.revealAt(x, y));
    this.echoView = this.add.image(SPAWN.x, SPAWN.y, thiefTexture(this, 'down', 0)).setTint(0xbda7ff).setAlpha(0).setDepth(11);
    this.securityView = this.add.graphics().setDepth(52);
    this.echoRings = [];
    this.keys = this.input.keyboard.addKeys({ w: 'W', a: 'A', s: 'S', d: 'D', up: 'UP', left: 'LEFT', down: 'DOWN', right: 'RIGHT',
      start: 'SPACE', retry: 'R', pause: 'ESC', pauseP: 'P', direct1: 'J', direct2: 'K', direct3: 'L' });
    this.keys.start.on('down', () => this.requestStart());
    this.keys.retry.on('down', () => { if (!options.isBlocked?.() && ['caught', 'victory'].includes(this.status)) options.onRetry?.(); });
    this.keys.pause.on('down', () => { if (this.status === 'playing') this.pause('Paused'); else if (this.status === 'paused') this.requestStart(); });
    this.keys.pauseP.on('down', () => { if (this.status === 'playing') this.pause('Paused'); else if (this.status === 'paused') this.requestStart(); });
    this.keys.direct1.on('down', () => this.direct('sweep'));
    this.keys.direct2.on('down', () => this.direct('lure'));
    this.keys.direct3.on('down', () => this.direct('lane'));
    this.onPulse = pulse => {
      if (this.status !== 'playing') return;
      this.lastPulse = this.elapsed;
      this.recording.event(this.elapsed, 'pulse', { x: pulse.x, y: pulse.y, radius: pulse.radius });
      this.guards.handlePulse(pulse);
      playHeartbeat((pulse.radius - this.pulses.baseRadius) / (this.pulses.maxRadius - this.pulses.baseRadius));
    };
    this.events.on('heartbeat:pulse', this.onPulse);
    this.events.on('guards:caught', this.catchPlayer, this);
    this.onBlur = () => { if (this.status === 'playing') this.pause('Window lost focus'); };
    this.onHidden = () => { if (document.hidden) this.onBlur(); };
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onHidden);
    this.events.once('shutdown', () => {
      window.removeEventListener('blur', this.onBlur);
      document.removeEventListener('visibilitychange', this.onHidden);
      this.events.off('heartbeat:pulse', this.onPulse); this.events.off('guards:caught', this.catchPlayer, this);
      this.guards.destroy(); this.pulses.destroy(); this.effects.destroy(); this.visibility.destroy();
      for (const key of Object.values(this.keys)) this.input.keyboard.removeKey(key, true, true);
    });
    this.physics.world.pause(); this.pushUI();
  }
  getPlayerState() {
    const { x, y } = this.player.body.center;
    return { x, y, hiding: hiddenAt({ x, y }) };
  }
  canOccupy(x, y, w, h) { return canFit(this.map, x, y, w, h); }
  hasLineOfSight(a, b) { return lineOfSight(this.map, a, b); }
  requestStart() {
    if (!['ready', 'paused'].includes(this.status) || this.options.isBlocked?.() || !isSensorUsable(getHeartRateState())) return false;
    if (this.status === 'ready') this.visibility.revealAll(2000, 500);
    this.status = 'playing'; this.pauseReason = ''; this.physics.world.resume(); this.pushUI(); return true;
  }
  pause(reason) {
    if (this.status !== 'playing') return;
    this.status = 'paused'; this.pauseReason = reason; this.player.setVelocity(0); this.physics.world.pause(); this.pushUI();
  }
  catchPlayer() { this.finish('caught'); }
  finish(outcome) {
    if (this.status !== 'playing') return false;
    this.recording.sample(this.elapsed, { player: this.getPlayerState() }); this.recording.event(this.elapsed, outcome);
    this.recording.finish(this.elapsed, outcome);
    this.status = outcome; this.player.setVelocity(0); this.physics.world.pause();
    this.visibility.revealAll(1000000, 500);
    this.options.onFinish?.(this.recording, this.lootCount, this.gear); this.pushUI(); return true;
  }
  snapshot() {
    const s = getHeartRateState();
    return { player: this.getPlayerState(), guards: this.guards.getStates(), bpm: s.bpm, mode: s.mode,
      carrying: this.hasArtefact, variant: this.variant, security: this.security ?? securityAt(this.elapsed), loot: this.lootCount };
  }
  pushUI() {
    this.options.onSnapshot?.({ ...this.snapshot(), status: this.status, reason: this.pauseReason,
      elapsed: this.elapsed, input: getHeartRateState(), curseName: this.curse.name, gearName: this.gear.name,
      director: Boolean(this.options.director), charges: this.directorClock.charges, cooldown: this.directorClock.cooldown,
      lane: this.directorLane, ghost: Boolean(this.echo.record), nearMisses: this.nearMisses });
  }
  investigate(point, radius = 145) {
    let count = 0;
    for (const guard of this.guards.guards) {
      if (guard.state === 'chase' || Math.hypot(guard.x - point.x, guard.y - point.y) > radius) continue;
      guard.state = 'suspicious'; guard.waitMs = 0;
      // A decoy neither erases real suspicion nor escalates into a fake chase.
      guard.suspicion = Math.max(.25, guard.suspicion); guard.calmRate = 0; guard.hiddenMs = 0;
      guard.setDestination(point); count++;
    }
    return count;
  }
  direct(action) {
    if (!this.options.director || this.status !== 'playing' || this.visibility.isHolding() || this.options.isBlocked?.()) return false;
    if (action === 'lane') { this.directorLane = (this.directorLane + 1) % LASERS.length; this.pushUI(); return true; }
    if (!['sweep', 'lure'].includes(action) || !this.directorClock.spend()) return false;
    const lane = this.directorLane;
    if (action === 'sweep') {
      this.directorAttack = { lane, starts: this.elapsed + 1500, ends: this.elapsed + 2400 };
      this.recording.event(this.elapsed, 'director-warning', { lane });
      this.notice(`${LASERS[lane].name}: director sweep in 1.5 seconds`);
    } else {
      const beam = LASERS[lane], point = { x: beam.x + beam.width / 2, y: beam.y + beam.height / 2 };
      this.investigate(point, 500); this.recording.event(this.elapsed, 'director-lure', { ...point, lane });
      this.notice(`Security is investigating ${LASERS[lane].name.toLowerCase()}.`);
    }
    this.pushUI(); return true;
  }
  notice(message) { this.options.onNotice?.(message); }
  tryShift() {
    const variant = 1 - this.variant, map = makeMap(variant);
    const actors = [this.getPlayerState(), ...this.guards.getStates()];
    if (!canShift(map, SHIFTS[variant], actors, this.elapsed - this.lastPulse, Boolean(this.visibility.preview))) return false;
    // Both the old and the new exhibit must be out of view before exchanging them.
    if (Math.hypot(actors[0].x - SHIFTS[this.variant].x - 16, actors[0].y - SHIFTS[this.variant].y - 16) < 190) return false;
    this.variant = variant; this.map = map;
    const wall = SHIFTS[variant];
    this.shiftBody.setPosition(wall.x + 16, wall.y + 16); this.shiftBody.body.updateFromGameObject();
    this.shiftView.setPosition(wall.x + 16, wall.y + 16);
    for (const g of this.guards.guards) { g.map = map; g.setDestination(g.target ?? g.route[g.waypointIndex]); }
    this.recording.event(this.elapsed, 'room-shift', { variant });
    this.notice('An exhibit moved in the Echo Gallery. A different passage is open.'); return true;
  }
  drawSecurity() {
    const g = this.securityView; g.clear();
    const draw = (lane, phase, remaining) => {
      if (phase === 'quiet') return;
      const r = LASERS[lane], active = phase === 'active';
      g.fillStyle(active ? 0xff5e73 : 0xeab565, active ? .62 : .14).fillRect(r.x, r.y, r.width, r.height);
      g.lineStyle(active ? 3 : 1, active ? 0xffa8b2 : 0xeab565, .9).strokeRect(r.x + 2, r.y + 2, r.width - 4, r.height - 4);
      if (!active) {
        const count = Math.max(1, Math.ceil(remaining / 300));
        for (let i = 0; i < count; i++) g.fillStyle(0xffce84).fillCircle(r.x + 6 + i * 6, r.y + 6, 2);
      }
    };
    draw(this.security.lane, this.security.phase, this.security.remaining);
    if (this.directorAttack && this.elapsed < this.directorAttack.ends) {
      const a = this.directorAttack; draw(a.lane, this.elapsed < a.starts ? 'warning' : 'active', a.starts - this.elapsed);
    }
    for (let i = this.echoRings.length - 1; i >= 0; i--) {
      const r = this.echoRings[i], age = this.elapsed - r.t;
      if (age > 550) { this.echoRings.splice(i, 1); continue; }
      g.lineStyle(1, 0xbda7ff, (1 - age / 550) * .6).strokeCircle(r.x, r.y, 12 + age / 550 * 45);
    }
  }
  update(_time, rawDelta) {
    const dt = Math.min(50, Math.max(0, rawDelta));
    if (this.status === 'playing' && !isSensorUsable(getHeartRateState())) this.pause('Heart-rate input lost. Reconnect, calibrate, then resume.');
    if (this.status !== 'playing') { this.player.setVelocity(0); this.visibility.update(0); this.pushUI(); return; }
    this.visibility.update(dt);
    if (this.visibility.isHolding()) { this.player.setVelocity(0); this.pushUI(); return; }
    this.elapsed += dt; this.directorClock.update(dt);
    const k = this.keys;
    const velocity = movementVelocity(k.a.isDown || k.left.isDown, k.d.isDown || k.right.isDown,
      k.w.isDown || k.up.isDown, k.s.isDown || k.down.isDown, this.gear.speed);
    this.player.setVelocity(velocity.x, velocity.y);
    const facing = velocity.x ? (velocity.x > 0 ? 'right' : 'left') : velocity.y ? (velocity.y > 0 ? 'down' : 'up') : this.facing ?? 'up';
    this.facing = facing; this.player.setTexture(thiefTexture(this, facing, velocity.x || velocity.y ? Math.floor(this.elapsed / 140) % 2 : 0));
    const me = this.getPlayerState(); this.player.setAlpha(me.hiding ? .7 : 1);
    if (!this.hasArtefact && Math.hypot(me.x - TREASURE.x, me.y - TREASURE.y) < 24) {
      this.hasArtefact = true; this.curseStart = this.elapsed; this.artefactView.setVisible(false); this.exitGlow.setAlpha(.8);
      this.recording.event(this.elapsed, 'curse', { x: me.x, y: me.y, curse: this.curse.id });
      this.notice(`${this.curse.name} is awake. Return to extraction. ${this.curse.description}`);
    }
    for (const coin of this.loot) if (coin.active && Math.hypot(me.x - coin.x, me.y - coin.y) < 18) {
      this.lootCount++; this.recording.event(this.elapsed, 'loot', { x: coin.x, y: coin.y }); coin.destroy();
    }
    // A theft starts a fresh quiet security cycle; there is no surprise active beam.
    const cycle = this.hasArtefact ? this.curse.cycle : 6000;
    this.security = securityAt(this.hasArtefact ? this.elapsed - this.curseStart : this.elapsed, cycle);
    const hitLaser = (lane) => intersects(bodyAt(me, 18), LASERS[lane]);
    const attacked = this.directorAttack && this.elapsed >= this.directorAttack.starts && this.elapsed < this.directorAttack.ends;
    if ((this.security.phase === 'active' && hitLaser(this.security.lane)) || (attacked && hitLaser(this.directorAttack.lane))) {
      this.recording.event(this.elapsed, 'laser-hit', { x: me.x, y: me.y }); this.finish('caught'); return;
    }
    if (this.hasArtefact && intersects(bodyAt(me, 18), EXIT)) { this.finish('victory'); return; }
    const settings = pulseSettings(this.gear, this.curse, this.hasArtefact), sensor = getHeartRateState();
    Object.assign(this.pulses, { baseRadius: settings.base, radiusPerBpm: settings.perBpm, maxRadius: settings.max, durationMs: settings.duration });
    this.pulses.update(dt, { ...sensor, bpm: sensor.smoothedBpm }, { status: this.status, player: me });
    this.effects.update(dt);
    const echo = this.echo.update(this.elapsed);
    this.echoView.setAlpha(echo.frame ? .4 * this.visibility.revealAt(echo.frame.player.x, echo.frame.player.y) : 0);
    if (echo.frame) this.echoView.setPosition(echo.frame.player.x, echo.frame.player.y);
    for (const event of echo.echoes) {
      this.echoRings.push({ ...event, t: this.elapsed });
      const distracted = this.investigate(event, Math.min(145, event.radius));
      this.recording.event(this.elapsed, 'ghost-echo', { x: event.x, y: event.y, distracted });
    }
    this.guards.update(dt, me);
    if (this.status !== 'playing') return;
    const near = this.guards.getStates().some(g => g.state === 'chase' && Math.hypot(g.x - me.x, g.y - me.y) < 60 && this.hasLineOfSight(g, me));
    if (near && this.elapsed > this.nearMissCooldown) { this.nearMisses++; this.nearMissCooldown = this.elapsed + 3000; this.recording.event(this.elapsed, 'near-miss', { x: me.x, y: me.y }); }
    if (this.elapsed >= this.nextShift) this.nextShift = this.elapsed + (this.tryShift() ? 8000 : 200);
    this.drawSecurity(); this.recording.sample(this.elapsed, { player: this.getPlayerState() });
    if (this.elapsed - this.lastUI >= 100) { this.lastUI = this.elapsed; this.pushUI(); }
  }
}
