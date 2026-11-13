import * as THREE from 'three';
import { drawFrontIdle } from './front-art.js';

export const SEAT_COLORS = ['#ff887d', '#83c9f4', '#ffd267', '#8adfc3', '#ab9bf3', '#f3b1cb', '#eaa46a', '#72c7bb', '#a6b9e7', '#d7b98d'];

const sharedImages = new Map();
const imageScale = new WeakMap();
export const spriteImageScale = image => imageScale.get(image) || 1;
let decoding = 0;
const decodeQueue = [];
export async function loadImage(url, { atlas = false } = {}) {
  const key = `${atlas ? 'atlas:' : 'art:'}${url}`;
  if (!sharedImages.has(key)) {
    const promise = (async () => {
      if (decoding >= 2) await new Promise(resolve => decodeQueue.push(resolve));
      decoding++;
      try {
        if (atlas && typeof createImageBitmap === 'function') {
          const response=await fetch(url);if(!response.ok)throw new Error(`Không tải được sprite: ${url}`);
          const blob=await response.blob(), header=new DataView(await blob.slice(0,24).arrayBuffer());
          const width=header.getUint32(16),height=header.getUint32(20);
          // A runtime 128px cell is enough for distant racers. Original 256px
          // sheets and metadata remain unchanged; only the browser decode is
          // sampled, preventing twenty full animation packs exhausting RAM.
          const scale=width*height>1_000_000?.5:1;
          const bitmap=await createImageBitmap(blob,{resizeWidth:Math.round(width*scale),resizeHeight:Math.round(height*scale),resizeQuality:'high'});
          imageScale.set(bitmap,scale);return bitmap;
        }
        const image = new Image(); image.decoding = 'async'; image.src = url;
        await image.decode(); return image;
      } finally {decoding--;decodeQueue.shift()?.();}
    })();
    sharedImages.set(key, promise);
    promise.catch(() => sharedImages.delete(key));
  }
  return sharedImages.get(key);
}

function canvasTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

