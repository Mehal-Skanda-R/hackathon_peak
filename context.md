# Heartbeat Heist — shared project context

Context version: 1.0 · Fresh-start baseline: 25 October 2026 (Asia/Kolkata)
Maintainer: Mehal Skanda (integration); each owner maintains their own status below.
Repository: https://github.com/Mehal-Skanda-R/hackathon_peak
Canonical file: **`context.md` on `main`** (lowercase; do not create competing copies).

## 0. Read this first — instructions for every teammate and AI

Soham explicitly requested a fresh start on 25 October 2026. This document replaces
the earlier `Context.md`, old role prompts, old implementation contracts and the
discarded local engine prototype. Do not import old code, tests, interfaces or
claims of completion as if they belong to this new build. Reuse requires an
explicit team decision and fresh verification. Do not delete anyone's local work.

The source for the concept is the team-provided **Priliminary Project Description.txt**.
This document captures its product requirements and establishes the fresh build's
ownership, stack and target interfaces. Interface definitions below are **targets
to implement, not assertions that those files/functions already exist**.

Every AI must:
1. Read the latest remote `main:context.md` before beginning a task. Inspect the
   actual repository, current branch, working changes and relevant files next.
2. Follow the stack, ownership, contracts and decisions here. If a new request
   conflicts, explain the conflict before editing; an explicit human decision may
   supersede this document and must then be recorded here.
3. Implement only its assigned scope. Do not duplicate another owner's module,
   silently change contracts or create a second game/sensor/pulse scheduler.
4. Keep work modular, small and testable. Report real commands/results; never turn
   a proposed interface, unpushed change or passing old test into a completion claim.
5. Follow the synchronization protocol in section 8. Do not assume another AI
   sees this chat, local files, unpushed changes or a feature branch automatically.

## 1. Project and pitch

**Your heartbeat reveals the world. It also reveals you.**

Heartbeat Heist is a small top-down 2D museum stealth game for the Confluence
Buildathon 2026, Crossbreed track (10-hour buildathon). Collect one artefact and
reach the exit while avoiding two guards. A real heart-rate sensor drives automatic
spatial pulses: they briefly reveal the dark museum and also expose the player to
guards. A rise above the player's calibrated baseline produces wider pulses,
trading more information for more exposure.

The two technologies are **standard BLE Heart Rate Service via Web Bluetooth**
(wearable sensing) and **Phaser 3** (interactive game development). Neither a BPM
display alone nor a game with decorative BPM proves the combination. In LIVE mode,
missing/disconnected/stale sensor input pauses gameplay. TEST mode is an explicit,
labelled development fallback and does not prove the live Crossbreed integration.

Prior art: Stifled uses sound-driven revelation/danger; Nevermind uses biofeedback.
Do not claim the first biofeedback game. Our distinction is automatic heart-rate-
driven spatial pulses that provide information and create stealth risk together.
Heart rate is a gameplay input, **not a fear score, emotion detector or diagnosis**.

## 2. Fixed scope and fresh stack

- JavaScript ES modules, plain HTML/CSS, **Phaser 3**, **Vite**, npm lockfile, Git/GitHub.
- Use the npm Phaser 3 dependency; do not also load Phaser through a CDN or use Phaser 4.
- Mehal creates the shared starter and commits exact resolved dependency versions
  in `package-lock.json` once. Others use `npm ci`; coordinate dependency changes.
- One `Phaser.Game`, one main `MuseumScene`, one world coordinate system.
- Browser-only MVP: no backend, database, accounts, React, multiplayer, Supabase or Groq.
- Target desktop Chrome/Edge with Web Bluetooth; verify the actual demo browser/device.
- Vercel deployment from the integrated repository; build `npm run build`, output `dist`.
  HTTPS in deployment; localhost for local development. Verify Bluetooth availability
  in the actual browser rather than assuming an embedded preview supports it.
- Programmatic geometry is acceptable; do not invent missing assets or block on art.
- Two guards, one map, one artefact, one exit, simple cover, a complete win/caught/restart loop.
- Replay, co-op, elaborate AI, additional levels and watch companion apps are out of MVP scope.

Required starter scripts: `dev`, `build`, `preview`, `test`. Document the actual test
runner and minimum Node version when the starter is committed. Test runner: Vitest. Minimum Node version: 24.12.0.

## 3. Roles, files and first deliverables

