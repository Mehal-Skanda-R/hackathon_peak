# CONTEXT — Heartbeat Heist
Last updated: [time] by [name]
Event: Confluence Buildathon 2026 · Track: Crossbreed

## Problem & pitch
A stealth game where YOUR real heartbeat is the game mechanic.
A Bluetooth heart-rate monitor feeds live BPM into the game:
every beat sends out a pulse that reveals the map — but pulses
also alert guards. Stay calm to stay hidden.

## Stack
Frontend: plain HTML + JavaScript, Phaser 3 (pinned 3.x via CDN)
Backend: none
Hardware: Bluetooth heart-rate monitor [model: ___]
Hosting: GitHub Pages (Web Bluetooth needs HTTPS)

## Architecture / data flow
- HR monitor → Web Bluetooth → heartRate.js
- heartRate.js emits a "bpm" event (number) on every reading
- GameScene listens → each beat triggers a pulse
- Pulse reveals map tiles briefly + alerts guards in its radius
- Fake BPM mode: ↑/↓ keys change BPM (for testing without the strap)

## File structure
index.html
src/main.js              – Phaser config, starts scenes
src/heartRate.js         – Bluetooth connect + fake BPM mode
src/scenes/GameScene.js  – map, player, pulses, guards
assets/                  – sprites, tiles, sounds

## Module contracts (no backend, so no API endpoints)
- heartRate.connect() → asks user to pick device (must be on a button click)
- heartRate.on("bpm", (bpm) => {})  → bpm is a number
- Service: "heart_rate", characteristic: "heart_rate_measurement"
  (byte 0 = flags; bit 0 = 0 → BPM is uint8 at byte 1, = 1 → uint16)

## Who's doing what
- Shyam: [ ]
- A: [ ]
- B: [ ]
- C: [ ]

## Decisions (don't relitigate)
- Browser game, no backend, no frameworks (no React)
- Phaser 3 only — don't use Phaser 4 syntax
- Chrome/Edge only (Web Bluetooth doesn't work in Safari/Firefox)
- Fake BPM mode must always work, so everyone can test without the strap

## Open problems / blockers
- Does our strap/watch broadcast standard BLE heart rate? Test FIRST
- How BPM maps to pulse size/speed [decide]
- Calibrate resting BPM at game start? [decide]
- Guard behaviour when alerted [decide]
