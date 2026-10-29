import { GEAR } from './rules.js';
const KEY = 'hh-after-hours-v1';
export function loadProfile(storage) {
  try {
    storage ??= globalThis.localStorage;
    const v = JSON.parse(storage.getItem(KEY) || '{}');
    return { marks: Number.isSafeInteger(v.marks) && v.marks >= 0 ? Math.min(v.marks, 1000000) : 0,
      escaped: Number.isSafeInteger(v.escaped) && v.escaped >= 0 ? v.escaped : 0,
      owned: ['standard', ...Object.keys(GEAR).filter(id => id !== 'standard' && Array.isArray(v.owned) && v.owned.includes(id))] };
  } catch { return { marks: 0, escaped: 0, owned: ['standard'] }; }
}
export function saveProfile(profile, storage) {
  try { storage ??= globalThis.localStorage; storage.setItem(KEY, JSON.stringify(profile)); return true; } catch { return false; }
}
export function buyGear(profile, id) {
  const gear = GEAR[id];
  if (!gear || profile.owned.includes(id) || profile.marks < gear.cost) return null;
  return { ...profile, marks: profile.marks - gear.cost, owned: [...profile.owned, id] };
}
export function rewardEscape(profile, coins, gear) {
  return { ...profile, marks: Math.min(1000000, profile.marks + 6 + Math.max(0, Math.min(8, coins)) + gear.reward), escaped: profile.escaped + 1 };
}