| Person / branch | Owns | First independently verifiable milestone |
| --- | --- | --- |
| **Soham Bharadwaj — game engine** / `feature/game-engine` | `src/game/config.js`, `src/game/MuseumScene.js`, `src/game/Player.js`; world geometry, collisions, movement, cover, artefact, exit and run transitions | Playable map without hardware; publish exact map dimensions, body size, geometry helpers and scene API; test movement/collisions/pickup/exit/restart |
| **Shubranshu Mishra — hardware and signal** / `feature/heart-rate` | `src/sensor/heartRate.js`, `src/sensor/signalProcessor.js`, `src/sensor/testSensor.js`; BLE parsing, connection lifecycle, calibration, smoothing, staleness and uniform test source | Verify the real sensor on demo laptop; publish normalized state stream and test fixtures for both BPM encodings and disconnect/stale behavior |
| **Shyam T Sooraj — guards and detection** / `feature/guard-ai` | `src/game/Guard.js`, `src/game/GuardSystem.js`; two patrols, suspicion, pulse response, chase/recovery and caught reporting | Two wall-respecting guards consume synthetic pulse events; verify suspicion/decay/hiding and caught behavior without needing BLE |
| **Mehal Skanda — pulses, presentation and integration** / `feature/fx-ui` | `src/game/PulseSystem.js`, `src/game/PulseEffects.js`, `src/game/VisibilitySystem.js`, `src/ui/hud.js`; pulse scheduling/radius, darkness/reveal, HUD, mode controls and integration | Commit starter first; wire one normalized test source to one scheduler and the same pulse events to both reveal and guard systems |

**Shared-file coordinator: Mehal.** `src/main.js`, `src/game/GameState.js`,
`src/style.css`, `index.html`, `package.json`, `package-lock.json` and deployment
configuration require coordination before edits. Describe the exact edit and
affected owners; record agreement here or in a linked PR. Do not let four AIs
independently scaffold the project or rewrite the entrypoint.

Each owner owns tests for their module. Mehal coordinates end-to-end tests, merges,
deployment and demo readiness; other owners must help diagnose integration failures.
All owners may publish evidence-backed context/status updates via section 8.

Target tree (create only what the assigned work needs):
```text
context.md
index.html
package.json / package-lock.json
README.md / .gitignore
public/assets/                    # optional, only real assets
src/main.js / src/style.css
src/game/config.js
src/game/GameState.js
src/game/MuseumScene.js / Player.js
src/game/Guard.js / GuardSystem.js
src/game/PulseSystem.js / PulseEffects.js / VisibilitySystem.js
src/sensor/heartRate.js / signalProcessor.js / testSensor.js
src/ui/hud.js
tests/
```

## 4. Game rules and initial tuning decisions

### Movement, map and objectives
- WASD **and arrow keys** move; diagonal speed is normalized. Physics uses elapsed
  time, not movement per frame. Walls and world bounds block player and guard bodies.
- Coordinates are world pixels: top-left origin, +x right, +y down. Actor positions
  and pulse origins are centers. Geometry rectangles use top-left x/y/width/height.
  Screen/CSS coordinates must never enter physics, radius or detection calculations.
- Soham publishes map width/height/tile size, spawn, artefact, exit, cover and
  geometry helpers in `config.js` before Shyam/Mehal bind routes or visibility to it.
  **Soham's implemented map ([PR #1](https://github.com/Mehal-Skanda-R/hackathon_peak/pull/1), merged):**
  800 × 544 px, 32 px tiles, 25 × 17 grid, 18 × 18 player body, 160 px/second.
  Spawn (80,464), artefact center (720,80), exit rect (32,416,64,96).
  Full exports, coordinates and wiring: `docs/ENGINE_HANDOFF.md` on `feature/game-engine`.
- Automatic artefact pickup on overlap; exit only wins while carrying artefact.
- Hiding is true when the full player body lies in a marked cover zone. Moving
  inside that zone is allowed. Hiding reduces guard exposure; it never stops pulses.
- Caught/victory freezes active gameplay. R or a HUD button requests restart.

### Automatic pulses
- No scan button, manual trigger, hold-to-scan, or scanner on/off switch.
- Use processed BPM to schedule animation: interval `60000 / bpm` milliseconds.
  BLE notifications are readings, **not necessarily individual physical beats**.
  Do not emit a pulse per notification or promise heartbeat-perfect synchronization.
- Radius formula: `clamp(baseRadius + radiusPerBpm * max(0, pulseDelta), baseRadius, maxRadius)`.
  Initial tuning: baseRadius 100 px, radiusPerBpm 4 px/BPM, maxRadius 260 px,
  durationMs 600. Soham/Mehal revisit pixel tuning against the actual map scale.
- One scheduler owns timing and radius. Guard and FX consumers receive the **same
  pulse object**, never separate radius calculations or independent timers.
- No pulse accumulation during pause; resume starts a fresh interval. Do not fire
  a backlog. Event origin and hiding state are snapshots at emission.
