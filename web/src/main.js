import '@fontsource-variable/nunito';
import './style.css';
import { TownWorld } from './world.js';
import { Player, SEAT_COLORS } from './sprites.js';
import { CameraDemo } from './demo.js';
import { DiceOverlay, dieFaceSVG } from './dice.js';

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
app.innerHTML = `
  <header class='topbar'>
    <a class='brand' href='./' aria-label='Cờ Tý Phí — trang chính'><span class='brand-mark'>${icons.dice}</span><span>Cờ Tý Phí<small>PHỐ ĐỒ CHƠI</small></span></a>
    <div class='topbar-center'><span class='live-dot'></span>BÀN CHƠI MẪU <span class='top-divider'></span> 10 người</div>
    <div class='pack-tag'><span class='small-star'>✦</span> Sprite v2.3 <span class='pack-check'>✓</span></div>
  </header>
  <main class='workspace'>
    <aside class='left-panel'>
      <div class='panel-caption'><span>NGƯỜI TRONG BÀN</span><span class='count-badge'>10 / 10</span></div>
      <div class='players' id='players'></div>
      <div class='sidebar-note'><span class='note-icon'>↗</span><p>Chọn một người để chuyển lượt và đưa camera đến nhân vật.</p></div>
    </aside>
    <section class='stage-column'>
      <div class='stage-toolbar'><span><span class='status-dot'></span><b id='map-title'>Chợ Vỉa Hè</b></span><span class='aspect-tag'>9:16 <i></i> 3D</span></div>
      <div class='portrait' id='portrait'>
        <canvas id='game' aria-label='Map 3D cờ Tý Phí cho mười người'></canvas>
        <div class='game-top'><div class='game-logo'>CỜ TÝ PHÍ<span>PHỐ ĐỒ CHƠI</span></div><div class='round-chip'>VÒNG DEMO <strong id='round-number'>01</strong></div></div>
        <div class='view-pill' id='view-pill'>${icons.grid}<span>Toàn bàn</span></div>
        <div class='turn-banner'><div class='turn-avatar' id='turn-avatar'></div><div><span class='eyebrow'>ĐẾN LƯỢT</span><strong id='turn-name'>Mít Tóc Xù</strong><small id='turn-action'>Camera đang nhìn toàn bàn</small></div><span class='turn-seat' id='turn-seat'>A</span></div>
        <div class='bottom-hud'><div class='hud-info'><span class='mini-dice' id='roll-display'>${icons.dice}</span><div><b id='hud-title'>Sẵn sàng tung xúc xắc</b><span id='hud-subtitle'>Chốt số rồi mới di chuyển</span></div><span class='hud-status' id='hud-status'>SẴN SÀNG</span><button id='roll-dice' class='roll-button' aria-label='Lắc xúc xắc'>${icons.dice}<span>Lắc</span></button></div><div class='progress-track'><i id='turn-progress'></i></div></div>
        <button class='fullscreen icon-button' id='fullscreen' aria-label='Xem toàn màn hình'>${icons.expand}</button>
        <div class='loading' id='loading'><div class='loader-dice'>${icons.dice}</div><h2>Đang mở khu phố…</h2><p id='loading-text'>Chuẩn bị nhân vật và map</p><div class='load-track'><i id='load-progress'></i></div></div>
      </div>
      <div class='playback'><button class='icon-button pause-button' id='pause' aria-label='Tạm dừng'>${icons.pause}</button><span id='playback-text'>Đang chạy bản xem trước</span><button class='next-button' id='next-turn'>Lượt tiếp ${icons.next}</button></div>
      <div class='mobile-players' id='mobile-players'></div>
    </section>
    <aside class='right-panel'>
      <div class='section-label'>GÓC MÁY</div>
      <h1>Một góc nhìn,<br>cả khu phố.</h1>
      <p class='camera-description'>Nhìn toàn bàn, rồi theo sau nhân vật qua từng ngã rẽ.</p>
      <div class='camera-modes' id='camera-modes'>
        <button class='camera-option selected' data-mode='auto' aria-pressed='true'>${icons.auto}<span><b>Tự chuyển</b><small>Toàn bàn → Góc thứ ba</small></span><i></i></button>
        <button class='camera-option' data-mode='overview' aria-pressed='false'>${icons.grid}<span><b>Toàn bàn</b><small>Thấy đủ 10 người</small></span><i></i></button>
        <button class='camera-option' data-mode='follow' aria-pressed='false'>${icons.camera}<span><b>Bám nhân vật</b><small>Góc thứ ba từ phía sau</small></span><i></i></button>
      </div>
      <div class='panel-rule'></div>
      <label class='section-label' for='map-select'>KHU PHỐ</label>
      <div class='select-wrap'><select id='map-select'><option value='CHO_VIA_HE'>Chợ Vỉa Hè</option><option value='PHO_GIAO_HANG'>Phố Giao Hàng</option></select>${icons.chevron}</div>
      <div class='map-meta'><span>24 ô</span><i></i><span>2 ngã rẽ</span><i></i><span>10 ghế</span></div>
      <div class='speed-row'><span>Tốc độ xem</span><div class='speed-options'><button data-speed='.75'>0.75×</button><button class='selected' data-speed='1'>1×</button><button data-speed='1.5'>1.5×</button></div></div>
      <div class='panel-rule'></div>
      <button class='capture-button' id='capture'>${icons.camera}<span>Chụp ảnh 1080 × 1920</span></button>
      <button class='restart-button' id='restart'>${icons.auto} Chạy lại cảnh demo</button>
      <div class='asset-note'><span>✦</span><div><b>Nhân vật của bạn đã vào phố</b><p>Idle v2.3 · di chuyển có animation<br>Map và đạo cụ từ bộ asset trong Git.</p></div></div>
    </aside>
  </main>
  <nav class='mobile-camera' aria-label='Góc máy trên điện thoại'><button data-mobile-mode='auto' class='selected'>${icons.auto} Tự chuyển</button><button data-mobile-mode='overview'>${icons.grid} Toàn bàn</button><button data-mobile-mode='follow'>${icons.camera} Theo sau</button></nav>
  <footer class='page-footer'><span>PHỐ ĐỒ CHƠI <i>•</i> CAMERA DEMO</span><span>10 nhân vật thật <i>•</i> Không cần kết nối TikTok</span></footer>
`;

