# After Hours: the Living Museum

Optional post-hackathon expansion, authorized by Soham on 27 October 2026.
Enter with **NEW MISSION / AFTER HOURS** on the existing castle home screen.
The original seven-floor campaign and its saved progress stay separate.

## Play

1. Choose an artefact, owned equipment and Solo or Local versus.
2. Accept the contract. Connect/calibrate the existing heart-rate source if needed.
   The inherited developer simulator remains explicitly labelled; it is not real BLE.
3. Start the mission. The two-second map preview holds movement and security.
4. WASD/arrows move. Hide fully inside green cover to lose guards.
5. Amber warns before a laser. Red captures. Quiet passages are safe.
6. Steal the artefact in the east vault and return to west extraction. Coins are
   optional loot in this mode. The curse changes the return journey.
7. On capture, retry with the previous attempt's ghost. On escape, spend marks
   on equipment. R retries after a terminal outcome; Esc pauses/resumes outside a
   dialog. Start/Resume buttons always enforce fresh, calibrated input.

### Implemented features

- Independent museum rhythm: a six-second cycle rotates across three laser
  sectors, with a 1.2-second warning and a one-second active interval. A curse
  begins a fresh quiet cycle instead of suddenly firing a laser at pickup.
- Three curses: Bellheart increases pulse radius by 65% and accelerates security
  to 4.8 s; Eclipse shortens light to 320 ms; Quicksilver accelerates security to
  3.8 s. Warnings remain 1.2 s. The same pulse radius reaches light and guards.
- One previous-failure ghost, with at most 12 distraction echoes. It cannot
  cancel a guard's real chase, lower existing suspicion or trigger player pulses.
- Two authored positions for an exhibit in the Echo Gallery. It moves only
  outside player vision, after pulse light expires, away from actors, with every
  coin/objective/guard waypoint reachable. Physics and guard paths change together.
  A safe opportunity is retried every 200 ms; successful shifts are 8 s apart.
- Separate black market: 6 marks + collected coins on escape. Four kits, including
  the free balanced kit, trade movement, pulse reach and reward. Purchases unlock
  equipment permanently in this browser. No rewards for failed/abandoned attempts.
- Local security director: two people share a keyboard. L selects a sector,
  J warns for 1.5 s then fires a 0.9 s sweep, K diverts non-chasing guards.
  Starts with 2 charges, earns 1 / 8 s up to 3, and has a 4 s action cooldown.
  This is local versus, not online thief/hacker co-op or a second wearable.

Soham explicitly removed cinematic replay. There is no replay viewer, timeline,
export or BPM history. The internal ghost buffer holds only player positions,
pulse locations/radii and bounded mission events in session memory. It samples
at 10 Hz for up to 10 minutes (6,001 frames), caps events at 1,800, and does not
loop a finished ghost. Forget previous ghost clears it; reload clears all ghosts.
Only equipment/marks persist under `hh-after-hours-v1`. No upload or backend.

## Architecture and compatibility

- One `Phaser.Game`. The existing `MuseumScene` sleeps while `AfterHoursScene`
  runs. Its player, guards, coins and paused run survive leaving/returning.
- Existing sensor facade, normalized readiness rule, `PulseSystem`, `PulseEffects`,
  `VisibilitySystem` and `GuardSystem` are reused. No second Bluetooth connection.
- Integrated Shyam's campaign polish through `b333b98`: heartbeat audio, danger
  vignette, pause keys, ratings/clock, home stars, hints and warm lamp lighting.
  Campaign pause shortcuts are gated during After Hours. P also pauses this mode.
  `VisibilitySystem(scene, map, { lamps })` adds an optional lamp override while
  retaining the existing campaign default. After Hours supplies its own map lamps
  and reuses the heartbeat sound, respecting the existing SOUND toggle. The
  sleeping campaign's danger overlay cannot bleed into the optional mission.
- Original config, map layouts, guard behaviour, sensor implementation, assets,
  package lockfile and campaign progression logic are unchanged.
- `main.js` registers the optional scene/UI and gates campaign controls while it
  is active. `hud.js` stops the sleeping campaign from overwriting mission labels.
- Scene-owned keys, window/document listeners, pulse consumers and display
  objects dispose on shutdown. Menu, sensor loss, focus loss and hidden tabs pause.
  Sensor recovery requires explicit Resume. All mission clocks freeze on pause.
- `rules.js`: pure geometry, shift safety, security phases, curses and budget.
- `recording.js`: bounded ghost samples and one-pass playback only.
- `profile.js`: validated equipment progression, with session fallback if storage
  is unavailable. No read/write to `hh-progress-v1`.
- `AfterHoursScene.js`: owns movement/collisions/objectives, security and ghost
  integration. `ui.js`, `style.css`, `art.js`: optional mission presentation.
- Map: 800 x 544 world pixels, 32 px tiles, 25 x 17 cells, top-left origin.
  Positions are actor centres. Player body 18 px, guards 20 px. The scene's
  `canOccupy`/`hasLineOfSight` use its own geometry, not campaign live bindings.
- `npm test` now includes the expansion rules suite. The existing menu-progress
  browser test's stale completed-campaign expectation now matches the already
  shipped behaviour: Continue returns to floor 1 after completing all seven.

## Verification

Node v24.12.0. Existing Vite 5.4.21 / Phaser 3.90.0 lockfile. No new dependencies.

```sh
npm ci
npm test
npm run build
npm run dev -- --host 127.0.0.1 --port 5190 --strictPort
```

In another terminal, after installing the existing isolated browser harness:

```sh
npm ci --prefix tests/engine
npx --prefix tests/engine playwright install chromium
node tests/afterhours/browser.cjs http://127.0.0.1:5190
node tests/ui/menu-progress.cjs http://127.0.0.1:5190
node tests/afterhours/playthrough.cjs http://127.0.0.1:5190
```

`PLAYWRIGHT_PACKAGE` may point to an already-installed isolated harness's
package.json. Local verification reused the historical copy's Playwright package.
Browser results/screenshots go to ignored `tests/engine/test-results/after-hours`.

Verified: 57 Node tests (50 including Shyam's progress tests, 7 expansion), production build, browser controls,
campaign preservation, collision against a moved exhibit, shifts/reachability,
warning-to-laser capture, curse/extraction, reward-once, equipment purchase,
three retries/ghost limits/listener disposal, one canvas, sensor-loss recovery and
campaign menu/progress regression. The movement controller drives normal movement
key states, Arcade collisions and cover with both guards/lasers enabled, no
teleports. It allows up to three ordinary attempts, retaining captures in its
result log and using the resulting ghost on retry; it is not a deterministic
human-balance verdict. It asserts at least one complete steal-and-return escape.

## Limits and next steps

- No online/networked multiplayer or dual-wearable hacker co-op. Those need a
  separate authoritative state/connection design, not a simulated completion claim.
- Safe authored exhibit shifting is deliberately modest; no arbitrary procedural
  maze mutations. A shift may wait indefinitely while visible or continuously lit.
- Movement-driven automation is not a human fun/balance study. Playtest all curses
  and equipment on the real demo laptop and actual Watch 7 before tuning them.
- The real wearable was not available for this verification. Existing LIVE
  contracts remain intact, with no new hardware latency claims.
- Existing dependency audit warnings and the Phaser bundle-size warning remain;
  no unrelated forced dependency upgrade was mixed into this expansion.
- This branch is reviewable separately. Do not deploy over the current campaign
  until the team chooses to merge it.
