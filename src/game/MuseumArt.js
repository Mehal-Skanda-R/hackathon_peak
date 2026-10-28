// Procedural museum artwork. Presentation only: config.js remains the geometry authority.
// The single background image can receive Mehal's visibility mask as one object.
// Reads the active level's live bindings (config.setLevel); each level paints
// and caches its own floor texture.
import { WORLD_WIDTH as W, WORLD_HEIGHT as H, TILE_SIZE as T, WALLS,
  HIDING_ZONES, ARTEFACT, SHRINE, EXIT, ENTRANCE, LEVEL } from './config.js';

// Base colours per level theme: museum stone (Act I) or catacomb earth (Act III).
const THEMES = Object.freeze({
  museum: Object.freeze({ floor: [23, 35, 39], grout: '#384749', brick: [29, 41, 44], wall: '#10191f', edge: '#657169' }),
  catacombs: Object.freeze({ floor: [33, 28, 23], grout: '#4a3f33', brick: [46, 38, 31], wall: '#1a1410', edge: '#7a6a55' }),
});
const theme = () => THEMES[LEVEL.theme] ?? THEMES.museum;

const PREFIX = 'hh-museum-v1-';
const hash = (x, y, salt = 0) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
};

function texture(scene, name, width, height, paint) {
  const key = PREFIX + name;
  if (!scene.textures.exists(key)) {
    const canvas = scene.textures.createCanvas(key, width, height);
    paint(canvas.context);
    canvas.refresh();
  }
  return key;
}

function glow(ctx, x, y, radius, color) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function rug(ctx, x, y, width, height) {
  ctx.fillStyle = '#080f13';
  ctx.fillRect(x - 3, y - 3, width + 6, height + 6);
  ctx.fillStyle = '#42242a';
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = '#997445';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 3, y + 3, width - 6, height - 6);
  ctx.strokeStyle = '#674a36';
  ctx.strokeRect(x + 7, y + 7, width - 14, height - 14);
  for (let i = 4; i < width; i += 5) {
    ctx.fillStyle = '#82643f';
    ctx.fillRect(x + i, y - 2, 1, 3);
    ctx.fillRect(x + i, y + height, 1, 3);
  }
  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(Math.PI / 4);
  ctx.strokeStyle = '#75523a';
  ctx.strokeRect(-7, -7, 14, 14);
  ctx.restore();
}

