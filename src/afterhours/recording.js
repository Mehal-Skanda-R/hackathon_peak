// Bounded session-memory recordings. No automatic BPM persistence or upload.
export const MAX_MS = 10 * 60 * 1000, SAMPLE_MS = 100, MAX_EVENTS = 1800;
export class RunRecording {
  constructor(meta = {}) { this.meta = { version: 1, ...meta }; this.frames = []; this.events = []; this.duration = 0; this.lastSample = -SAMPLE_MS; this.finished = false; }
  sample(time, snapshot) {
    if (this.finished || time > MAX_MS || time - this.lastSample < SAMPLE_MS) return;
    this.lastSample = time; this.duration = time;
    this.frames.push({ t: Math.round(time), ...structuredClone(snapshot) });
  }
  event(time, type, detail = {}) {
    if (!this.finished && time <= MAX_MS && this.events.length < MAX_EVENTS)
      this.events.push({ t: Math.round(time), type, ...structuredClone(detail) });
  }
  finish(time, outcome) { if (this.finished) return; this.duration = Math.min(MAX_MS, time); this.meta.outcome = outcome; this.finished = true; }
}
export function frameAt(record, time) {
  if (!record?.frames?.length) return null;
  const frames = record.frames;
  let lo = 0, hi = frames.length - 1;
  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (frames[mid].t <= time) lo = mid; else hi = mid - 1; }
  return frames[lo];
}
// Ghost events are consumed once, never looped or re-emitted as real heartbeats.
export class EchoPlayback {
  constructor(record) { this.record = record; this.cursor = 0; this.count = 0; }
  update(time) {
    const echoes = [], pulses = this.record?.events ?? [];
    while (this.cursor < pulses.length && pulses[this.cursor].t <= time) {
      const event = pulses[this.cursor++];
      if (event.type === 'pulse' && this.count < 12) { echoes.push(event); this.count++; }
    }
    return { frame: time <= (this.record?.duration ?? 0) ? frameAt(this.record, time) : null, echoes };
  }
}
