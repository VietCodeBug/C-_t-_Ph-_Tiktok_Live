import * as THREE from 'three';

export class CameraDemo {
  constructor(world, players, layouts, onChange) {
    this.world = world; this.players = players; this.layouts = layouts; this.onChange = onChange;
    this.mode = 'auto'; this.paused = false; this.speed = 1;
    this.active = 0; this.turn = 1; this.phase = 'overview'; this.phaseTime = 0; this.clock = 0;
    this.remaining = 0; this.segment = null; this.mapId = 'CHO_VIA_HE';
    players.forEach(p => world.playerGroup.add(p.group));
  }

  async changeMap(id) {
    if (this.loading) return;
    this.loading = true;
    this.mapId = id;
    this.layout = this.layouts[id];
    this.nodes = new Map(this.layout.nodes.map(n => [n.id, n]));
    await this.world.loadMap(this.layout);
    this.reset();
    this.loading = false;
    this.emit();
  }

  reset() {
    this.active = 0; this.turn = 1; this.phase = 'overview'; this.phaseTime = 0; this.segment = null;
    const route = ['C00']; let current = 'C00';
    while (true) {
      const next = this.nodes.get(current).next[0];
      if (next === 'C00') break;
      route.push(next); current = next;
      if (route.length > 24) throw new Error('Invalid map route');
    }
    this.players.forEach((p, i) => {
      p.node = route[i * 2]; p.position.fromArray(this.nodes.get(p.node).position);
      const next = this.nodes.get(this.nodes.get(p.node).next[0]).position;
      p.heading.fromArray(next).sub(p.position).setY(0).normalize();
      p.facing = 'S'; p.distance = 0; p.setClip('idle');
    });
    this.world.followHeading.copy(this.players[0].heading);
    this.emit();
  }

  setMode(mode) { this.mode = mode; this.emit(); }
  setPaused(value) { this.paused = value; this.emit(); }

  select(index) {
    const old = this.players[this.active];
    if (this.segment) {
      old.node = this.segment.progress > .5 ? this.segment.to : this.segment.from;
      old.position.fromArray(this.nodes.get(old.node).position);
    }
    old.setClip('idle');
    this.active = index; this.segment = null; this.phase = 'overview';
    this.phaseTime = this.mode === 'follow' ? 2.6 : 1.5;
    this.world.followHeading.copy(this.players[index].heading);
    this.emit();
  }

  nextTurn() { this.turn++; this.select((this.active + 1) % this.players.length); }

  startSegment() {
    const player = this.players[this.active];
    const next = this.nodes.get(player.node).next;
    const to = next.length === 1 ? next[0] : next[(this.active + this.turn) % 2];
    const a = new THREE.Vector3().fromArray(this.nodes.get(player.node).position);
    const b = new THREE.Vector3().fromArray(this.nodes.get(to).position);
    player.heading.copy(b).sub(a).setY(0).normalize();
    this.segment = { from: player.node, to, a, b, length: a.distanceTo(b), progress: 0 };
  }

  update(dt) {
    if (this.loading) return;
    const gameDt = this.paused ? 0 : dt * this.speed;
    this.clock += gameDt; this.phaseTime += gameDt;
    const player = this.players[this.active];
    if (!this.paused) {
      if (this.phase === 'overview' && this.phaseTime >= 2.7) {
        this.phase = 'roll'; this.phaseTime = 0;
        this.roll = 2 + ((this.active + this.turn) % 3);
        this.remaining = this.roll;
        player.setClip('roll_dice');
        player.loadClip('run');
        this.emit();
      } else if (this.phase === 'roll' && this.phaseTime >= 1.2) {
        this.phase = 'moving'; this.phaseTime = 0;
        player.setClip('run');
        this.startSegment(); this.emit();
      } else if (this.phase === 'moving') {
        if (!this.segment) this.startSegment();
        const distance = gameDt * 1.02;
        const step = Math.min(distance, (1 - this.segment.progress) * this.segment.length);
        this.segment.progress += step / this.segment.length;
        player.distance += step;
        player.position.lerpVectors(this.segment.a, this.segment.b, this.segment.progress);
        if (this.segment.progress >= 1 - 1e-7) {
          player.node = this.segment.to; this.segment = null; this.remaining--;
          if (!this.remaining) {
            this.phase = 'arrive'; this.phaseTime = 0;
            player.setClip('happy'); this.emit();
          }
        }
      } else if (this.phase === 'arrive' && this.phaseTime >= 1.55) {
        player.setClip('idle');
        // Keep only the active movement/gesture bitmap in addition to each player's idle.
        for (const key of ['run', 'walk', 'roll_dice', 'happy']) player.images.delete(key);
        this.turn++; this.active = (this.active + 1) % 10;
        this.phase = 'overview'; this.phaseTime = 0; this.emit();
      }
    }
    this.cameraView = this.world.updateCamera(dt, this.players[this.active], this.mode, this.phase === 'overview');
    for (let i = 0; i < this.players.length; i++) {
      this.players[i].update(gameDt, this.world.camera, i === this.active && this.phase === 'moving', i === this.active, this.clock);
    }
    this.emitTime = (this.emitTime || 0) + dt;
    if (this.emitTime > .2) { this.emitTime = 0; this.emit(); }
  }

  snapshot() {
    const p = this.players[this.active];
    return { map: this.mapId, active: this.active, seat: p.seat, name: p.data.name, mode: this.mode,
      cameraView: this.cameraView || 'overview', phase: this.phase, paused: this.paused, speed: this.speed,
      turn: this.turn, roll: this.roll || 0, remaining: this.remaining, node: p.node,
      destination: this.segment?.to || p.node, tile: this.world.types?.[p.node]?.name || 'ĐANG VÀO PHỐ',
      players: this.players.map(x => ({ seat: x.seat, name: x.data.name, position: x.position.toArray(), heading: x.heading.toArray(), clip: x.clip, frame: x.frame, facing: x.facing })),
      camera: { position: this.world.camera.position.toArray(), target: this.world.lookAt.toArray(),
        distanceToPlayer: this.world.camera.position.distanceTo(p.position) },
      spriteVersion: '2.3', runtime: { calls: this.world.renderer.info.render.calls, triangles: this.world.renderer.info.render.triangles } };
  }

  emit() { this.onChange?.(this.snapshot()); }
}
