# Soham — engine adaptation for context v1

Soham explicitly authorized adapting the prior prototype on 25 October 2026.
This branch contains his three engine modules and a separate test fixture. It does
not create or modify Mehal's production entrypoint, shared GameState, HUD or root
package files. The fixture is not a simulated-sensor implementation or live demo.

## Implemented exports and world coordinates

| File | Exports |
| --- | --- |
| `src/game/config.js` | Named map/constants and pure geometry helpers listed below |
| `src/game/Player.js` | Default `Player` (Rectangle with an Arcade dynamic body) |
| `src/game/MuseumScene.js` | Default `MuseumScene`; named `ENGINE_EVENTS` |

The selected map is **800 × 544 pixels**, 25 × 17 tiles of 32 pixels. Origin is
top-left; +x right, +y down. Player/artefact positions are centers. Wall, cover and
exit rectangles use top-left x/y/width/height. CSS scaling does not change the world.

- Player: 18 × 18 body; 160 pixels/second; normalized WASD/arrow movement.
- Spawn: (80, 464), initially inside the locked exit.
- Artefact: center (720, 80), 20 × 20, automatic overlap pickup.
- Exit: rectangle (32, 416, 64, 96); only wins with the artefact.
- Cover: (64,160,64,64), (416,256,64,64), (672,256,64,64). Hiding requires the full
  body inside a zone; movement within it is allowed. No pulse behavior lives here.
- Geometry, arrays and snapshots are frozen. All visuals are generated with Phaser.

Playtest revision: Soham found the original artefact route too easy. The bottom
gallery shortcut is closed, a central partition adds a turn, and an upper-right
artefact-room partition requires approaching from the west. World size, player
speed and cover positions stay the same. All floor tiles/cover/objectives must
remain reachable; guard routes must be checked against this updated wall geometry.
The shortest four-direction route is now 44 tiles (1408 px), up from 31 tiles
(992 px). Fresh geometry checks and all five browser checks passed after this revision.

`config.js` exports `TILE_SIZE`, `MAP_COLUMNS`, `MAP_ROWS`, `WORLD_WIDTH`,
`WORLD_HEIGHT`, `PLAYER_SIZE`, `PLAYER_SPEED`, `SCENE_KEY`, `WALLS`, `HIDING_ZONES`,
`SPAWN`, `ARTEFACT`, `EXIT`, `MAP_GEOMETRY`, `overlaps`, `canOccupy`, `getHidingZone`,
`hasLineOfSight`, `movementVelocity`.

`canOccupy(x,y,width=18,height=width)` tests a centered AABB against walls/bounds;
wall contact is allowed, overlap is not. It is a position query, not a pathfinder
or a swept collision test. `hasLineOfSight(from,to)` tests a zero-width segment;
touching a wall blocks sight. It does not alter the context's wall-penetrating
pulse rule. `getHidingZone` returns a zone object or null.

## Scene API and state

```js
const scene = game.scene.getScene('MuseumScene'); // once created
scene.getPlayerState(); // frozen { x, y, hiding }, current physics-body center
scene.getMapGeometry(); // { width,height,tileSize,columns,rows,walls,hidingZones,spawn,artefact,exit }
scene.canOccupy(x, y, width, height);
scene.hasLineOfSight({ x, y }, { x: targetX, y: targetY });
scene.startRun();
scene.setPaused(true, 'sensor stale');
scene.setPaused(false);
scene.catchPlayer();
scene.restartRun();
scene.getState(); // convenience snapshot for late subscribers; engine fields only
// { status:'ready'|'playing'|'paused'|'victory'|'caught',
//   pauseReason: string|null, hasArtefact:boolean, player:{x,y,hiding} }
```

`scene.walls` is an Arcade StaticGroup. Shyam can use
`scene.physics.add.collider(guardBodyObject, scene.walls)` once per guard/run.
`scene.player` exposes its Arcade `body` for collision integration; use
`getPlayerState()` for current positions, including during physics callbacks.
Do not mutate engine state or call the overlap handlers to simulate real proximity.

| Action | Valid source state | Result |
| --- | --- | --- |
| Scene create | — | `ready`, physics paused, artefact restored |
| `startRun()` | `ready` | `playing`, physics resumed |
| `setPaused(true, reason)` | `playing` or `paused` | `paused`, reason updated, physics frozen |
| `setPaused(false)` | `paused` | `playing`, reason cleared |
| `catchPlayer()` | `playing` | `caught`, physics frozen |
| Exit overlap carrying artefact | `playing` | `victory`, physics frozen |
| R / `restartRun()` | Any created run | Freeze immediately, recreate scene next step in `ready` |