function plant(ctx, x, y, seed) {
  ctx.fillStyle = '#070e12';
  ctx.beginPath(); ctx.ellipse(x + 2, y + 4, 13, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#776044'; ctx.fillRect(x - 5, y - 3, 10, 9);
  ctx.fillStyle = '#aa8c59'; ctx.fillRect(x - 6, y - 4, 12, 3);
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4 + seed;
    ctx.save(); ctx.translate(x, y - 6); ctx.rotate(a);
    ctx.fillStyle = i % 2 ? '#255448' : '#367467';
    ctx.beginPath(); ctx.ellipse(0, -7, 3, 10, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#609382'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -13); ctx.stroke();
    ctx.restore();
  }
}

function statue(ctx, wall) {
  const x = wall.x + wall.width / 2;
  const y = wall.y + wall.height / 2;
  ctx.fillStyle = '#0d1419'; ctx.fillRect(wall.x + 4, wall.y + 3, 56, 58);
  ctx.fillStyle = '#424a46'; ctx.fillRect(x - 20, y + 12, 40, 12);
  ctx.fillStyle = '#78796a'; ctx.fillRect(x - 18, y + 10, 36, 6);
  ctx.strokeStyle = '#aa9c75'; ctx.strokeRect(x - 20, y + 12, 40, 12);
  ctx.fillStyle = '#66796f';
  ctx.beginPath(); ctx.moveTo(x - 7, y - 14); ctx.lineTo(x + 6, y - 14);
  ctx.lineTo(x + 13, y + 11); ctx.lineTo(x - 14, y + 11); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#9ba392';
  ctx.beginPath(); ctx.ellipse(x, y - 20, 6, 8, -0.15, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#a7ab92'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - 5, y - 12); ctx.lineTo(x - 8, y + 8);
  ctx.moveTo(x + 3, y - 10); ctx.lineTo(x + 8, y + 9); ctx.stroke();
  ctx.fillStyle = '#152824'; ctx.fillRect(x - 3, y - 21, 2, 2);
}

// Water basin for 'P' cells: dark water, soft ripples, stone lip.
function pool(ctx, r) {
  ctx.fillStyle = '#071a24'; ctx.fillRect(r.x, r.y, r.width, r.height);
  const water = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.height);
  water.addColorStop(0, '#0f3a4a'); water.addColorStop(1, '#0a2733');
  ctx.fillStyle = water; ctx.fillRect(r.x + 4, r.y + 4, r.width - 8, r.height - 8);
  ctx.strokeStyle = 'rgba(140,210,220,.18)'; ctx.lineWidth = 1;
  for (let i = 0; i < 9; i++) {
    const x = r.x + 10 + hash(r.x, i) * (r.width - 30), y = r.y + 10 + hash(r.y, i) * (r.height - 20);
    ctx.beginPath(); ctx.ellipse(x, y, 9, 2.5, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.strokeStyle = '#7d8a7f'; ctx.lineWidth = 3; ctx.strokeRect(r.x + 1.5, r.y + 1.5, r.width - 3, r.height - 3);
}

// Wooden bridge for '=' cells (floor), drawn across the pool gap.
function bridge(ctx, r) {
  ctx.fillStyle = '#3b2a1a'; ctx.fillRect(r.x + 2, r.y, r.width - 4, r.height);
  ctx.strokeStyle = '#6e5233'; ctx.lineWidth = 1;
  for (let y = r.y + 4; y < r.y + r.height; y += 6) { ctx.beginPath(); ctx.moveTo(r.x + 3, y); ctx.lineTo(r.x + r.width - 3, y); ctx.stroke(); }
  ctx.fillStyle = '#a07a45'; ctx.fillRect(r.x + 2, r.y, 2, r.height); ctx.fillRect(r.x + r.width - 4, r.y, 2, r.height);
}

// Raised display with a dinosaur skeleton for 'K' cells.
function exhibit(ctx, r) {
  ctx.fillStyle = '#0c1418'; ctx.fillRect(r.x, r.y, r.width, r.height);
  ctx.fillStyle = '#2a2a24'; ctx.fillRect(r.x + 6, r.y + 6, r.width - 12, r.height - 12);
  ctx.strokeStyle = '#a99467'; ctx.lineWidth = 2; ctx.strokeRect(r.x + 6, r.y + 6, r.width - 12, r.height - 12);
  const cx = r.x + r.width / 2, cy = r.y + r.height / 2 + 6, s = Math.min(r.width / 260, r.height / 150);
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
  ctx.strokeStyle = '#d8cfb6'; ctx.fillStyle = '#d8cfb6'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); // spine and tail
  ctx.moveTo(-95, -10); ctx.quadraticCurveTo(-30, -45, 40, -25); ctx.quadraticCurveTo(80, -15, 115, 5); ctx.stroke();
  for (let i = 0; i < 9; i++) { // ribs
    const x = -60 + i * 10; ctx.beginPath(); ctx.moveTo(x, -32 + Math.abs(i - 4) * 2); ctx.quadraticCurveTo(x + 4, -5, x - 2, 12); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(-70, -15); ctx.lineTo(-78, 40); ctx.moveTo(-40, -20); ctx.lineTo(-34, 40); // legs
  ctx.moveTo(10, -22); ctx.lineTo(4, 40); ctx.moveTo(30, -22); ctx.lineTo(38, 40); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-95, -10); ctx.lineTo(-115, -55); ctx.stroke(); // neck
  ctx.beginPath(); ctx.ellipse(-122, -62, 13, 8, -0.4, 0, Math.PI * 2); ctx.fill(); // skull
  ctx.fillStyle = '#2a2a24'; ctx.beginPath(); ctx.arc(-124, -64, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#c9b27a'; ctx.font = 'bold 9px serif'; ctx.textAlign = 'center';
  ctx.fillText('PREHISTORIC HALL', cx, r.y + r.height - 12);
}

// A heap of skulls and bones filling a 'x' wall cell block (catacombs).
function bones(ctx, r) {
  ctx.fillStyle = '#120d0a'; ctx.fillRect(r.x, r.y, r.width, r.height);
  for (let y = r.y + 6; y < r.y + r.height - 2; y += 9) {
    for (let x = r.x + 5 + ((y / 9) % 2) * 4; x < r.x + r.width - 3; x += 10) {
      const tone = 180 + Math.floor(hash(x, y) * 40);
      ctx.fillStyle = `rgb(${tone},${tone - 12},${tone - 34})`;
      ctx.beginPath(); ctx.ellipse(x, y, 4, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a120c'; ctx.fillRect(x - 2, y - 1, 1.5, 1.5); ctx.fillRect(x + 1, y - 1, 1.5, 1.5);
    }
  }
  ctx.strokeStyle = '#a8977a'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (let i = 0; i < r.width / 16; i++) {
    const x = r.x + 4 + hash(r.x, i) * (r.width - 8), y = r.y + 4 + hash(r.y, i + 3) * (r.height - 8);
    ctx.beginPath(); ctx.moveTo(x - 5, y - 2); ctx.lineTo(x + 5, y + 2); ctx.stroke();
  }
  ctx.strokeStyle = '#5a4a38'; ctx.lineWidth = 1; ctx.strokeRect(r.x + 1.5, r.y + 1.5, r.width - 3, r.height - 3);
}

// Aurel's shrine: a low stone altar with a heart-shaped hollow (Act III).
function shrine(ctx, s) {
  ctx.fillStyle = '#0c0907'; ctx.fillRect(s.x - 22, s.y - 14, 46, 34);
  ctx.fillStyle = '#5d5040'; ctx.fillRect(s.x - 20, s.y - 16, 40, 30);
  ctx.fillStyle = '#7f6f58'; ctx.fillRect(s.x - 20, s.y - 16, 40, 4);
  ctx.strokeStyle = '#b39d78'; ctx.lineWidth = 1; ctx.strokeRect(s.x - 17.5, s.y - 11.5, 35, 22);
  ctx.fillStyle = '#2a1f17';
  ctx.beginPath(); ctx.moveTo(s.x, s.y + 7);
  ctx.bezierCurveTo(s.x - 11, s.y - 1, s.x - 6, s.y - 10, s.x, s.y - 4);
  ctx.bezierCurveTo(s.x + 6, s.y - 10, s.x + 11, s.y - 1, s.x, s.y + 7); ctx.fill();
  ctx.fillStyle = '#c9b27a'; ctx.font = 'bold 7px serif'; ctx.textAlign = 'center';
  ctx.fillText('AUREL', s.x, s.y + 22);
}

function paintMuseum(ctx) {
  const palette = theme();
  ctx.fillStyle = '#091116'; ctx.fillRect(0, 0, W, H);
  for (let row = 0; row < H / T; row++) for (let col = 0; col < W / T; col++) {
    const x = col * T, y = row * T;
    const shade = Math.floor(hash(col, row) * 12);
    const [fr, fg, fb] = palette.floor;
    ctx.fillStyle = `rgb(${fr + shade},${fg + shade},${fb + shade})`;
    ctx.fillRect(x + 1, y + 1, T - 2, T - 2);
    ctx.strokeStyle = palette.grout; ctx.lineWidth = 0.7;
    ctx.strokeRect(x + 2, y + 2, T - 4, T - 4);
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(x + 2, y + T - 4, T - 3, 3);
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(161,175,154,.06)' : 'rgba(0,0,0,.16)';
      ctx.fillRect(x + hash(col, row, i + 1) * 29, y + hash(row, col, i + 8) * 29, 2, 1);
    }
    if ((col + row * 3) % 17 === 0) {
      ctx.strokeStyle = '#14232a';
      ctx.beginPath(); ctx.moveTo(x + 12, y + 1); ctx.lineTo(x + 15, y + 8);
      ctx.lineTo(x + 12, y + 13); ctx.stroke();
    }
  }
  for (const [x, y, width, height] of LEVEL.decor.rugs) rug(ctx, x, y, width, height);
  if (ARTEFACT) rug(ctx, ARTEFACT.x - 25, ARTEFACT.y - 25, 50, 51);

  // Recessed leaf-pattern carpets identify usable cover without bright debug boxes.
  for (const zone of HIDING_ZONES) {
    ctx.fillStyle = '#153832'; ctx.fillRect(zone.x + 3, zone.y + 3, zone.width - 6, zone.height - 6);
    ctx.strokeStyle = '#426654'; ctx.strokeRect(zone.x + 4, zone.y + 4, zone.width - 8, zone.height - 8);
    for (let i = 0; i < 6; i++) {
      const px = zone.x + 13 + (i % 3) * 19, py = zone.y + 20 + Math.floor(i / 3) * 25;
      ctx.strokeStyle = '#2d5144';
      ctx.beginPath(); ctx.ellipse(px, py, 4, 7, .7, 0, Math.PI * 2); ctx.stroke();
    }
    plant(ctx, zone.x + 11, zone.y + 12, zone.x);
    plant(ctx, zone.x + zone.width - 10, zone.y + zone.height - 9, zone.y);
  }

  // The stone blocks themselves match the collision rectangles exactly.
  // Pools and exhibits are walls too, but get their own art below.
  const special = new Set([...(LEVEL.decor.pools ?? []), ...(LEVEL.decor.exhibits ?? []), ...(LEVEL.decor.bones ?? [])]);
  const statues = LEVEL.decor.statues ?? WALLS.filter(w => w.width === 64 && w.height === 64);
  for (const wall of WALLS) {
    if (special.has(wall)) continue;
    ctx.shadowColor = 'rgba(0,0,0,.75)'; ctx.shadowBlur = 9; ctx.shadowOffsetY = 6;
    ctx.fillStyle = palette.wall; ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
    ctx.shadowColor = 'transparent'; ctx.shadowOffsetY = 0; ctx.shadowBlur = 0;
    ctx.save(); ctx.beginPath(); ctx.rect(wall.x, wall.y, wall.width, wall.height); ctx.clip();
    for (let y = wall.y; y < wall.y + wall.height; y += 12) {
      for (let x = wall.x - ((y / 12) % 2 ? 12 : 0); x < wall.x + wall.width; x += 24) {
        const shade = Math.floor(hash(x, y) * 11);
        const [br, bg, bb] = palette.brick;
        ctx.fillStyle = `rgb(${br + shade},${bg + shade},${bb + shade})`;
        ctx.fillRect(x + 1, y + 1, 22, 10);
        ctx.fillStyle = 'rgba(130,151,145,.13)'; ctx.fillRect(x + 1, y + 1, 22, 1);
      }
    }
    ctx.restore();
    ctx.strokeStyle = palette.edge; ctx.lineWidth = 1;
    ctx.strokeRect(wall.x + 1.5, wall.y + 1.5, wall.width - 3, wall.height - 3);
    ctx.strokeStyle = '#101b20'; ctx.lineWidth = 2;
    ctx.strokeRect(wall.x + 4, wall.y + 4, wall.width - 8, wall.height - 8);
    if (statues.includes(wall)) statue(ctx, wall);
  }
  for (const r of LEVEL.decor.pools ?? []) pool(ctx, r);
  for (const r of LEVEL.decor.bridges ?? []) bridge(ctx, r);
  for (const r of LEVEL.decor.exhibits ?? []) exhibit(ctx, r);
  for (const r of LEVEL.decor.bones ?? []) bones(ctx, r);
  if (SHRINE) shrine(ctx, SHRINE);

  // Decorative banners on wall faces, not additional obstacles.
  for (const [x, y] of LEVEL.decor.banners) {
    ctx.fillStyle = '#755b37'; ctx.fillRect(x - 2, y - 3, 20, 3);
    ctx.fillStyle = '#4b2630';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 16, y);
    ctx.lineTo(x + 16, y + 37); ctx.lineTo(x + 8, y + 32); ctx.lineTo(x, y + 37); ctx.fill();
    ctx.strokeStyle = '#967446'; ctx.lineWidth = .8; ctx.stroke();
    ctx.save(); ctx.translate(x + 8, y + 16); ctx.rotate(Math.PI / 4);
    ctx.strokeRect(-3, -3, 6, 6); ctx.restore();
  }

  // Warm lamp pools baked into scenery; no fog/visibility or heartbeat simulation.
  for (const [x, y] of LEVEL.decor.lamps) {
    glow(ctx, x + 5, y + 14, 58, 'rgba(234,154,51,.22)');
    glow(ctx, x, y, 15, 'rgba(255,197,91,.30)');
    ctx.fillStyle = '#100f10'; ctx.fillRect(x - 5, y - 4, 10, 10);
    ctx.fillStyle = '#a77c3b'; ctx.fillRect(x - 5, y - 4, 10, 2);
    ctx.fillStyle = '#f4ce75'; ctx.fillRect(x - 3, y - 1, 6, 3);
    ctx.fillStyle = '#7d602f'; ctx.fillRect(x - 4, y + 3, 8, 2);
  }

  // Raised stone display underneath the removable crystal (final level only).
  if (ARTEFACT) {
    const ax = ARTEFACT.x, ay = ARTEFACT.y;
    ctx.fillStyle = '#090e11'; ctx.fillRect(ax - 16, ay - 8, 35, 27);
    ctx.fillStyle = '#71664c'; ctx.fillRect(ax - 15, ay - 11, 30, 24);
    ctx.fillStyle = '#a49468'; ctx.fillRect(ax - 15, ay - 11, 30, 4);
    ctx.strokeStyle = '#b7a276'; ctx.strokeRect(ax - 13.5, ay - 8.5, 27, 19);
  }

  const vignette = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, W * .65);
  vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,0,.42)');
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
}

