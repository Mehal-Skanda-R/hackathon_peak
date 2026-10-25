# Soham → Shyam / Mehal: combined heist checks and guard art

`tests/engine/combined-heist.cjs` follows the approach in Shyam's integrated-play
harness, extended to win the actual heist with keyboard input and no teleports or
guard tuning changes. Both guards, heartbeat pulses and darkness remain active.
It waits for the full 45-second TEST calibration rather than bypassing Start gates.

Run production Vite separately, then:

```sh
cd tests/engine
npm ci
node combined-heist.cjs http://127.0.0.1:5176/
# Optional higher-BPM trial, after 72-BPM baseline calibration:
node combined-heist.cjs http://127.0.0.1:5176/ 110
```

The default checks two wins with an R restart between them, guard reset, guard
movement/pulses stopping after victory, browser errors, one canvas, and whether
guards occupy the artefact room's west opening. Route selection uses static BFS;
the player follows it with real arrow keys. This demonstrates winnability for a
known route, not difficulty for a first-time human navigating darkness.

The optional BPM trial records either a legitimate victory or caught outcome;
getting caught under higher exposure is not itself a regression. No injected
calibration, artificial guard state or shortened sample clock is used.

The current main's initial TEST source is idle. The harness explicitly reports
its live→test mode-cycle workaround, then uses actual sensor-facade samples and
waits for calibration. This check does not clear that normal-startup issue.

JSON evidence and screenshots are written under ignored
`tests/engine/test-results/combined-heist[-BPM]/`.

## Verified results — main base 5a8b0ad, Node 24.12.0 / Chromium

- Root `npm test`: **22 passed**. PR #4 is merged and its disposal checks are present.
- Baseline ~72 BPM, calibrated baseline 72, delta 0: **two consecutive victories**,
  17.465 and 17.471 seconds, 21 real scheduled pulses each. Both guard systems active;
  no player/guard teleportation, invulnerability, guard-state edits or tuning changes.
- After each victory, guard positions/states were identical after 2.5 seconds and
  no new pulse was emitted. R reset both guard snapshots to original patrol/spawn/
  zero suspicion. One canvas and zero page errors across both runs.
- Gallery suspicion peaked ~0.249, east suspicion 0 on this route. Neither guard
  center occupied the west opening (tile 17,3) in sampled playing frames. Guards have
  no Arcade bodies, so they do not physically wall off a doorway; capture can still
  make crossing dangerous. No persistent doorway obstruction was observed here.
- Higher-exposure trial: 110 BPM after genuine 72-BPM calibration (delta 38),
  same shortest route, **caught after 6.248 seconds before pickup**, 12 pulses.
  Gallery suspicion reached 1; east ~0.864. No error; no doorway occupancy before catch.
  A direct sprint is much riskier under strong pulses. This single trial does not
  establish which guard is too punishing or prove high-BPM play impossible.
- Balance judgement: known-route baseline play is winnable (possibly easy), while
  high-BPM play needs human testing with cover/waiting and patrol timing. No route,
  wall or guard tuning change is justified solely by these automated trials.
- Initial TEST source remains idle on base 5a8b0ad despite selecting TEST at startup;
  both checks reported the live→test workaround and waited the full calibration.
  Normal source startup remains Shubranshu/Mehal work; this is not a live BLE demo.

## Optional guard art helper (Shyam owns adoption)

```js
import { guardTexture } from './MuseumArt.js';
const visual = scene.add.image(guard.x, guard.y, guardTexture(scene, 'down', 0))
  .setDepth(9);
// Facing: up/down/left/right; stride: 0/1. Cached key, 40×40 transparent frame.
visual.setPosition(guard.x, guard.y);
visual.setTexture(guardTexture(scene, facing, stride));
```

This supplies burgundy-uniformed museum guards with gold trim, a cap and walking
frames matching the thief's palette. It adds no guard instances and changes no
behaviour, routes, speed, dimensions or suspicion. Keep the existing 20px logic
body and depth-9 suspicion bar. Images use tint/texture rather than Rectangle's
`setFillStyle`; replace that visual call in GuardSystem when adopting the helper.
Shyam should retain the shutdown/disposal fix and run the guard tests after wiring.

Helper smoke: eight 40×40 directional/walk frames rendered in the Canvas fixture,
cache count stayed stable on repeat calls, zero page errors. The helper is not yet
wired into production guards; Shyam owns that adoption.
