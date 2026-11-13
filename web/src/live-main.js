import '@fontsource-variable/nunito';
import * as THREE from 'three';
import { TownWorld } from './world.js';
import { Player } from './sprites.js';
import { createTownLayout } from './layouts.js';
import { DiceOverlay } from './dice.js';
import { TownEffects } from './effects.js';
import { EventCameos } from './event-cameos.js';
import { RacePresentation } from './race-presentation.js';
import { CommunityView } from './community-view.js';
import { LiveAudio } from './live-audio.js';
import './gameplay.css';
import './community.css';
import './live.css';

const mode = location.pathname.startsWith('/demo') || new URLSearchParams(location.search).get('mode') === 'demo' ? 'demo' : 'live';
const base = new URL('/runtime/', location.origin).href;
const money = value => Math.round(value || 0).toLocaleString('vi-VN');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = selector => document.querySelector(selector);
$('#live-app').innerHTML = `
  <main class="live-stage portrait" id="portrait" data-phase="waiting">
    <canvas id="game" aria-label="Khu phố 3D Cờ Tý Phí"></canvas>
    <header class="live-header"><div class="live-brand">CỜ TÝ PHÍ<small>CẢ PHỐ CÙNG CHƠI</small></div><div class="live-room-state"><span id="live-mode">${mode === 'demo' ? 'MÔ PHỎNG' : 'TIKTOK LIVE'}</span><small id="source-state">Đang nối máy chủ…</small></div></header>
    <div class="live-turn" id="live-turn" hidden><div class="live-turn-seat" id="turn-seat"></div><div class="live-turn-person"><small id="turn-label">CAMERA ĐANG THEO</small><strong id="turn-name"></strong><span id="turn-action"></span></div><div class="live-wallet"><small>MONEY</small><b id="turn-money"></b></div></div>
    <section class="live-welcome" id="live-welcome" hidden aria-live="polite"><span class="welcome-icon">✦</span><div><small id="welcome-label">CẢ PHỐ CHÀO BẠN</small><b id="welcome-name"></b><span id="welcome-detail"></span></div></section>
    <section class="live-branch" id="branch-bar" hidden><div><b>↔ CHỌN NGÕ NÀO?</b><span id="branch-time"></span></div><div id="branch-options"></div><small id="branch-votes"></small><div class="live-track"><i id="branch-track"></i></div></section>
    <section class="live-event" id="event-panel" hidden><div><span id="event-category"></span><span id="event-time"></span></div><h2 id="event-title"></h2><p id="event-body"></p><strong id="event-money"></strong><div id="event-options"></div></section>
    <section class="live-waiting" id="live-waiting"><span>✦</span><h1>Khu phố đang mở cửa</h1><p id="waiting-description">Gõ <b>CHƠI</b> để có quân của bạn.<br>Khách chờ vẫn góp vốn, đặt đơn và nhận lì xì.</p></section>
    <div class="live-caption" id="live-caption" hidden aria-live="polite"></div>
    <footer class="live-footer"><div><b id="room-count">0 người trong bàn</b><span id="race-hint">Ba vòng đường · Top 3 lên bục</span></div><span id="lap-label">1 / 3</span></footer>
    <button class="live-audio-button" id="audio-unlock">♫ Bật âm thanh MC</button>
    <div class="live-loading" id="live-loading"><span>✦</span><b>Đang mở khu phố…</b><small id="loading-message">Chuẩn bị nhà, cây và nhân vật</small></div>
    <div class="live-source-warning" id="live-warning" hidden></div>
  </main>`;
document.body.dataset.mode = mode;

let current = null, world, pack, actors = [], bySeat = new Map(), dice, effects, cameos, presentation, communityView;
let mapKey = '', frameTime = 0, renderTime = 0, syncing = false, pending = null, connected = false, lastStateAt = 0, activeCaption = null;
const targets = new Map();
const facade = {
  game: { accounts: new Map() }, selectedId: '',
  demo: { players: [], active: 0, setPaused() {}, select() {} },
  comment() {}, like() {}, rose() {}, openInvestment() {}, openEnvelope() {}, openShop() {}, simulateJoins() {}, simulateHearts() {}, simulateOrders() {}, simulateCancels() {}
};
const audio = new LiveAudio({ mode,
  onCaption(text, cue) { activeCaption = text ? { text, cue, until: Date.now() + 16000 } : null; updateCaption(); },
  onState(status) {
    $('#audio-unlock').textContent = !status.unlocked ? '♫ Bật âm thanh MC' : !status.enabled ? '♫ MC đang tắt' : status.error ? '♫ MC · kiểm tra âm thanh' : '♫ MC đang bật';
    $('#audio-unlock').dataset.enabled = String(!!status.unlocked && status.enabled);
    $('#audio-unlock').title = status.error || 'Bật âm thanh trong đúng cửa sổ đang lấy vào LIVE Studio';
  },
  onDuck(gain) { if (effects) { effects.volume = gain; effects.audio.forEach(item => { item.volume = .28 * gain; }); } }
});
$('#audio-unlock').onclick = async () => { try { await audio.unlock(); effects.unlocked = true; } catch (error) { showWarning(error.message); } };

