import { CUTSCENES } from './script.js';
import { paintThief } from '../game/MuseumArt.js';
import { guardSpriteTexture, wardenSpriteTexture } from '../game/GuardSystem.js';
import { VESPER_PALETTE } from './art.js';

// Cutscene cards: a full-screen overlay with one code-drawn pixel-art panel
// and the story text per card. Space, Enter or a click moves on; Esc skips.
// Game keys never reach the paused game while a card is open.
const W = 320, H = 180;

// Sprites drawn with the game's own painters onto standalone canvases.
const sprites = new Map();
const spriteScene = {
  textures: {
    exists: key => sprites.has(key),
    createCanvas: (key, width, height) => {
      const canvas = Object.assign(document.createElement('canvas'), { width, height });
      sprites.set(key, canvas);
      return { context: canvas.getContext('2d'), refresh() {} };
    },
  },
};
const sprite = (key, paint) => {
  if (!sprites.has(key)) {
    const canvas = Object.assign(document.createElement('canvas'), { width: 40, height: 40 });
    paint(canvas.getContext('2d'));
    sprites.set(key, canvas);
  }
  return sprites.get(key);
};
const thief = () => sprite('card-thief', ctx => paintThief(ctx, 'down', 0));
const vesper = () => sprite('card-vesper', ctx => paintThief(ctx, 'right', 0, VESPER_PALETTE));
const guard = () => sprites.get(guardSpriteTexture(spriteScene, 'down', 0));
const warden = () => sprites.get(wardenSpriteTexture(spriteScene, 'left', 0));

const glow = (ctx, x, y, r, color) => {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
};
const sky = (ctx, top, bottom) => {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  for (let i = 0; i < 40; i++) ctx.fillRect((i * 73) % W, (i * 37) % 90, 1, 1);
};
const castle = (ctx, lit) => {
  ctx.fillStyle = '#0b0f16';
  ctx.fillRect(90, 70, 140, 110);
  for (const [x, w, h] of [[80, 26, 96], [118, 18, 120], [150, 22, 140], [184, 18, 118], [214, 26, 92]]) {
    ctx.fillRect(x, H - h, w, h);
    ctx.beginPath(); ctx.moveTo(x - 3, H - h); ctx.lineTo(x + w / 2, H - h - 18); ctx.lineTo(x + w + 3, H - h); ctx.fill();
  }
  for (let i = 0; i < 26; i++) {
    const x = 96 + (i * 29) % 128, y = 72 + ((i * 17) % 90);
    ctx.fillStyle = lit || i % 3 ? 'rgba(240,190,100,.85)' : 'rgba(240,190,100,.25)';
    ctx.fillRect(x, y, 3, 4);
  }
};
const heart = (ctx, x, y, s, t) => {
  const beat = 1 + 0.12 * Math.max(0, Math.sin(t / 140)) * (Math.sin(t / 420) > 0 ? 1 : 0);
  glow(ctx, x, y, 34 * s * beat, 'rgba(255,190,70,.55)');
  ctx.save(); ctx.translate(x, y); ctx.scale(s * beat, s * beat);
  ctx.fillStyle = '#db8c29'; ctx.strokeStyle = '#ffedab'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 9); ctx.bezierCurveTo(-14, -1, -8, -13, 0, -5);
  ctx.bezierCurveTo(8, -13, 14, -1, 0, 9); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffe096'; ctx.fillRect(-5, -5, 3, 3);
  ctx.restore();
};