- MVP wall rule: radial pulse reveal/exposure may pass through walls; walls still
  block movement and direct visual/chase line of sight. This is an intentional
  starting rule to keep both pulse consumers consistent. Change only by joint
  engine/guard/FX agreement and record the change here.

### Guards and cover
- Two guards; patrol → suspicious/investigate → chase → recover/return.
- Process each pulse ID once. At emission, guards within its final radius gain
  suspicion. Initial normalized suspicion range 0..1; gain 0.25 per pulse, decay
  0.08/second, hiding multiplier 0.25; suspicion >= 0.75 enters chase.
- These are initial tuning values, not claims of playtested balance. Keep them
  configurable; Shyam records actual adopted values and observed behavior.
- Caught requires actual close contact during chase (initial center distance 22 px)
  with unobstructed line of sight; no catching through walls or solely from a pulse.
- Chase movement must respect geometry. Avoid adding advanced pathfinding before
  the patrol/investigate/caught loop works; publish any navigation dependency early.
- Pulse eligibility uses pulse origin/hiding snapshot. Pursuit uses current player
  state. Cover attenuates pulse suspicion, not invulnerability to physical capture.

## 5. Module contracts (v1; implementation status in section 7)

There are no HTTP endpoints. These are in-browser module APIs. Implement the names
below or agree on a documented version change **before** consumers integrate.

### Sensor contract — Shubranshu produces; everyone else reads
```js
// All temporal values use performance.now() milliseconds in this browser session.
// Read-only snapshot; consumers must not mutate it.
{
  mode: 'live' | 'test',
  bpm: number | null,             // latest valid raw BPM
  smoothedBpm: number | null,     // cadence input
  baselineBpm: number | null,
  pulseDelta: number,             // smoothedBpm - baselineBpm; 0 before calibration
  connected: boolean,            // true only for connected real BLE device
  calibrated: boolean,
  stale: boolean,
  lastReadingAtMs: number | null,
  error: string | null
}

// Named exports of src/sensor/heartRate.js (facade for live + test input):
connectHeartRate(): Promise<void> // invoke from a user button gesture
disconnectHeartRate(): void
startCalibration(): void
setSensorMode(mode): void
setTestBpm(bpm): void             // test mode only; never alters real measurements
getHeartRateState(): SensorState
subscribeToHeartRate(callback): () => void // immediate snapshot, then changes; returns unsubscribe
```

Only this sensor facade creates the BLE connection. Switching mode removes old
listeners/timers and invalidates calibration. LIVE disconnect never silently
switches to TEST. TEST uses the same processing/state shape, with `connected:false`;
its usability depends on mode and fresh input, not pretending hardware is connected.
The HUD owns test controls (slider or +/-); do not take arrow keys away from movement.

BLE service `heart_rate` / UUID 0x180D; characteristic `heart_rate_measurement` /
0x2A37. Flags byte bit 0 selects uint8 BPM at offset 1 or little-endian uint16 at
offset 1. Validate length, finite positive readings and plausible sensor values;
publish the accepted range. Reject malformed input without breaking the stream.
Optional RR data is not required for MVP.

Initial calibration duration 45 seconds; require valid fresh samples and restart
calibration on signal loss. Initial smoothing: EMA alpha 0.2, seed with first valid
sample. Initial stale threshold: 5000 ms since last valid reading. Detect silence
with a timer even when no notification arrives. Unready/stale input must not be
clamped into a fake usable BPM. Hardware compatibility and sensitivity remain to test.

### Shared state and engine contract — Soham + Mehal
```js
// Target src/game/GameState.js named exports, implemented by Mehal:
getGameState(): GameState
subscribeToGameState(callback): () => void // immediate snapshot; unsubscribe required
// Internal update API is agreed by Soham/Mehal before implementation.

// Engine-owned fields in a GameState snapshot:
{
  status: 'ready' | 'playing' | 'paused' | 'victory' | 'caught',
  pauseReason: string | null,
  player: { x: number, y: number, hiding: boolean },
  hasArtefact: boolean,
  // Aggregated by Mehal; guard/sensor owners remain authoritative:
  sensor: SensorState,
  guards: GuardState[],
  pulseRadius: number
}

// Target MuseumScene instance API (default export, scene key 'MuseumScene'):
getPlayerState(): { x, y, hiding }
getMapGeometry(): { width, height, tileSize, walls, hidingZones, spawn, artefact, exit }
canOccupy(x, y, width, height): boolean // body center, axis-aligned size
hasLineOfSight(from, to): boolean     // world point objects {x,y}; walls block
startRun(): void
setPaused(paused, reason = null): void
catchPlayer(): void
restartRun(): void
```

