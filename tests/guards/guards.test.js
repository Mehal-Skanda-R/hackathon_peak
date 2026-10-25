// Run: node --test tests/guards/  (no dependencies; real map geometry, synthetic pulses)
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP_GEOMETRY, canOccupy, hasLineOfSight } from '../../src/game/config.js';
import Guard, { GUARD_TUNING, findPath } from '../../src/game/Guard.js';
import GuardSystem, { GUARD_ROUTES, GUARD_ROUTES_BY_LEVEL, GUARD_EVENTS } from '../../src/game/GuardSystem.js';
import { LEVELS, setLevel } from '../../src/game/config.js';

const T = MAP_GEOMETRY.tileSize;
const at = (c, r) => ({ x: (c + 0.5) * T, y: (r + 0.5) * T });

function fakeScene() {
  const listeners = {};
  return {
    status: 'playing',
    canOccupy, hasLineOfSight,
    events: {
      emitted: [],
      emit(name, payload) { this.emitted.push({ name, payload }); (listeners[name] ?? []).forEach(f => f(payload)); },
    },
  };
}
let pulseId = 0;
const pulse = (point, extra = {}) => ({ id: ++pulseId, x: point.x, y: point.y, radius: 100,
  durationMs: 600, emittedAtMs: 0, source: 'heartbeat', mode: 'test', hidingAtEmission: false, ...extra });
const run = (thing, ms, player, step = 16) => { for (let t = 0; t < ms; t += step) thing.update(step, player); };
const far = at(2, 14); // player spawn, far from both guards

test('every waypoint is walkable and every route leg is reachable', () => {
  for (const [id, route] of Object.entries(GUARD_ROUTES)) {
    assert.equal(route.length >= 2, true, id);
    route.forEach(([c, r], i) => {
      assert.ok(canOccupy(at(c, r).x, at(c, r).y, GUARD_TUNING.bodySize), `${id} waypoint ${i}`);
      const [nc, nr] = route[(i + 1) % route.length];
      assert.ok(findPath(at(c, r), at(nc, nr), MAP_GEOMETRY).length > 0, `${id} leg ${i}`);
    });
  }
});

test('every level has two guard routes on walkable, mutually reachable tiles', () => {
  try {
    for (const [index, level] of LEVELS.entries()) {
      setLevel(index);
      const routes = GUARD_ROUTES_BY_LEVEL[level.id];
      assert.ok(routes, `routes for ${level.id}`);
      assert.equal(Object.keys(routes).length, 2);
      for (const [id, route] of Object.entries(routes)) {
        route.forEach(([c, r], i) => {
          assert.ok(canOccupy(at(c, r).x, at(c, r).y, GUARD_TUNING.bodySize), `${level.id}/${id} waypoint ${i}`);
          const [nc, nr] = route[(i + 1) % route.length];
          assert.ok(findPath(at(c, r), at(nc, nr), MAP_GEOMETRY).length > 0, `${level.id}/${id} leg ${i}`);
        });
      }
    }
  } finally { setLevel(0); }
});

test('two guards patrol without ever entering a wall', () => {
  const scene = fakeScene();
  const system = new GuardSystem(scene, MAP_GEOMETRY);
  const states = system.getStates();
  assert.equal(states.length, 2);
  const start = states.map(s => ({ x: s.x, y: s.y }));
  for (let t = 0; t < 60000; t += 16) {
    system.update(16, far);
    for (const g of system.getStates()) {
      assert.ok(canOccupy(g.x, g.y, GUARD_TUNING.bodySize), `${g.id} in wall at ${g.x},${g.y}`);
      assert.equal(g.state, 'patrol');
    }
  }
  system.getStates().forEach((g, i) => assert.notDeepEqual({ x: g.x, y: g.y }, start[i]));
});

test('pulse in radius raises suspicion by 0.25; outside radius does nothing', () => {
  const scene = fakeScene();
  const system = new GuardSystem(scene, MAP_GEOMETRY);
  const [a, b] = system.getStates();
  system.handlePulse(pulse(a));
  const [a2, b2] = system.getStates();
  assert.equal(a2.suspicion, 0.25);
  assert.equal(a2.state, 'suspicious');
  assert.equal(b2.suspicion, b.suspicion);
  assert.equal(b2.state, 'patrol');
});

