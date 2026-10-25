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