function showWarning(text) { $('#live-warning').hidden = !text; $('#live-warning').textContent = text || ''; }
function updateCaption() {
  const text = activeCaption && activeCaption.until > Date.now() ? activeCaption.text : '';
  $('#live-caption').textContent = text; $('#live-caption').hidden = !text;
}

async function makeActor(row) {
  const index = Math.max(0, Number(row.actorIndex) || 0) % pack.actors.length;
  const actor = new Player({ ...pack.actors[index], instanceIndex: index, name: row.name || row.nickname || row.seat }, row.seat, base);
  await actor.init(); return actor;
}

// Only rendering lives in this page. The server owns dice, wallets, clocks and
// membership; opening another overlay never executes a second game engine.
async function applyState(state) {
  pending = state;
  if (syncing) return;
  syncing = true;
  try {
    while (pending) {
      const next = pending; pending = null;
      const game = next.game;
      const key = game ? `${game.map}:${game.seed}` : 'waiting';
      if (game && key !== mapKey) {
        $('#live-loading').hidden = false;
        await world.loadMap(createTownLayout(game.map, game.seed));
        mapKey = key; effects.clear();
      }
      const roster = new Map((next.roster || []).map(row => [row.seat, row]));
      const rows = game?.players || [];
      const wanted = new Set(rows.map(row => row.seat));
      const additions = await Promise.all(rows.filter(row => !bySeat.has(row.seat)).map(async row => {
        const actor = await makeActor({ ...row, ...roster.get(row.seat) });
        return [row.seat, actor];
      }));
      for (const [seat, actor] of additions) { bySeat.set(seat, actor); world.playerGroup.add(actor.group); }
      for (const [seat, actor] of bySeat) if (!wanted.has(seat)) { actor.dispose(); bySeat.delete(seat); targets.delete(seat); }
      const nextActors = rows.map(row => bySeat.get(row.seat));
      if (actors.map(p => p.seat).join('|') !== nextActors.map(p => p.seat).join('|')) {
        presentation?.dispose(); actors = nextActors;
        presentation = actors.length ? new RacePresentation(world, actors) : null;
      } else actors = nextActors;
      rows.forEach((row, index) => {
        const actor = actors[index];
        if (key !== current?.mapKey || !targets.has(row.seat)) actor.position.fromArray(row.position);
        targets.set(row.seat, row);
        actor.node = row.node; actor.money = row.money; actor.laps = row.laps;
        actor.raceSteps = row.raceSteps; actor.finished = row.finished; actor.finishRank = row.finishRank;
        if (row.clip && actor.data.animations[row.clip]) actor.setClip(row.clip);
      });
      current = { ...next, mapKey: key };
      facade.demo.players = actors; facade.demo.active = game?.active || 0;
      facade.demo.paused = !!game?.paused;
      if (next.community) {
        facade.game.accounts = new Map(next.community.accounts.map(row => [row.id, row]));
        facade.selectedId = game?.seat || actors[0]?.seat || '';
        if (!communityView && actors.length) communityView = new CommunityView(facade, $('#portrait'), $('#portrait'));
      }
      $('#live-loading').hidden = true;
      renderHud();
    }
  } catch (error) { console.error(error); showWarning('Chưa dựng được cảnh: ' + error.message); $('#live-loading').hidden = true; }
  finally { syncing = false; }
}

