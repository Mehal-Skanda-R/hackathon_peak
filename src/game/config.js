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

// Text-grid levels (25 x 17). Legend:
//   '#' wall   'b' wall with a banner   's' statue (2x2 wall)   'K' exhibit (wall)
//   'P' pool (wall)   '.' floor   'h' cover (2x2)   'r' decorative rug   'c' coin
//   'l' lamp (floor)  '=' bridge (floor)
// spawn/entrance/door/artefact are given in tiles: [column, row(, columns, rows)].
const WALL_CHARS = new Set(['#', 'b', 's', 'K', 'P']);

// Merge cells whose character is in `chars` into as few rectangles as possible:
// horizontal runs per row, then identical runs stacked over consecutive rows.
function mergeCells(rows, chars, skip = new Set()) {
  const done = [];
  let open = new Map();
  rows.forEach((line, row) => {
    const next = new Map();
    for (let column = 0; column < line.length;) {
      if (!chars.has(line[column]) || skip.has(`${column},${row}`)) { column++; continue; }
      const start = column;
      while (column < line.length && chars.has(line[column]) && !skip.has(`${column},${row}`)) column++;
      const key = `${start}:${column - start}`;
      const rect = open.get(key);
      if (rect) { rect.rows++; open.delete(key); next.set(key, rect); }
      else next.set(key, { column: start, row, columns: column - start, rows: 1 });
    }
    done.push(...open.values());
    open = next;
  });
  done.push(...open.values());
  return done.map(r => tileRect(r.column, r.row, r.columns, r.rows));
}

function asciiLevel({ id, name, rows, spawn, entrance, door, artefact }) {
  if (rows.length !== MAP_ROWS || rows.some(line => line.length !== MAP_COLUMNS)) {
    throw new Error(`Level ${id} must be ${MAP_COLUMNS} x ${MAP_ROWS}`);
  }
  const statues = [];
  const hidingZones = [];
  const statueCells = new Set();
  const coinTiles = [];
  const banners = [];
  const lamps = [];
  rows.forEach((line, row) => [...line].forEach((ch, column) => {
    const topLeft = line[column - 1] !== ch && rows[row - 1]?.[column] !== ch;
    if (ch === 's' && topLeft) {
      statues.push(tileRect(column, row, 2, 2));
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) statueCells.add(`${column + dx},${row + dy}`);
    }
    if (ch === 'h' && topLeft) hidingZones.push(cover(`${id}-cover-${hidingZones.length + 1}`, column, row));
    if (ch === 'c') coinTiles.push([column, row]);
    if (ch === 'b') banners.push([column * TILE_SIZE + 8, row * TILE_SIZE + 2]);
    if (ch === 'l') lamps.push([column * TILE_SIZE + 16, row * TILE_SIZE + 10]);
  }));
  const exhibits = mergeCells(rows, new Set(['K']));
  const pools = mergeCells(rows, new Set(['P']));
  const walls = [...mergeCells(rows, new Set(['#', 'b'])), ...statues, ...exhibits, ...pools];
  return Object.freeze({
    id, name,
    walls: Object.freeze(walls),
    hidingZones: Object.freeze(hidingZones),
    spawn: center(...spawn),
    entrance: tileRect(...entrance),
    door: tileRect(...door),
    artefact: artefact ? Object.freeze({ ...center(...artefact), size: 20 }) : null,
    coins: coins(coinTiles),
    decor: Object.freeze({
      rugs: mergeCells(rows, new Set(['r'])).map(r => [r.x + 3, r.y + 3, r.width - 6, r.height - 6]),
      banners, lamps, statues, exhibits, pools,
      bridges: mergeCells(rows, new Set(['='])),
    }),
  });
}

