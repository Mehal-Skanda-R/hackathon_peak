import AfterHoursScene from './AfterHoursScene.js';
import { GEAR, CURSES, LASERS } from './rules.js';
import { loadProfile, saveProfile, buyGear, rewardEscape } from './profile.js';
import { isSensorUsable } from '../game/GameState.js';
import { getHeartRateState, subscribeToHeartRate } from '../sensor/heartRate.js';
import './style.css';

// Optional mode. The original campaign sleeps intact, including its paused run.
// All selectors/storage/events are namespaced; no campaign progress writes.
export function initAfterHours(game) {
  game.scene.add('AfterHoursScene', AfterHoursScene, false);
  let active = false, lastFailed = null, current = null, profile = loadProfile(), noticeTimer, dialogKind = 'setup';
  const entry = document.createElement('button');
  entry.id = 'ah-entry'; entry.innerHTML = '<span>NEW MISSION</span> AFTER HOURS <b>↗</b>';
  document.getElementById('home').appendChild(entry);
  const root = document.createElement('section'); root.id = 'ah-ui';
  const retryHint = document.querySelector('.frame-bottom span:last-child');
  const campaignRetryHint = retryHint.innerHTML;
  root.setAttribute('aria-label', 'After Hours mission controls');
  root.innerHTML = `
    <div class="ah-telemetry" aria-label="Mission readings">
      <div><small>MUSEUM RHYTHM</small><strong id="ah-phase">QUIET</strong><span id="ah-countdown"></span><progress id="ah-beat" max="1" value="0" aria-label="Museum security cycle"></progress></div>
      <div><small>YOUR HEART RATE</small><strong id="ah-bpm">--</strong><span id="ah-input"></span></div>
      <div class="ah-goal"><small id="ah-stage">THE CONTRACT</small><strong id="ah-objective">Steal the cursed artefact</strong><span id="ah-loot">0 / 8 coins</span></div>
      <button id="ah-pause" type="button">Pause / kit</button>
    </div>
    <div id="ah-director" hidden>
      <b>PLAYER 2 · SECURITY DIRECTOR</b><span id="ah-budget"></span>
      <button id="ah-lane">L · Select sector</button><button id="ah-sweep">J · Warn + sweep</button><button id="ah-lure">K · Divert guards</button>
    </div>
    <div id="ah-toast" role="status" aria-live="polite"></div>
    <div class="ah-dialog" id="ah-dialog" hidden role="dialog" aria-modal="true" aria-labelledby="ah-title">
      <div class="ah-dialog-content">
        <p class="ah-eyebrow">HEARTBEAT HEIST / AFTER HOURS</p>
        <h2 id="ah-title">The collection is alive.</h2>
        <p id="ah-description">Steal a cursed artefact from the east vault, then escape through the west extraction point. Your heartbeat reveals the museum. Its heartbeat powers security.</p>
        <div class="ah-briefing" id="ah-briefing">
          <label>THE ARTEFACT<select id="ah-curse">${Object.values(CURSES).map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select></label>
          <p id="ah-curse-detail"></p>
          <label>YOUR EQUIPMENT<select id="ah-gear">${Object.values(GEAR).map(g => `<option value="${g.id}">${g.name}${g.cost ? ` · ${g.cost} marks to own` : ' · included'}</option>`).join('')}</select></label>
          <p id="ah-gear-detail"></p>
          <div class="ah-market"><span id="ah-wallet"></span><button id="ah-buy">Buy equipment</button></div>
          <label>PLAY STYLE<select id="ah-style"><option value="solo">Solo heist</option><option value="director">Local versus · thief + security director</option></select></label>
          <p id="ah-style-detail">One thief. Both patrol guards remain active.</p>
          <ul class="ah-instructions">
            <li><b>WASD / arrows</b> move. Green rugs hide you from guards.</li>
            <li><b>Amber</b> warns before a laser. <b>Red</b> is dangerous. Wait for a quiet passage.</li>
            <li><b>Purple exhibit</b> can shift outside your vision. Routes remain connected.</li>
            <li><b>A failed attempt</b> leaves one ghost. Its first 12 echoes can divert investigating guards, never a guard already chasing you.</li>
          </ul>
        </div>
        <p id="ah-result" hidden></p>
        <p id="ah-sensor-status" role="status"></p>
        <div class="ah-dialog-actions">
          <button id="ah-launch" class="ah-primary">Accept contract</button>
          <button id="ah-resume" class="ah-primary" hidden>Resume mission</button>
          <button id="ah-retry" class="ah-primary" hidden>Retry with my ghost</button>
          <button id="ah-change" hidden>New contract / equipment</button>
          <button id="ah-connect">Connect heart-rate sensor</button>
          <button id="ah-castle">Return to campaign</button>
          <button id="ah-clear">Forget previous ghost</button>
        </div>
        <small class="ah-footnote">Campaign progress stays separate. Ghosts live only in this tab and contain positions and pulse locations, not BPM history. No online multiplayer.</small>
      </div>
    </div>`;
  document.getElementById('museum-frame').appendChild(root);
  const $ = id => root.querySelector(`#${id}`);
  const scene = () => game.scene.getScene('AfterHoursScene');
  const notice = message => { $('ah-toast').textContent = message; $('ah-toast').classList.add('show');
    clearTimeout(noticeTimer); noticeTimer = setTimeout(() => $('ah-toast').classList.remove('show'), 5000); };
  const dialog = kind => {
    dialogKind = kind;
    $('ah-dialog').hidden = false;
    $('ah-briefing').hidden = kind !== 'setup'; $('ah-launch').hidden = kind !== 'setup';
    $('ah-resume').hidden = !['ready', 'paused'].includes(kind);
    $('ah-resume').textContent = kind === 'ready' ? 'Start mission' : 'Resume mission';
    $('ah-retry').hidden = !['caught', 'victory'].includes(kind);
    $('ah-retry').textContent = kind === 'caught' ? 'Retry with my ghost' : 'Run this contract again';
    $('ah-change').hidden = kind === 'setup'; $('ah-result').hidden = !['caught', 'victory'].includes(kind);
    $('ah-title').textContent = { setup: 'The collection is alive.', ready: 'Your contract is ready.', paused: 'A moment in the shadows.', caught: 'An echo remains.', victory: 'The curse escaped with you.' }[kind];
    $('ah-description').textContent = kind === 'setup'
      ? 'Steal a cursed artefact from the east vault, then escape through west extraction. Your heartbeat reveals the museum. Its heartbeat powers security.'
      : kind === 'caught' ? 'The museum caught you. Your last attempt can now draw guards toward its echoes.'
      : kind === 'victory' ? 'The artefact is yours. Spend your marks on a different approach to the next contract.'
      : current?.reason || 'Find the artefact in the east vault. Bring it back to the extraction point in the west.';
    requestAnimationFrame(() => root.querySelector('.ah-dialog-actions button:not([hidden]):not(:disabled)')?.focus());
    sensorStatus();
  };
  const updateMarket = () => {
    const id = $('ah-gear').value, gear = GEAR[id], owned = profile.owned.includes(id);
    $('ah-gear-detail').textContent = gear.description;
    $('ah-curse-detail').textContent = CURSES[$('ah-curse').value].description;
    $('ah-wallet').textContent = `${profile.marks} marks · ${profile.escaped} successful extractions`;
    $('ah-buy').hidden = owned; $('ah-buy').disabled = profile.marks < gear.cost;
    $('ah-buy').textContent = profile.marks < gear.cost ? `Need ${gear.cost - profile.marks} more marks` : `Buy for ${gear.cost} marks`;
    $('ah-launch').disabled = !owned;
  };
  function sensorStatus() {
    if (!active) return;
    const s = getHeartRateState(), usable = isSensorUsable(s);
    $('ah-sensor-status').textContent = usable ? (s.mode === 'live' ? 'LIVE sensor ready.' : 'DEVELOPMENT SIMULATOR active. This is simulated heart-rate input.')
      : s.mode === 'live' && !s.connected ? 'Connect your sensor, then allow calibration.' : 'Waiting for fresh, calibrated heart-rate readings…';
    $('ah-resume').disabled = !usable;
    $('ah-connect').hidden = s.mode === 'live' && s.connected;
    $('ah-bpm').textContent = s.smoothedBpm == null ? '--' : `${Math.round(s.smoothedBpm)} BPM`;
    $('ah-input').textContent = s.mode === 'live' ? (s.connected ? 'LIVE SENSOR' : 'LIVE · DISCONNECTED') : 'SIMULATED INPUT';
  }
  const render = s => {
    const changed = current?.status !== s.status; current = s;
    if (!active) return;
    $('ah-director').hidden = !s.director;
    const security = s.security;
    $('ah-phase').textContent = security.phase === 'quiet' ? 'QUIET' : security.phase === 'warning' ? 'LASER WARNING' : 'LASER ACTIVE';
    $('ah-phase').dataset.phase = security.phase;
    $('ah-countdown').textContent = `${LASERS[security.lane].name} · ${(security.remaining / 1000).toFixed(1)}s`;
    $('ah-beat').value = security.progress;
    $('ah-stage').textContent = s.carrying ? `CURSE ACTIVE · ${s.curseName}` : 'THE CONTRACT';
    $('ah-objective').textContent = s.carrying ? 'Return to west extraction' : 'Steal the artefact in the east vault';
    $('ah-loot').textContent = `${s.loot} / 8 coins · ${Math.floor(s.elapsed / 1000)}s${s.ghost ? ' · ghost active' : ''}`;
    $('ah-budget').textContent = `${s.charges} / 3 charges · ${LASERS[s.lane].name}${s.cooldown ? ` · ${(s.cooldown / 1000).toFixed(1)}s cooldown` : ''}`;
    $('ah-sweep').disabled = $('ah-lure').disabled = s.status !== 'playing' || s.charges < 1 || s.cooldown > 0;
    $('ah-pause').disabled = !['playing', 'paused', 'ready'].includes(s.status);
    document.getElementById('frame-level').textContent = 'AFTER HOURS · THE LIVING MUSEUM';
    document.getElementById('hud-status').textContent = s.status === 'playing' ? 'After Hours · heist in progress' : `After Hours · ${s.status}`;
    if (changed && s.status !== 'playing') dialog(s.status);
    sensorStatus();
  };
  const launch = () => {
    if (!profile.owned.includes($('ah-gear').value)) return;
    current = null; $('ah-dialog').hidden = true;
    const options = { gearId: $('ah-gear').value, curseId: $('ah-curse').value,
      director: $('ah-style').value === 'director', previous: lastFailed,
      isBlocked: () => !$('ah-dialog').hidden,
      onSnapshot: render, onNotice: notice, onRetry: launch,
      onFinish(record, coins, gear) {
        if (record.meta.outcome === 'caught') lastFailed = record;
        else { lastFailed = null; const before = profile.marks; profile = rewardEscape(profile, coins, gear);
          const saved = saveProfile(profile); updateMarket();
          $('ah-result').textContent = `Escaped in ${(record.duration / 1000).toFixed(1)}s. ${coins} coins collected. +${profile.marks - before} marks.${saved ? '' : ' Browser storage is unavailable; rewards last only for this session.'}`;
        }
        if (record.meta.outcome === 'caught') $('ah-result').textContent = `Attempt lasted ${(record.duration / 1000).toFixed(1)}s. No marks lost. Your next attempt gets this ghost.`;
      } };
    if (game.scene.isActive('AfterHoursScene')) game.scene.stop('AfterHoursScene');
    game.scene.start('AfterHoursScene', options);
  };
  const open = () => {
    if (active) return;
    const museum = game.scene.getScene('MuseumScene');
    if (museum.status === 'transition') return;
    if (museum.status === 'playing') museum.setPaused(true, 'Menu open');
    game.scene.sleep('MuseumScene'); active = true; current = null;
    document.body.classList.add('after-hours-open'); window.dispatchEvent(new Event('hud-hide-home'));
    retryHint.innerHTML = '<b>R</b> RETRY AFTER CAPTURE / ESCAPE';
    updateMarket(); dialog('setup'); document.getElementById('museum-frame').scrollIntoView({ block: 'start', behavior: 'instant' });
  };
  const leave = () => {
    if (!active) return;
    game.scene.stop('AfterHoursScene'); active = false; current = null;
    clearTimeout(noticeTimer); $('ah-toast').classList.remove('show'); $('ah-dialog').hidden = true;
    document.body.classList.remove('after-hours-open'); game.scene.wake('MuseumScene');
    retryHint.innerHTML = campaignRetryHint;
    window.dispatchEvent(new Event('hud-show-home'));
  };
  entry.addEventListener('click', open);
  $('ah-launch').addEventListener('click', launch); $('ah-retry').addEventListener('click', launch);
  $('ah-resume').addEventListener('click', () => {
    $('ah-dialog').hidden = true;
    if (!scene().requestStart()) { $('ah-dialog').hidden = false; sensorStatus(); }
  });
  $('ah-change').addEventListener('click', () => { scene().pause('Changing contract'); dialog('setup'); updateMarket(); });
  $('ah-pause').addEventListener('click', () => { if (current?.status === 'playing') scene().pause('Paused'); else if (current) dialog(current.status); });
  $('ah-castle').addEventListener('click', leave);
  $('ah-gear').addEventListener('change', updateMarket); $('ah-curse').addEventListener('change', updateMarket);
  $('ah-style').addEventListener('change', () => { $('ah-style-detail').textContent = $('ah-style').value === 'solo'
    ? 'One thief. Both patrol guards remain active.' : 'Two people, one keyboard. Thief: WASD. Director: L selects a sector, J warns then fires a sweep, K diverts guards. 1 charge / 8 seconds, 4-second action cooldown. No second watch or network connection.'; });
  $('ah-buy').addEventListener('click', () => {
    const bought = buyGear(profile, $('ah-gear').value); if (!bought) return;
    profile = bought; const saved = saveProfile(profile); updateMarket();
    notice(saved ? 'Equipment purchased. It stays available for future contracts.' : 'Equipment purchased for this session. Browser storage is unavailable.');
  });
  $('ah-clear').addEventListener('click', () => { lastFailed = null;
    if (game.scene.isActive('AfterHoursScene')) { scene().echo.record = null; scene().echoView.setAlpha(0); }
    notice('Previous ghost forgotten. No heartbeat history was stored.'); });
  $('ah-connect').addEventListener('click', () => window.dispatchEvent(new Event('hud-ble-clicked')));
  $('ah-lane').addEventListener('click', () => scene().direct('lane'));
  $('ah-sweep').addEventListener('click', () => scene().direct('sweep'));
  $('ah-lure').addEventListener('click', () => scene().direct('lure'));
  window.addEventListener('hud-open-menu', () => {
    if (!active) return;
    if (current?.status === 'playing') scene().pause('Paused'); else dialog(current?.status ?? 'setup');
  });
  window.addEventListener('hud-notice', event => {
    if (!active || ['hint', 'cleared'].includes(event.detail?.tone)) return;
    const message = typeof event.detail === 'string' ? event.detail : event.detail?.text;
    if (message) notice(message);
  });
  // Keep keyboard gameplay from escaping a modal or scrolling the page. Trap Tab
  // within the mission dialog while open; Escape pauses a running mission.
  root.addEventListener('keydown', event => {
    if ($('ah-dialog').hidden) return;
    if (['r', 'R'].includes(event.key) && event.target.tagName !== 'SELECT'
      && ['caught', 'victory'].includes(dialogKind) && !event.repeat) {
      event.preventDefault(); event.stopPropagation(); launch(); return;
    }
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'r', 'R', 'j', 'J', 'k', 'K', 'l', 'L'].includes(event.key)
      && event.target.tagName !== 'SELECT') event.stopPropagation();
    if (event.key === 'Tab') {
      const focusable = [...$('ah-dialog').querySelectorAll('button, select')].filter(e => !e.disabled && !e.hidden && e.offsetParent !== null);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  subscribeToHeartRate(sensorStatus);
}