Engine owns player, objectives and run transitions; guards request catches and HUD
requests controls, never directly mutate those fields. MuseumScene publishes
`engine:ready`, `engine:state`, `engine:artefact-collected`, `engine:victory`,
`engine:caught` on `scene.events`. Payload is the current engine-owned subset above
(status, pauseReason, player, hasArtefact), not a second full GameState store.
Mehal mirrors those events into the one shared snapshot and documents wiring order.

Start LIVE only when connected, calibrated and fresh. Start TEST when calibrated
and fresh without requiring BLE. Use a ready/start gate, never automatically enter
live gameplay. On disconnect/staleness: pause movement, guards, pulses and run time,
but keep HUD and sensor reconnection controls working. Recovery allows an explicit
Resume when input is valid; it must not resume a terminal run.

Restart resets positions, artefact, suspicion, pulse visuals and run status. It
returns to ready; it does not create a second game or sensor connection. Preserve
valid calibration for the same source; reset it on source/mode change. Dispose
scene-owned colliders/listeners/effects; retain the single external sensor facade.

### Pulse contract — Mehal emits; FX + guards consume
```js
// Immutable event on scene.events: 'heartbeat:pulse'
{
  id: number,                     // monotonically increasing within the run
  x: number, y: number,           // player center at emission
  radius: number, durationMs: number,
  emittedAtMs: number,
  source: 'heartbeat',
  mode: 'live' | 'test',
  hidingAtEmission: boolean
}
// Target default-export classes:
new PulseSystem(scene)           // Mehal calls update(deltaMs, sensorState, engineState)
new PulseEffects(scene)          // handlePulse(pulse), destroy()
new VisibilitySystem(scene, mapGeometry) // handlePulse(pulse), destroy()
// PulseSystem also exposes reset() and destroy(); exactly one instance per run.
```

The whole radius is the detection/reveal footprint for this MVP; expanding rings
are its visual treatment. Reveal lasts durationMs; overlapping reveals must expire
independently. Do not reveal the entire map permanently or stop pulses while hiding.

### Guard contract — Shyam produces
```js
new GuardSystem(scene, mapGeometry)
guardSystem.update(deltaMs, playerState) // only while playing
guardSystem.handlePulse(pulse)          // only while playing
guardSystem.getStates(): GuardState[]
guardSystem.reset(): void
guardSystem.destroy(): void
// GuardState = { id: string, x: number, y: number,
//                state: 'patrol'|'suspicious'|'chase'|'return', suspicion: number }
// Emit scene.events 'guards:caught' with { guardId }; Mehal wires to scene.catchPlayer().
```

Soham exposes wall geometry/static collision integration before guard movement is
finalized. Shyam publishes valid spawn/waypoint routes against the actual map.
GuardSystem never creates the map, controls the player or opens Bluetooth.

### HUD — Mehal
Consumes shared snapshots; displays LIVE/TEST prominently, connection/stale/calibration
status, BPM, baseline/delta or radius, suspicion, objective and terminal state.
Buttons invoke the documented control APIs. No movement, detection, signal processing,
second sensor connection or Phaser instance lives in the HUD.

## 6. Build order and acceptance evidence

1. **Immediately, in parallel:** Mehal commits starter/contracts; Shubranshu proves
   real sensor readings on the demo laptop. All others pull that starter before coding.
2. **First components:** Soham proves map/movement/objectives; Shyam proves patrol and
   synthetic-pulse detection; Mehal proves test-sensor → one scheduler → visible pulse.
3. **First integrated vertical slice:** one map, artefact/exit, two guards, cover,
   automatically shared reveal/detection events, HUD, explicit TEST mode.
4. **Live slice:** calibrate real input; same pipeline; demonstrate disconnect/stale
   pause, reconnection, explicit resume and no silent test fallback.
5. **Finish:** tune visibility/exposure; verify terminal states/restarts; production
   build and HTTPS deployment; record an actual sensor-connected backup run; rehearse.

Required evidence before calling the MVP complete:
- One canvas/game, reachable artefact/exit, wall blocking, normalized movement.
- Exit cannot win before pickup; caught/victory stop gameplay; repeated restarts
  don't multiply bodies, listeners, BLE subscriptions or pulse timers.
- Valid uint8/uint16 parsing, malformed data rejection, calibration and stale timeout.
- BPM changes cadence; delta changes radius within caps; automatic pulses continue
  while stationary/hiding; FX and guard consumers observe the same pulse IDs/radii.
- Two patrols, pulse suspicion, decay, reduced exposure in cover, no catching through walls.
- Explicit TEST mode works without hardware; LIVE stops on lost input; no fallback deception.
- HUD remains usable while paused; real sensor run, production build and deployment verified.

