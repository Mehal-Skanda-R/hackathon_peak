// The Heart Lock on floor 07: the Golden Heart's case opens for "a living
// heart". Stand at the case and raise your heart rate `raise` BPM above your
// baseline (arming it), then let it settle back to `settle` or below for
// `settleHoldMs` while staying near the case (nearby cover counts). Pure logic.
//
// Accessibility: anyone can also pick the lock slowly by standing at the case
// for `pickMs` in total, so no player is locked out of the story by their body.
// This responds to heart rate relative to the player's own baseline only; it
// makes no claim about stress, fear or fitness.
export const HEART_LOCK = Object.freeze({
  raise: 15,
  settle: 5,
  settleHoldMs: 2000,
  pickMs: 25000,
  nearRange: 48,     // px from the case to work the lock
  settleRange: 120,  // px from the case to settle (reaches the cover beside it)
});

export function createHeartLock(tuning = HEART_LOCK) {
  return { phase: 'raise', pickedMs: 0, settledMs: 0, tuning };
}

// Advance the lock; returns the events that happened: 'armed', 'opened'.
export function updateHeartLock(lock, deltaMs, { delta, distance }) {
  if (lock.phase === 'open') return [];
  const t = lock.tuning;
  const events = [];
  const near = distance <= t.nearRange;
  if (near) lock.pickedMs = Math.min(t.pickMs, lock.pickedMs + deltaMs);
  if (lock.phase === 'raise' && near && delta >= t.raise) {
    lock.phase = 'settle';
    events.push('armed');
  }
  if (lock.phase === 'settle') {
    lock.settledMs = distance <= t.settleRange && delta <= t.settle ? lock.settledMs + deltaMs : 0;
  }
  if ((lock.phase === 'settle' && lock.settledMs >= t.settleHoldMs) || lock.pickedMs >= t.pickMs) {
    lock.phase = 'open';
    events.push('opened');
  }
  return events;
}

// Snapshot for the HUD panel.
export function heartLockView(lock, delta) {
  const t = lock.tuning;
  return Object.freeze({
    phase: lock.phase, delta, raise: t.raise, settle: t.settle,
    pick: lock.pickedMs / t.pickMs, settled: lock.settledMs / t.settleHoldMs,
  });
}
