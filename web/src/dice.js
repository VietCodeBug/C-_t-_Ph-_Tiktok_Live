import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

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
const FACE_ROTATION = { 1: [0, 0], 2: [90, 0], 3: [0, -90], 4: [0, 90], 5: [-90, 0], 6: [0, 180] };

// Physical faces use standard opposite pairs (1+6, 2+5, 3+4). The result
// quaternion turns the chosen face towards +Z, the front of the dice camera.
export function dieResultQuaternion(value) {
  if (!PIPS[value]) throw new RangeError('Die result must be an integer from 1–6');
  const [x, y] = FACE_ROTATION[value];
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(x * Math.PI / 180, y * Math.PI / 180, 0));
}

export function createDieMesh() {
  const die = new THREE.Group();
  die.name = 'physical-die';
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.58, 1.58, 1.58, 6, .16),
    new THREE.MeshPhysicalMaterial({ color: '#fff3d7', roughness: .25, metalness: 0,
      clearcoat: .85, clearcoatRoughness: .2 }));
  body.name = 'rounded-ivory-body';
  body.castShadow = body.receiveShadow = true;
  die.add(body);
  const dark = new THREE.MeshStandardMaterial({ color: '#263c38', roughness: .58 });
  const red = new THREE.MeshStandardMaterial({ color: '#b94738', roughness: .55 });
  const rim = new THREE.MeshStandardMaterial({ color: '#d3c3a2', roughness: .7 });
  const pipGeometry = new THREE.SphereGeometry(.097, 20, 12);
  const rimGeometry = new THREE.TorusGeometry(.098, .009, 6, 20);
  const orientations = {
    1: [0, 0, 0], 6: [0, Math.PI, 0], 3: [0, Math.PI / 2, 0],
    4: [0, -Math.PI / 2, 0], 2: [-Math.PI / 2, 0, 0], 5: [Math.PI / 2, 0, 0]
  };
  for (const [value, positions] of Object.entries(PIPS)) {
    const face = new THREE.Group();
    face.name = `face-${value}`;
    face.userData.value = Number(value);
    face.userData.normal = new THREE.Vector3(0, 0, 1);
    face.rotation.set(...orientations[value]);
    for (const i of positions) {
      const pip = new THREE.Mesh(pipGeometry, Number(value) === 1 ? red : dark);
      pip.name = 'modeled-pip';
      pip.position.set((i % 3 - 1) * .365, (1 - Math.floor(i / 3)) * .365, .788);
      pip.scale.z = .16;
      face.add(pip);
      const lip = new THREE.Mesh(rimGeometry, rim);
      lip.position.copy(pip.position);
      lip.position.z = .792;
      face.add(lip);
    }
    die.add(face);
  }
  return die;
}

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
    this.el.innerHTML = `<span class='dice-eyebrow'>XÚC XẮC CỦA GHẾ <b class='dice-seat'>A</b></span><div class='dice-stage'><canvas class='dice-webgl' aria-label='Xúc xắc 3D bo góc, chấm nổi khối' data-renderer='three-webgl'></canvas><span class='dice-spark dice-spark-a'>✦</span><span class='dice-spark dice-spark-b'>✧</span></div><strong class='dice-caption'>Đang lắc…</strong><span class='dice-note'>Chờ xúc xắc dừng</span>`;
    parent.append(this.el);
    this.canvas = this.el.querySelector('.dice-webgl');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(240, 200, false);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 240 / 200, .1, 30);
    this.camera.position.set(3.2, 2.6, 6.0);
    this.camera.lookAt(0, .85, 0);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb6b594, 2));
    const key = new THREE.DirectionalLight(0xffedcf, 4.5);
    key.position.set(-3, 6, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(512, 512);
    Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: .1, far: 15 });
    key.shadow.normalBias = .02;
    key.shadow.bias = -.001;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xd4ecff, 2);
    fill.position.set(4, 2, -3);
    this.scene.add(fill);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: .22 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -.11;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.die = createDieMesh();
    this.die.position.y = .72;
    this.scene.add(this.die);
    this.identity = new THREE.Quaternion();
    this.up = new THREE.Vector3();
    this.inverse = new THREE.Quaternion();
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
      const turns = 1 - Math.pow(1 - p, 1.5);
      const lift = Math.sin(p * Math.PI) * .43 + Math.abs(Math.sin(p * Math.PI * 4)) * (1 - p) * .11;
      this.die.rotation.set(Math.PI * 4 * turns, Math.PI * 6 * turns, Math.PI * 2 * turns);
      // Support height for a rounded cube keeps every rolling corner above the floor.
      this.up.set(0, 1, 0).applyQuaternion(this.inverse.copy(this.die.quaternion).invert());
      const support = .63 * (Math.abs(this.up.x) + Math.abs(this.up.y) + Math.abs(this.up.z)) + .16;
      this.die.position.set(Math.sin(p * Math.PI * 2) * .13, -.07 + support + lift, 0);
    } else {
      // Use the game clock for settling too, so pause and playback speed stay in sync.
      const settle = 1 - Math.pow(1 - Math.min(1, state.elapsed / .32), 3);
      this.die.quaternion.slerpQuaternions(this.identity, dieResultQuaternion(state.value), settle);
      this.die.position.set(0, .72, 0);
    }
    const pose = [...this.die.quaternion.toArray(), ...this.die.position.toArray()].map(n => n.toFixed(6)).join(',');
    const renderKey = `${state.sequence}:${pose}`;
    if (renderKey !== this.renderKey) {
      this.canvas.dataset.pose = pose;
      this.renderer.render(this.scene, this.camera);
      this.renderKey = renderKey;
    }
    const key = state.sequence + ':' + state.phase;
    if (this.captionKey !== key) {
      this.captionKey = key;
      this.caption.textContent = spinning ? 'Đang lắc xúc xắc…' : `${state.value} BƯỚC`;
      this.note.textContent = spinning ? 'Chờ xúc xắc dừng rồi mới di chuyển' : `Ghế ${state.seat} đi đúng ${state.value} ô`;
    }
  }
}