const PANELS = {
  castle(ctx) {
    sky(ctx, '#070b18', '#1b2440');
    ctx.fillStyle = '#e9e4cf'; ctx.beginPath(); ctx.arc(250, 36, 14, 0, Math.PI * 2); ctx.fill();
    castle(ctx, false);
    ctx.drawImage(thief(), 52, 128, 40, 40);
  },
  radio(ctx, t) {
    ctx.fillStyle = '#071116'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#59dce6'; ctx.lineWidth = 2; ctx.beginPath();
    for (let x = 0; x <= W; x += 4) {
      const y = 90 + Math.sin(x / 9 + t / 160) * 14 * Math.max(0.2, Math.sin(x / 60 + t / 700));
      if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.drawImage(thief(), 40, 116, 48, 48);
    ctx.drawImage(guard(), 230, 112, 48, 48);
    ctx.fillStyle = '#ffd84a'; ctx.font = 'bold 14px monospace'; ctx.fillText('?', 250, 110);
  },
  heart(ctx, t) {
    ctx.fillStyle = '#0a0809'; ctx.fillRect(0, 0, W, H);
    glow(ctx, 160, 100, 120, 'rgba(120,40,30,.35)');
    ctx.fillStyle = '#1e1513'; ctx.fillRect(0, 150, W, 30);
    heart(ctx, 150, 92, 2.2, t);
    ctx.drawImage(thief(), 118, 108, 40, 40);
    ctx.drawImage(warden(), 236, 104, 44, 44);
  },
  stair(ctx, t) {
    ctx.fillStyle = '#080605'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = `rgb(${40 - i * 3},${33 - i * 3},${26 - i * 2})`;
      ctx.fillRect(60 + i * 18, 40 + i * 14, 200 - i * 36 > 20 ? 200 - i * 36 : 20, 14);
    }
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = '#c9bb9c'; ctx.beginPath(); ctx.arc(30 + (i * 23) % 260, 162 + (i % 3) * 5, 4, 0, Math.PI * 2); ctx.fill();
    }
    heart(ctx, 160, 150, 0.8, t);
    ctx.drawImage(thief(), 70, 20, 40, 40);
  },
  moon(ctx) {
    sky(ctx, '#0b1020', '#243050');
    ctx.fillStyle = '#efe9d4'; ctx.beginPath(); ctx.arc(60, 40, 16, 0, Math.PI * 2); ctx.fill();
    castle(ctx, true);
    ctx.fillStyle = '#0a0d12'; ctx.fillRect(0, 168, W, 12);
    ctx.drawImage(thief(), 250, 130, 40, 40);
    ctx.fillStyle = '#f2c14e';
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(244 + i * 3, 170 - (i % 2) * 2, 2.5, 0, Math.PI * 2); ctx.fill(); }
  },
  shrine(ctx, t) {
    ctx.fillStyle = '#0b0807'; ctx.fillRect(0, 0, W, H);
    glow(ctx, 160, 90, 110, 'rgba(255,200,110,.45)');
    ctx.fillStyle = '#5d5040'; ctx.fillRect(120, 108, 80, 40);
    ctx.fillStyle = '#7f6f58'; ctx.fillRect(120, 104, 80, 6);
    heart(ctx, 160, 96, 1.6, t / 3);
    ctx.drawImage(thief(), 70, 112, 40, 40);
    ctx.drawImage(warden(), 214, 110, 40, 40);
  },
  dawn(ctx) {
    sky(ctx, '#3a2a4a', '#f0b070');
    ctx.fillStyle = '#ffe9b0'; ctx.beginPath(); ctx.arc(160, 150, 30, 0, Math.PI * 2); ctx.fill();
    castle(ctx, true);
    ctx.fillStyle = '#1a1210'; ctx.fillRect(0, 170, W, 10);
    ctx.drawImage(thief(), 40, 132, 40, 40);
    ctx.drawImage(vesper(), 270, 132, 40, 40);
  },
};

let overlay = null;

function build() {
  overlay = document.createElement('section');
  overlay.id = 'story-card';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <div class="story-card-inner">
      <canvas width="${W}" height="${H}" aria-hidden="true"></canvas>
      <p class="story-eyebrow"></p>
      <h2 class="story-title"></h2>
      <p class="story-text"></p>
      <div class="story-actions"><span class="story-count"></span>
        <button class="primary" id="story-next">Continue <span>▸</span></button>
        <button class="secondary" id="story-skip">Skip</button></div>
    </div>`;
  document.body.appendChild(overlay);
}

// Plays the named cutscene; resolves when the last card is dismissed.
export function playCutscene(id) {
  const cards = CUTSCENES[id];
  if (!cards?.length) return Promise.resolve();
  if (!overlay) build();
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  return new Promise(resolve => {
    let index = 0, frame = 0;
    const canvas = overlay.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      PANELS[cards[index].panel]?.(ctx, performance.now());
      frame = requestAnimationFrame(draw);
    };
    const show = () => {
      const card = cards[index];
      overlay.querySelector('.story-eyebrow').textContent = card.eyebrow;
      overlay.querySelector('.story-title').textContent = card.title;
      overlay.querySelector('.story-text').textContent = card.text;
      overlay.querySelector('.story-count').textContent = cards.length > 1 ? `${index + 1} / ${cards.length}` : '';
      overlay.querySelector('#story-next').innerHTML = index < cards.length - 1
        ? 'Continue <span>▸</span>' : 'Done <span>✓</span>';
    };
    const close = () => {
      cancelAnimationFrame(frame);
      overlay.classList.remove('show');
      document.body.classList.remove('story-open');
      window.removeEventListener('keydown', onKey, { capture: true });
      overlay.querySelector('#story-next').onclick = null;
      overlay.querySelector('#story-skip').onclick = null;
      resolve();
    };
    const advance = () => { if (++index >= cards.length) close(); else show(); };
    // Capture phase on window: the game (Phaser, P/R/F/Space shortcuts) never sees these keys.
    const onKey = event => {
      event.stopPropagation();
      if (event.repeat) return;
      if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); advance(); }
      if (event.key === 'Escape') close();
    };
    overlay.querySelector('#story-next').onclick = advance;
    overlay.querySelector('#story-skip').onclick = close;
    window.addEventListener('keydown', onKey, { capture: true });
    document.body.classList.add('story-open');
    overlay.classList.add('show');
    show();
    draw();
    overlay.querySelector('#story-next').focus();
  });
}

export const storyOpen = () => document.body.classList.contains('story-open');
