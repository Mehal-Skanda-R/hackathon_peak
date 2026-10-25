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

export const WALLS = Object.freeze([
  tileRect(0, 0, 25, 1), tileRect(0, 16, 25, 1),
  tileRect(0, 1, 1, 15), tileRect(24, 1, 1, 15),
  // Enter the central gallery through the upper doorway; no bottom shortcut.
  tileRect(8, 1, 1, 4), tileRect(8, 7, 1, 9),
  tileRect(16, 1, 1, 8), tileRect(16, 11, 1, 5),
  tileRect(1, 8, 3), tileRect(6, 8, 2),
  tileRect(17, 6, 3), tileRect(22, 6, 2),
  tileRect(11, 4, 2, 2), tileRect(11, 11, 2, 2),
  tileRect(20, 11, 2, 2),
  // Gallery partitions create turns without narrowing the passage below a tile.
  tileRect(9, 7, 5, 1),
  // The artefact room is approached from its west opening, not straight from below.
  tileRect(18, 3, 6, 1),
]);
export const HIDING_ZONES = Object.freeze([
  Object.freeze({ id: 'west-cover', ...tileRect(2, 5, 2, 2) }),
  Object.freeze({ id: 'central-cover', ...tileRect(13, 8, 2, 2) }),
  Object.freeze({ id: 'east-cover', ...tileRect(21, 8, 2, 2) }),
]);
export const SPAWN = center(2, 14);
export const ARTEFACT = Object.freeze({ ...center(22, 2), size: 20 });
export const EXIT = tileRect(1, 13, 2, 3);
export const MAP_GEOMETRY = Object.freeze({
  width: WORLD_WIDTH, height: WORLD_HEIGHT, tileSize: TILE_SIZE,
  columns: MAP_COLUMNS, rows: MAP_ROWS,
  walls: WALLS, hidingZones: HIDING_ZONES, spawn: SPAWN,
  artefact: ARTEFACT, exit: EXIT,
});

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
