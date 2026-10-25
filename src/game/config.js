// All geometry is in world pixels: origin top-left, +x right, +y down.
export const TILE_SIZE = 32;
export const MAP_COLUMNS = 25;
export const MAP_ROWS = 17;
export const WORLD_WIDTH = MAP_COLUMNS * TILE_SIZE;
export const WORLD_HEIGHT = MAP_ROWS * TILE_SIZE;
export const PLAYER_SIZE = 18;
export const PLAYER_SPEED = 160;
export const SCENE_KEY = 'MuseumScene';

const tileRect = (column, row, columns = 1, rows = 1) => Object.freeze({
  x: column * TILE_SIZE, y: row * TILE_SIZE,
  width: columns * TILE_SIZE, height: rows * TILE_SIZE,
});
const center = (column, row) => Object.freeze({
  x: (column + 0.5) * TILE_SIZE, y: (row + 0.5) * TILE_SIZE,
});

const cover = (id, column, row) => Object.freeze({ id, ...tileRect(column, row, 2, 2) });
const coins = list => Object.freeze(list.map(([column, row]) => center(column, row)));
const BORDER = [
  tileRect(0, 0, 25, 1), tileRect(0, 16, 25, 1),
  tileRect(0, 1, 1, 15), tileRect(24, 1, 1, 15),
];

// Levels play in order. Entering a level's door moves on to the next level
// with no way back; the crystal is the collectable of the final level only,
// and that level's door opens only once it is carried. Coins are an optional
// score. `entrance` is the closed door the thief arrived through (decor only).
export const LEVELS = Object.freeze([
  Object.freeze({
    id: 'gallery', name: 'The Gallery',
    walls: Object.freeze([
      ...BORDER,
      // Enter the central gallery through the upper doorway; no bottom shortcut.
      tileRect(8, 1, 1, 4), tileRect(8, 7, 1, 9),
      tileRect(16, 1, 1, 8), tileRect(16, 11, 1, 5),
      tileRect(1, 8, 3), tileRect(6, 8, 2),
      tileRect(17, 6, 3), tileRect(22, 6, 2),
      tileRect(11, 4, 2, 2), tileRect(11, 11, 2, 2),
      tileRect(20, 11, 2, 2),
      // Gallery partitions create turns without narrowing the passage below a tile.
      tileRect(9, 7, 5, 1),
      // The door room is approached from its west opening, not straight from below.
      tileRect(18, 3, 6, 1),
    ]),
    hidingZones: Object.freeze([cover('west-cover', 2, 5), cover('central-cover', 13, 8), cover('east-cover', 21, 8)]),
    spawn: center(2, 14),
    entrance: tileRect(1, 13, 2, 3),
    door: tileRect(22, 1, 2, 2),
    artefact: null,
    coins: coins([[1, 1], [7, 1], [4, 8], [1, 15], [9, 5], [15, 1], [9, 15], [15, 15],
      [16, 10], [23, 15], [23, 7], [19, 4], [19, 1]]),
    decor: Object.freeze({
      rugs: [[102, 301, 73, 92], [446, 118, 46, 94]],
      banners: [[264, 52], [520, 157], [350, 233]],
      lamps: [[42, 57], [241, 146], [297, 65], [490, 281], [549, 62], [747, 149], [45, 328], [746, 463]],
    }),
  }),
  Object.freeze({
    id: 'vault', name: 'The Vault',
    walls: Object.freeze([
      ...BORDER,
      tileRect(8, 1, 1, 5), tileRect(8, 8, 1, 5),      // west divider: gaps rows 6-7, 13-15
      tileRect(1, 5, 5, 1),                            // vault wall, opening cols 6-7
      tileRect(1, 11, 5, 1),                           // west lower room, opening cols 6-7
      tileRect(16, 4, 1, 5), tileRect(16, 11, 1, 5),   // east divider: gaps rows 1-3, 9-10
      tileRect(17, 8, 5, 1),                           // east partition, opening cols 22-23
      tileRect(11, 3, 2, 2), tileRect(11, 12, 2, 2), tileRect(19, 4, 2, 2), tileRect(19, 12, 2, 2),
      tileRect(9, 8, 4, 1),                            // central partition
    ]),
    // The vault has its own cover so it can never become an inescapable dead end.
    hidingZones: Object.freeze([cover('vault-cover', 3, 2), cover('west-cover', 2, 7),
      cover('central-cover', 13, 9), cover('east-cover', 21, 10)]),
    spawn: center(22, 14),
    entrance: tileRect(22, 13, 2, 3),
    door: tileRect(1, 13, 2, 3),
    artefact: Object.freeze({ ...center(2, 2), size: 20 }),
    coins: coins([[7, 1], [1, 4], [7, 9], [1, 6], [9, 1], [15, 1], [9, 15], [15, 7],
      [17, 1], [23, 1], [23, 6], [17, 15], [12, 10]]),
    decor: Object.freeze({
      rugs: [[96, 422, 64, 64], [430, 72, 46, 64], [600, 300, 64, 46]],
      banners: [[264, 300], [520, 170], [600, 252]],
      lamps: [[42, 40], [300, 60], [480, 60], [560, 40], [747, 60], [45, 230], [300, 300],
        [480, 470], [747, 300], [560, 470]],
    }),
  }),
]);

