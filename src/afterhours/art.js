import { BASE_WALLS, COVERS, EXIT, WIDTH, HEIGHT, LAMPS } from './rules.js';

// Code-drawn architecture uses exactly the same rectangles as collision.
export function createAfterHoursArt(scene) {
  const key = 'hh-after-hours-floor-v1';
  if (!scene.textures.exists(key)) {
    const canvas = scene.textures.createCanvas(key, WIDTH, HEIGHT), c = canvas.context;
    c.fillStyle = '#0e1b21'; c.fillRect(0, 0, WIDTH, HEIGHT);
    for (let y = 32; y < HEIGHT - 32; y += 32) for (let x = 32; x < WIDTH - 32; x += 32) {
      c.fillStyle = (x / 32 + y / 32) % 2 ? '#17292f' : '#1b2e35'; c.fillRect(x + 1, y + 1, 30, 30);
      c.strokeStyle = '#263c40'; c.strokeRect(x + 2, y + 2, 28, 28);
      if ((x * 7 + y * 3) % 160 === 0) { c.fillStyle = '#304044'; c.fillRect(x + 12, y + 12, 6, 6); }
    }
    for (const z of [{ x: 278, y: 166, width: 234, height: 100 }, { x: 654, y: 36, width: 100, height: 112 }]) {
      c.fillStyle = '#422333'; c.fillRect(z.x, z.y, z.width, z.height);
      c.strokeStyle = '#a17b40'; c.strokeRect(z.x + 3, z.y + 3, z.width - 6, z.height - 6);
      c.strokeStyle = '#655138'; c.strokeRect(z.x + 7, z.y + 7, z.width - 14, z.height - 14);
    }
    for (const z of COVERS) {
      c.fillStyle = '#163e37'; c.fillRect(z.x + 2, z.y + 2, z.width - 4, z.height - 4);
      c.strokeStyle = '#598b6c'; c.strokeRect(z.x + 4, z.y + 4, z.width - 8, z.height - 8);
      for (let i = 12; i < z.width; i += 16) { c.fillStyle = '#43755b'; c.beginPath(); c.ellipse(z.x + i, z.y + 24, 4, 12, .5, 0, Math.PI * 2); c.fill(); }
    }
    for (const w of BASE_WALLS) {
      c.fillStyle = '#060d13'; c.fillRect(w.x + 4, w.y + 7, w.width + 4, w.height + 5);
      c.fillStyle = '#25353a'; c.fillRect(w.x, w.y, w.width, w.height);
      for (let y = w.y; y < w.y + w.height; y += 16) for (let x = w.x; x < w.x + w.width; x += 32) {
        c.strokeStyle = '#152328'; c.strokeRect(x + 1, y + 1, Math.min(30, w.x + w.width - x - 2), Math.min(14, w.y + w.height - y - 2));
      }
      c.fillStyle = '#52615c'; c.fillRect(w.x + 1, w.y + 1, w.width - 2, 3);
    }
    for (const [x, y] of LAMPS) {
      const g = c.createRadialGradient(x, y + 8, 1, x, y + 8, 60);
      g.addColorStop(0, 'rgba(242,180,81,.28)'); g.addColorStop(1, 'rgba(242,180,81,0)');
      c.fillStyle = g; c.fillRect(x - 60, y - 52, 120, 120);
      c.fillStyle = '#d6ab61'; c.fillRect(x - 4, y, 8, 4);
    }
    c.fillStyle = '#132728'; c.fillRect(EXIT.x + 6, EXIT.y + 6, EXIT.width - 12, EXIT.height - 12);
    c.strokeStyle = '#8eaa90'; c.lineWidth = 2; c.strokeRect(EXIT.x + 7, EXIT.y + 7, EXIT.width - 14, EXIT.height - 14);
    c.font = '9px monospace'; c.textAlign = 'center'; c.fillStyle = '#afc2ab'; c.fillText('EXTRACTION', EXIT.x + EXIT.width / 2, EXIT.y - 6);
    for (const [label, x, y] of [['ECHO GALLERY', 400, 46], ['THE COLLECTION', 688, 294], ['WEST WING', 127, 95]]) {
      c.fillStyle = '#a0a07b'; c.font = '10px monospace'; c.fillText(label, x, y);
    }
    canvas.refresh();
  }
  return scene.add.image(0, 0, key).setOrigin(0).setDepth(0);
}
