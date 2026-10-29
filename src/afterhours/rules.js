// Pure, deterministic rules for the optional mission. No campaign live bindings.
export const T = 32, WIDTH = 800, HEIGHT = 544;
export const at = (column, row) => ({ x: (column + .5) * T, y: (row + .5) * T });
export const rect = (c, r, w = 1, h = 1) => ({ x: c * T, y: r * T, width: w * T, height: h * T });
export const intersects = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x
  && a.y < b.y + b.height && a.y + a.height > b.y;
export const bodyAt = (p, size = 20) => ({ x: p.x - size / 2, y: p.y - size / 2, width: size, height: size });
export const BASE_WALLS = Object.freeze([
  rect(0, 0, 25), rect(0, 16, 25), rect(0, 1, 1, 15), rect(24, 1, 1, 15),
  rect(7, 1, 1, 5), rect(7, 8, 1, 8), rect(17, 1, 1, 7), rect(17, 10, 1, 6),
  rect(8, 9, 4), rect(14, 9, 3), rect(1, 10, 2), rect(5, 10, 2),
  rect(18, 5, 3), rect(23, 5), rect(10, 3, 2, 2), rect(13, 12, 2, 2), rect(20, 12, 2, 2),
]);
export const COVERS = Object.freeze([rect(2, 6, 2, 2), rect(14, 5, 2, 2), rect(19, 9, 2, 2), rect(3, 13, 2, 2)]);
export const SPAWN = Object.freeze(at(3, 14));
export const TREASURE = Object.freeze(at(22, 2));
export const EXIT = Object.freeze(rect(2, 13, 2, 2));
export const LOOT = Object.freeze([[4, 2], [6, 8], [9, 7], [15, 2], [13, 10], [23, 8], [18, 14], [11, 15]].map(p => at(...p)));
export const SHIFTS = Object.freeze([rect(12, 6), rect(13, 6)]);
export const LAMPS = Object.freeze([[48, 48], [208, 48], [272, 80], [518, 184], [756, 184], [48, 288], [740, 480], [272, 480]]);
export const LASERS = Object.freeze([
  { ...rect(3, 10, 2), name: 'West passage' },
  { ...rect(12, 9, 2), name: 'South gallery' },
  { ...rect(17, 8, 1, 2), name: 'Vault threshold' },
]);
export const ROUTES = Object.freeze({
  'warden-gallery': [[9, 6], [15, 6], [15, 8], [9, 8]],
  'warden-vault': [[18, 8], [23, 8], [23, 14], [18, 14]],
});
export const GEAR = Object.freeze({
  standard: { id: 'standard', name: 'Balanced kit', cost: 0, speed: 160, radius: 1, reward: 0,
    description: 'Standard movement and pulse reach. Always available.' },
  velvet: { id: 'velvet', name: 'Velvet cloak', cost: 8, speed: 140, radius: .78, reward: 0,
    description: '22% smaller pulses reveal less and alert fewer guards. Movement drops to 140 px/s.' },
  lens: { id: 'lens', name: 'Prismatic lens', cost: 12, speed: 160, radius: 1.25, reward: 0,
    description: '25% wider vision. The same wider pulse also reaches more guards.' },
  satchel: { id: 'satchel', name: 'Smuggler’s satchel', cost: 16, speed: 135, radius: 1, reward: 6,
    description: 'Earn 6 extra marks on escape. The heavy bag slows movement to 135 px/s.' },
});
export const CURSES = Object.freeze({
  bellheart: { id: 'bellheart', name: 'The Bellheart', color: 0xe9b963, radius: 1.65, cycle: 4800, duration: 600,
    description: 'After theft, pulses reach 65% farther and security cycles accelerate.' },
  eclipse: { id: 'eclipse', name: 'The Eclipse Eye', color: 0xb898fa, radius: 1, cycle: 6000, duration: 320,
    description: 'After theft, pulse light lasts only 0.32 seconds. Guard exposure stays unchanged.' },
  quicksilver: { id: 'quicksilver', name: 'The Quicksilver Heart', color: 0x78e1da, radius: 1, cycle: 3800, duration: 600,
    description: 'After theft, the museum’s cycle drops from 6 to 3.8 seconds. Warning time stays 1.2 seconds.' },
});
export function makeMap(variant = 0) {
  return { width: WIDTH, height: HEIGHT, tileSize: T, columns: 25, rows: 17,
    walls: [...BASE_WALLS, SHIFTS[variant === 1 ? 1 : 0]], hidingZones: COVERS,
    spawn: SPAWN, artefact: TREASURE, exit: EXIT, levelId: 'after-hours' };
}
export function canFit(map, x, y, w = 20, h = w) {
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return false;
  const body = { x: x - w / 2, y: y - h / 2, width: w, height: h };
  return body.x >= 0 && body.y >= 0 && body.x + w <= WIDTH && body.y + h <= HEIGHT
    && !map.walls.some(wall => intersects(body, wall));
}
export function hiddenAt(p) {
  return COVERS.some(z => p.x - 9 >= z.x && p.x + 9 <= z.x + z.width
    && p.y - 9 >= z.y && p.y + 9 <= z.y + z.height);
}
export function lineOfSight(map, from, to) {
  if (!canFit(map, from.x, from.y, .01) || !canFit(map, to.x, to.y, .01)) return false;
  return !map.walls.some(wall => {
    let near = 0, far = 1;
    for (const axis of ['x', 'y']) {
      const d = to[axis] - from[axis], min = wall[axis], max = min + wall[axis === 'x' ? 'width' : 'height'];
      if (!d) { if (from[axis] < min || from[axis] > max) return false; }
      else { const a = (min - from[axis]) / d, b = (max - from[axis]) / d;
        near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b)); if (near > far) return false; }
    }
    return true;
  });
}
// Reachability for every required destination, not just the start and exit.
export function reachable(map, from, destinations) {
  const key = p => `${Math.floor(p.x / T)},${Math.floor(p.y / T)}`;
  const seen = new Set([key(from)]), queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i], c = Math.floor(p.x / T), r = Math.floor(p.y / T);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = at(c + dc, r + dr), k = key(n);
      if (!seen.has(k) && canFit(map, n.x, n.y, 30)) { seen.add(k); queue.push(n); }
    }
  }
  return destinations.every(p => seen.has(key(p)));
}
export function canShift(map, candidate, actors, pulseAgeMs, previewing = false) {
  // No visible pop-in, crushes, pulse-time rearrangements, stranded guards or lost loot.
  if (previewing || pulseAgeMs < 700 || actors.some(p => Math.hypot(p.x - candidate.x - 16, p.y - candidate.y - 16) < 80)) return false;
  if (Math.hypot(actors[0].x - candidate.x - 16, actors[0].y - candidate.y - 16) < 190) return false;
  return actors.every(p => canFit(map, p.x, p.y, 30))
    && reachable(map, actors[0], [SPAWN, TREASURE, ...LOOT, ...actors.slice(1), ...Object.values(ROUTES).flat().map(p => at(...p))]);
}
export function securityAt(elapsed, cycle = 6000) {
  const beat = Math.floor(elapsed / cycle), phaseMs = elapsed % cycle;
  const activeAt = cycle - 1000, warnAt = activeAt - 1200;
  return { beat, lane: beat % LASERS.length, phase: phaseMs >= activeAt ? 'active' : phaseMs >= warnAt ? 'warning' : 'quiet',
    remaining: (phaseMs < warnAt ? warnAt : phaseMs < activeAt ? activeAt : cycle) - phaseMs,
    progress: phaseMs / cycle };
}
export function pulseSettings(gear, curse, carrying) {
  const factor = gear.radius * (carrying ? curse.radius : 1);
  return { base: 100 * factor, perBpm: 4 * factor, max: 260 * factor, duration: carrying ? curse.duration : 600 };
}
// Separate clock: no high-heart-rate advantage for the director's action budget.
export class DirectorBudget {
  constructor() { this.charges = 2; this.recharge = 0; this.cooldown = 0; }
  update(dt) { this.cooldown = Math.max(0, this.cooldown - dt); this.recharge += dt;
    while (this.recharge >= 8000) { this.recharge -= 8000; this.charges = Math.min(3, this.charges + 1); } }
  spend() { if (this.cooldown || this.charges <= 0) return false; this.charges--; this.cooldown = 4000; return true; }
}