export class Player {
  constructor(data, seat, base) {
    this.data = data;
    this.seat = seat;
    this.base = base;
    this.instanceIndex = data.instanceIndex ?? Math.max(0, seat.charCodeAt(0) - 65);
    this.showName = true; this.detailed = true;
    this.position = new THREE.Vector3();
    this.heading = new THREE.Vector3(0, 0, 1);
    this.facing = 'S';
    this.clip = 'idle';
    this.frame = -1;
    this.distance = 0;
    this.clipTime = 0;
    this.images = new Map();
    this.pending = new Map();
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = 256;
    this.ctx = this.canvas.getContext('2d');
    this.texture = canvasTexture(this.canvas);
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texture, transparent: true, alphaTest: .03, depthWrite: false }));
    this.height = data.worldHeight * 256 / 202;
    this.sprite.scale.set(this.height, this.height, 1);
    this.sprite.center.set(data.pivot[0] / 256, 1 - data.pivot[1] / 256);
    this.sprite.name = 'player-' + seat;
    this.group = new THREE.Group();
    this.group.add(this.sprite);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(.24, 24), new THREE.MeshBasicMaterial({ color: 0x23352a, transparent: true, opacity: .16, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.y = .65;
    shadow.position.y = .018;
    this.group.add(shadow);
    const label = document.createElement('canvas');
    label.width = 512; label.height = 112;
    const c = label.getContext('2d');
    c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(4, 8, 504, 88, 35); c.fill();
    c.fillStyle = SEAT_COLORS[this.instanceIndex % SEAT_COLORS.length]; c.beginPath(); c.arc(47, 52, 28, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#263a35'; c.font = `800 ${seat.length > 1 ? 23 : 32}px sans-serif`; c.textAlign = 'center'; c.fillText(seat.replace(/^P/, ''), 47, 62, 49);
    c.font = '700 29px sans-serif'; c.textAlign = 'left'; c.fillText(data.name, 91, 63, 392);
    this.label = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTexture(label), transparent: true, depthTest: false, depthWrite: false }));
    this.label.scale.set(1.55, .34, 1);
    this.label.position.y = 1.53;
    this.label.renderOrder = 100;
    this.group.add(this.label);
  }

  async init() {
    await this.loadClip('idle');
    if (this.data.frontIdle) this.frontImage = await loadImage(this.base + this.data.frontIdle.image);
    this.draw('idle', 0, 'S');
    const avatar = document.createElement('canvas');
    avatar.width = avatar.height = 128;
    avatar.getContext('2d').drawImage(this.canvas, 62, 0, 132, 132, 0, 0, 128, 128);
    this.avatar = avatar.toDataURL('image/png');
  }

  async loadClip(clip) {
    if (this.images.has(clip)) return;
    if (this.pending.has(clip)) return this.pending.get(clip);
    const promise = loadImage(this.base + this.data.animations[clip].image, { atlas: true }).then(image => {
      this.images.set(clip, image);
      this.pending.delete(clip);
    }).catch(error=>{this.pending.delete(clip);throw error;});
    this.pending.set(clip, promise);
    return promise;
  }

  setClip(clip) {
    if (this.clip === clip) return;
    this.clip = clip;
    this.clipTime = 0;
    this.frame = -1;
    this.loadClip(clip).catch(error => console.error('Sprite load failed', this.data.id, clip, error));
  }

  draw(clip, frame, facing) {
    if (clip === 'idle' && facing === 'S' && this.frontImage && this.data.frontIdle) {
      if (this.drawKey === 'clean-front-idle') return;
      this.ctx.clearRect(0, 0, 256, 256); drawFrontIdle(this.ctx, this.frontImage, this.data.frontIdle);
      this.drawKey = 'clean-front-idle'; this.texture.needsUpdate = true; this.frame = 0; return;
    }
    const data = this.data.animations[clip];
    const image = this.images.get(clip);
    if (!image) return;
    const direction = facing === 'W' ? 'E' : facing;
    const spec = data.directions[direction]?.[frame];
    if (!spec) return;
    const key = clip + ':' + frame + ':' + facing;
    if (this.drawKey === key) return;
    this.drawKey = key;
    const [x, y, w, h] = spec.rect;
    const c = this.ctx;
    c.clearRect(0, 0, 256, 256);
    c.save();
    if (facing === 'W') { c.translate(256, 0); c.scale(-1, 1); }
    const scale=imageScale.get(image)||1;
    c.drawImage(image, x*scale, y*scale, w*scale, h*scale, 0, 0, 256, 256);
    c.restore();
    this.texture.needsUpdate = true;
    this.frame = frame;
  }

  update(dt, camera, moving, active, globalClock) {
    this.clipTime += dt;
    this.group.position.copy(this.position);
    if (!moving && this.visualOffset) { this.group.position.x += this.visualOffset[0]; this.group.position.z += this.visualOffset[1]; }
    this.group.position.y += .035;
    const distance = camera.position.distanceTo(this.position);
    const overhead = camera.position.y > 12;
    this.label.visible = this.showName && (overhead || (!active && distance < 11));
    const labelWidth = overhead ? 1.55 : THREE.MathUtils.clamp(distance * .10, .65, 1.15);
    this.label.scale.set(labelWidth, labelWidth * 112 / 512, 1);
    this.label.material.opacity = active ? 1 : .88;
    if (moving) {
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize();
      const toward = camera.position.clone().sub(this.position).setY(0).normalize();
      const x = this.heading.dot(right), y = this.heading.dot(toward);
      // The actual V2.3 pack has three unique directions plus a mirrored west row.
      this.facing = Math.abs(x) >= Math.abs(y) ? (x >= 0 ? 'E' : 'W') : (y >= 0 ? 'S' : 'N');
    }
    let clip = this.clip;
    if (!this.images.has(clip)) clip = 'idle';
    const spec = this.data.animations[clip];
    let frame;
    if (moving && spec.locomotion?.cycleTravelArtPx) {
      const stride = spec.locomotion.cycleTravelArtPx * this.height / 256;
      frame = Math.floor(this.distance / stride * spec.frameCount) % spec.frameCount;
    } else {
      const clock = clip === 'idle' ? globalClock + this.instanceIndex * .11 : this.clipTime;
      frame = Math.floor(clock * spec.fps);
      frame = spec.loop ? frame % spec.frameCount : Math.min(frame, spec.frameCount - 1);
    }
    if (!this.detailed && !active) frame = 0;
    if (this.group.visible || active) this.draw(clip, frame, this.facing);
  }

  dispose() {
    this.group.parent?.remove(this.group);
    this.texture.dispose();this.sprite.material.dispose();
    this.label.material.map?.dispose();this.label.material.dispose();
    for(const object of this.group.children)if(object.isMesh){object.geometry.dispose();object.material.dispose();}
    this.images.clear();this.group.clear();
  }
}
