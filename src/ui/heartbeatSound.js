import { isMuted } from './audio.js';

// A synthesized "lub-dub" for each heartbeat pulse, so the player hears the
// rhythm the guards hear. Presentation only. No audio file: two short
// low sine thumps through Web Audio. Silent while muted or before the
// browser allows audio (the first click or key press).
let ctx = null;

const context = () => {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
  }
  return ctx;
};

export function initHeartbeatSound() {
  const unlock = () => { const c = context(); if (c?.state === 'suspended') c.resume().catch(() => {}); };
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
}

function thump(c, at, freq, peak) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq * 1.6, at);
  osc.frequency.exponentialRampToValueAtTime(freq, at + 0.05);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
  osc.connect(gain).connect(c.destination);
  osc.start(at);
  osc.stop(at + 0.18);
}

// intensity 0..1: how far the pulse grew above its base size.
export function playHeartbeat(intensity = 0) {
  if (isMuted() || !ctx || ctx.state !== 'running') return;
  const level = Math.max(0, Math.min(1, intensity));
  const peak = 0.22 + 0.38 * level;
  const now = ctx.currentTime + 0.01;
  thump(ctx, now, 58 + 14 * level, peak);
  thump(ctx, now + 0.15, 50 + 12 * level, peak * 0.7);
}
