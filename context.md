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

### Crossbreed presentation agreement — Soham / team, 25 Oct 2026

Soham confirmed the team accepts this positioning:
- Name both technologies: standard BLE Heart Rate Service through Web Bluetooth
  (wearable physiological sensing) and Phaser 3 (real-time stealth simulation).
- Measured heart rate/BPM is the input. In-game "noise" means simulated spatial
  exposure, not microphone audio. Signal noise means measurement variation.
  Do not claim stress/fear detection, emotion classification, medical diagnosis,
  or exact synchronization of each animation with an individual physical beat.
- The judged product requires LIVE sensing. Missing input pauses the heist, with
  no automatic TEST fallback. Keep TEST as an explicitly disclosed development
  simulator, separated from the competition experience/configuration.
- This is an approved release requirement, NOT proof that separation is shipped:
  inspected main at 4254863 still initializes TEST and exposes mode controls.
  Mehal/integration coordinates implementation; Shubranshu verifies actual hardware.
- Demonstrate real input driving both reveal and guard suspicion, then disconnect
  and recover valid input before explicit Resume. A recorded real-device run may
  back up the demo; TEST alone does not prove Crossbreed integration.
- Soham created an editable 14-slide pitch (12 main + 2 appendix) with speaker
  notes and visible terminology/removal-test distinctions. Local deliverable:
  presentations/Heartbeat-Heist-Crossbreed-Pitch.pptx in Soham's workspace,
  not committed to this repository. Real-device proof remains pending in the deck.
  No game code or module APIs changed for this presentation task.

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
  inside that zone is allowed. Hiding reduces pulse exposure (it never stops pulses)
  and makes the player invisible to guards: no sight, no capture (decision below).
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
  state. Cover attenuates pulse suspicion AND prevents sight/capture while fully hidden
  (Shyam decision, 25 Oct; supersedes the earlier attenuation-only rule).

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

Calibration duration: LIVE 20 seconds; TEST 3 seconds (decisions in section 9); require valid fresh samples and restart
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

### Integration tasks by Shyam's AI for Mehal — 25 Oct 2026 (IST)
- **Decision:** Mehal's AI ran out of quota, so Shyam asked his AI to do Mehal's assigned
  integration tasks. Mehal keeps ownership of main.js/GameState/HUD/package.json/deploy.
- Merged into main: PR #7 sensor fix (`e71c30a`), PR #5 preview renderer (`615bf45`),
  PR #6 combined-heist test + `guardTexture` (`7f1b674`; main's newer context.md kept).
- `7a0f34a` Resume fix: `GameState.isSensorUsable(sensor)` is the one readiness rule for
  Start, Resume and the sensor-loss pause (calibrated, fresh, smoothedBpm; LIVE also
  connected). HUD: RESUME button (or Space) only while paused and usable, never after
  caught/victory; sensor line (CALIBRATING / NO SIGNAL / NOT CONNECTED / READY); pause
  reason; Start/Resume greyed until usable; TEST BPM -5/+5 buttons; USE TEST MODE in LIVE.
- Evidence (Chromium, Node 22.22.0): `npm ci`, `npm test` (30 passed), `npm run build` pass.
  Soham's `tests/engine/combined-heist.cjs`: two consecutive keyboard-only **victories**,
  `testStartupWorkaround: false`, no page errors. UI-only run: fresh load calibrating, Start
  greyed and ignored → calibrated → Start → CONNECT BLE (no device) → paused "Sensor input
  lost or stale", guards frozen, Resume disabled, Space ignored → USE TEST MODE → ~45 s
  recalibration → Resume → playing → caught (harness teleport) → no Resume; Resume/Space
  ignored → R → guards (304,80)/(560,144) suspicion 0 → second run starts. No errors.
- **Not done:** Vercel deployment (no Vercel access in this environment; import the repo in
  Vercel, framework Vite, build `npm run build`, output `dist`), real BLE device, human
  balance playtest, backup recording, rehearsal.

### Sensor fixes by Shyam's AI for Shubranshu — 25 Oct 2026 (IST)
- **Decision:** Shubranshu's AI was unavailable, so Shyam asked his AI to cover the
  sensor code tasks. Shubranshu keeps ownership of `src/sensor/*` and the hardware test.
