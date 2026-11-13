import '@fontsource-variable/nunito';
import './style.css';
import './gameplay.css';
import { TownWorld } from './world.js';
import { Player, SEAT_COLORS } from './sprites.js';
import { CameraDemo } from './demo.js';
import { ParallelRace } from './parallel-race.js';
import { DiceOverlay, dieFaceSVG } from './dice.js';
import { createTownLayouts } from './layouts.js';
import { TownEffects } from './effects.js';
import { EventCameos } from './event-cameos.js';
import { CommunityController } from './community-controller.js';
import { CommunityView } from './community-view.js';
import { RacePresentation } from './race-presentation.js';
import { MatchmakingQueue, MATCHMAKING_MC } from './matchmaking.js';
import './community.css';

const icons = {
 dice: `<svg viewBox='0 0 24 24' fill='none'><rect x='3' y='3' width='18' height='18' rx='5' stroke='currentColor' stroke-width='1.8'/><circle cx='8' cy='8' r='1.5' fill='currentColor'/><circle cx='16' cy='8' r='1.5' fill='currentColor'/><circle cx='12' cy='12' r='1.5' fill='currentColor'/><circle cx='8' cy='16' r='1.5' fill='currentColor'/><circle cx='16' cy='16' r='1.5' fill='currentColor'/></svg>`,
 grid: `<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8'><rect x='3' y='3' width='18' height='18' rx='4'/><path d='M3 10h18M10 3v18'/></svg>`,
 camera: `<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8'><path d='M4 7h4l2-3h4l2 3h4v13H4z' stroke-linejoin='round'/><circle cx='12' cy='13' r='3.5'/></svg>`,
 auto: `<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8'><path d='M20 8a8 8 0 0 0-14-2L3 9m0-6v6h6M4 16a8 8 0 0 0 14 2l3-3m0 6v-6h-6' stroke-linecap='round' stroke-linejoin='round'/></svg>`,
 next: `<svg viewBox='0 0 24 24' fill='currentColor'><path d='m5 5 11 7-11 7zm12 0h2v14h-2z'/></svg>`,
 pause: `<svg viewBox='0 0 24 24' fill='currentColor'><rect x='6' y='5' width='4' height='14' rx='1'/><rect x='14' y='5' width='4' height='14' rx='1'/></svg>`,
 play: `<svg viewBox='0 0 24 24' fill='currentColor'><path d='m7 4 14 8-14 8z'/></svg>`,
 expand: `<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8'><path d='M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5' stroke-linecap='round'/></svg>`,
 chevron: `<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8'><path d='m9 5 7 7-7 7' stroke-linecap='round' stroke-linejoin='round'/></svg>`
};
const app = document.querySelector('#app');
const query = new URLSearchParams(location.search);
const classic = query.get('mode') === 'classic';
const stress=query.get('stress')==='1';
const participantCount = Math.max(2, Math.min(classic?20:stress?200:20, Math.floor(Number(query.get('players')) || (classic ? 10 : 20))));
const accountCount=classic?participantCount:Math.max(participantCount,Math.min(1000,Math.floor(Number(query.get('accounts'))||100)));
app.innerHTML = `
  <header class='topbar'>
    <a class='brand' href='./' aria-label='Cờ Tý Phí — trang chính'><span class='brand-mark'>${icons.dice}</span><span>Cờ Tý Phí<small>PHỐ ĐỒ CHƠI</small></span></a>
    <div class='topbar-center'><span class='live-dot'></span>CHẠY THỬ LOCAL <span class='top-divider'></span> ${participantCount} quân · ${accountCount-participantCount} khách chờ</div>
    <div class='pack-tag'><span class='small-star'>✦</span> Sprite v2.3 <span class='pack-check'>✓</span></div>
  </header>
  <main class='workspace'>
    <aside class='left-panel'>
      <div class='panel-caption'><span>NGƯỜI TRONG BÀN</span><span class='count-badge'>${participantCount} / ${participantCount}</span></div>
      <div class='players' id='players'></div>
      <div class='sidebar-note'><span class='note-icon'>↗</span><p>Chọn một quân để camera theo dõi. Các quân khác tiếp tục chạy đồng thời.</p></div>
    </aside>
    <section class='stage-column'>
      <div class='stage-toolbar'><span><span class='status-dot'></span><b id='map-title'>Chợ Vỉa Hè</b></span><span class='aspect-tag'>KHU PHỐ MỞ RỘNG <i></i> 9:16</span></div>
      <div class='portrait' id='portrait'>
        <canvas id='game' aria-label='Map 3D cờ Tý Phí cho ${participantCount} người'></canvas>
        <div class='game-top'><div class='game-logo'>CỜ TÝ PHÍ<span>PHỐ ĐỒ CHƠI</span></div><div class='round-chip'>VÒNG ĐƯỜNG <strong id='round-number'>1 / 3</strong></div></div>
        <div class='view-pill' id='view-pill'>${icons.grid}<span>Toàn bàn</span></div>
        <div class='district-caption'><span id='district-story'>Phiên chợ sớm · cả phố cùng chốt đơn</span></div>
        <div class='turn-banner'><div class='turn-avatar' id='turn-avatar'></div><div class='turn-person'><span class='eyebrow'>ĐẾN LƯỢT</span><strong id='turn-name'>Mít Tóc Xù</strong><small id='turn-action'>Camera đang nhìn toàn bàn</small></div><div class='wallet-chip'><small>MONEY</small><b id='turn-money'>1.000</b></div><span class='turn-seat' id='turn-seat'>A</span></div>
        <section class='decision-bar' id='branch-bar' hidden aria-label='Chọn đường đi'><div class='decision-heading'><span>↔ <b id='branch-heading'>NGÃ RẼ</b></span><span class='decision-time' id='branch-time'>10s</span></div><div class='branch-options' id='branch-options'></div><div class='decision-foot' id='branch-votes'>Hết giờ dùng phiếu, hòa đi mặc định</div><div class='decision-track'><i id='branch-progress'></i></div></section>
        <section class='event-panel' id='event-panel' hidden aria-live='polite'><div class='event-heading'><span id='event-category'>CHUYỆN PHỐ</span><span id='event-time'></span></div><h2 id='event-title'></h2><p id='event-body'></p><strong class='event-money' id='event-money'></strong><div class='event-options' id='event-options'></div><div class='event-reason' id='event-reason'></div></section>
        <div class='bottom-hud'><div class='hud-info'><span class='mini-dice' id='roll-display'>${icons.dice}</span><div><b id='hud-title'>Sẵn sàng tung xúc xắc</b><span id='hud-subtitle'>Chốt số rồi mới di chuyển</span></div><span class='hud-status' id='hud-status'>SẴN SÀNG</span><button id='roll-dice' class='roll-button' aria-label='Lắc xúc xắc'>${icons.dice}<span>Lắc</span></button></div><div class='progress-track'><i id='turn-progress'></i></div></div>
        <button class='fullscreen icon-button' id='fullscreen' aria-label='Xem toàn màn hình'>${icons.expand}</button>
        <div class='loading' id='loading'><div class='loader-dice'>${icons.dice}</div><h2>Đang mở khu phố…</h2><p id='loading-text'>Chuẩn bị nhân vật và map</p><div class='load-track'><i id='load-progress'></i></div></div>
      </div>
      <div class='playback'><button class='icon-button pause-button' id='pause' aria-label='Tạm dừng'>${icons.pause}</button><span id='playback-text'>Đang chạy bản xem trước</span><button class='next-button' id='next-turn'>${classic?'Lượt tiếp':'Theo quân kế'} ${icons.next}</button></div>
      <div class='town-controls'><select id='map-select-mobile' aria-label='Chọn khu phố'><option value='CHO_VIA_HE'>Chợ Vỉa Hè</option><option value='PHO_GIAO_HANG'>Phố Giao Hàng</option><option value='BEN_SONG'>Bến Sông</option></select><button id='new-town'>${icons.auto} Phố mới</button><span id='seed-label'></span></div>
      <div class='mobile-players' id='mobile-players'></div>
    </section>
    <aside class='right-panel'>
      <div class='section-label'>GÓC MÁY</div>
      <h1>Đi một vòng,<br>gặp cả khu phố.</h1>
      <p class='camera-description'>Chợ nhỏ, phố nhà và bến sông. Mỗi vòng, một khung cảnh mới để khám phá.</p>
      <div class='camera-modes' id='camera-modes'>
        <button class='camera-option selected' data-mode='auto' aria-pressed='true'>${icons.auto}<span><b>Tự chuyển</b><small>Toàn bàn → Góc thứ ba</small></span><i></i></button>
        <button class='camera-option' data-mode='overview' aria-pressed='false'>${icons.grid}<span><b>Toàn bàn</b><small>Theo dõi ${participantCount} quân</small></span><i></i></button>
        <button class='camera-option' data-mode='follow' aria-pressed='false'>${icons.camera}<span><b>Bám nhân vật</b><small>Góc thứ ba từ phía sau</small></span><i></i></button>
      </div>
      <div class='panel-rule'></div>
      <label class='section-label' for='map-select'>KHU PHỐ</label>
      <div class='select-wrap'><select id='map-select'><option value='CHO_VIA_HE'>Chợ Vỉa Hè</option><option value='PHO_GIAO_HANG'>Phố Giao Hàng</option><option value='BEN_SONG'>Bến Sông</option></select>${icons.chevron}</div>
      <div class='map-meta'><span id='node-count'>138 ô</span><i></i><span>6 ngã rẽ</span><i></i><span>${participantCount} quân</span></div>
      <label class='round-random'><input id='random-rounds' type='checkbox' checked> Top 3 → giữ ghế → ghép ván mới</label>
      <div class='racer-count-row'><label for='racer-count'>Số quân trên map</label><select id='racer-count'><option value='10'>10 · nhẹ</option><option value='20'>20 · mặc định</option><option value='100'>100 · stress test</option></select></div><div id='race-status' class='race-status'>Mỗi quân 3 vòng · kết thúc khi có Top 3</div>
      <div class='speed-row'><span>Tốc độ xem</span><div class='speed-options'><button data-speed='.75'>0.75×</button><button class='selected' data-speed='1'>1×</button><button data-speed='1.5'>1.5×</button></div></div>
      <div class='panel-rule'></div>
      <button class='capture-button' id='capture'>${icons.camera}<span>Chụp ảnh 1080 × 1920</span></button>
      <button class='restart-button' id='restart'>${icons.auto} Chạy lại cảnh demo</button>
      <div class='sandbox-controls'><span class='section-label'>GHÉ THỬ MỘT Ô</span><div><select id='event-preview' aria-label='Chọn loại ô để thử'><option value='gain'>Nhận tiền</option><option value='loss'>Mất tiền</option><option value='event'>Chuyện phố</option><option value='invest'>Đầu tư</option><option value='trade'>Buôn bán</option><option value='rest'>Ô nghỉ</option><option value='minigame'>Thử thách</option><optgroup label='Chuyện có nhân vật'><option value='loss:LOSS01'>Công an tuýt còi</option><option value='loss:LOSS02'>Chó giữ chiếc dép</option><option value='event:LIFE01'>Chó chắn đường</option><option value='event:LIFE02'>Công an hỏi đường</option></optgroup></select><button id='try-event'>Ghé ô</button></div><div class='sandbox-actions'><button id='try-fork'>↔ Thử ngã rẽ</button><button id='sound-toggle' aria-pressed='true'>♫ Âm thanh bật</button></div></div>
      <div class='asset-note'><span>✦</span><div><b>Cả phố cùng chơi bằng bình luận</b><p>CHƠI → LẮC → TRÁI / PHẢI<br>Demo mỹ thuật · chưa nối chat LIVE.</p></div></div>
    </aside>
  </main>
  <nav class='mobile-camera' aria-label='Góc máy trên điện thoại'><button data-mobile-mode='auto' class='selected'>${icons.auto} Tự chuyển</button><button data-mobile-mode='overview'>${icons.grid} Toàn bàn</button><button data-mobile-mode='follow'>${icons.camera} Theo sau</button></nav>
  <footer class='page-footer'><span>PHỐ ĐỒ CHƠI <i>•</i> MÔ PHỎNG ĐỒNG THỜI</span><span>${participantCount} quân độc lập <i>•</i> Chưa kết nối TikTok</span></footer>
`;