// Door frame + open doorway (the leaf is drawn separately so it can swing open).
function paintDoorway(ctx, w, h, label) {
  ctx.fillStyle = '#0a1113'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#020405'; ctx.fillRect(6, 6, w - 12, h - 10);
  glow(ctx, w / 2, h * 0.55, Math.max(w, h) * 0.45, 'rgba(120,230,190,.35)');
  ctx.strokeStyle = '#9b8659'; ctx.lineWidth = 3; ctx.strokeRect(3, 3, w - 6, h - 4);
  ctx.strokeStyle = '#5b5038'; ctx.lineWidth = 1; ctx.strokeRect(6.5, 6.5, w - 13, h - 10);
  ctx.fillStyle = '#c9b27a'; ctx.font = 'bold 8px serif'; ctx.textAlign = 'center';
  ctx.fillText(label, w / 2, 14);
}

function paintDoorLeaf(ctx, w, h, locked) {
  ctx.fillStyle = locked ? '#1b1716' : '#2e2318'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = locked ? '#3c3330' : '#7a5a35'; ctx.lineWidth = 1;
  for (let x = 6; x < w; x += 9) { ctx.beginPath(); ctx.moveTo(x, 3); ctx.lineTo(x, h - 3); ctx.stroke(); }
  ctx.strokeStyle = locked ? '#4a4038' : '#a7834e'; ctx.lineWidth = 2; ctx.strokeRect(2, 2, w - 4, h - 4);
  ctx.fillStyle = locked ? '#5a4f45' : '#d8b46a'; ctx.fillRect(w - 9, h / 2 - 2, 3, 5); // handle
  if (locked) { // barred: the way back is closed
    ctx.strokeStyle = '#6d6259'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(4, h * 0.35); ctx.lineTo(w - 4, h * 0.35);
    ctx.moveTo(4, h * 0.65); ctx.lineTo(w - 4, h * 0.65); ctx.stroke();
  }
}

