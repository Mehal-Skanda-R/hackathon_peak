// Code-drawn art for the story layer: Vesper, journal pages and the shrine's glow.
// Textures are cached on the scene's texture manager, like MuseumArt.
import { paintThief, THIEF_PALETTE } from '../game/MuseumArt.js';

const cached = (scene, key, width, height, paint) => {
  if (!scene.textures.exists(key)) {
    const canvas = scene.textures.createCanvas(key, width, height);
    paint(canvas.context);
    canvas.refresh();
  }
  return key;
};

// Vesper: the same thief silhouette in a red cloak with gold eyes.
export const VESPER_PALETTE = Object.freeze({
  ...THIEF_PALETTE,
  glow: 'rgba(255,70,90,.14)', boots: '#8a3a3a', cloak: '#5e1220', cloakEdge: '#d5474f',
  hood: '#8f1f2c', hoodEdge: '#ff7a7f', face: '#1a0507', eyes: '#ffd27a', seam: '#c24a4f',
  arms: '#2a070b', armEdge: '#b8454a', strap: '#e0c27a',
});

export const vesperTexture = (scene, facing, stride) =>
  cached(scene, `hh-vesper-v1-${facing}-${stride}`, 40, 40, ctx => paintThief(ctx, facing, stride, VESPER_PALETTE));

// A folded journal page with a wax seal.
export const pageTexture = scene => cached(scene, 'hh-journal-page-v1', 18, 20, ctx => {
  const glow = ctx.createRadialGradient(9, 10, 0, 9, 10, 10);
  glow.addColorStop(0, 'rgba(255,240,200,.35)'); glow.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, 18, 20);
  ctx.fillStyle = '#e9dcb8'; ctx.fillRect(3, 3, 12, 14);
  ctx.fillStyle = '#c9b98f'; ctx.fillRect(12, 3, 3, 3);
  ctx.fillStyle = '#7d6b4a';
  for (let y = 7; y < 15; y += 2) ctx.fillRect(5, y, 7, 1);
  ctx.fillStyle = '#a3262f'; ctx.beginPath(); ctx.arc(12, 15, 2, 0, Math.PI * 2); ctx.fill();
});

// Warm gold glow for Aurel's shrine (drawn additively above the darkness).
export const shrineGlowTexture = scene => cached(scene, 'hh-shrine-glow-v1', 96, 96, ctx => {
  const glow = ctx.createRadialGradient(48, 48, 0, 48, 48, 48);
  glow.addColorStop(0, 'rgba(255,210,120,1)'); glow.addColorStop(0.3, 'rgba(240,150,60,.5)');
  glow.addColorStop(1, 'rgba(200,90,40,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, 96, 96);
});