// The active level. These are live ES module bindings: importers always see
// the current level's geometry after setLevel().
export let LEVEL_INDEX = 0;
export let LEVEL = LEVELS[0];
export let WALLS = LEVEL.walls;
export let HIDING_ZONES = LEVEL.hidingZones;
export let SPAWN = LEVEL.spawn;
export let ARTEFACT = LEVEL.artefact;   // null except in the final level
export let EXIT = LEVEL.door;           // the level's door: entering it ends the level
export let ENTRANCE = LEVEL.entrance;
export let COINS = LEVEL.coins;
export let MAP_GEOMETRY;

export function setLevel(index) {
  if (!Number.isInteger(index) || index < 0 || index >= LEVELS.length) throw new Error(`No level ${index}`);
  LEVEL_INDEX = index;
  LEVEL = LEVELS[index];
  WALLS = LEVEL.walls;
  HIDING_ZONES = LEVEL.hidingZones;
  SPAWN = LEVEL.spawn;
  ARTEFACT = LEVEL.artefact;
  EXIT = LEVEL.door;
  ENTRANCE = LEVEL.entrance;
  COINS = LEVEL.coins;
  MAP_GEOMETRY = Object.freeze({
    width: WORLD_WIDTH, height: WORLD_HEIGHT, tileSize: TILE_SIZE,
    columns: MAP_COLUMNS, rows: MAP_ROWS,
    levelId: LEVEL.id, levelIndex: index, levelName: LEVEL.name, levelCount: LEVELS.length,
    walls: WALLS, hidingZones: HIDING_ZONES, spawn: SPAWN,
    artefact: ARTEFACT, exit: EXIT, entrance: ENTRANCE, coins: COINS,
  });
  return LEVEL;
}
setLevel(0);

export function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x
    && a.y < b.y + b.height && a.y + a.height > b.y;
}

// x/y are the body's CENTER. Touching a wall is legal; entering it is not.
export function canOccupy(x, y, width = PLAYER_SIZE, height = width) {
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return false;
  const body = { x: x - width / 2, y: y - height / 2, width, height };
  return body.x >= 0 && body.y >= 0
    && body.x + width <= WORLD_WIDTH && body.y + height <= WORLD_HEIGHT
    && !WALLS.some(wall => overlaps(body, wall));
}

export function getHidingZone(x, y, width = PLAYER_SIZE, height = width) {
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  return HIDING_ZONES.find(zone => x - width / 2 >= zone.x && y - height / 2 >= zone.y
    && x + width / 2 <= zone.x + zone.width && y + height / 2 <= zone.y + zone.height) ?? null;
}

// Conservative segment/AABB test: touching a wall blocks line of sight.
export function hasLineOfSight(from, to) {
  if (![from?.x, from?.y, to?.x, to?.y].every(Number.isFinite)) return false;
  if (!canOccupy(from.x, from.y, 0.001) || !canOccupy(to.x, to.y, 0.001)) return false;
  return !WALLS.some(wall => {
    let near = 0;
    let far = 1;
    for (const axis of ['x', 'y']) {
      const delta = to[axis] - from[axis];
      const min = wall[axis];
      const max = min + (axis === 'x' ? wall.width : wall.height);
      if (delta === 0) {
        if (from[axis] < min || from[axis] > max) return false;
      } else {
        const a = (min - from[axis]) / delta;
        const b = (max - from[axis]) / delta;
        near = Math.max(near, Math.min(a, b));
        far = Math.min(far, Math.max(a, b));
        if (near > far) return false;
      }
    }
    return true;
  });
}

export function movementVelocity(left, right, up, down, speed = PLAYER_SPEED) {
  const x = Number(right) - Number(left);
  const y = Number(down) - Number(up);
  const length = Math.hypot(x, y) || 1;
  return { x: x / length * speed, y: y / length * speed };
}