export function createMuseumArt(scene) {
  const background = scene.add.image(0, 0, texture(scene, `floor-${LEVEL.id}`, W, H, paintMuseum)).setOrigin(0).setDepth(0);
  const gemKey = texture(scene, 'crystal', 64, 64, ctx => {
    glow(ctx, 32, 32, 31, 'rgba(255,184,45,.40)');
    ctx.fillStyle = '#db8c29'; ctx.strokeStyle = '#ffedab'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(32, 15); ctx.lineTo(42, 29); ctx.lineTo(32, 47);
    ctx.lineTo(22, 29); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffe096'; ctx.beginPath(); ctx.moveTo(32, 15); ctx.lineTo(32, 47);
    ctx.lineTo(22, 29); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff4bd'; ctx.beginPath(); ctx.moveTo(22, 29); ctx.lineTo(42, 29);
    ctx.moveTo(32, 15); ctx.lineTo(36, 29); ctx.lineTo(32, 47); ctx.stroke();
    ctx.fillStyle = '#fff1c1'; ctx.fillRect(14, 20, 1, 5); ctx.fillRect(12, 22, 5, 1);
  });
  const artefact = ARTEFACT ? scene.add.image(ARTEFACT.x, ARTEFACT.y - 4, gemKey).setDepth(4) : null;

  // Exit door: doorway plus a leaf hinged on its left edge (scaleX opens it).
  const exitKey = texture(scene, `door-${EXIT.width}x${EXIT.height}`, EXIT.width, EXIT.height,
    ctx => paintDoorway(ctx, EXIT.width, EXIT.height, 'EXIT'));
  const leafW = EXIT.width - 12, leafH = EXIT.height - 10;
  const leafKey = texture(scene, `door-leaf-${leafW}x${leafH}`, leafW, leafH, ctx => paintDoorLeaf(ctx, leafW, leafH, false));
  const exit = scene.add.image(EXIT.x, EXIT.y, exitKey).setOrigin(0).setDepth(2);
  const exitLeaf = scene.add.image(EXIT.x + 6, EXIT.y + 6, leafKey).setOrigin(0).setDepth(2.5);

  // Entrance: the closed, barred door the thief came through. No way back.
  const entranceKey = texture(scene, `entrance-${ENTRANCE.width}x${ENTRANCE.height}`, ENTRANCE.width, ENTRANCE.height, ctx => {
    paintDoorway(ctx, ENTRANCE.width, ENTRANCE.height, 'NO RETURN');
    ctx.save(); ctx.translate(6, 6); paintDoorLeaf(ctx, ENTRANCE.width - 12, ENTRANCE.height - 10, true); ctx.restore();
  });
  const entrance = scene.add.image(ENTRANCE.x, ENTRANCE.y, entranceKey).setOrigin(0).setDepth(2);
  return { background, artefact, exit, exitLeaf, entrance };
}