test('same pulse id is processed once', () => {
  const system = new GuardSystem(fakeScene(), MAP_GEOMETRY);
  const p = pulse(system.getStates()[0]);
  system.handlePulse(p); system.handlePulse(p); system.handlePulse({ ...p });
  assert.equal(system.getStates()[0].suspicion, 0.25);
});

test('hiding at emission scales gain by 0.25', () => {
  const system = new GuardSystem(fakeScene(), MAP_GEOMETRY);
  system.handlePulse(pulse(system.getStates()[0], { hidingAtEmission: true }));
  assert.equal(system.getStates()[0].suspicion, 0.0625);
});

test('suspicion decays at 0.08/s and the guard returns to patrol', () => {
  const system = new GuardSystem(fakeScene(), MAP_GEOMETRY);
  system.handlePulse(pulse(system.getStates()[0]));
  run(system, 1000, far, 10);
  assert.ok(Math.abs(system.getStates()[0].suspicion - 0.17) < 1e-9);
  run(system, 30000, far);
  assert.equal(system.getStates()[0].suspicion, 0);
  assert.equal(system.getStates()[0].state, 'patrol');
});

test('three pulses reach 0.75 and start a chase', () => {
  const system = new GuardSystem(fakeScene(), MAP_GEOMETRY);
  for (let i = 0; i < 3; i++) system.handlePulse(pulse(system.getStates()[0]));
  assert.equal(system.getStates()[0].state, 'chase');
});

test('chasing guard catches a visible player in reach, emitting guards:caught once', () => {
  const scene = fakeScene();
  const system = new GuardSystem(scene, MAP_GEOMETRY);
  const g = system.getStates()[0];
  const player = { x: g.x + 60, y: g.y, hiding: false };
  for (let i = 0; i < 3; i++) system.handlePulse(pulse(player));
  run(system, 3000, player);
  const caught = scene.events.emitted.filter(e => e.name === GUARD_EVENTS.CAUGHT);
  assert.deepEqual(caught.map(e => e.payload), [{ guardId: 'guard-gallery' }]);
});

test('no catch through a wall, even when very close', () => {
  // Guard at (7,10) west of wall column 8, player at (9,10) east of it: 64 px apart.
  const guard = new Guard({ id: 'g', route: [at(7, 10)], map: MAP_GEOMETRY,
    tuning: { catchDistance: 200 } });
  const player = { ...at(9, 10), hiding: false };
  for (let i = 0; i < 3; i++) guard.handlePulse({ ...pulse(player), radius: 300 });
  assert.equal(guard.state, 'chase');
  let caught = false;
  for (let t = 0; t < 2000; t += 16) caught ||= guard.update(16, player);
  assert.equal(caught, false);
  assert.ok(canOccupy(guard.x, guard.y, GUARD_TUNING.bodySize));
});

test('a player hiding in cover is never caught, even right next to a chasing guard', () => {
  const scene = fakeScene();
  const system = new GuardSystem(scene, MAP_GEOMETRY);
  const g = system.getStates()[0];
  const player = { x: g.x + 10, y: g.y, hiding: true };   // inside catch distance
  for (let i = 0; i < 3; i++) system.handlePulse(pulse(player, { hidingAtEmission: false }));
  assert.equal(system.getStates()[0].state, 'chase');
  run(system, 5000, player);
  assert.equal(scene.events.emitted.filter(e => e.name === GUARD_EVENTS.CAUGHT).length, 0);
  assert.notEqual(system.getStates()[0].state, 'chase', 'guard gives up on a hidden player');
});

