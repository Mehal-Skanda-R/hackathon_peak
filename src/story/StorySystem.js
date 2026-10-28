// Per-floor story layer, rebuilt with the other systems on every engine:ready.
// Owns the journal page, the Heart Lock and the Warden's door seal (floor 07),
// Aurel's shrine (Act III), Vesper the rival, bought intel overlays and Wren's
// radio lines plus the heist report. Talks to the engine only through its
// story hooks (MuseumScene) and to the guards through GuardSystem.
import { LEVEL, ARTEFACT, SHRINE, EXIT, TILE_SIZE } from '../game/config.js';
import { findPath } from '../game/Guard.js';
import { GUARD_ROUTES_BY_LEVEL } from '../game/GuardSystem.js';
import { FLOOR_LINES, MOMENTS, journalFor, JOURNAL } from './script.js';
import { createHeartLock, updateHeartLock, heartLockView, HEART_LOCK } from './heartLock.js';
import Rival, { RIVAL_BY_LEVEL } from './Rival.js';
import { vesperTexture, pageTexture, shrineGlowTexture } from './art.js';
import { say } from './radio.js';
import { journalFound, recordJournal, hasIntel } from '../ui/progress.js';

const PAGE_PICKUP = 18;
const SHRINE_REACH = 24;
const ROUTES_SHOW_MS = 6000;
const tileCenter = ([column, row]) => ({ x: (column + 0.5) * TILE_SIZE, y: (row + 0.5) * TILE_SIZE });

