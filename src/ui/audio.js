// Background music and the door/victory sound. Presentation only.
// Browsers block audio until the first user gesture, so music starts on the
// first click or key press. The mute choice is a per-browser convenience.
const MUTE_KEY = 'hh-muted';
const music = new Audio('/assets/audio/game-audio.mp3');
music.loop = true;
music.volume = 0.45;
const victory = new Audio('/assets/audio/victory.mp3');
victory.volume = 0.85;

let muted = false;
try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* storage unavailable */ }
let unlocked = false;
let inVictory = false;
let victoryTimer = null;

const playMusic = () => {
  if (muted || !unlocked || inVictory) return;
  music.play().catch(() => {});
};

const notify = () => window.dispatchEvent(new CustomEvent('audio-muted-changed', { detail: muted }));

export function initAudio() {
  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    playMusic();
  };
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
  victory.addEventListener('ended', endVictory);
  notify();
}

function endVictory() {
  clearTimeout(victoryTimer);
  inVictory = false;
  playMusic();
}

// Going through a door: music stops, the victory sound plays, music resumes after.
export function playDoorVictory() {
  inVictory = true;
  music.pause();
  clearTimeout(victoryTimer);
  if (muted) { victoryTimer = setTimeout(endVictory, 4800); return; }
  victory.currentTime = 0;
  victory.play().catch(() => {});
  victoryTimer = setTimeout(endVictory, 6000); // fallback if 'ended' never fires
}

export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* ignore */ }
  if (muted) { music.pause(); victory.pause(); } else { unlocked = true; playMusic(); }
  notify();
  return muted;
}

export function isMuted() { return muted; }

// For checks/debugging: what is currently audible.
export function audioState() {
  return { music: !music.paused, victory: !victory.paused, muted, unlocked };
}