test('stepping out of cover makes the player catchable again', () => {
  const scene = fakeScene();
  const system = new GuardSystem(scene, MAP_GEOMETRY);
  const g = system.getStates()[0];
  const player = { x: g.x + 40, y: g.y, hiding: true };
  for (let i = 0; i < 3; i++) system.handlePulse(pulse(player));
  run(system, 4000, player);
  assert.equal(scene.events.emitted.length, 0);
  assert.notEqual(system.getStates()[0].state, 'chase', 'lost the hidden player');
  // Out in the open next to the guard again: a fresh chase can catch.
  const now = system.getStates()[0];
  const [dx, dy] = [[40, 0], [-40, 0], [0, 40], [0, -40]].find(([dx, dy]) =>
    canOccupy(now.x + dx, now.y + dy, 18) && hasLineOfSight(now, { x: now.x + dx, y: now.y + dy }));
  Object.assign(player, { x: now.x + dx, y: now.y + dy, hiding: false });
  for (let i = 0; i < 3; i++) system.handlePulse(pulse(player));
  assert.equal(system.getStates()[0].state, 'chase');
  run(system, 3000, player);
  assert.equal(scene.events.emitted.filter(e => e.name === GUARD_EVENTS.CAUGHT).length, 1);
});

test('hidden 3 s: the guard leaves, then suspicion drains to 0 over 5 s', () => {
  const guard = new Guard({ id: 'g', route: [at(10, 10), at(14, 10)], map: MAP_GEOMETRY });
  const player = { ...at(12, 10), hiding: false };
  for (let i = 0; i < 4; i++) guard.handlePulse({ ...pulse(player), radius: 300 });
  assert.equal(guard.state, 'chase');
  assert.equal(guard.suspicion, 1);
  player.hiding = true;
  const step = (ms) => { for (let t = 0; t < ms; t += 10) guard.update(10, player); };
  step(2900);
  assert.equal(guard.state, 'chase', 'still searching before 3 s');
  step(200);
  assert.equal(guard.state, 'return', 'leaves after 3 s hidden');
  const atLeave = guard.suspicion;
  step(2400);   // ~2.5 s into the 5 s calm-down
  assert.ok(Math.abs(guard.suspicion - atLeave / 2) < 0.04, `half-way after 2.5 s (${guard.suspicion})`);
  step(2300);   // calming started at 3.0 s; now at ~4.9 s of 5
  assert.ok(guard.suspicion > 0 && guard.suspicion < 0.06, `almost calm just before 5 s (${guard.suspicion})`);
  step(200);
  assert.equal(guard.suspicion, 0, 'calm after 5 s');
});

test('pulses from cover do not bring a calming guard back; open pulses do', () => {
  const guard = new Guard({ id: 'g', route: [at(10, 10), at(14, 10)], map: MAP_GEOMETRY });
  const player = { ...at(12, 10), hiding: false };
  for (let i = 0; i < 4; i++) guard.handlePulse({ ...pulse(player), radius: 300 });
  player.hiding = true;
  for (let t = 0; t < 3100; t += 10) guard.update(10, player);
  assert.equal(guard.state, 'return');
  const before = guard.suspicion;
  assert.equal(guard.handlePulse({ ...pulse(player), radius: 300, hidingAtEmission: true }), false);
  assert.equal(guard.suspicion, before);
  assert.equal(guard.state, 'return');
  for (let t = 0; t < 5000; t += 10) guard.update(10, player);
  assert.equal(guard.suspicion, 0, 'still calm by 8 s despite hidden pulses');
  player.hiding = false;
  assert.equal(guard.handlePulse({ ...pulse(player), radius: 300 }), true);
  assert.equal(guard.state, 'suspicious');
});

test('leaving cover before 3 s resets the hidden timer', () => {
  const guard = new Guard({ id: 'g', route: [at(10, 10)], map: MAP_GEOMETRY });
  const player = { ...at(12, 10), hiding: true };
  for (let i = 0; i < 3; i++) guard.handlePulse({ ...pulse(player), radius: 300 });
  for (let t = 0; t < 2000; t += 10) guard.update(10, player);
  player.hiding = false; guard.update(10, player); player.hiding = true;
  for (let t = 0; t < 2000; t += 10) guard.update(10, player);
  assert.equal(guard.calmRate, 0, 'never 3 s in a row hidden');
});

