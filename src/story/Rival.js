// Vesper, the rival thief: races the player for coins, then leaves by the
// door. Every few seconds she makes a noise that distracts the guards. Pure
// logic; StorySystem renders her, hands her the floor's coins and applies her
// events. The engine refuses any coin that would make the door impossible.
import { findPath } from '../game/Guard.js';

export const RIVAL_TUNING = Object.freeze({
  speed: 95,            // px/s: slower than the 160 px/s thief, so a race is winnable
  startDelayMs: 3000,   // after the floor starts
  maxCoins: 3,
  pickupDistance: 14,
  noiseEveryMs: 9000,
  noiseRadius: 110,
  bodySize: 18,
});

// Start tile per floor she appears on.
export const RIVAL_BY_LEVEL = Object.freeze({
  'gallery-hall': Object.freeze({ start: [12, 1] }),
  'vault-ring': Object.freeze({ start: [12, 1] }),
  ossuary: Object.freeze({ start: [2, 1] }),
});

export default class Rival {
  constructor({ start, exit, map, canOccupy, tuning = {} }) {
    this.tuning = { ...RIVAL_TUNING, ...tuning };
    this.map = map;
    this.canOccupy = canOccupy;
    this.exit = exit;
    this.x = start.x;
    this.y = start.y;
    this.state = 'waiting';   // waiting -> racing -> leaving -> gone
    this.waitMs = this.tuning.startDelayMs;
    this.noiseMs = this.tuning.noiseEveryMs;
    this.taken = 0;
    this.target = null;
    this.path = [];
  }

  getState() {
    return Object.freeze({ x: this.x, y: this.y, state: this.state, taken: this.taken });
  }

  // coins: the engine's active coin objects ({ x, y }). Returns events:
  // { type: 'arrived' | 'coin' | 'noise' | 'gone', coin?, x?, y? }.
  update(deltaMs, coins) {
    const events = [];
    if (this.state === 'gone') return events;
    if (this.state === 'waiting') {
      this.waitMs -= deltaMs;
      if (this.waitMs > 0) return events;
      this.state = 'racing';
      events.push({ type: 'arrived' });
    }
    this.noiseMs -= deltaMs;
    if (this.noiseMs <= 0) {
      this.noiseMs = this.tuning.noiseEveryMs;
      events.push({ type: 'noise', x: this.x, y: this.y, radius: this.tuning.noiseRadius });
    }
    if (this.state === 'racing') {
      if (this.taken >= this.tuning.maxCoins) this.leave();
      else if (!this.target || !coins.includes(this.target)) this.chooseCoin(coins);
    }
    const arrived = this.followPath(this.tuning.speed * deltaMs / 1000);
    if (this.state === 'racing' && this.target
      && Math.hypot(this.target.x - this.x, this.target.y - this.y) <= this.tuning.pickupDistance) {
      events.push({ type: 'coin', coin: this.target });
      this.target = null;
    } else if (this.state === 'leaving' && arrived) {
      this.state = 'gone';
      events.push({ type: 'gone' });
    }
    return events;
  }

  // StorySystem reports whether the engine let her take the coin.
  coinTaken(accepted) {
    if (accepted) this.taken++;
    else this.leave(); // any more would leave the player short: her share is done
  }

  chooseCoin(coins) {
    let best = null;
    for (const coin of coins) {
      const path = findPath(this, coin, this.map, this.canOccupy, this.tuning.bodySize);
      if (path.length && (!best || path.length < best.path.length)) best = { coin, path };
    }
    if (!best) return this.leave();
    this.target = best.coin;
    this.path = [...best.path, { x: best.coin.x, y: best.coin.y }];
  }

  leave() {
    if (this.state === 'leaving' || this.state === 'gone') return;
    this.state = 'leaving';
    this.target = null;
    this.path = findPath(this, this.exit, this.map, this.canOccupy, this.tuning.bodySize);
  }

  followPath(distance) {
    while (distance > 0 && this.path.length) {
      const next = this.path[0];
      const remaining = Math.hypot(next.x - this.x, next.y - this.y);
      if (remaining <= distance) {
        this.x = next.x; this.y = next.y;
        distance -= remaining;
        this.path.shift();
      } else {
        this.x += (next.x - this.x) / remaining * distance;
        this.y += (next.y - this.y) / remaining * distance;
        distance = 0;
      }
    }
    return this.path.length === 0;
  }
}
