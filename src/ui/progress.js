// Per-viewer campaign progress (unlocked floors, best coins) kept in this
// browser only. Storage can be unavailable (private mode), so every access is
// guarded and the game works without it.
const KEY = 'hh-progress-v1';
const fresh = () => ({ unlocked: 1, completed: 0, bestCoins: 0 });

export function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && Number.isInteger(saved.unlocked) && Number.isInteger(saved.completed)) return { ...fresh(), ...saved };
  } catch { /* storage unavailable or corrupt */ }
  return fresh();
}

function saveProgress(progress) {
  try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch { /* ignore */ }
}

// level is 1-based; finishing it unlocks the next floor.
export function recordLevelComplete(level, coins, levelCount) {
  const progress = loadProgress();
  progress.completed = Math.max(progress.completed, level);
  progress.unlocked = Math.min(levelCount, Math.max(progress.unlocked, level + 1));
  progress.bestCoins = Math.max(progress.bestCoins, coins ?? 0);
  saveProgress(progress);
  return progress;
}

// Floor rating: one star for clearing it, one for taking every coin, one for
// never being chased. Pure so it can be unit-tested.
export function floorStars({ allCoins, spotted }) {
  return 1 + (allCoins ? 1 : 0) + (spotted ? 0 : 1);
}

export const starText = stars => '★'.repeat(stars) + '☆'.repeat(3 - stars);

export function formatTime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// Keep the best stars and the best time per floor (they can come from different runs).
export function recordFloorResult(level, { timeMs, stars }) {
  const progress = loadProgress();
  const floors = { ...(progress.floors ?? {}) };
  const previous = floors[level] ?? {};
  const newBest = previous.bestMs === undefined || timeMs < previous.bestMs;
  floors[level] = {
    stars: Math.max(previous.stars ?? 0, stars),
    bestMs: newBest ? timeMs : previous.bestMs,
  };
  saveProgress({ ...progress, floors });
  return { ...floors[level], newBest };
}

export function floorRecord(level) {
  return loadProgress().floors?.[level] ?? null;
}