test('icon: ! while chasing, then ? fading red -> yellow -> none while calming', () => {
  const scene = drawingScene();
  const system = new GuardSystem(scene, MAP_GEOMETRY);
  const icon = scene.objects[2];               // guard-gallery's icon
  const g = system.getStates()[0];
  const player = { x: g.x + 40, y: g.y, hiding: false };
  for (let i = 0; i < 4; i++) system.handlePulse(pulse(player));
  run(system, 50, player);
  assert.equal(icon.text, '!');
  player.hiding = true;
  run(system, 3100, player);
  assert.equal(icon.text, '?');
  const red = parseInt(icon.color.slice(1), 16);
  run(system, 3000, player);
  const later = parseInt(icon.color.slice(1), 16);
  assert.equal(icon.text, '?');
  assert.ok((later >> 8 & 0xff) > (red >> 8 & 0xff), `greener (more yellow) as it calms: ${icon.color}`);
  run(system, 2500, player);
  assert.equal(icon.text, '', 'no icon once calm');
});

test('a pulse alone never catches; patrol/suspicious guards never catch', () => {
  const scene = fakeScene();
  const system = new GuardSystem(scene, MAP_GEOMETRY);
  const g = system.getStates()[0];
  const player = { x: g.x, y: g.y, hiding: false };
  system.handlePulse(pulse(player));
  run(system, 500, player);
  assert.equal(scene.events.emitted.length, 0);
});

test('chase gives up after losing sight and the guard returns to its route', () => {
  const system = new GuardSystem(fakeScene(), MAP_GEOMETRY);
  const g = system.getStates()[0];
  for (let i = 0; i < 3; i++) system.handlePulse(pulse(g));
  const hidden = { ...at(2, 14), hiding: true }; // behind several walls
  run(system, 4000, hidden);
  assert.notEqual(system.getStates()[0].state, 'chase');
  run(system, 30000, hidden);
  assert.equal(system.getStates()[0].state, 'patrol');
});

test('does nothing unless the scene is playing', () => {
  const scene = fakeScene();
  const system = new GuardSystem(scene, MAP_GEOMETRY);
  const before = system.getStates();
  scene.status = 'paused';
  system.handlePulse(pulse(before[0]));
  run(system, 1000, far);
  assert.deepEqual(system.getStates(), before);
});

test('reset restores spawn, clears suspicion and processed pulse ids; destroy is idempotent', () => {
  const system = new GuardSystem(fakeScene(), MAP_GEOMETRY);
  const initial = system.getStates();
  const p = pulse(initial[0]);
  system.handlePulse(p);
  run(system, 2000, far);
  system.reset();
  assert.deepEqual(system.getStates(), initial);
  system.handlePulse(p); // same id is valid again in the new run
  assert.equal(system.getStates()[0].suspicion, 0.25);
  system.destroy(); system.destroy();
  system.handlePulse(pulse(initial[0]));
  assert.equal(system.getStates()[0].suspicion, 0.25);
});

test('state snapshots are frozen and match the contract shape', () => {
  const [s] = new GuardSystem(fakeScene(), MAP_GEOMETRY).getStates();
  assert.ok(Object.isFrozen(s));
  assert.deepEqual(Object.keys(s).sort(), ['id', 'state', 'suspicion', 'x', 'y']);
});

// Canvas 2D stand-in: every drawing call is a no-op.
const fakeContext = () => new Proxy({}, { get: (t, k) => k === 'createRadialGradient'
  ? () => ({ addColorStop() {} }) : (t[k] ?? (() => {})), set: (t, k, v) => { t[k] = v; return true; } });