export function coinTexture(scene) {
  return texture(scene, 'coin', 18, 18, ctx => {
    glow(ctx, 9, 9, 9, 'rgba(255,205,80,.35)');
    ctx.fillStyle = '#8a5f17'; ctx.beginPath(); ctx.arc(9, 10, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.arc(9, 9, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffe9a3'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(9, 9, 4, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff6cf'; ctx.fillRect(6, 6, 2, 2);
  });
}

// The thief's colours; the rival thief (src/story/art.js) repaints the same figure.
export const THIEF_PALETTE = Object.freeze({
  glow: 'rgba(44,211,227,.12)', legs: '#07151f', boots: '#467483', cloak: '#123a4a', cloakEdge: '#3097a4',
  hood: '#1f6a79', hoodEdge: '#59cccf', face: '#061821', eyes: '#99f5ed', seam: '#4c9a9d',
  arms: '#091b24', armEdge: '#438d96', strap: '#c0a269',
});

export function paintThief(ctx, facing, stride, c = THIEF_PALETTE) {
  glow(ctx, 20, 20, 20, c.glow);
  ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.beginPath(); ctx.ellipse(21, 31, 11, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); if (facing === 'left') { ctx.translate(40, 0); ctx.scale(-1, 1); }
  ctx.fillStyle = c.legs;
  ctx.fillRect(14 + stride * 2, 25, 5, 8 - stride * 2);
  ctx.fillRect(22 - stride * 2, 25, 5, 6 + stride * 2);
  ctx.fillStyle = c.boots; ctx.fillRect(13 + stride * 2, 31 - stride * 2, 7, 3);
  ctx.fillRect(22 - stride * 2, 29 + stride * 2, 7, 3);
  ctx.fillStyle = c.cloak;
  ctx.beginPath(); ctx.moveTo(15, 14); ctx.lineTo(25, 14); ctx.lineTo(29, 28);
  ctx.lineTo(11, 28); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = c.cloakEdge; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = c.hood; ctx.beginPath(); ctx.ellipse(20, 12, 9, 10, -.15, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = c.hoodEdge; ctx.stroke();
  if (facing !== 'up') {
    ctx.fillStyle = c.face; ctx.beginPath(); ctx.ellipse(facing === 'down' ? 20 : 24, 13, 6, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c.eyes; ctx.fillRect(facing === 'down' ? 17 : 24, 12, 2, 2);
    ctx.fillRect(facing === 'down' ? 22 : 27, 12, 2, 2);
  } else {
    ctx.strokeStyle = c.seam; ctx.beginPath(); ctx.moveTo(19, 5); ctx.lineTo(19, 17); ctx.stroke();
  }
  ctx.strokeStyle = c.arms; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(12, 19); ctx.lineTo(10, 25 + stride * 2);
  ctx.moveTo(27, 18); ctx.lineTo(30, 24 - stride * 2); ctx.stroke();
  ctx.strokeStyle = c.armEdge; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = c.strap; ctx.beginPath(); ctx.moveTo(15, 19); ctx.lineTo(24, 26); ctx.stroke();
  ctx.restore();
}

export function thiefTexture(scene, facing, stride) {
  return texture(scene, `thief-${facing}-${stride}`, 40, 40, ctx => paintThief(ctx, facing, stride));
}

// Optional visual-only helper for Shyam. GuardSystem retains movement, suspicion,
// collision and its 20px logic body; this draws a centered 40px sprite frame.
export function guardTexture(scene, facing = 'down', stride = 0) {
  const direction = ['up', 'down', 'left', 'right'].includes(facing) ? facing : 'down';
  const frame = stride ? 1 : 0;
  return texture(scene, `guard-${direction}-${frame}`, 40, 40, ctx => {
    ctx.fillStyle = 'rgba(0,0,0,.65)';
    ctx.beginPath(); ctx.ellipse(20, 32, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    if (direction === 'left') { ctx.translate(40, 0); ctx.scale(-1, 1); }
    ctx.fillStyle = '#11202b';
    ctx.fillRect(13 + frame * 2, 25, 6, 8 - frame * 2);
    ctx.fillRect(22 - frame * 2, 25, 6, 6 + frame * 2);
    ctx.fillStyle = '#090e15';
    ctx.fillRect(12 + frame * 2, 31 - frame * 2, 8, 4);
    ctx.fillRect(22 - frame * 2, 29 + frame * 2, 8, 4);
    ctx.fillStyle = '#6e303a';
    ctx.beginPath(); ctx.moveTo(13, 16); ctx.lineTo(27, 16);
    ctx.lineTo(29, 28); ctx.lineTo(11, 28); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#a25b54'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#151d23'; ctx.fillRect(12, 25, 16, 3);
    ctx.fillStyle = '#d0ad65'; ctx.fillRect(18, 25, 4, 3);
    ctx.fillRect(12, 16, 5, 2); ctx.fillRect(24, 16, 5, 2);
    ctx.strokeStyle = '#17222b'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(12, 19); ctx.lineTo(10, 26 + frame);
    ctx.moveTo(28, 19); ctx.lineTo(30, 25 - frame); ctx.stroke();
    ctx.strokeStyle = '#8e514f'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = direction === 'up' ? '#253640' : '#b09a78';
    ctx.beginPath(); ctx.ellipse(20, 12, 6, 7, 0, 0, Math.PI * 2); ctx.fill();
    if (direction !== 'up') {
      ctx.fillStyle = '#202731';
      const x = direction === 'down' ? 16 : 22;
      ctx.fillRect(x, 12, 9, 4);
      ctx.fillStyle = '#e0bd83'; ctx.fillRect(x + 2, 12, 2, 1);
    }
    ctx.fillStyle = '#843b44';
    ctx.beginPath(); ctx.ellipse(20, 7, 9, 5, -.08, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#c57867'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#18232a'; ctx.fillRect(direction === 'down' ? 12 : 17, 9, 17, 3);
    ctx.fillStyle = '#d9b672'; ctx.fillRect(18, 6, 4, 3);
    ctx.restore();
  });
}
