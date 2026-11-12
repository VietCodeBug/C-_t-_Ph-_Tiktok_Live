export const DICE_ROLL_SECONDS = 1.8;
export const DICE_RESULT_SECONDS = .95;

// Discard the four upper uint32 values so every face has the same probability.
export function rollDie(fill = values => globalThis.crypto.getRandomValues(values)) {
  const sample = new Uint32Array(1);
  const limit = 0x100000000 - (0x100000000 % 6);
  do { fill(sample); } while (sample[0] >= limit);
  return sample[0] % 6 + 1;
}

const PIPS = {
  1: [4], 2: [0, 8], 3: [0, 4, 8],
  4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8]
};
const FACE_ROTATION = { 1: [0, 0], 2: [-90, 0], 3: [0, -90], 4: [0, 90], 5: [90, 0], 6: [0, 180] };

export function dieFaceSVG(value) {
  const pips = PIPS[value];
  if (!pips) return '';
  return `<svg viewBox='0 0 24 24' fill='none' aria-hidden='true'><rect x='2' y='2' width='20' height='20' rx='5' stroke='currentColor' stroke-width='1.6'/>${pips.map(i => `<circle cx='${6 + (i % 3) * 6}' cy='${6 + Math.floor(i / 3) * 6}' r='1.6' fill='currentColor'/>`).join('')}</svg>`;
}

export class DiceOverlay {
  constructor(parent, base) {
    this.el = document.createElement('div');
    this.el.className = 'dice-overlay';
    this.el.hidden = true;
    this.el.setAttribute('role', 'status');
    this.el.setAttribute('aria-live', 'polite');
    const faces = [['front', 1], ['back', 6], ['right', 3], ['left', 4], ['top', 2], ['bottom', 5]];
    this.el.innerHTML = `<span class='dice-eyebrow'>XÚC XẮC CỦA GHẾ <b class='dice-seat'>A</b></span><div class='dice-stage'><div class='dice-shadow'></div><div class='dice-float'><div class='dice-orbit'><div class='dice-cube'>${faces.map(([side, n]) => `<div class='die-face die-${side}' data-face='${n}'>${PIPS[n].map(i => `<i class='die-pip' style='grid-row:${1 + Math.floor(i / 3)};grid-column:${1 + i % 3}'></i>`).join('')}</div>`).join('')}</div></div></div><span class='dice-spark dice-spark-a'>✦</span><span class='dice-spark dice-spark-b'>✧</span></div><strong class='dice-caption'>Đang lắc…</strong><span class='dice-note'>Chờ xúc xắc dừng</span>`;
    parent.append(this.el);
    this.cube = this.el.querySelector('.dice-cube');
    this.float = this.el.querySelector('.dice-float');
    this.shadow = this.el.querySelector('.dice-shadow');
    this.caption = this.el.querySelector('.dice-caption');
    this.note = this.el.querySelector('.dice-note');
    this.seat = this.el.querySelector('.dice-seat');
    this.audio = new Audio(base + 'audio/sfx_dice_roll.ogg');
    this.audio.preload = 'auto';
    this.audio.volume = .35;
    document.addEventListener('pointerdown', () => { this.audioUnlocked = true; }, { once: true, capture: true });
  }

  update(state) {
    const spinning = state.phase === 'roll';
    const showing = spinning || state.phase === 'roll-result';
    this.el.hidden = !showing;
    if (!showing) {
      if (this.visible) { this.audio.pause(); this.resumeAudio = false; }
      this.visible = false;
      return;
    }
    this.visible = true;
    this.el.dataset.state = spinning ? 'spinning' : 'result';
    this.el.dataset.value = spinning ? '' : String(state.value);
    this.el.dataset.paused = String(state.paused);
    this.seat.textContent = state.seat;
    if (this.lastRoll !== state.sequence) {
      this.lastRoll = state.sequence;
      if (this.audioUnlocked) {
        this.audio.currentTime = 0;
        this.audio.play().catch(() => {});
      }
    }
    if (state.paused && !this.audio.paused) { this.resumeAudio = true; this.audio.pause(); }
    else if (!state.paused && this.resumeAudio) { this.resumeAudio = false; this.audio.play().catch(() => {}); }
    if (spinning) {
      const p = Math.min(1, state.elapsed / DICE_ROLL_SECONDS);
      const lift = Math.sin(p * Math.PI) * 28 + Math.abs(Math.sin(p * Math.PI * 4)) * (1 - p) * 7;
      this.cube.style.transition = 'none';
      this.cube.style.transform = `rotateX(${720 * p}deg) rotateY(${1080 * p}deg) rotateZ(${360 * p}deg)`;
      this.float.style.transform = `translateY(${-lift}px) scale(${.94 + Math.sin(p * Math.PI) * .1})`;
      this.shadow.style.transform = `scale(${1 - lift / 110})`;
      this.shadow.style.opacity = String(.25 - lift / 240);
    } else {
      const [x, y] = FACE_ROTATION[state.value];
      // Use the game clock for settling too, so pause and playback speed stay in sync.
      const settle = 1 - Math.pow(1 - Math.min(1, state.elapsed / .32), 3);
      this.cube.style.transition = 'none';
      this.cube.style.transform = `rotateX(${720 + x * settle}deg) rotateY(${1080 + y * settle}deg) rotateZ(360deg)`;
      this.float.style.transform = 'translateY(0) scale(1)';
      this.shadow.style.transform = 'scale(1)'; this.shadow.style.opacity = '.25';
    }
    const key = state.sequence + ':' + state.phase;
    if (this.captionKey !== key) {
      this.captionKey = key;
      this.caption.textContent = spinning ? 'Đang lắc xúc xắc…' : `${state.value} BƯỚC`;
      this.note.textContent = spinning ? 'Chờ xúc xắc dừng rồi mới di chuyển' : `Ghế ${state.seat} đi đúng ${state.value} ô`;
    }
  }
}