Record command, environment, result, code commit and limitations below. Unit tests
alone do not prove Bluetooth, rendering or the full game. Hardware results require
actual hardware evidence. No need to depend on exercise, breath-holding or guaranteed
instant changes in heart rate for the demo.

## 7. Current handoff / status (fresh start)

### Immediate assignments after status check

Soham requested these next steps for all four teammates and their AIs. Read the
latest remote context/main and confirm an issue is still present before fixing it;
the audit below describes a specific tested commit. Keep existing ownership/API
contracts. Mehal coordinates shared entrypoint, GameState, HUD and dependency edits.
Update this context and your status after each verified milestone using section 8.
Do not claim another owner's work is complete or overwrite concurrent updates.

**Mehal — make the combined game reliable (integration lead)**
1. Align root Vite/Vitest and restore standard `npm ci`, `npm test` and
   `npm run build`; document actual successful commands/versions.
2. Coordinate initial TEST source activation with Shubranshu; expose working mode,
   calibration and recovery controls. Gate Start/Resume on fresh, calibrated input
   (plus real connection in LIVE). Pause player/guards/pulses/run time when input
   becomes unavailable, keeping HUD/reconnection controls usable.
3. Fix run lifecycle: dispose/recreate guards, visibility and pulse systems and
   their scene/window subscriptions; reset positions, suspicion, visuals and timers.
   Verify two consecutive complete runs without refreshing the page.
4. Review/merge art PR #3 after compatibility checks. Coordinate integration PRs;
   do not ask all four AIs to independently rewrite shared files.

**Shubranshu — dependable live and simulated sensor input**
1. Make TEST readings start through the normal startup/UI path; same-mode selection
   must not leave the source permanently idle. Coordinate startup wiring with Mehal.
2. Verify calibration, malformed readings, stale timeout, disconnect and LIVE/TEST
   switching. Publish accurate fresh/calibrated/connected state for Mehal's gates;
   provide processed BPM for pulse cadence. Keep sensor logic in sensor-owned files.
3. Test the actual heart-rate device on the intended laptop/browser. Record exact
   model, successful readings and observed failures. Code merged is not hardware proof.

**Shyam — guards in actual combined gameplay**
1. Help Mehal verify patrol, pulse suspicion, hiding, chase and capture in the
   integrated game, against current map geometry and pulse events.
2. Focus on the second run: both guards visible at their starting positions,
   suspicion zero, patrol normal, no duplicate catches or stale display objects.
   Mehal owns external system recreation; fix guard-internal reset/disposal issues
   in Guard/GuardSystem and coordinate any shared entrypoint edits.
3. Verify guards remain inactive during ready/paused/terminal states. Preserve the
   passing module checks and publish integrated-play evidence, not only unit results.

**Soham — playable museum, artwork and combined playtesting**
1. Help Mehal integrate art PR #3 using its documented layer/body-center contracts.
2. Play the combined game with guards and darkness: steal/escape, get caught,
   restart and successfully play again; check walls, cover, objective gating and
   route fairness. Include two consecutive runs in the evidence.
3. Fix map/player/engine problems in owned files. Report sensor/guard/FX integration
   problems to their owners via the shared context; coordinate shared edits with Mehal.

**Immediate team goal:** one reliable TEST-mode heist that survives restart.
Then prove the same pipeline with a real sensor, check the deployed HTTPS build,
record a real-sensor backup and rehearse the demo. Mark these goals complete only
with actual evidence. No new endpoints or module contract changes are introduced.

### Latest independent integration check — 25 Oct 2026, 11:04 IST (Soham)

Audited actual `main` code at `f257c43` in a separate clean checkout, plus GitHub PR
states. All four core modules are present/connected on main; **do not treat the
reported integration milestone as demo-ready acceptance yet**. Art PR #3 is still open.

Fresh evidence:
- `node --test tests/guards/guards.test.js tests/engine/geometry.test.js`: **18 passed**
  (14 guard + 4 map/movement checks).
- Standard `npm ci`: **failed**, ERESOLVE: Vitest 5.0.5 requires Vite >=6.4 while the
  root locks Vite 5.4.21. Using `npm ci --legacy-peer-deps` only in the audit checkout
  allowed a build: `npm run build` **passed**. Root `npm test` still **failed** at
  Vitest startup (`ERR_PACKAGE_PATH_NOT_EXPORTED`, Vite `./module-runner`).
- Chromium initial page: one canvas, two patrol guards, mode TEST, BPM null,
  calibrated false, stale true. After 1.5 s the test stream still had no reading.
- Clicking Start with that state entered PLAYING and moved guards. This bypasses
  the documented fresh/calibrated input gate.
- Manually switching the sensor facade live → test started test readings (~72 BPM)
  and pulses; normal initial TEST mode never starts its timer because initial mode
  is already test and the setter returns early. There is no normal HUD test-mode action.