const $ = s => document.querySelector(s);
const base = import.meta.env.BASE_URL + 'runtime/';
let world, demo, lastSnapshot, diceOverlay, effects, cameos, community, communityView, racePresentation;
let autoNewMatch = true, podiumTime = 0, restarting = false, matchmaking, lobbyForSeed=null, lastLobbyPhase=null, accountDefinitions;
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = value => Math.round(value || 0).toLocaleString('vi-VN');
let branchKey, eventChoicesKey, branchSoundKey;
let loadingPct = 0;
function progress(fraction, text) {
  loadingPct = Math.max(loadingPct, fraction);
  $('#load-progress').style.width = `${Math.round(loadingPct * 100)}%`;
  $('#loading-text').textContent = text;
}

function updateUI(s) {
  if (!s.players?.length || !s.name) return;
  lastSnapshot = s;
  $('#portrait').dataset.phase = s.phase;
  $('#portrait').dataset.parallel = String(!!s.parallel);
  $('#turn-name').textContent = s.name;
  $('#turn-money').textContent = money(s.money ?? 1000);
  $('#turn-seat').textContent = s.seat;
  $('#turn-seat').style.background = SEAT_COLORS[(demo?.players[s.active]?.instanceIndex ?? s.active) % SEAT_COLORS.length];
  $('#round-number').textContent = s.race ? `${Math.min(3, (s.players[s.active]?.laps || 0) + 1)} / 3` : String(Math.floor((s.turn - 1) / s.players.length) + 1).padStart(2, '0');
  if (s.race) $('#race-status').textContent = `${s.race.finishers.length} / 3 về đích · ${s.players.filter(p=>p.phase==='moving').length} đang đi · ${accountCount-s.players.length} khách chờ`;
  $('#map-title').textContent = s.mapName || (s.map === 'CHO_VIA_HE' ? 'Chợ Vỉa Hè' : 'Phố Giao Hàng');
  $('#map-select').value = $('#map-select-mobile').value = s.map;
  $('#district-story').textContent = s.story || '';
  $('#node-count').textContent = `${s.nodeCount} ô`;
  $('#seed-label').textContent = `#${s.seed ?? 'gốc'}`;
  $('#new-town').disabled = s.loading;
  const overview = s.cameraView === 'overview';
  $('#view-pill').innerHTML = (overview ? icons.grid : icons.camera) + `<span>${overview ? 'Toàn bàn' : 'Góc thứ ba · Theo sau'}</span>`;
  const action = s.phase === 'fork-choice' ? 'Chọn đường: TRÁI hoặc PHẢI' : s.phase === 'event-choice' ? 'Chọn cách xử lý chuyện phố' : s.phase === 'moving' ? `Đang đi · còn ${s.remaining} bước` : s.phase === 'roll' ? 'Đang lắc xúc xắc…' : s.phase === 'roll-result' ? `Ra ${s.roll}! Chuẩn bị đi ${s.roll} bước` : s.phase === 'arrive' ? `Đã đi đủ ${s.roll} bước · ${s.tile.toLowerCase()}` : 'Camera đang nhìn toàn bàn';
  $('#turn-action').textContent = action;
  $('#hud-title').textContent = s.phase === 'moving' ? `${s.name.split(' ')[0]}: ${s.stepsCompleted}/${s.roll} bước` : s.phase === 'arrive' ? `Đã đi đủ ${s.roll} bước!` : s.phase === 'roll' ? 'Đang lắc xúc xắc…' : s.phase === 'roll-result' ? `Ra ${s.roll}! Đi ${s.roll} bước` : 'Sẵn sàng tung xúc xắc';
  $('#hud-subtitle').textContent = s.phase === 'moving' ? `Còn ${s.remaining} bước · Camera theo sau` : s.phase === 'arrive' ? 'Chuẩn bị chuyển sang người tiếp theo' : s.phase === 'roll' ? 'Chờ xúc xắc dừng' : s.phase === 'roll-result' ? 'Đã chốt kết quả · chuẩn bị di chuyển' : 'Bấm Lắc hoặc chờ lượt tự động';
  $('#hud-status').textContent = s.paused ? 'TẠM DỪNG' : s.phase === 'moving' ? 'ĐANG ĐI' : s.phase === 'roll' ? 'ĐANG LẮC' : s.phase === 'roll-result' ? 'ĐÃ CHỐT' : 'SẴN SÀNG';
  $('#roll-display').innerHTML = s.roll ? dieFaceSVG(s.roll) : icons.dice;
  $('#roll-display').dataset.value = String(s.roll);
  $('#roll-dice').disabled = s.phase !== 'overview' || s.paused || s.globalHold || s.queuedRoll || !!s.race?.over;
  $('#roll-dice span').textContent = s.queuedRoll ? 'Đã xếp' : s.phase === 'roll' ? 'Đang lắc' : s.roll ? `${s.roll} bước` : 'Lắc';
  $('#playback-text').textContent = s.paused ? 'Đã tạm dừng' : s.globalHold ? 'Sự kiện chung đang mở' : 'Đang chạy bản xem trước';
  $('#pause').innerHTML = s.paused ? icons.play : icons.pause;
  $('#pause').setAttribute('aria-label', s.paused ? 'Tiếp tục' : 'Tạm dừng');
  $('#turn-progress').style.width = (s.phase === 'overview' ? 6 : s.phase === 'roll' ? 12 : s.phase === 'roll-result' ? 20 : s.phase === 'arrive' ? 100 : 20 + (1 - s.remaining / s.roll) * 75) + '%';
  if (s.phase === 'fork-choice' || s.phase === 'event-choice') {
    $('#hud-title').textContent = s.phase === 'fork-choice' ? 'Cả phố cùng chọn đường' : 'Chuyện tới cửa rồi!';
    $('#hud-subtitle').textContent = s.phase === 'fork-choice' ? `Còn ${s.remaining} bước · chọn ở thanh phía trên` : 'Chọn cách xử lý trên thông báo';
    $('#hud-status').textContent = 'CHỜ CHỌN';
  }
  $('#next-turn').disabled = ['fork-choice','event-choice','roll','roll-result'].includes(s.phase) || s.loading || s.globalHold || !!s.race?.over;
  const branch = s.branch;
  $('#branch-bar').hidden = !branch;
  if (branch) {
    $('#branch-heading').textContent = `GHẾ ${s.seat} · CHỌN ĐƯỜNG`;
    $('#branch-time').textContent = `${Math.ceil(branch.remainingSeconds)}s`;
    $('#branch-progress').style.width = `${Math.max(0, branch.remainingSeconds / 10) * 100}%`;
    $('#branch-votes').textContent = `TRÁI ${branch.votes.left} · PHẢI ${branch.votes.right} — Hòa: ${branch.default === 'right' ? 'PHẢI' : 'TRÁI'}`;
    const key = JSON.stringify([branch.nodeId,branch.options,s.paused]);
    if (key !== branchKey) {
      branchKey = key;
      $('#branch-options').innerHTML = branch.options.map(option => `<button type='button' data-direction='${option.id}' ${s.paused ? 'disabled' : ''}><b>${option.id === 'left' ? '↰ TRÁI' : 'PHẢI ↱'}</b><span>${escapeHTML(option.name || option.label)}</span><small>${escapeHTML(option.preview)}</small></button>`).join('');
    }
    const soundKey = `${s.turn}:${branch.nodeId}:${s.roll}`;
    if (soundKey !== branchSoundKey) { branchSoundKey = soundKey; effects?.sound('sfx_question'); }
  } else branchKey = null;
  const event = s.event;
  $('#event-panel').hidden = !event || !!branch || event.category === 'rest' || !!event.result?.community;
  if (event) {
    const categories = {station:'GA KHU PHỐ',gain:'NHẬN TIỀN',loss:'PHÍ PHÁT SINH',event:'CHUYỆN PHỐ',invest:'CƠ HỘI ĐẦU TƯ',trade:'BUÔN BÁN',rest:'NGHỈ CHÂN',minigame:'THỬ THÁCH'};
    const result = event.result;
    $('#event-panel').dataset.tone = result ? result.delta > 0 ? 'gain' : result.delta < 0 ? 'loss' : 'neutral' : 'choice';
    $('#event-panel').classList.toggle('resolved', !!result);
    $('#event-category').textContent = categories[event.category] || 'CHUYỆN KHU PHỐ';
    $('#event-title').textContent = event.title;
    $('#event-body').textContent = event.body;
    $('#event-time').textContent = result ? 'ĐÃ CHỐT' : `${Math.ceil(event.remainingSeconds)}s`;
    $('#event-money').textContent = result ? `${result.delta > 0 ? '+' : ''}${money(result.delta)} MONEY` : '';
    $('#event-reason').textContent = result ? `${result.reasonText || result.text || ''} · Ví ${money(result.before)} → ${money(result.after)}` : event.category === 'minigame' ? 'Hết giờ không có thưởng.' : 'Hết giờ chọn phương án an toàn đầu tiên.';
    const key = JSON.stringify([event.sequence,!!result,event.choices,s.paused]);
    if (key !== eventChoicesKey) {
      eventChoicesKey = key;
      $('#event-options').innerHTML = result ? '' : event.choices.map(option => `<button type='button' data-event-choice='${escapeHTML(option.id)}' ${s.paused || option.disabled ? 'disabled' : ''}><b>${escapeHTML(option.label)}</b><small>${option.disabled ? `Cần ${money(option.minMoney)} MONEY · ` : ''}${escapeHTML(option.description)}</small></button>`).join('');
    }
    if (event.category === 'rest') { $('#hud-title').textContent = 'Ô thường · một nhịp đi dạo'; $('#hud-subtitle').textContent = 'Không có sự kiện · ví giữ nguyên'; }
  } else eventChoicesKey = null;
  document.querySelectorAll('.player-row,.mobile-seat').forEach(el => {
    const active = Number(el.dataset.seat) === s.active;
    el.classList.toggle('active', active);
    el.setAttribute('aria-pressed', String(active));
    const info=s.players[Number(el.dataset.seat)];
    if (el.querySelector('.player-status')) el.querySelector('.player-status').textContent = s.race ? info.finished ? `Về đích #${info.finishRank}` : `Vòng ${Math.min(3,(info.laps||0)+1)}/3 · ${info.phase==='moving'?'Đang đi':info.phase==='roll'?'Đang lắc':info.phase==='fork-choice'?'Chọn đường':'Trong phố'}` : active ? (s.phase === 'moving' ? 'Đang đi' : 'Đến lượt') : 'Trong bàn';
    const wallet = el.querySelector('.player-money');
    const value = money(s.players[Number(el.dataset.seat)]?.money ?? 1000);
    if (wallet && wallet.dataset.value !== value) { wallet.innerHTML = `<i>●</i> ${value}`; wallet.dataset.value = value; }
  });
  document.querySelectorAll('[data-mode]').forEach(el => { const active = el.dataset.mode === s.mode; el.classList.toggle('selected', active); el.setAttribute('aria-pressed', String(active)); });
  document.querySelectorAll('[data-mobile-mode]').forEach(el => el.classList.toggle('selected', el.dataset.mobileMode === s.mode));
  if (demo) $('#turn-avatar').style.backgroundImage = `url(${demo.players[s.active].avatar})`;
}

