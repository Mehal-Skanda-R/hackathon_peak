// Per-viewer campaign progress (unlocked floors, best coins, and the story:
// journal pages, endings, Act III depths, coin wallet and bought intel) kept
// in this browser only. Storage can be unavailable (private mode), so every
// access is guarded; progress then lasts for this page load only.
import { ACTS } from '../game/config.js';

const KEY = 'hh-progress-v1';
const fresh = () => ({ unlocked: 1, completed: 0, bestCoins: 0 });
let memory = null; // fallback when storage throws

export function loadProgress() {
  let raw;
  try { raw = localStorage.getItem(KEY); } catch { return memory ? structuredClone(memory) : fresh(); }
  try {
    const saved = JSON.parse(raw);
    if (saved && Number.isInteger(saved.unlocked) && Number.isInteger(saved.completed)) return { ...fresh(), ...saved };
  } catch { /* corrupt */ }
  return fresh();
}

function saveProgress(progress) {
  memory = structuredClone(progress);
  try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch { /* ignore */ }
}

const update = change => {
  const progress = loadProgress();
  const result = change(progress);
  saveProgress(progress);
  return result ?? progress;
};

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

// ---- Story progress (src/story) ----

// Any campaign floor (1-based over all LEVELS): Act I keeps the original
// unlocked/completed counts; Act III depths have their own.
export function recordFloorComplete(level, coins) {
  const act = ACTS.find(a => level - 1 >= a.first && level - 1 <= a.last) ?? ACTS[0];
  if (act.id === 1) return recordLevelComplete(level, coins, act.last - act.first + 1);
  const depth = level - act.first;
  return update(progress => {
    const deep = { unlocked: 1, completed: 0, ...(progress.catacombs ?? {}) };
    deep.completed = Math.max(deep.completed, depth);
    deep.unlocked = Math.min(act.last - act.first + 1, Math.max(deep.unlocked, depth + 1));
    progress.catacombs = deep;
    progress.bestCoins = Math.max(progress.bestCoins, coins ?? 0);
  });
}

export const catacombProgress = () => ({ unlocked: 1, completed: 0, ...(loadProgress().catacombs ?? {}) });

// Journal pages by level id. Returns true when the page is new.
export function recordJournal(levelId) {
  return update(progress => {
    const pages = new Set(progress.journal ?? []);
    const added = !pages.has(levelId);
    pages.add(levelId);
    progress.journal = [...pages];
    return added;
  });
}
export const journalFound = () => new Set(loadProgress().journal ?? []);

// Endings: 'clean', 'heart', 'returned', 'last'. Returns true when new.
export function recordEnding(id) {
  return update(progress => {
    const added = !progress.endings?.[id];
    progress.endings = { ...(progress.endings ?? {}), [id]: true };
    return added;
  });
}
export const endingsFound = () => ({ ...(loadProgress().endings ?? {}) });
// Act III opens once the Heart has been carried out of floor 07.
export const act3Unlocked = () => Boolean(loadProgress().endings?.heart);

// Cutscenes already shown.
export function markSeen(id) { update(progress => { progress.seen = { ...(progress.seen ?? {}), [id]: true }; }); }
export const hasSeen = id => Boolean(loadProgress().seen?.[id]);

// Coin wallet: a cleared floor banks the coins collected on it; intel spends them.
export const INTEL = Object.freeze({
  routes: Object.freeze({ cost: 4, name: 'Guard routes', detail: 'Patrol routes are drawn over the map for the first seconds.' }),
  page: Object.freeze({ cost: 3, name: 'Journal page', detail: "Marks where this floor's journal page lies." }),
  preview: Object.freeze({ cost: 3, name: 'Long look', detail: 'The start-of-floor map preview lasts 4 seconds instead of 2.' }),
});
export const wallet = () => loadProgress().wallet ?? 0;
export function bankCoins(amount) {
  return update(progress => { progress.wallet = (progress.wallet ?? 0) + Math.max(0, amount | 0); return progress.wallet; });
}
export const hasIntel = (levelId, item) => Boolean(loadProgress().intel?.[levelId]?.includes(item));
// Intel bought for a floor stays for that floor. Returns { ok, reason }.
export function buyIntel(levelId, item) {
  const offer = INTEL[item];
  if (!offer) return { ok: false, reason: 'unknown' };
  return update(progress => {
    const owned = progress.intel?.[levelId] ?? [];
    if (owned.includes(item)) return { ok: false, reason: 'owned' };
    if ((progress.wallet ?? 0) < offer.cost) return { ok: false, reason: 'funds' };
    progress.wallet -= offer.cost;
    progress.intel = { ...(progress.intel ?? {}), [levelId]: [...owned, item] };
    return { ok: true };
  });
}