- Switching to disconnected LIVE input during play left status PLAYING with
  BPM null/stale true. Automatic sensor-loss pause is not wired into main yet.
- Restart returned the engine to ready but retained old guard positions; darkness
  and guard display objects disappeared. Starting again caused browser error
  `Cannot read properties of null (reading 'setSize')`. main creates external
  Guard/FX/Visibility instances only once; rebuild/dispose them on engine lifecycle.

Priorities/owners (findings, not unauthorized contract changes):
1. Mehal: align root Vite/Vitest and make the documented install/test commands work.
2. Shubranshu + Mehal: initialize TEST readings through the normal startup/UI path.
3. Mehal + Shubranshu: gate Start/Resume; pause on disconnected/stale input; expose
   usable recovery/test controls. PulseSystem currently reads raw bpm; adopt the
   agreed processed cadence input as part of the sensor integration check.
4. Mehal + engine/guard owners as needed: destroy/recreate external run systems and
   reset guards, timers, overlays and listeners on restart; test two complete runs.
5. Mehal: review/merge art PR #3. Team: actual sensor verification, full run,
   deployed HTTPS check, balance and recording remain unverified by this audit.

No source files or dependency versions were changed during this status check.


Owners report evidence here. Feature-branch implementation is not merged/integrated
completion. Prior prototype tests do not count; the engine results below are fresh.

| Owner | Current status | Next action | Commit / PR / verified checks |
| --- | --- | --- | --- |
| Soham | Engine merged; art PR #3 awaiting review | Support art integration; playtest walls/cover/objectives and two consecutive runs | [Art PR #3](https://github.com/Mehal-Skanda-R/hackathon_peak/pull/3), `db5fd09`; 4 geometry + 5 Chromium checks, fixture/root builds and TEST-mode smoke passed |
| Shubranshu | Sensor code merged; hardware unverified | Fix normal TEST startup with Mehal; verify state/calibration/loss and actual device | Device/model and live results pending |
| Shyam | Guards merged/wired; component checks pass; lifecycle audit issues open | Verify integrated guards and second-run reset/disposal with Mehal | `feature/guard-ai` @ `ffc4cdd`; `node --test tests/guards/guards.test.js` 14 passed; browser smoke run with local-only wiring, no console errors |
| Mehal | All core modules wired; integration acceptance blockers recorded below | Fix install/tests, valid-input gating, TEST startup and restart; review art PR #3 | Commits ba8eb96 to ca21070 |