function renderHud() {
  if (!current) return;
  const game = current.game, count = current.roster?.length || 0, waiting = current.waiting?.length ?? current.lobby?.waitingCount ?? 0;
  const over = !!game?.race?.over;
  $('#portrait').dataset.phase = game?.phase || 'waiting';
  $('#live-waiting').hidden = count > 0;
  $('#live-turn').hidden = !game?.players?.length || over;
  $('#room-count').textContent = `${count} người trong bàn · ${waiting} khách chờ`;
  $('#lap-label').textContent = game ? `${Math.min(3, (game.players[game.active]?.laps || 0) + 1)} / 3` : '3 VÒNG';
  const limit = game?.race?.finishLimit || 3;
  $('#race-hint').textContent = over ? 'Đã chốt ván · chuẩn bị sảnh mới' : `Ba vòng đường · ${limit < 3 ? `${limit} người về đích` : 'Top 3 lên bục'}`;
  const source = current.connection;
  const status = source?.status || source?.state;
  $('#source-state').textContent = mode === 'demo' ? 'Sự kiện mô phỏng · dữ liệu riêng' : status === 'connected' ? `@${source.host || source.username || 'TikTok'} · đã kết nối` : current.sourcePaused ? 'Nguồn đang nối lại · giữ ván' : 'Chờ kết nối ở màn quản lý';
  $('#live-mode').dataset.connected = String(status === 'connected');
  if (game?.players?.length) {
    const player = game.players[game.active];
    $('#turn-seat').textContent = player.seat; $('#turn-name').textContent = player.name;
    $('#turn-money').textContent = money(player.money);
    $('#turn-label').textContent = game.globalHold ? 'SỰ KIỆN CẢ PHỐ' : current.spotlight ? 'CHÀO NGƯỜI MỚI' : 'CAMERA ĐANG THEO';
    $('#turn-action').textContent = game.globalHold ? 'Cả phố cùng tham gia sự kiện' : game.phase === 'roll' ? 'Đang lắc xúc xắc…' : game.phase === 'roll-result' ? `Ra ${game.roll}!` : game.phase === 'moving' ? `Đang đi · còn ${game.remaining} bước` : game.phase === 'fork-choice' ? 'Gõ TRÁI hoặc PHẢI' : game.phase === 'event-choice' ? 'Chọn phương án trên thẻ' : 'Gõ LẮC · hết giờ tự lắc';
  }
  const welcome = current.spotlight;
  $('#live-welcome').hidden = !welcome || over || !!current.community?.modal;
  if (welcome) {
    const queued = welcome.queued === true || welcome.kind === 'waiting';
    $('#welcome-label').textContent = queued ? 'CHÀO KHÁCH ĐANG CHỜ' : 'CẢ PHỐ CHÀO BẠN';
    $('#welcome-name').textContent = welcome.userName || welcome.name || welcome.seat;
    $('#welcome-detail').textContent = queued ? `Hàng chờ #${welcome.position || welcome.queuePosition || '…'} · vẫn chơi sự kiện cùng phố` : `${welcome.seat} · mời bạn lắc xúc xắc!`;
  }
  const branch = game?.branch;
  $('#branch-bar').hidden = !branch || !!current.community?.modal || over;
  if (branch) {
    $('#branch-time').textContent = `${Math.ceil(branch.remainingSeconds)}s`;
    $('#branch-options').innerHTML = branch.options.map(option => `<div><b>${option.id === 'left' ? '↰ TRÁI' : 'PHẢI ↱'}</b><span>${esc(option.name || option.label)}</span><small>${esc(option.preview)}</small></div>`).join('');
    $('#branch-votes').textContent = `Phiếu: TRÁI ${branch.votes.left} · PHẢI ${branch.votes.right} · hòa đi mặc định`;
    $('#branch-track').style.width = `${Math.min(100, branch.remainingSeconds * 10)}%`;
  }
  const event = game?.event;
  $('#event-panel').hidden = !event || !!current.community?.modal || event.category === 'rest' || !!event.result?.community || over || !!branch;
  if (event) {
    $('#event-panel').dataset.tone = event.result?.delta > 0 ? 'gain' : event.result?.delta < 0 ? 'loss' : 'neutral';
    $('#event-category').textContent = ({ gain: 'NHẬN TIỀN', loss: 'PHÍ PHÁT SINH', event: 'CHUYỆN PHỐ', invest: 'ĐẦU TƯ', trade: 'BUÔN BÁN', minigame: 'THỬ TÀI', station: 'GA PHỐ' })[event.category] || 'CHUYỆN PHỐ';
    $('#event-time').textContent = event.result ? 'ĐÃ CHỐT' : `${Math.ceil(event.remainingSeconds)}s`;
    $('#event-title').textContent = event.title; $('#event-body').textContent = event.body;
    $('#event-money').textContent = event.result ? `${event.result.delta > 0 ? '+' : ''}${money(event.result.delta)} MONEY` : '';
    $('#event-options').innerHTML = event.result ? '' : event.choices.map((choice, index) => `<div><b>Gõ ${index + 1} · ${esc(choice.label)}</b><span>${esc(choice.description)}</span></div>`).join('');
  }
  if (communityView && game && current.community) {
    const state = { ...current.community, selectedId: game.seat || actors[0]?.seat || '' };
    const nextIn = current.lobby?.phase === 'podium' ? current.lobby.timeleft : 0;
    communityView.update(game, state, nextIn, current.lobby);
    // Spoken cues come from the server's dedicated, bounded MC queue.
    communityView.mc.hidden = true;
  } else if (communityView) {
    communityView.panel.hidden = true; communityView.hearts.hidden = true; communityView.podium.hidden = true;
    $('#portrait').dataset.community = 'false';
  }
}