- Shubranshu's own `9ef7cfa`/`313d719` (TEST auto-start on module load, same-mode TEST
  no-op only while the watchdog runs) were reviewed and kept. With them, a fresh page load
  now produces TEST readings with no live→test workaround.
- [PR #7](https://github.com/Mehal-Skanda-R/hackathon_peak/pull/7) `fix/sensor-test-startup` @ `1b91197`:
  the stale watchdog, BLE disconnect and `disconnectHeartRate()` now clear calibrated/
  baseline/delta/BPM (previously `calibrated` stayed true); fixes the calibration start at
  timestamp 0; adds export `parseHeartRateMeasurement`; adds `tests/sensor/sensor.test.js`
  (8 tests: fake clock/timers/Web Bluetooth) to `npm test` (package.json: Mehal to confirm).
- Evidence: `npm test` 30 passed; build passed. Chromium fresh load, no workarounds:
  readings at 3 s; Space blocked until calibrated (~45 s); Space → playing; switching to
  LIVE without a device → paused, calibrated false, stale true, no TEST fallback; no errors.
- Still open: real device test (Shubranshu); Resume after a sensor-loss pause (Mehal).

### Soham → Shyam/Mehal: full wins, victory gating and guard artwork — 25 Oct 2026, 11:55 IST
- Synced/tested main base `5a8b0ad`; PR #4 is already merged. Root npm test now
  **passes 22 checks** (18 guards + 4 geometry). No walls/routes/tuning changed.
- [PR #6](https://github.com/Mehal-Skanda-R/hackathon_peak/pull/6), `test/combined-heist`
  @ `492ce17316949d57211403cdc7ea91a5483c3a5d` adds a reproducible keyboard-only
  full-heist check and optional guard art helper; see docs/COMBINED_PLAYTEST.md.
- Two consecutive wins at calibrated ~72 BPM (baseline 72/delta 0), 17.465/17.471 s,
  21 automatically scheduled pulses each. Both guards/visibility active, no player
  or guard teleportation, no invulnerability or artificial state/calibration injection.
- After BOTH victories, guards stayed exactly frozen for 2.5 s and no pulse emitted.
  R restored both guards to their original patrol/spawn/suspicion snapshots. One
  canvas, zero page errors across both runs.
- Neither guard center occupied the artefact west opening (tile 17,3) in those
  playing frames. Guards have no Arcade bodies and cannot physically seal a passage;
  capture can still make a doorway tactically dangerous. No patrol camping observed.
- Separate 110 BPM trial after genuine 72 BPM calibration (delta 38) was caught in
  6.248 s before pickup, 12 pulses; gallery suspicion 1, east ~0.864. This makes a
  direct sprint risky; one trial cannot establish that guard-east is unfair or
  high-BPM play impossible. Known-route automation is not human navigation in darkness.
  Human cover/waiting/patrol-timing balance testing remains necessary.
- The normal initial TEST source was still idle. Tests explicitly used live→test
  activation and waited the full 45 s calibration. That startup issue is not cleared;
  real BLE behavior was not tested.
- Optional engine-owned `guardTexture(scene, facing='down', stride=0)` export in
  MuseumArt.js provides eight cached 40×40 frames matching the thief/museum palette.
  Shyam owns adoption in GuardSystem: preserve 20px logic bodies and depth-9 bars;
  use image texture/tint instead of Rectangle setFillStyle. No visual wiring in PR #6.
- Helper render/cache smoke and fixture build passed. Coordinate changes/API payloads,
  map geometry, patrols, speeds and suspicion/caught rules are unchanged.


### Museum preview white-canvas fix — 25 Oct 2026 (Soham)
- User preview at port 5174 showed a white broken canvas while status still said
  VICTORY. The actual affected tab console reported: WebGL Context lost. Renderer disabled.
- [PR #5](https://github.com/Mehal-Skanda-R/hackathon_peak/pull/5),
  `fix/preview-canvas` @ `98f0544cbebf1d34e8c92a03b4b39f68ee11c8f9`: use Phaser.CANVAS
  in the art/engine fixture, which has no WebGL-only effects. Production main and
  gameplay/sensor/guard contracts remain unchanged.
- Reloaded affected tab and visually verified the museum restored. Four geometry
  + five Chromium checks passed with WebGL disabled, including full heist/victory/
  restart and a 2D-context assertion. Fixture build passed.
- Mehal: review/merge PR #5. Keep production WebGL for the inverted visibility
  mask; the renderer choice here is specific to the isolated art/engine preview.
- Art PR #3 is already merged into main (`b108e0a`); older pending-art notes are historical.


### Restart and runner fix verification — 25 Oct 2026, 11:16 IST (Soham)

Checked Mehal's code fix `b5efa88` on main snapshot `e8fbcce`. This supersedes
only the restart and dependency-version findings in the earlier 11:04 audit.

- **Restart VERIFIED fixed:** main now destroys/recreates GuardSystem, PulseSystem,
  PulseEffects and VisibilitySystem on engine:ready. Chromium exercised three
  controlled chase/contact captures by guard-gallery across R restarts. Each new run
  caught again; guards reset exactly to (304,80)/(560,144), suspicion 0, caught flags
  false, pulse count 0. Guard visuals restored; one darkness overlay and one ring
  graphics object per run. Pulse listeners stayed 3, ready listeners 1, canvas 1;
  no page errors. This was controlled capture testing, not three full winning heists.
- **Version mismatch VERIFIED fixed:** package and lockfile now resolve Vitest 1.6.0
  with Vite 5.4.21. Standard `npm ci` succeeded without legacy-peer flags;
  `npm run build` passed (normal Phaser chunk warning).
- **Root npm test STILL FAILS:** Vitest now starts, but collects the node:test files
  (`tests/engine/geometry.test.js`, `tests/guards/guards.test.js`) as empty Vitest
  suites, plus the Playwright browser spec which lacks its nested dependencies in
  a root-only install. Errors: No test suite found / Failed to load @playwright/test.
- Mehal's remaining test task: route existing Node and Playwright suites to their
  correct runners, or explicitly migrate/configure Vitest; make npm test return success
  for real executed tests. Merely changing versions does not finish runner setup.
- TEST readings were enabled via a browser-only live→test mode cycle for this check.
  Initial TEST startup and input-readiness/disconnect-pause findings were not fixed
  by this commit and are not cleared by this verification. No real BLE test claimed.
- Verification only: no source/dependency files were modified by Soham.


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
| Soham | Engine/art merged; two full baseline wins and victory gating verified; helper/test PR #6 open | Human high-BPM/cover playtest; support Shyam's optional sprite adoption | [PR #6](https://github.com/Mehal-Skanda-R/hackathon_peak/pull/6), `492ce17`; 22 checks pass; two wins; stress trial documented |
| Shubranshu | TEST auto-start (`9ef7cfa`, `313d719`) + calibration-reset fix and sensor tests (PR #7, merged as `e71c30a`, by Shyam's AI) | Test the real device on the demo laptop | npm test 30 passed incl. 8 sensor; hardware unverified |
| Shyam | Guards on main with yellow thief-style sprites + ?/! state icons (`e42b0b1`); also covered sensor/integration tasks (see notes) | Guard balance tweaks after Soham's human playtest | npm test 32 passed; sprites checked in Chromium (patrol/suspicious/chase, darkness), no errors |
| Mehal | Integration tasks done by Shyam's AI while Mehal's AI is out of quota (see note): PRs #5/#6/#7 merged, Resume + HUD sensor controls on main | Deploy main to Vercel (needs Mehal's account) and verify HTTPS + Bluetooth; rehearse | main `7a0f34a`; npm test 30 passed; build passed; 2 wins + caught/Resume/restart UI run, no errors |

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
  `GUARD_TUNING`, `findPath`. Guards draw yellow thief-style sprites (`guardSpriteTexture`), a state-coloured suspicion bar and a ?/! icon (depth 9); see `e42b0b1`.
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

### Shyam's integrated-play check — 25 Oct 2026 (IST)
- Tested merged `main` @ `f4c0207` (includes Mehal's restart fix and art PR #3) plus
  [PR #4](https://github.com/Mehal-Skanda-R/hackathon_peak/pull/4) (`9f0c238`), Chromium, TEST mode,
  `tests/guards/integrated-play.cjs`. No page or console errors.
- Verified: guards idle in ready; both patrol, never inside walls; hidden pulse gain ≈0.05
  vs exposed ≈0.24; chase → caught with exactly 1 `guards:caught`; guards frozen while caught
  and paused. Restart (R): ready, both guards at (304,80)/(560,144), suspicion 0, exactly
  4 live guard display objects; second run patrols and catches again (1 new event).
- PR #4 fixes the audit `setSize` on null: GuardSystem drops views on scene `shutdown`
  and never touches destroyed objects. Routes re-checked against current WALLS (unchanged).
- Harness workaround: the TEST sensor only produced readings after switching live → test
  (initial BPM stays null), so Start-gating/TEST startup remain Mehal + Shubranshu items.
- Root `npm test` (Vitest) finds no suites in `node:test` files; run guard tests with
  `node --test tests/guards/guards.test.js` (18 passed) until Mehal decides the config.
- Not tested: victory-state gating, real sensor, balance.

Open problems:
- Exact sensor model/availability and actual desktop connection; do not assume Apple
  Watch/Galaxy Watch exposes the standard BLE service without an extra bridge.
- Real seated BPM variation and appropriate sensitivity; initial constants are untested.
- Map dimensions/speed selected by Soham above; guard routes/speeds published in Shyam's guard handoff; guards integrated and verified in play (see Shyam's integrated-play check).
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
- 25 Oct 2026 — Shyam, after playtesting the Vercel deploy (heartbeat-heist.vercel.app):
  TEST mode calibration shortened from 45 s to 3 s (`4e5b6bd`); LIVE keeps 45 s for a
  real resting baseline. Same state shape and gating; HUD shows the matching estimate.
  npm test 31 passed; fresh load → Start enabled after ~4.3 s in Chromium.
- 25 Oct 2026 — Shyam: LIVE calibration shortened from 45 s to 20 s so live demos start
  sooner (~20 readings at ~1 Hz). TEST stays 3 s. npm test 31 passed. Deployed at
  https://heartbeat-heist.vercel.app (auto-deploys from main). Baseline stability with
  the real wearable is untested; Shubranshu to confirm on the device.
- 25 Oct 2026 — Shyam: guards now use yellow sprites in the thief's art style (cap, badge,
  torch, facing/stride) instead of rectangles; '?' suspicious / '!' chase icons and a
  state-coloured suspicion bar (`e42b0b1`). Visual only; guard logic unchanged.
- 25 Oct 2026 — Shyam: end-of-round screen. Caught/victory now show CAUGHT! / YOU ESCAPED!
  over the game with PLAY AGAIN (full scene restart, auto-starts if the sensor is usable)
  and an 'or press R' hint. Verified both outcomes in Chromium; one canvas, no errors.
- 25 Oct 2026 — Shyam: production UI now uses Soham's museum frame + briefing design
  (previously only in tests/engine/fixture). Live HUD folded into the gold panel; TEST
  controls moved into a labelled "Developer simulator · TEST" box; FULL SCREEN button/F key
  (Phaser Scale.FIT). No game-logic change. Note: the Crossbreed agreement's LIVE-first
  release configuration (TEST separated from the judged experience) is still NOT done:
  the page still starts in TEST. Needs a team decision on how TEST is reached (e.g. ?dev).
- 25 Oct 2026 — Shyam reported a black screen after reset on the deploy. Cause: R (and Play
  again when input is not usable) correctly returns to ready, where no pulses fire, so the
  dark canvas looked dead (and Start sat in the side panel, hidden in full screen). Fix
  `0a806c6`: an on-canvas screen for ready / waiting-for-input / paused (with Start, Resume,
  Connect sensor) as well as caught/victory. Restart-to-ready contract unchanged.
- Soham's `tests/engine/combined-heist.cjs` is timing-sensitive: in slow headless Chromium
  (~20-25 fps) key release overshoots corners by up to ~10 px and the walker can wedge on a
  wall corner (e.g. return leg toward (464,208)). Seen on main with and without `0a806c6`;
  not a game defect. Soham may want a wider stop tolerance or per-frame key release.
- 25 Oct 2026 — Shyam (guard owner), after playtesting: a player fully inside a cover zone
  can no longer be seen or caught by guards; a chasing guard loses them and gives up after
  3 s. Pulses while hidden still add 0.25x suspicion. Supersedes "cover is not invulnerability
  to physical capture" in section 4. Commit `86d6942`; npm test 34 passed.
- 25 Oct 2026 — Shyam: round-start map preview. Each ready -> playing transition shows the
  whole museum for 1 s, then fades to dark over 0.5 s (`VisibilitySystem.revealAll`, `b2ad925`).
  Visual only (no guard exposure); Resume does not trigger it; never a permanent reveal.
- 25 Oct 2026 — Shyam: pulse reveal is now a soft radial gradient (Among Us-style vision):
  darkness RenderTexture with a gradient brush erased per pulse; reveal fades out at the end;
  the white outline ring became a faint soft glow band. Radius/timing/exposure unchanged.
- 25 Oct 2026 — Shyam: the pulse light/glow now follows the thief while it expands (drawn at
  the current player position). Guard exposure still uses the pulse's emission snapshot.
- 25 Oct 2026 — Shyam: constant dim vision circle (radius 120 px = 120% of base pulse radius,
  28% strength, soft edge) follows the thief and shows the map faintly; it never shows guards.
  Guards are drawn only in pulse light/preview (VisibilitySystem.revealAt + GuardSystem
  setVisibilityProbe). Visual only; detection unchanged.
- 25 Oct 2026 — Shyam: hiding calm-down. While the player stays in cover, an alerted guard
  searches near the last sighting; after 3 s hidden it leaves and its suspicion drains
  linearly to 0 over 5 s (pulses from cover are ignored while calming; a pulse from the open
  resumes normal rules). Icon: '!' chasing; '?' fades red -> orange -> yellow -> none.

### Levels, coins and doors — 25 Oct 2026 (Shyam decision; implemented by Shyam's AI, `def286c`)
- **Decision:** more levels are planned, so the crystal is the collectable of the **final level
  only**. Levels are joined by an **exit door**; walking in plays a door animation and loads the
  next level. **No way back** (each level's spawn sits at a barred "NO RETURN" entrance).
  **Coins** are an optional score on paths and in corners, carried across levels.
- `config.js`: `LEVELS` + `setLevel(index)`; `WALLS`, `HIDING_ZONES`, `SPAWN`, `ARTEFACT` (null
  except final level), `EXIT` (the level's door), `ENTRANCE`, `COINS`, `MAP_GEOMETRY` are live
  bindings of the active level. Level 1 "The Gallery" = previous map, door in the old crystal room.
  Level 2 "The Vault" = new map, crystal in a vault with its own cover, door opens only with it.
- Engine contract additions (MuseumScene): status `'transition'` during the door animation;
  events `engine:coin`, `engine:door`, `engine:level-complete`; state adds `level`, `levelCount`,
  `levelName`, `needsArtefact`, `coins`, `levelCoins`, `levelCoinTotal`. R/caught retries the
  current level; `restartGame()` (Play again after final victory) returns to level 1.
- Guards: `GUARD_ROUTES_BY_LEVEL` (vault: central hall + east wing loops).
- Evidence: npm test 41 passed (geometry per level; guard routes per level). Chromium run of
  coins -> door -> level 2 -> locked door -> crystal -> victory -> Play again; no errors.
- **Soham:** `tests/engine/browser/engine.spec.js`, the engine fixture and
  `tests/engine/combined-heist.cjs` still assume a level-1 crystal (`ARTEFACT`) and need updating
  to the door objective. Map art for future levels goes in `LEVELS[i].decor`.
- 25 Oct 2026 — Shyam: **7 levels** (`1774fa4`), from the team concept sheet: 1 The Gallery,
  2 The West Wing, 3 The Gallery Hall (dinosaur skeleton), 4 The Archive (maze), 5 The Vault
  Ring, 6 The Royal Exhibit (pool + bridge; exit bottom-left), 7 The Final Heist (crystal at the
  exit door, 4 guards). Replaces the interim "Vault" level 2. Levels 2-7 are text grids in
  `config.js` (legend in `asciiLevel`); concept-sheet gem cases became coin clusters. Each level
  has 2-4 guards (`GUARD_ROUTES_BY_LEVEL`); routes to the door are 40-48 tiles (final 34).
- 25 Oct 2026 — Shyam: start-of-level map preview is now 2 s (then 0.5 s fade); during the
  hold the thief cannot move and pulses/guards wait (`setInputLocked`, `isHolding`).
- 25 Oct 2026 — Shyam: castle home screen (`2384405`) with floor select, How to play,
  progress panel and in-game MENU (pauses as 'Menu open'). Progress (unlocked/completed floors,
  best coins) is per-browser localStorage via src/ui/progress.js. Engine: `startAtLevel(index)`.
