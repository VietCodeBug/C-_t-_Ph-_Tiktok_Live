import * as THREE from 'three';
import { Player } from './sprites.js';

const CAST = {
  dog: { id: 'pet_dog', gesture: 'bark', side: 1 },
  police: { id: 'npc02', gesture: 'police_stop', side: -1 }
};

export function normalizeCameoAnimations(raw, id, gesture) {
  return Object.fromEntries(['idle', gesture].map(clip => {
    const animation = raw.animations[clip];
    if (!animation) throw new Error(`NPC ${id} thiếu animation ${clip}`);
    const directions = Object.fromEntries(Object.entries(animation.directions).map(([direction, frames]) => [direction,
      frames.map(frame => {
        const rect = Array.isArray(frame) ? frame : frame.rect;
        if (!Array.isArray(rect) || rect.length !== 4 || !rect.every(Number.isFinite) || rect[2] <= 0 || rect[3] <= 0) throw new Error(`NPC ${id} có frame lỗi`);
        return { ...(Array.isArray(frame) ? {} : frame), rect };
      })]));
    return [clip, { ...animation, directions, image: `cameos/${id}/${animation.image}` }];
  }));
}

// These actors are supplied V2.3 sprites. They are presentation only: no board
// position, step count or ledger entry can be changed by a cameo.
export class EventCameos {
  constructor(world, base) {
    this.world = world; this.base = base;
    this.group = new THREE.Group(); this.group.name = 'Neighborhood event cameos';
    this.group.visible = false; world.scene.add(this.group);
    this.actors = new Map(); this.age = 0;
    this.right = new THREE.Vector3(); this.toward = new THREE.Vector3();
  }

  async init() {
    if (this.initializing) return this.initializing;
    this.initializing = Promise.all(Object.entries(CAST).map(async ([kind, spec]) => {
      const response = await fetch(`${this.base}cameos/${spec.id}/animations.json`);
      if (!response.ok) throw new Error(`Không tải được NPC ${spec.id}`);
      const raw = await response.json();
      const animations = normalizeCameoAnimations(raw, spec.id, spec.gesture);
      const actor = new Player({ ...raw, animations }, 'A', this.base);
      await actor.init();
      // A cameo has neither a seat label nor a selectable player identity.
      actor.group.remove(actor.label);
      actor.label.material.map?.dispose(); actor.label.material.dispose();
      actor.group.name = `event-cameo-${kind}`; actor.group.visible = false;
      actor.facing = kind === 'dog' ? 'W' : 'S';
      this.group.add(actor.group); this.actors.set(kind, actor);
    }));
    await this.initializing;
    return this;
  }

  show(kind, key) {
    if (!CAST[kind] || !this.actors.has(kind)) return false;
    this.kind = kind; this.key = key; this.age = 0;
    for (const [name, actor] of this.actors) actor.group.visible = name === kind;
    this.actors.get(kind).setClip(CAST[kind].gesture);
    this.group.visible = true;
    return true;
  }

  hide() {
    this.group.visible = false; this.key = null; this.kind = null;
  }

  update(dt, snapshot, player) {
    const event = snapshot.event;
    if (snapshot.loading || !event || !['event-choice', 'arrive'].includes(snapshot.phase)) {
      this.hide(); return;
    }
    const cue = `${event.sfx || ''} ${event.vfx || ''}`;
    const kind = /dog|paw/.test(cue) ? 'dog' : /whistle|siren|police/.test(cue) ? 'police' : null;
    if (!kind) { this.hide(); return; }
    const key = `${snapshot.map}:${snapshot.seed}:${snapshot.active}:${event.sequence}:${event.id}`;
    if (key !== this.key && !this.show(kind, key)) return;
    const actor = this.actors.get(kind);
    const elapsed = snapshot.paused ? 0 : dt * snapshot.speed;
    this.age += elapsed;
    const spec = CAST[kind], gesture = actor.data.animations[spec.gesture];
    if (this.age > gesture.frameCount / gesture.fps + .4 && actor.clip !== 'idle') actor.setClip('idle');
    this.right.setFromMatrixColumn(this.world.camera.matrixWorld, 0).setY(0).normalize();
    this.toward.copy(this.world.camera.position).sub(player.position).setY(0).normalize();
    actor.position.copy(player.position)
      .addScaledVector(this.right, spec.side * (kind === 'dog' ? .78 : .92))
      .addScaledVector(this.toward, .12);
    actor.facing = kind === 'dog' ? 'W' : 'S';
    actor.update(elapsed, this.world.camera, false, false, this.age);
    actor.label.visible = false;
    actor.sprite.material.opacity = 1;
    // The dog bounces in place; the player's feet and route remain untouched.
    if (kind === 'dog' && this.age < 1.8) actor.group.position.y += Math.abs(Math.sin(this.age * 5)) * .065;
  }

  snapshot() {
    const actor = this.actors.get(this.kind);
    return { visible: this.group.visible, kind: this.kind || null, clip: actor?.clip || null,
      frame: actor?.frame ?? -1, age: this.age, loaded: this.actors.size };
  }
}