function tick(now) {
  const dt = Math.min(.08, (now - frameTime) / 1000 || .016); frameTime = now;
  const game = current?.game;
  const active = actors[game?.active || 0];
  if (active && game) {
    for (const [index, actor] of actors.entries()) {
      const row = targets.get(actor.seat); if (!row) continue;
      const old = actor.position.clone();
      actor.position.lerp(new THREE.Vector3().fromArray(row.position), 1 - Math.exp(-dt * 18));
      actor.heading.fromArray(row.heading); actor.distance += old.distanceTo(actor.position);
      actor.update(game.paused || game.globalHold ? 0 : dt, world.camera, row.phase === 'moving' && !game.globalHold, index === game.active, now / 1000);
    }
    const fork = game.branch ? world.layout.nodes.find(node => node.id === game.branch.nodeId) : null;
    world.updateCamera(dt, active, 'auto', game.phase === 'overview' || game.race?.over, fork);
    dice.update(game.dice || { phase: 'waiting', elapsed: 0, value: 0 });
    effects.update(dt, game, active); cameos.update(dt, game, active);
    presentation?.update(game);
  } else {
    world.activeRing.visible = false;
    const dummy = { position: new THREE.Vector3(), heading: new THREE.Vector3(0, 0, -1) };
    world.updateCamera(dt, dummy, 'overview', true); world.activeRing.visible = false;
    dice.update({ phase: 'waiting', value: 0, elapsed: 0 });
  }
  if (now - renderTime > 1000 / 30 - 1) { world.render(); renderTime = now; }
  updateCaption();
  if (connected && Date.now() - lastStateAt > 8000) showWarning('Đang chờ máy chủ · giữ nguyên hình và kết quả gần nhất');
  requestAnimationFrame(tick);
}

async function init() {
  try {
    pack = await fetch(base + 'actors.json').then(response => { if (!response.ok) throw new Error('Chưa có asset runtime; chạy npm run build trước'); return response.json(); });
    world = new TownWorld($('#game'), base);
    await world.loadModels(); await world.loadMap(createTownLayout('CHO_VIA_HE', 42));
    dice = new DiceOverlay($('#portrait'), base); effects = new TownEffects(world, $('#portrait'), base);
    cameos = new EventCameos(world, base); await cameos.init();
    $('#live-loading').hidden = true;
    requestAnimationFrame(tick);
    const stream = new EventSource(`/api/events?mode=${mode}`);
    const state = event => {
      try { const value = JSON.parse(event.data); connected = true; lastStateAt = Date.now(); showWarning(''); applyState(value.data || value.state || value); }
      catch (error) { console.error('Invalid game state', error); }
    };
    stream.addEventListener('state', state);
    stream.addEventListener('mc', event => { try { audio.enqueue(JSON.parse(event.data)); } catch (error) { console.error(error); } });
    stream.addEventListener('connection', event => {
      try { if (current) { current.connection = JSON.parse(event.data); renderHud(); } } catch {}
    });
    stream.addEventListener('settings', event => {
      try { const settings = JSON.parse(event.data).audio; if (settings) audio.configure(settings); } catch {}
    });
    stream.onmessage = event => { try { const message = JSON.parse(event.data); if (message.type === 'state') state({ data: JSON.stringify(message.data) }); if (message.type === 'mc') audio.enqueue(message.data); } catch {} };
    stream.onerror = () => { connected = false; showWarning('Mất đường truyền tới máy chủ · đang tự nối lại'); };
    window.__TYPHI_LIVE__ = {
      ready: true, mode, snapshot: () => current, actors: () => actors.map(actor => ({ seat: actor.seat, position: actor.position.toArray(), name: actor.data.name })),
      audio, stats: () => ({ actors: actors.length, calls: world.renderer.info.render.calls, triangles: world.renderer.info.render.triangles }),
      dispose() { stream.close(); audio.dispose(); }
    };
    window.addEventListener('pagehide', () => { stream.close(); audio.dispose(); }, { once: true });
  } catch (error) {
    console.error(error); $('#loading-message').textContent = error.message;
    showWarning('Không mở được khung phát. Kiểm tra terminal và tải lại trang.');
  }
}
init();