### Soham's engine handoff — 25 Oct 2026, 10:14 IST
- Code: `feature/game-engine` at `8a15f7ed5dc1e4c0a4daa6fc2dd60b3b8bb3b924`,
  [PR #1](https://github.com/Mehal-Skanda-R/hackathon_peak/pull/1). Remote tree verified
  identical to tested local files. PR #1 has since been merged; full-team completion is not claimed.
- Changed: three owned `src/game` modules, `docs/ENGINE_HANDOFF.md`, isolated
  `tests/engine/` fixture/package/lockfile/configs/tests. No shared production files changed.
- Implemented APIs: the MuseumScene methods above, plus `getState()` for the engine-only
  snapshot. Named `ENGINE_EVENTS`, frozen geometry/helpers, `scene.walls` StaticGroup
  for guard colliders. Player coordinates come from the current Arcade body center.
- Playtest layout revision (25 Oct 2026): Soham found reaching the artefact too easy.
  Closed the bottom gallery shortcut, added central/artefact-room partitions and moved
  artefact center to (720,80). Shortest four-direction route: 44 tiles (1408 px),
  formerly 31 (992 px). All floor/cover/objectives remain reachable; 4 geometry +
  5 browser tests freshly passed. Shyam must use the revised WALLS for guard routes.
  No module API, world-size, movement-speed or cover-position change.
- Lifecycle: initial ready; explicit Start; paused with reason; terminal locks; R/HUD
  restart returns to ready. Restart key uses down events so short taps are not lost.
- Integration: enforce fresh/calibrated source before Start/Resume in Mehal's caller.
  Engine pauses Arcade bodies, not the entire scene. Gate guard/pulse/timer work on
  playing; clean up/rebuild external systems on shutdown/ready; preserve external sensor.
- Reproduce: `cd tests/engine`, `npm ci`, `npx playwright install chromium`,
  `npm run test:unit` (4 passed), `npm run test:browser` (5 passed), `npm run build`
  (passed; Phaser chunk warning, ~335 kB gzip). Node 24.12.0 / Chromium.
- Browser checks cover full keyboard heist, walls/cover, ready gating, all-body pause,
  reason/resume rules, terminal locks, stable restart bodies/colliders/listeners and
  immutable/non-spamming snapshots. No known failure in tested cases; hardware and
  production integration remain unverified. `npm run dev` serves engine-only fixture
  on port 5174; this is not the shared production starter or a sensor demonstration.

### Soham's concept-art upgrade — 25 Oct 2026 (IST)
- [PR #3](https://github.com/Mehal-Skanda-R/hackathon_peak/pull/3), branch
  `feature/museum-art`, code `db5fd09998c857b93cbda3c6d394b29f16cd2265`; open for review.
  This is a follow-up to merged engine PR #1, based on integrated main `ca21070`.
- Soham asked for the PPT concept's visual atmosphere. Added engine-owned helper
  `src/game/MuseumArt.js`: procedural stone/brick, rugs, banners, plants/statues,
  warm lamp pools, golden crystal and cyan thief walking frames. Updated MuseumScene,
  Player and engine fixture styling/tests/handoff. No new external art/font assets.
- Player is now a 40px visual Sprite with the original centered 18px Arcade body.
  Initial inset is synchronized before ready pauses physics. Map, routes, movement,
  hiding logic, objectives, lifecycle and public engine event/state contracts unchanged.
- Layers exposed on scene: `worldArt` depth 0, `exitVisual` 2, `artefactVisual` 4,
  player 10. Invisible collision rectangles remain in `scene.walls`. All fit under
  Mehal's darkness overlay 50 and pulse graphics 51. Lamp glows are baked scenery;
  real visibility/pulse behavior still belongs to Mehal. Texture cache reused on restart.
- Art preview at port 5174 has a responsive museum frame/mission panel. These are
  fixture files only; production HUD, main.js and src/style.css were not modified.
- Fresh checks: 4 geometry + 5 Chromium gameplay/lifecycle passed; fixture build
  passed (~338 kB gzip); desktop/390px screenshots inspected, no horizontal overflow.
  Against integrated main base `ca21070`, root npm ci/build passed; TEST-mode smoke
  showed one canvas, Start → PLAYING, movement and pulse/darkness over art, no page errors.
  Real BLE/guard integration not tested by this pass. Root lockfile audit warnings
  were inherited; shared dependency owner can address them.
- Mehal: merge PR #3 and retain overlay depths. See docs/ENGINE_HANDOFF.md in that
  branch for artwork, body-center and cleanup details. Full-team balance still pending.

### Shyam's guard handoff — 25 Oct 2026 (IST)
- Code: `feature/guard-ai` at `ffc4cdd`; files `src/game/Guard.js`, `src/game/GuardSystem.js`,
  `tests/guards/guards.test.js`. No shared files changed. No PR opened yet.
- API exactly as section 5. Extra named exports: `GUARD_EVENTS`, `GUARD_ROUTES`,
  `GUARD_TUNING`, `findPath`. Guards draw their own rectangles + suspicion bar (depth 9).
- Routes (tile col,row; revised WALLS): `guard-gallery` (9,2)→(15,2)→(15,14)→(9,14);
  `guard-east` (17,4)→(23,4)→(23,15)→(17,15). Legs walked by 4-direction tile BFS.
- Adopted tuning = section 4 values (0.25/pulse, 0.08/s decay, hiding ×0.25, chase ≥0.75,
  catch 22 px with line of sight). Added: body 20 px; speeds patrol 70 / investigate 90 /
  chase 130 px/s (player 160); chase gives up after 3000 ms without sight; guards don't
  pass walls (geometry via `scene.canOccupy`/`hasLineOfSight`, not Arcade bodies).
- Wiring for Mehal: `new GuardSystem(museum, museum.getMapGeometry())`; forward
  `heartbeat:pulse` to `handlePulse`; call `update(delta, museum.getPlayerState())` only
  while playing; `guards:caught` → `museum.catchPlayer()`; put `getStates()` into
  `GameState.guards`; create a fresh GuardSystem after each scene restart and `destroy()` on shutdown.
- Tests: `node --test tests/guards/guards.test.js` (Node 22.22.0): 14 passed — routes reachable,
  60 s patrol never inside walls, gain/radius/dedupe/hiding, decay, chase, catch once,
  no catch through walls, no catch from pulse alone, give-up/return, pause gating, reset/destroy.
  Not yet tested: full integrated play, real sensor. Balance is untested.

Open problems:
- Exact sensor model/availability and actual desktop connection; do not assume Apple
  Watch/Galaxy Watch exposes the standard BLE service without an extra bridge.
- Real seated BPM variation and appropriate sensitivity; initial constants are untested.
- Map dimensions/speed selected by Soham above; guard routes/speeds published in Shyam's guard handoff; integration wiring pending (Mehal).
- Exact GameState writer API and initial scene wiring; Soham + Mehal own this decision.
- Team repository write access and hosting access must be verified per teammate/AI.
- No role acknowledgement or implementation is claimed on behalf of an absent teammate.

## 8. Frequent shared-context synchronization — mandatory

This is a shared Git document, not real-time chat or a magically synchronized memory.
Each AI must actively fetch/read/update it during work. No background automation is
assumed; an idle AI does not run. A text reply called a sync is not proof of a push.

### When to read/pull
- At every new task/session and when the user says `sync`.
- Before editing a shared file, defining/changing an API, integrating a teammate's
  module, or making a decision that could depend on newer work.
- After each meaningful milestone, before a code push/PR/merge/handoff, and at safe
  checkpoints no more than about **15 active working minutes** apart on long tasks.
- Fetch even if working on a feature branch: its local context copy can be stale.

```sh
git status --short --branch
git fetch origin
git show origin/main:context.md
```

Use `git pull --ff-only` when on a clean tracking branch. On a feature branch,
fetch/read main's context first; merge current main when safe/needed, resolve
conflicts deliberately and test. Never blindly pull into uncommitted work, auto-stash
someone else's edits, reset away files or force-push to make synchronization easier.

### What to push and how
After a meaningful decision, API/file change, milestone or blocker, update only the
relevant sections and your status row. Include owner, date/time (IST), actual code
commit/PR, tests and pending work. Update the current contracts in place; do not
bury incompatible versions in an ever-growing changelog. Keep recent history short.

1. Code goes to the owner's feature branch in small commits; push it and open/update
   a PR. Include the actual interface changes and tests in that PR.
2. Context-only updates go promptly to canonical `main:context.md` through a **clean
   main checkout dedicated to documentation**, so all teammates can read them before
   a feature merges. Pull latest main first; edit/stage only context.md. Never push
   unreviewed feature code to main under the label of a context sync.
3. Before pushing context, fetch again. If main changed, preserve the teammate's
   changes, reconcile the small update, and retry a normal fast-forward push. Never
   replace the entire remote context from a stale feature-branch copy; never force.
4. If branch protection requires a PR, open a context-only PR and ask Mehal to merge
   promptly. Until merged, report **pending context PR**, not canonical publication.
5. Verify publication by fetching and reading the remote commit/file. Report its SHA.
   If access fails, state the error and keep a local patch; do not claim synchronization.

Any teammate can publish factual status. **Contract/ownership/stack changes need
affected owners' agreement**; mark proposals pending with owners/PR links until
agreed. Pending proposals do not override the active contracts. Routine implementation
details inside an owned module do not require whole-team approval.

Example context-only workflow, only inside the clean documentation checkout:
```sh
git pull --ff-only origin main
# Read, reconcile, then edit context.md only.
git add -- context.md
git diff --cached --check
git diff --cached -- context.md
git commit -m "docs(context): OWNER milestone or decision"
git push origin main
git fetch origin
git show origin/main:context.md
```

### User command: `sync`
Perform the safe read/reconcile/publish steps relevant to your work, then reply
**ONLY** with `CONTEXT UPDATE` and at most **8 bullets** covering decisions made,
new/changed module APIs (there are no backend endpoints), file/folder changes,
verified tests, open problems, and the remote context commit or explicit push failure.
No preamble, extra headings or unsupported claims. A sync does not authorize
unrelated edits, changing agreed contracts, messaging other people, or merging code.

### Short handoff template for every owner
Owner / branch / code commit or PR; changed files; implemented exports and payloads;
commands actually run and results; integration dependencies; blockers; next step;
context commit verified on main (or publication pending/failed).

## 9. Recent decisions

- 25 Oct 2026 — Soham requested a complete fresh start and a comprehensive canonical
  context for all four teammates/AIs; previous context/prototype explicitly superseded.
- 25 Oct 2026 — Fresh baseline chooses modular Phaser 3 + Vite + Vercel, allocates
  roles above, establishes target v1 contracts and frequent context synchronization.
  Test input belongs to the sensor owner; Mehal owns its UI and the single pulse scheduler.
- 25 Oct 2026 — Preliminary description preserved: automatic pulses, baseline-relative
  radius, live-input dependency, clearly disclosed test mode and small complete heist.
- 25 Oct 2026 — Soham explicitly authorized adapting the earlier engine to this fresh
  assignment. Reuse is permitted for his engine modules/tests, with new lifecycle
  implementation and fresh verification. Shared starter remains Mehal's responsibility.
- 25 Oct 2026, 10:14 IST — Soham's adapted engine is implemented/freshly verified in
  PR #1; see section 7 for exact evidence and remaining integration. No hardware
  checks or full integrated build have been verified.