// Levels play in order (level 1 + levels 02-07 from the team's concept sheet).
// Entering a level's door moves on to the next level with no way back; the
// crystal is the collectable of the final level only, placed at its door,
// and that door opens only once it is carried. Coins are an optional
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
  asciiLevel({
    id: 'west-wing', name: 'The West Wing',
    spawn: [1, 15], entrance: [1, 14, 2, 2], door: [22, 14, 2, 2], artefact: null,
    rows: [
      "#########################",
      "#c...#.......l#.....rr.c#",
      "#.ss.#........#.....rr..#",
      "#.ss.#..hh....#..#####..#",
      "#....#..hh....#..#ss....#",
      "#.........c......#ss..c.#",
      "####.#####...#####......#",
      "#l...#.........#........#",
      "#.rr.#..rrrr...#..hh..l.#",
      "#.rr.#..rrrr...#..hh....#",
      "#.........c....######.###",
      "#####.###..#####....c...#",
      "#c..#....#.#.......ss...#",
      "#...#.hh.#.#..c....ss..c#",
      "#...#.hh...#............#",
      "#.........c#.l......c...#",
      "#########################",
    ],
  }),
  asciiLevel({
    id: 'gallery-hall', name: 'The Gallery Hall',
    spawn: [1, 15], entrance: [1, 14, 2, 2], door: [22, 14, 2, 2], artefact: null,
    rows: [
      "#########################",
      "#c..l.#....b.....#..rr.c#",
      "#.....#.....ss...#..rr..#",
      "#.hh..#.....ss...#......#",
      "#.hh.....c.......###.##.#",
      "###.###.........l.......#",
      "#.....#.KKKKKKKKK.#.hh..#",
      "#..c..#.KKKKKKKKK.#.hh..#",
      "#......cKKKKKKKKK.....c.#",
      "#.rr..#.KKKKKKKKK.#.....#",
      "#.rr..#.KKKKKKKKK.#..ss.#",
      "#.....#...........#..ss.#",
      "####.##############.....#",
      "#c......#c.hh.#.l....c..#",
      "#.......#..hh.#.........#",
      "#....l.....c..#....c....#",
      "#########################",
    ],
  }),
  asciiLevel({
    id: 'archive', name: 'The Archive',
    spawn: [1, 15], entrance: [1, 14, 2, 2], door: [22, 14, 2, 2], artefact: null,
    rows: [
      "#########################",
      "#c....l#.........#....c.#",
      "#.####.#.#####.#.#.####.#",
      "#.#..#...#...#.#...#..#.#",
      "#.#hh#.###.#.#.#####hh#.#",
      "#..hh......#c#......hh..#",
      "####.#####.#.#####.######",
      "#c...#rr...#...l.#......#",
      "#.##.#rr.###.###.#.####.#",
      "#..#.....#.....#...#..#.#",
      "##.#####.#.hh..#.#.#c.#.#",
      "#..#..c..#.hh..#.#...##.#",
      "#..#.###.###########....#",
      "#....#l..........##.....#",
      "#.....####.####..##c....#",
      "#.......c....c.....#....#",
      "#########################",
    ],
  }),
  asciiLevel({
    id: 'vault-ring', name: 'The Vault Ring',
    spawn: [1, 15], entrance: [1, 14, 2, 2], door: [22, 14, 2, 2], artefact: null,
    rows: [
      "#########################",
      "#c...l.....b.....l....c.#",
      "#.hh....................#",
      "#.hh.#######.#######.hh.#",
      "#....#.....c.c.....#.hh.#",
      "#.rr.#.###########.#....#",
      "#.rr.#.#....c....#.#.rr.#",
      "#......#.###.###.#.#.rr.#",
      "#c...#.#.#cc.cc#.#......#",
      "#....#.#.#######.#...c..#",
      "#.rr.#.#....c....#.#....#",
      "#.rr.#.######.####.#.hh.#",
      "#....#.....c.......#.hh.#",
      "#..hh###############....#",
      "#..hh..l.....c..#....c..#",
      "#...........c...#.......#",
      "#########################",
    ],
  }),
  asciiLevel({
    id: 'royal-exhibit', name: 'The Royal Exhibit',
    spawn: [23, 15], entrance: [22, 14, 2, 2], door: [1, 14, 2, 2], artefact: null,
    rows: [
      "#########################",
      "#c..l...#....b....#..l.c#",
      "#.ss....#.........#..ss.#",
      "#.ss....#....c....#..ss.#",
      "#.......####.######.....#",
      "#..hh...................#",
      "#..hh..PPPPP=PPPPP..hh..#",
      "#......PPPPP=PPPPP..hh..#",
      "#.c....PPPPP=PPPPP....c.#",
      "#......PPPPP=PPPPP......#",
      "#.rr.#######=#######....#",
      "#.rr.#####..c..#####.rr.#",
      "#....#.ss.......ss.#.rr.#",
      "#....#.ss..l#...ss.#....#",
      "#....#......#......#....#",
      "#..c.#.....c#c.....#.c..#",
      "#########################",
    ],
  }),
  asciiLevel({
    id: 'final-heist', name: 'The Final Heist',
    spawn: [1, 15], entrance: [1, 14, 2, 2], door: [22, 14, 2, 2], artefact: [20, 15],
    rows: [
      "#########################",
      "#c..l..#....b....#..l..c#",
      "#.hh...#.........#...hh.#",
      "#.hh.#.#.###.###.#.#.hh.#",
      "#....#...#.....#...#....#",
      "###.####.#.ss..#.####.###",
      "#c.....#.#.ss..#.#.....c#",
      "#.rr...#.###.###.#...rr.#",
      "#.rr.....l.....l.....rr.#",
      "#......####...####......#",
      "####.###.#..c..#.###.####",
      "#......#.#######.#......#",
      "#.hh...#.........#...hh.#",
      "#.hh.#####..c..###.#.hh.#",
      "#....#.............#....#",
      "#...c#.....c...c...#....#",
      "#########################",
    ],
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