const $ = s => document.querySelector(s);
const base = import.meta.env.BASE_URL + 'runtime/';
let world, demo, lastSnapshot, diceOverlay;
let loadingPct = 0;
function progress(fraction, text) {
  loadingPct = Math.max(loadingPct, fraction);
  $('#load-progress').style.width = `${Math.round(loadingPct * 100)}%`;
  $('#loading-text').textContent = text;
}

function updateUI(s) {
  lastSnapshot = s;
  $('#turn-name').textContent = s.name;
  $('#turn-seat').textContent = s.seat;
  $('#turn-seat').style.background = SEAT_COLORS[s.active];
  $('#round-number').textContent = String(Math.floor((s.turn - 1) / 10) + 1).padStart(2, '0');
  $('#map-title').textContent = s.map === 'CHO_VIA_HE' ? 'Chợ Vỉa Hè' : 'Phố Giao Hàng';
  const overview = s.cameraView === 'overview';
  $('#view-pill').innerHTML = (overview ? icons.grid : icons.camera) + `<span>${overview ? 'Toàn bàn' : 'Góc thứ ba · Theo sau'}</span>`;
  const action = s.phase === 'moving' ? `Đang chạy · còn ${s.remaining} bước` : s.phase === 'roll' ? 'Đang lắc xúc xắc…' : s.phase === 'roll-result' ? `Ra ${s.roll}! Chuẩn bị đi ${s.roll} bước` : s.phase === 'arrive' ? `Đã đi đủ ${s.roll} bước · ${s.tile.toLowerCase()}` : 'Camera đang nhìn toàn bàn';
  $('#turn-action').textContent = action;
  $('#hud-title').textContent = s.phase === 'moving' ? `${s.name.split(' ')[0]}: ${s.stepsCompleted}/${s.roll} bước` : s.phase === 'arrive' ? `Đã đi đủ ${s.roll} bước!` : s.phase === 'roll' ? 'Đang lắc xúc xắc…' : s.phase === 'roll-result' ? `Ra ${s.roll}! Đi ${s.roll} bước` : 'Sẵn sàng tung xúc xắc';
  $('#hud-subtitle').textContent = s.phase === 'moving' ? `Còn ${s.remaining} bước · Camera theo sau` : s.phase === 'arrive' ? 'Chuẩn bị chuyển sang người tiếp theo' : s.phase === 'roll' ? 'Chờ xúc xắc dừng' : s.phase === 'roll-result' ? 'Đã chốt kết quả · chuẩn bị di chuyển' : 'Bấm Lắc hoặc chờ lượt tự động';
  $('#hud-status').textContent = s.paused ? 'TẠM DỪNG' : s.phase === 'moving' ? 'ĐANG ĐI' : s.phase === 'roll' ? 'ĐANG LẮC' : s.phase === 'roll-result' ? 'ĐÃ CHỐT' : 'SẴN SÀNG';
  $('#roll-display').innerHTML = s.roll ? dieFaceSVG(s.roll) : icons.dice;
  $('#roll-display').dataset.value = String(s.roll);
  $('#roll-dice').disabled = s.phase !== 'overview' || s.paused;
  $('#roll-dice span').textContent = s.phase === 'roll' ? 'Đang lắc' : s.roll ? `${s.roll} bước` : 'Lắc';
  $('#playback-text').textContent = s.paused ? 'Đã tạm dừng' : 'Đang chạy bản xem trước';
  $('#pause').innerHTML = s.paused ? icons.play : icons.pause;
  $('#pause').setAttribute('aria-label', s.paused ? 'Tiếp tục' : 'Tạm dừng');
  $('#turn-progress').style.width = (s.phase === 'overview' ? 6 : s.phase === 'roll' ? 12 : s.phase === 'roll-result' ? 20 : s.phase === 'arrive' ? 100 : 20 + (1 - s.remaining / s.roll) * 75) + '%';
  document.querySelectorAll('.player-row,.mobile-seat').forEach(el => {
    const active = Number(el.dataset.seat) === s.active;
    el.classList.toggle('active', active);
    el.setAttribute('aria-pressed', String(active));
    if (el.querySelector('.player-status')) el.querySelector('.player-status').textContent = active ? (s.phase === 'moving' ? 'Đang chạy' : 'Đến lượt') : 'Trong bàn';
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
    const players = pack.actors.map((data, i) => new Player(data, String.fromCharCode(65 + i), base));
    let loaded = 0;
    await Promise.all([
      world.loadModels(p => progress(.12 + p * .36, 'Dựng phố, nhà và cây xanh')),
      Promise.all(players.map(async p => { await p.init(); progress(.45 + (++loaded / 10) * .3, 'Đưa nhân vật v2.3 vào bàn'); }))
    ]);
    $('#players').innerHTML = players.map((p, i) => `<button class='player-row' data-seat='${i}' aria-pressed='${i === 0}'><span class='player-avatar' style='background-image:url(${p.avatar});--seat:${SEAT_COLORS[i]}'><i>${p.seat}</i></span><span class='player-info'><b>${p.data.name}</b><small class='player-status'>Trong bàn</small></span><span class='player-money'><i>●</i> 1.000</span></button>`).join('');
    $('#mobile-players').innerHTML = players.map((p,i) => `<button class='mobile-seat' data-seat='${i}' aria-label='Theo ghế ${p.seat}: ${p.data.name}' style='--seat:${SEAT_COLORS[i]}'><img src='${p.avatar}' alt=''><span>${p.seat}</span></button>`).join('');
    demo = new CameraDemo(world, players, boards.layouts, updateUI);
    await demo.changeMap('CHO_VIA_HE');
    diceOverlay = new DiceOverlay($('#portrait'), base);
    progress(1, 'Khu phố đã sẵn sàng');
    $('#loading').classList.add('hidden');
    bind();
    let last = performance.now(), lastRender = 0;
    function tick(now) {
      const dt = Math.min((now - last) / 1000, .08); last = now;
      demo.update(dt);
      diceOverlay.update(demo.diceState());
      if (now - lastRender >= 1000 / 30 - 1) { world.render(); lastRender = now; }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    window.__TYPHI__ = {
      ready: true, snapshot: () => demo.snapshot(), select: i => demo.select(i),
      mode: mode => demo.setMode(mode), pause: value => demo.setPaused(value),
      changeMap: id => demo.changeMap(id), screenshot: () => world.screenshot(),
      roll: () => demo.requestRoll(),
      provenance: { spriteVersion: pack.version, sourceCommit: pack.sourceCommit },
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
  } catch (error) {
    console.error(error);
    $('#loading').innerHTML = `<h2>Chưa mở được khu phố</h2><p>${error.message}</p><button class='retry-button'>Thử lại</button>`;
    $('.retry-button').onclick = () => location.reload();
  }
}

function bind() {
  document.querySelectorAll('[data-seat]').forEach(el => el.addEventListener('click', () => demo.select(Number(el.dataset.seat))));
  document.querySelectorAll('[data-mode]').forEach(el => el.addEventListener('click', () => demo.setMode(el.dataset.mode)));
  document.querySelectorAll('[data-mobile-mode]').forEach(el => el.addEventListener('click', () => demo.setMode(el.dataset.mobileMode)));
  $('#pause').onclick = () => demo.setPaused(!demo.paused);
  $('#next-turn').onclick = () => demo.nextTurn();
  $('#roll-dice').onclick = () => demo.requestRoll();
  $('#restart').onclick = () => { demo.paused = false; demo.reset(); };
  $('#capture').onclick = () => world.screenshot();
  $('#fullscreen').onclick = async () => { if (!document.fullscreenElement) await $('#portrait').requestFullscreen(); else await document.exitFullscreen(); };
  $('#map-select').onchange = async e => {
    $('#loading').classList.remove('hidden');
    $('#loading-text').textContent = 'Chuyển sang khu phố mới';
    try { await demo.changeMap(e.target.value); }
    catch (error) { console.error(error); $('#loading-text').textContent = 'Không tải được map. Hãy thử lại.'; return; }
    $('#loading').classList.add('hidden');
  };
  document.querySelectorAll('[data-speed]').forEach(el => el.onclick = () => {
    demo.speed = Number(el.dataset.speed);
    document.querySelectorAll('[data-speed]').forEach(b => b.classList.toggle('selected', b === el));
  });
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault(); demo.setPaused(!demo.paused); }
    if (e.code === 'ArrowRight') demo.nextTurn();
    if (e.key.toLowerCase() === 'v') demo.setMode(demo.mode === 'overview' ? 'follow' : 'overview');
  });
  $('#game').addEventListener('wheel', e => { e.preventDefault(); world.zoom = Math.max(.75, Math.min(1.35, world.zoom + e.deltaY * .0005)); }, { passive: false });
}

init();