export default class StorySystem {
  constructor(scene, { guards, visibility }) {
    this.scene = scene;
    this.guards = guards;
    this.visibility = visibility;
    this.level = LEVEL;
    this.started = false;      // the floor's first playable frame has happened
    this.peak = { delta: 0, chased: false };
    this.objects = [];
    this.storyKey = '';
    const add = object => { this.objects.push(object); return object; };
    const hasScene = Boolean(scene.add?.image);

    // Journal page: visible only in pulse light, until found.
    const page = journalFor(LEVEL.id);
    if (page && hasScene && !journalFound().has(LEVEL.id)) {
      const point = tileCenter(page.cell);
      this.page = { ...page, ...point, image: add(scene.add.image(point.x, point.y, pageTexture(scene)).setDepth(3).setAlpha(0)) };
      if (hasIntel(LEVEL.id, 'page')) {
        this.page.marker = add(scene.add.text(point.x, point.y - 16, '✦', {
          fontFamily: 'serif', fontSize: '14px', color: '#f6e2a8', stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(52));
      }
    }

    // The Heart Lock: a glass case over the Golden Heart until it opens.
    if (LEVEL.heartLock && ARTEFACT) {
      this.lock = createHeartLock();
      if (hasScene) {
        this.glass = add(scene.add.rectangle(ARTEFACT.x, ARTEFACT.y - 4, 30, 34, 0x9fe8ff, 0.12)
          .setStrokeStyle(1.5, 0xbff2ff, 0.85).setDepth(4.5));
      }
    }

    // Aurel's shrine glows through the dark and answers each heartbeat.
    if (SHRINE && hasScene) {
      this.shrineGlow = add(scene.add.image(SHRINE.x, SHRINE.y, shrineGlowTexture(scene))
        .setDepth(50.6).setBlendMode('ADD').setScale(0.7).setAlpha(0.22));
    }

    // Vesper races for coins on her floors.
    const rival = RIVAL_BY_LEVEL[LEVEL.id];
    if (rival) {
      const exit = { x: EXIT.x + EXIT.width / 2, y: EXIT.y + EXIT.height / 2 };
      this.rival = new Rival({ start: tileCenter(rival.start), exit, map: scene.getMapGeometry(),
        canOccupy: (x, y, w, h) => scene.canOccupy(x, y, w, h) });
      if (hasScene) {
        this.rivalView = { body: add(scene.add.image(this.rival.x, this.rival.y, vesperTexture(scene, 'down', 0))
          .setDepth(9).setAlpha(0)), lastX: this.rival.x, facing: 'down', walked: 0 };
        this.noiseRing = add(scene.add.graphics().setDepth(52));
      }
      this.noiseId = 0;
      this.rings = [];
    }

    // Intel: the guards' patrol routes, drawn over the map for a few seconds.
    if (hasIntel(LEVEL.id, 'routes') && hasScene) {
      this.routes = add(scene.add.graphics().setDepth(52));
      this.routesLeftMs = ROUTES_SHOW_MS;
      this.drawRoutes();
    }

    this.onPickup = () => this.heartTaken();
    this.onWarden = event => this.wardenEvent(event);
    this.onPulse = () => this.shrineBeat();
    this.onDoor = () => this.door();
    scene.events.on('engine:artefact-collected', this.onPickup);
    scene.events.on('guards:warden', this.onWarden);
    scene.events.on('heartbeat:pulse', this.onPulse);
    scene.events.on('engine:door', this.onDoor);
  }

  drawRoutes() {
    const routes = GUARD_ROUTES_BY_LEVEL[LEVEL.id] ?? {};
    const map = this.scene.getMapGeometry();
    const free = (x, y, w, h) => this.scene.canOccupy(x, y, w, h);
    this.routes.lineStyle(2, 0xffe08a, 0.75);
    for (const waypoints of Object.values(routes)) {
      const points = waypoints.map(tileCenter);
      points.forEach((point, i) => {
        const path = findPath(point, points[(i + 1) % points.length], map, free);
        for (let j = 1; j < path.length; j++) {
          // Dashed: draw every other step.
          if (j % 2) this.routes.lineBetween(path[j - 1].x, path[j - 1].y, path[j].x, path[j].y);
        }
      });
      this.routes.fillStyle(0xffe08a, 0.9).fillCircle(points[0].x, points[0].y, 4);
    }
  }

  // Called every frame by the integration scene.
  update(deltaMs, state, { previewing = false } = {}) {
    const playing = state.status === 'playing';
    const me = state.player;
    if (this.routes && this.routes.scene && this.started) {
      this.routesLeftMs -= deltaMs;
      this.routes.setAlpha(Math.max(0, Math.min(1, this.routesLeftMs / 1000)));
    }
    if (!playing || previewing) { this.publish(state); return; }

    if (!this.started) {
      this.started = true;
      const lines = FLOOR_LINES[LEVEL.id];
      if (lines?.start) say({ text: lines.start }, { fresh: true });
      if (this.guards?.warden && !this.guards.warden.startsDormant) say(MOMENTS.wardenHunting);
    }

    const delta = Math.max(0, Math.round(state.sensor?.pulseDelta ?? 0));
    const chased = (state.guards ?? []).some(g => g.state === 'chase' || g.state === 'inspect');
    if (delta > this.peak.delta) this.peak = { delta, chased };

    this.updatePage(me);
    this.updateLock(deltaMs, me, delta);
    this.updateShrine(me);
    this.updateRival(deltaMs);
    this.publish(state, delta);
  }

  updatePage(me) {
    const page = this.page;
    if (!page || page.found) return;
    if (page.image?.scene) page.image.setAlpha(this.visibility?.revealAt(page.x, page.y) ?? 1);
    if (page.marker?.scene) page.marker.setAlpha(0.45 + 0.35 * Math.sin(this.scene.time.now / 300));
    if (Math.hypot(me.x - page.x, me.y - page.y) > PAGE_PICKUP) return;
    page.found = true;
    recordJournal(LEVEL.id);
    page.image?.destroy();
    page.marker?.destroy();
    const count = journalFound().size;
    say({ text: `${MOMENTS.journal.text} "${page.title}"` });
    window.dispatchEvent(new CustomEvent('hud-notice', { detail: {
      tone: 'hint', ms: 3600, text: `Journal page found: ${page.title} (${count} / ${JOURNAL.length})`,
    } }));
  }

  updateLock(deltaMs, me, delta) {
    if (!this.lock || this.lock.phase === 'open') return;
    const distance = Math.hypot(me.x - ARTEFACT.x, me.y - ARTEFACT.y);
    if (!this.lockNoticed && distance <= HEART_LOCK.nearRange) {
      this.lockNoticed = true;
      say(MOMENTS.heartLockNear);
    }
    for (const event of updateHeartLock(this.lock, deltaMs, { delta, distance })) {
      if (event === 'armed') say(MOMENTS.heartLockArmed, { urgent: true });
      if (event === 'opened') {
        this.scene.setArtefactLocked(false);
        if (this.glass?.scene) this.scene.tweens.add({ targets: this.glass, alpha: 0, duration: 400 });
        window.dispatchEvent(new CustomEvent('hud-notice', { detail: {
          tone: 'cleared', ms: 3200, text: 'The Heart Lock opens. Take the Golden Heart, or leave it.' } }));
      }
    }
    this.lockDistance = distance;
  }

  // Floor 07: taking the Heart wakes the Warden and seals the door.
  heartTaken() {
    if (!LEVEL.heartLock) return;
    this.guards?.warden?.wake(ARTEFACT);
    this.scene.setDoorSealed(true);
    say(MOMENTS.heartTaken, { urgent: true });
    say(MOMENTS.doorSealed);
  }

  wardenEvent({ type }) {
    if (type === 'inspection-start') say(MOMENTS.inspectionStart, { urgent: true });
    if (type === 'inspection-passed') {
      if (LEVEL.heartLock) {
        this.scene.setDoorSealed(false);
        say(MOMENTS.inspectionPassed, { urgent: true });
      } else {
        say({ text: "He's lost you. For now. Move while he rests." }, { urgent: true });
      }
    }
  }

  updateShrine(me) {
    if (!SHRINE || this.scene.shrineLit) return;
    if (Math.hypot(me.x - SHRINE.x, me.y - SHRINE.y) > SHRINE_REACH) return;
    if (!this.scene.lightShrine()) return;
    this.guards?.warden?.release();
    say(MOMENTS.shrinePlaced, { urgent: true });
    if (this.shrineGlow?.scene) {
      this.scene.tweens.add({ targets: this.shrineGlow, scale: 1.6, alpha: 0.7, duration: 900, ease: 'Sine.easeOut' });
    }
  }

  // The unlit shrine brightens briefly on every heartbeat: it is calling the Heart.
  shrineBeat() {
    if (!this.shrineGlow?.scene || this.scene.shrineLit) return;
    this.shrineGlow.setAlpha(0.5);
    this.scene.tweens.add({ targets: this.shrineGlow, alpha: 0.22, duration: 500 });
  }

  updateRival(deltaMs) {
    const rival = this.rival;
    if (!rival || rival.state === 'gone') return;
    for (const event of rival.update(deltaMs, this.scene.activeCoins())) {
      if (event.type === 'arrived') say(MOMENTS.vesperArrives);
      if (event.type === 'coin') {
        const accepted = this.scene.takeCoinByRival(event.coin);
        rival.coinTaken(accepted);
        if (accepted && rival.taken === 1) say(MOMENTS.vesperCoin);
      }
      if (event.type === 'noise') {
        this.guards?.handleNoise({ id: `vesper-${++this.noiseId}`, x: event.x, y: event.y, radius: event.radius });
        this.rings.push({ x: event.x, y: event.y, radius: event.radius, ageMs: 0 });
      }
      if (event.type === 'gone') {
        say(MOMENTS.vesperLeaves);
        this.rivalView?.body.destroy();
      }
    }
    this.drawRival(deltaMs);
  }

  drawRival(deltaMs) {
    const view = this.rivalView;
    if (view?.body.scene && this.rival.state !== 'gone') {
      const { x, y } = this.rival;
      const dx = x - view.lastX;
      if (Math.abs(dx) > 0.05) view.facing = dx > 0 ? 'right' : 'left';
      view.walked += Math.abs(dx) + Math.abs(y - (view.lastY ?? y));
      view.lastX = x; view.lastY = y;
      const stride = this.rival.path.length ? Math.floor(view.walked / 8) % 2 : 0;
      view.body.setPosition(x, y).setTexture(vesperTexture(this.scene, view.facing, stride))
        .setAlpha(this.rival.state === 'waiting' ? 0 : (this.visibility?.revealAt(x, y) ?? 1));
    }
    // Her noise: a red ripple above the darkness, so the player knows what the guards heard.
    if (!this.noiseRing?.scene) return;
    this.noiseRing.clear();
    this.rings = this.rings.filter(ring => (ring.ageMs += deltaMs) < 700);
    for (const ring of this.rings) {
      const t = ring.ageMs / 700;
      this.noiseRing.lineStyle(2, 0xff5d6c, 0.8 * (1 - t)).strokeCircle(ring.x, ring.y, ring.radius * t);
    }
  }

  // Door: Wren's line and the heist report, written from this floor's heart data.
  door() {
    const lines = FLOOR_LINES[LEVEL.id];
    const { delta, chased } = this.peak;
    const report = delta <= 3
      ? `Your heart barely moved: +${delta} BPM above baseline at most. Ice cold.`
      : `Your heart peaked at +${delta} BPM above baseline${chased ? ', as a guard closed in' : ''}.`;
    say({ text: `${lines?.door ? `${lines.door} ` : ''}${report}` }, { fresh: true });
  }

  // Story state for the HUD (lock panel, Inspection panel, journal count).
  publish(state, delta = Math.max(0, Math.round(state.sensor?.pulseDelta ?? 0))) {
    const inspection = this.guards?.warden?.getState().inspection ?? null;
    const lockNear = this.lock && this.lock.phase !== 'open'
      && (this.lockDistance ?? Infinity) <= (this.lock.phase === 'settle' ? HEART_LOCK.settleRange : HEART_LOCK.nearRange);
    const story = {
      heartLock: lockNear ? heartLockView(this.lock, delta) : null,
      inspection: inspection ? { ...inspection, delta } : null,
      rival: this.rival ? this.rival.getState().state : null,
    };
    const key = JSON.stringify(story);
    if (key === this.storyKey) return;
    this.storyKey = key;
    this.onStory?.(story);
  }

  destroy() {
    const events = this.scene.events;
    events.off('engine:artefact-collected', this.onPickup);
    events.off('guards:warden', this.onWarden);
    events.off('heartbeat:pulse', this.onPulse);
    events.off('engine:door', this.onDoor);
    for (const object of this.objects) if (object?.scene) object.destroy();
    this.objects = [];
  }
}