async function init() {
  try {
    const [pack, boards] = await Promise.all([
      fetch(base + 'actors.json').then(r => { if (!r.ok) throw new Error('Không tải được danh mục nhân vật'); return r.json(); }),
      fetch(base + 'board_layouts.json').then(r => r.json())
    ]);
    world = new TownWorld($('#game'), base);
    accountDefinitions=new Map(Array.from({length:accountCount},(_,i)=>{
      const source=pack.actors[i % pack.actors.length];
      const seat=classic?String.fromCharCode(65+i):`P${String(i+1).padStart(3,'0')}`;
      return[seat,{seat,money:1000,data:{...source,instanceIndex:i,name:classic?source.name:`${source.name} #${String(i+1).padStart(3,'0')}`}}];
    }));
    const players = makeActors([...accountDefinitions.keys()].slice(0,participantCount));
    let loaded = 0;
    await Promise.all([
      world.loadModels(p => progress(.12 + p * .36, 'Dựng phố, nhà và cây xanh')),
      Promise.all(players.map(async p => { await p.init(); progress(.45 + (++loaded / participantCount) * .3, `Đưa ${participantCount} nhân vật vào phố`); }))
    ]);
    renderPlayers(players);
    const requestedSeed = new URLSearchParams(location.search).get('seed');
    const seed = requestedSeed !== null && /^\d{1,10}$/.test(requestedSeed) ? Number(requestedSeed) >>> 0 : crypto.getRandomValues(new Uint32Array(1))[0];
    demo = classic ? new CameraDemo(world, players, createTownLayouts(seed), updateUI, { interactiveChoices: true }) : new ParallelRace(world, players, createTownLayouts(seed), updateUI, { interactiveChoices: true });
    demo.randomizeRounds = classic;
    await demo.changeMap('CHO_VIA_HE');
    diceOverlay = new DiceOverlay($('#portrait'), base);
    effects = new TownEffects(world, $('#portrait'), base);
    cameos = new EventCameos(world, base);
    await cameos.init();
    if (!classic) {
      community = new CommunityController(demo, {onSound:name=>effects.sound(name),accounts:[...accountDefinitions.values()]});
      matchmaking = new MatchmakingQueue([...accountDefinitions.keys()],{activeIds:players.map(p=>p.seat),seats:participantCount,reserved:Math.floor(participantCount*.6)});
      community.matchmaking=matchmaking;
      communityView = new CommunityView(community, $('#portrait'), $('.stage-column'));
      racePresentation = new RacePresentation(world,players);
      racePresentation.update(demo.snapshot());
    }
    progress(1, 'Khu phố đã sẵn sàng');
    $('#loading').classList.add('hidden');
    bind();
    let last = performance.now(), lastRender = 0;
    function tick(now) {
      const wallDt = Math.max(0,(now - last) / 1000);
      const dt = Math.min(wallDt, .08); last = now;
      if(demo.loading || !demo.layout){requestAnimationFrame(tick);return;}
      demo.update(dt);
      community?.update(dt);
      diceOverlay.update(demo.diceState());
      const snapshot = demo.snapshot(), actor = demo.players[demo.active];
      effects.update(dt, snapshot, actor);
      cameos.update(dt, snapshot, actor);
      racePresentation?.update(snapshot);
      if (snapshot.race?.over) {
        const opened=lobbyForSeed!==snapshot.seed;
        if(opened){
          matchmaking.beginPodium(demo.players.map(p=>p.seat));lobbyForSeed=snapshot.seed;
          community.cue('race.podium',MATCHMAKING_MC.podium);
        }
        if(!demo.paused&&!opened)matchmaking.tick(wallDt);
        const lobby=matchmaking.snapshot();podiumTime=lobby.phase==='podium'?8-lobby.timeleft:8;
        if(lastLobbyPhase!==lobby.phase){lastLobbyPhase=lobby.phase;if(lobby.phase==='reserving')community.cue('reserve.open',MATCHMAKING_MC.reserveOpen);}
        if(lobby.phase==='ready' && autoNewMatch && !restarting){
          const retained=lobby.result?.retainedIds.length||0,newcomers=lobby.result?.fromQueueIds.length||0;
          community.cue('reserve.locked',`Khóa sảnh! ${retained} người giữ ghế, ${newcomers} người từ hàng chờ. ${participantCount} quân chuẩn bị xuất phát!`,{retained,newcomers});
          startNewMatch({manual:false,rosterIds:lobby.nextActiveIds});
        }
      } else podiumTime = 0;
      if (now - (tick.lastCommunity || 0) >= 150) { tick.lastCommunity = now; if (communityView) communityView.update(snapshot,community.snapshot(),Math.max(0,8-podiumTime),matchmaking?.snapshot()); }
      if (now - lastRender >= 1000 / 30 - 1) { world.render(); lastRender = now; }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    window.__TYPHI__ = {
      ready: true, snapshot: () => demo.snapshot(), select: i => demo.select(i),
      mode: mode => demo.setMode(mode), pause: value => demo.setPaused(value),
      changeMap: id => demo.changeMap(id), screenshot: () => world.screenshot(),
      roll: () => demo.requestRoll(),
      chooseFork: direction => demo.chooseFork(direction),
      voteFork: (viewer, direction) => demo.voteFork(viewer, direction),
      chooseEvent: id => demo.chooseEvent(id),
      previewEvent: (category, id) => { demo.setPaused(false); return demo.previewEvent(category, id); },
      previewFork: () => { demo.setPaused(false); return demo.previewFork(); },
      eventCameo: () => cameos.snapshot(),
      crowd: () => racePresentation?.snapshot(),
      community: () => community?.snapshot(),
      matchmaking: () => matchmaking?.snapshot(),
      comment: (id,text,eventId) => community?.comment(id,text,eventId),
      like: (id,count,eventId) => community?.like(id,count,eventId),
      rose: (id,eventId,count) => community?.rose(id,eventId,count),
      startInvestment: options => community?.openInvestment(demo.active,options),
      joinAll: () => community?.simulateJoins(),
      startEnvelope: seed => community?.openEnvelope(seed),
      heartsAll: () => community?.simulateHearts(),
      startShop: () => community?.openShop(demo.active),
      ordersAll: count => community?.simulateOrders(count),
      cancelOrders: count => community?.simulateCancels(count),
      mcCues: () => community?.mcCues,
      newMatch: () => startNewMatch({manual:true}),
      regenerate: options => demo.regenerate(options),
      layout: () => structuredClone(demo.layout),
      provenance: { spriteVersion: pack.version, sourceCommit: pack.sourceCommit },
      sourceMapNodeCount: boards.layouts.CHO_VIA_HE.nodes.length,
      renderStats: () => ({ calls:world.renderer.info.render.calls, triangles:world.renderer.info.render.triangles,
        textures:world.renderer.info.memory.textures, geometries:world.renderer.info.memory.geometries,
        tileLabelBatches:world.town.children.filter(o=>o.name.startsWith('Batched tile labels ')).length,
        activeActors:demo.players.length, accounts:community?.game.accounts.size ?? demo.players.length }),
      geometryAudit: () => {
        const meshes = [];
        world.scene.traverse(o => {
          if (!o.isMesh) return;
          const a = o.geometry.attributes.position;
          let invalid = -1;
          for (let i = 0; i < a.array.length; i++) if (!Number.isFinite(a.array[i])) { invalid = i; break; }
          if (invalid !== -1 || !o.matrixWorld.elements.every(Number.isFinite)) meshes.push({ name: o.name, invalidPosition: invalid, matrix: o.matrixWorld.elements });
        });
        return meshes;
      }
    };
    if (query.get('debug') === '1') window.__TYPHI__.advance = seconds => {
      if (!Number.isFinite(seconds) || seconds < 0 || seconds > 3000 || demo.paused) return false;
      const onChange=demo.onChange, updates=demo.players.map(player=>player.update);
      demo.onChange=null; demo.players.forEach(player=>{player.update=()=>{};});
      try { for(let t=0;t<seconds;t+=.1){demo.update(Math.min(.1,seconds-t));community?.update(Math.min(.1,seconds-t));if(demo.race?.over)break;} }
      finally {demo.onChange=onChange;demo.players.forEach((player,i)=>{player.update=updates[i];});}
      demo.update(0); const s=demo.snapshot(); updateUI(s);racePresentation?.update(s);if(communityView)communityView.update(s,community.snapshot(),Math.max(0,8-podiumTime),matchmaking?.snapshot());world.render();return s;
    };
  } catch (error) {
    console.error(error);
    $('#loading').innerHTML = `<h2>Chưa mở được khu phố</h2><p>${error.message}</p><button class='retry-button'>Thử lại</button>`;
    $('.retry-button').onclick = () => location.reload();
  }
}

function makeActors(ids) {
  return ids.map(id=>{const definition=accountDefinitions.get(id);const actor=new Player(definition.data,id,base);actor.money=community?.game.accounts.get(id)?.money??1000;return actor;});
}

function renderPlayers(players) {
  $('#players').innerHTML=players.map((p,i)=>`<button class='player-row' data-seat='${i}' aria-pressed='${i===0}'><span class='player-avatar' style='background-image:url(${p.avatar});--seat:${SEAT_COLORS[p.instanceIndex%10]}'><i>${p.seat}</i></span><span class='player-info'><b>${escapeHTML(p.data.name)}</b><small class='player-status'>Trong bàn</small></span><span class='player-money'><i>●</i> ${money(p.money)}</span></button>`).join('');
  $('#mobile-players').innerHTML=players.map((p,i)=>`<button class='mobile-seat' data-seat='${i}' aria-label='Theo quân ${p.seat}' style='--seat:${SEAT_COLORS[p.instanceIndex%10]}'><img src='${p.avatar}' alt=''><span>${classic?p.seat:p.seat.slice(1)}</span></button>`).join('');
  document.querySelectorAll('[data-seat]').forEach(el=>{el.onclick=()=>demo.select(Number(el.dataset.seat));});
}

async function startNewMatch({manual=true,id,rosterIds}={}) {
  if (!demo || restarting || demo.loading) return false;
  if (community && !community.resetForMatch({manual})) return false;
  restarting=true; $('#loading').classList.remove('hidden'); $('#loading-text').textContent='Mở ván mới, sinh map và vạch đích';
  try {
    if(manual && matchmaking){const seen=matchmaking.seenEvents,waiting=matchmaking.waitingIds;matchmaking=new MatchmakingQueue([...waiting,...demo.players.map(p=>p.seat)],{activeIds:demo.players.map(p=>p.seat),seats:participantCount,reserved:Math.floor(participantCount*.6)});matchmaking.seenEvents=seen;community.matchmaking=matchmaking;}
    if(rosterIds){
      const actors=makeActors(rosterIds);await Promise.all(actors.map(p=>p.init()));
      racePresentation?.dispose();racePresentation=null;
      const old=demo.setPlayers(actors,{reset:manual});old.forEach(p=>p.dispose());
      renderPlayers(actors);racePresentation=new RacePresentation(world,actors);
    }
    if(id) await demo.changeMap(id); else await demo.regenerate({nextRound:true});
    demo.reset(); demo.setPaused(false); podiumTime=0;lobbyForSeed=null;lastLobbyPhase=null;
    racePresentation?.update(demo.snapshot()); return true;
  } catch(error) {console.error(error);$('#playback-text').textContent='Chưa mở được ván mới, hãy thử lại';return false;}
  finally {restarting=false;$('#loading').classList.add('hidden');}
}

function bind() {
  $('#racer-count').value=String(participantCount);
  $('#racer-count').onchange=e=>{const params=new URLSearchParams(location.search);params.set('players',e.target.value);if(Number(e.target.value)>20)params.set('stress','1');else params.delete('stress');location.search=params.toString();};
  document.querySelectorAll('[data-mode]').forEach(el => el.addEventListener('click', () => demo.setMode(el.dataset.mode)));
  document.querySelectorAll('[data-mobile-mode]').forEach(el => el.addEventListener('click', () => demo.setMode(el.dataset.mobileMode)));
  $('#pause').onclick = () => demo.setPaused(!demo.paused);
  $('#next-turn').onclick = () => demo.nextTurn();
  $('#roll-dice').onclick = () => demo.requestRoll();
  $('#branch-options').onclick = e => { const button = e.target.closest('[data-direction]'); if (button) demo.chooseFork(button.dataset.direction); };
  $('#event-options').onclick = e => { const button = e.target.closest('[data-event-choice]'); if (button) demo.chooseEvent(button.dataset.eventChoice); };
  $('#try-event').onclick = () => { demo.setPaused(false); const [category,id] = $('#event-preview').value.split(':'); demo.previewEvent(category,id); };
  $('#try-fork').onclick = () => { demo.setPaused(false); demo.previewFork(); };
  $('#sound-toggle').onclick = () => {
    effects.setEnabled(!effects.enabled); diceOverlay.audio.muted = !effects.enabled;
    $('#sound-toggle').textContent = effects.enabled ? '♫ Âm thanh bật' : '♫ Âm thanh tắt';
    $('#sound-toggle').setAttribute('aria-pressed', String(effects.enabled));
  };
  $('#restart').onclick = () => { if(classic){demo.paused=false;demo.reset();}else startNewMatch({manual:true}); };
  $('#capture').onclick = () => world.screenshot();
  $('#fullscreen').onclick = async () => { if (!document.fullscreenElement) await $('#portrait').requestFullscreen(); else await document.exitFullscreen(); };
  const changeMap = async e => {
    if(!classic){await startNewMatch({manual:true,id:e.target.value});return;}
    $('#loading').classList.remove('hidden');
    $('#loading-text').textContent = 'Chuyển sang khu phố mới';
    try { await demo.changeMap(e.target.value); }
    catch (error) { console.error(error); $('#loading-text').textContent = 'Không tải được map. Hãy thử lại.'; return; }
    $('#loading').classList.add('hidden');
  };
  $('#map-select').onchange = $('#map-select-mobile').onchange = changeMap;
  $('#random-rounds').onchange = e => { autoNewMatch=e.target.checked; if(classic) demo.randomizeRounds=e.target.checked; };
  $('#new-town').onclick = async () => {
    $('#new-town').disabled = true;
    try { if(classic) await demo.regenerate(); else await startNewMatch({manual:true}); }
    catch (error) { console.error(error); $('#playback-text').textContent = 'Chưa đổi được phố, hãy thử lại'; }
    finally { $('#new-town').disabled = false; }
  };
  document.querySelectorAll('[data-speed]').forEach(el => el.onclick = () => {
    demo.speed = Number(el.dataset.speed);
    document.querySelectorAll('[data-speed]').forEach(b => b.classList.toggle('selected', b === el));
  });
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault(); demo.setPaused(!demo.paused); }
    if (e.code === 'ArrowRight' && !e.repeat && !demo.loading && !['roll','roll-result','fork-choice','event-choice'].includes(demo.phase)) demo.nextTurn();
    if (e.key.toLowerCase() === 'v') demo.setMode(demo.mode === 'overview' ? 'follow' : 'overview');
    if (e.code === 'ArrowLeft' && demo.phase === 'fork-choice') { e.preventDefault(); demo.chooseFork('left'); }
    if (e.code === 'ArrowRight' && demo.phase === 'fork-choice') { e.preventDefault(); demo.chooseFork('right'); }
  });
  $('#game').addEventListener('wheel', e => { e.preventDefault(); world.zoom = Math.max(.75, Math.min(1.35, world.zoom + e.deltaY * .0005)); }, { passive: false });
  let drag;
  $('#game').addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    drag = { x: e.clientX, moved: false };
    $('#game').setPointerCapture(e.pointerId);
  });
  $('#game').addEventListener('pointermove', e => {
    if (!drag) return;
    const delta = e.clientX - drag.x; drag.x = e.clientX;
    if (Math.abs(delta) > 1) {
      if (!drag.moved) demo.setMode('overview');
      drag.moved = true; world.overviewYaw -= delta * .006;
    }
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) $('#game').addEventListener(type, () => { drag = null; });
}

init();