// Minimal Phaser stand-in: display objects lose `scene` when destroyed, and
// 'shutdown' destroys everything the scene owns, as a Phaser restart does.
function drawingScene() {
  const scene = fakeScene();
  const handlers = {};
  const objects = [];
  scene.events.once = (name, fn) => { (handlers[name] ??= []).push(fn); };
  scene.events.off = (name, fn) => { handlers[name] = (handlers[name] ?? []).filter(f => f !== fn); };
  scene.shutdown = () => {
    const fns = handlers.shutdown ?? []; handlers.shutdown = [];
    fns.forEach(f => f());
    objects.forEach(o => o.destroy());
  };
  scene.listenerCount = name => (handlers[name] ?? []).length;
  const make = () => {
    const o = { scene, destroyCalls: 0,
      destroy() { this.destroyCalls++; this.scene = null; } };
    const live = name => function () { if (!this.scene) throw new TypeError(`Cannot read properties of null (reading '${name}')`); return this; };
    for (const m of ['setPosition', 'setSize', 'setTexture', 'setText', 'setColor', 'setFillStyle']) o[m] = live(m);
    const setText = o.setText, setColor = o.setColor;
    o.setText = function (t) { setText.call(this); this.text = t; return this; };
    o.setColor = function (c) { setColor.call(this); this.color = c; return this; };
    for (const m of ['setDepth', 'setOrigin', 'setStrokeStyle']) o[m] = function () { return this; };
    o.setAlpha = function (a) { this.alpha = a; return this; };
    objects.push(o); return o;
  };
  scene.add = { rectangle: make, image: make, text: make };
  const textures = new Set();
  scene.textures = { exists: k => textures.has(k), createCanvas: k => { textures.add(k); return { context: fakeContext(), refresh() {} }; } };
  scene.objects = objects;
  return scene;
}

test('creates one sprite, one suspicion bar and one alert icon per guard', () => {
  const scene = drawingScene();
  new GuardSystem(scene, MAP_GEOMETRY);
  assert.equal(scene.objects.length, 6);
});

test('visibility probe sets guard sprite, bar and icon alpha', () => {
  const scene = drawingScene();
  const system = new GuardSystem(scene, MAP_GEOMETRY);
  system.setVisibilityProbe(() => 0);
  assert.ok(scene.objects.every(o => o.alpha === 0), 'hidden outside pulse light');
  system.setVisibilityProbe((x) => (x < 400 ? 1 : 0.25));
  const [gallery, east] = system.getStates();
  assert.ok(gallery.x < 400 && east.x >= 400);
  assert.deepEqual(scene.objects.slice(0, 3).map(o => o.alpha), [1, 1, 1]);
  assert.deepEqual(scene.objects.slice(3, 6).map(o => o.alpha), [0.25, 0.25, 0.25]);
});

test('guard sprite frames are drawn once and cached per facing/stride', () => {
  const scene = drawingScene();
  const system = new GuardSystem(scene, MAP_GEOMETRY);
  run(system, 3000, far);
  const before = scene.textures.exists('hh-guard-v1-down-0');
  new GuardSystem(scene, MAP_GEOMETRY);
  assert.ok(before);
});

test('after a scene shutdown, old system never touches destroyed objects', () => {
  const scene = drawingScene();
  const system = new GuardSystem(scene, MAP_GEOMETRY);
  scene.shutdown();
  assert.doesNotThrow(() => {
    system.handlePulse(pulse(system.getStates()[0]));
    run(system, 500, far);
    system.reset();
    system.destroy();
  });
  assert.ok(scene.objects.every(o => o.destroyCalls === 1), 'each object destroyed exactly once');
});

test('restart cycle (shutdown -> destroy old -> new system) gives a clean second run', () => {
  const scene = drawingScene();
  const first = new GuardSystem(scene, MAP_GEOMETRY);
  const initial = first.getStates();
  for (let i = 0; i < 3; i++) first.handlePulse(pulse(first.getStates()[0]));
  run(first, 2000, far);
  scene.shutdown();
  first.destroy();
  assert.equal(scene.listenerCount('shutdown'), 0, 'no leaked shutdown listener');
  const second = new GuardSystem(scene, MAP_GEOMETRY);
  assert.deepEqual(second.getStates(), initial);
  assert.equal(scene.objects.filter(o => o.scene).length, 6, 'only the new run\'s 6 objects are live');
  run(second, 1000, far);
  assert.ok(second.getStates().every(g => g.state === 'patrol' && g.suspicion === 0));
});

test('destroy without shutdown removes its own objects and listener', () => {
  const scene = drawingScene();
  const system = new GuardSystem(scene, MAP_GEOMETRY);
  system.destroy(); system.destroy();
  assert.ok(scene.objects.every(o => o.destroyCalls === 1));
  assert.equal(scene.listenerCount('shutdown'), 0);
});