Other start/resume/terminal transitions are no-ops. A repeated pause may update its
reason. Start never acts as Resume. Ready, pause and terminal states block movement
and objective transitions. Restart never creates another game or touches sensor state.

**Mehal must enforce fresh/calibrated input before calling Start/Resume.** This engine
does not import sensor modules or duplicate their policy. TEST-mode start requires
the proper test-source contract in production; the isolated fixture bypasses sensors
only to test the engine. Preserve calibration in the external facade across restart.

The engine pauses Arcade physics for every dynamic body. It keeps the scene itself
alive so HUD/buttons/reconnection work. Mehal must gate guard updates, PulseSystem,
effects and run timers by `status === 'playing'`; world.pause() does not pause
arbitrary JavaScript timers/tweens. Do not globally pause the scene to handle BLE loss.

## Events, ordering and cleanup

All events use **`scene.events`**, not game.events. `ENGINE_EVENTS` maps:

| Key | Event | Payload |
| --- | --- | --- |
| READY | `engine:ready` | Engine snapshot, after each scene create |
| STATE | `engine:state` | Engine snapshot on changes and initial create |
| PICKUP | `engine:artefact-collected` | Snapshot after possession becomes true |
| VICTORY | `engine:victory` | Snapshot with victory status |
| CAUGHT | `engine:caught` | Snapshot with caught status |

Create emits STATE then READY. Pickup/terminal emits its specific event then STATE.
Movement/cover changes publish after the physics step. Unchanged idle state does
not emit every frame. Terminal events and pickup occur once per run. Snapshots are
immutable, do not contain sensor/guards/radius, and are ready for Mehal's GameState adapter.

Subscribe before create to catch the first READY, or read `getState()` when attaching
late. On each READY, build fresh guard/FX instances against current scene objects.
On shutdown, destroy those instances and remove their subscriptions. Persistent
scene-event subscribers should be installed once or explicitly removed; do not
add duplicates on every restart. Phaser destroys engine bodies/objects/colliders;
the engine also removes its post-update listener and owned movement/R key objects.

## Test fixture and commands

Until Mehal's starter is available, test dependencies are scoped to `tests/engine`.
No production root package or lockfile is introduced. With Node 24.12.0 (tested):

```sh
cd tests/engine
npm ci
npx playwright install chromium
npm test
npm run build
npm run dev
```

Fixture URL: `http://127.0.0.1:5174/`. Click **Start engine test**; use WASD/arrows,
gold artefact, green exit, teal cover, R to return to ready. Pause/Resume/Simulate
caught buttons exercise engine controls only. Test hooks live exclusively in the
fixture (`window.__ENGINE_TEST__`); production modules expose no browser globals.

The isolated fixture builds with Phaser 3.90.0/Vite 7.3.7 and uses Playwright 1.64.1.
When the team's starter lands, Mehal can adopt these tests into the root test
command; production modules continue importing ordinary `phaser`.

Fresh verification on 25 October 2026, Node 24.12.0 / Chromium:

- `npm run test:unit`: **4 passed** (all floor tiles/objectives reachable, walls,
  normalized speed, cover and line-of-sight rules).
- `npm run test:browser`: **5 passed** (real keyboard/full heist, ready gate,
  pause reasons, all-body freeze/resume, terminal locks, repeated restarts with
  stable objects/bodies/colliders/listeners, immutable snapshots and idle event counts).
- `npm run build`: **passed** for the isolated fixture. Phaser bundle ~335 kB gzip;
  Vite reports the expected >500 kB uncompressed chunk warning.
- A short R tap could previously be lost between frames. Restart now uses Key's
  down event; the fresh browser checks exercise it in terminal and paused states.

No known engine failure remains in these tested cases. This is not a claim that
the not-yet-integrated production application or real sensor flow has passed.

## Integration still required

- Mehal: starter, GameState adapter, input-readiness Start/Resume gate, status-gated
  systems and reset/shutdown wiring. Keep exactly one game instance.
- Shyam: routes/spawns against this geometry; add guard-to-wall colliders; publish
  `guards:caught` and have integration call `catchPlayer()`.
- Mehal: visibility mask/pulse effects over these world objects; use the context's
  radius/mode/hiding snapshots. No HUD/mask/guard/sensor implementation is included.
- Hardware behavior, full-team build and deployment need their own checks after integration.
