import * as THREE from 'three';

// Short effects follow the simulation clock; an already posted ledger entry
// cannot play twice just because the HUD refreshes or the game is paused.
export class TownEffects {
  constructor(world, parent, base) {
    this.world = world; this.base = base; this.enabled = true;
    this.group = new THREE.Group(); this.group.name = 'Event feedback'; world.scene.add(this.group);
    this.items = []; this.audio = []; this.seen = new Set();
    this.geometries = { coin: new THREE.CylinderGeometry(.095, .095, .035, 12),
      spark: new THREE.IcosahedronGeometry(.045, 0), ring: new THREE.TorusGeometry(.5, .025, 6, 40) };
    this.label = document.createElement('div'); this.label.className = 'money-pop'; this.label.hidden = true;
    parent.append(this.label);
    document.addEventListener('pointerdown', () => { this.unlocked = true; }, { once: true, capture: true });
  }

  setEnabled(value) {
    this.enabled = value;
    if (!value) this.audio.forEach(audio => audio.pause());
  }

  clear() {
    for (const item of this.items) { this.group.remove(item.mesh); item.mesh.material.dispose(); }
    this.items.length = 0; this.pop = null; this.label.hidden = true;
  }

  sound(name) {
    if (!this.enabled || !this.unlocked) return;
    const aliases = { coin: 'sfx_coin_up', gain: 'sfx_coin_up', loss: 'sfx_coin_down',
      dog: 'sfx_dog_bark', police: 'sfx_traffic_whistle', trade: 'sfx_order', correct: 'sfx_correct' };
    const id = aliases[name] || name || 'sfx_coin';
    if (!/^sfx_[a-z_]+$/.test(id)) return;
    this.audio = this.audio.filter(audio => !audio.ended);
    if (this.audio.length >= 3) this.audio.shift().pause();
    const audio = new Audio(this.base + 'audio/' + id + '.ogg'); audio.volume = .28;
    this.audio.push(audio); audio.play().catch(() => {});
  }

  burst(position, result, key) {
    const delta = result.delta || 0;
    const gain = delta > 0, loss = delta < 0;
    const color = gain ? '#ffd369' : loss ? '#ef8d7d' : '#a7ddc1';
    this.sound(result.sfx || (gain ? 'sfx_coin_up' : loss ? 'sfx_coin_down' : 'sfx_correct'));
    this.pop = { position: position.clone(), age: 0, life: 2.3 };
    this.label.textContent = `${gain ? '+' : ''}${delta.toLocaleString('vi-VN')} MONEY`;
    this.label.dataset.tone = gain ? 'gain' : loss ? 'loss' : 'neutral'; this.label.hidden = false;
    const count = gain ? 18 : loss ? 12 : 8;
    for (let i = 0; i < count; i++) {
      const angle = i / count * Math.PI * 2 + key * .7;
      const material = new THREE.MeshStandardMaterial({ color: i % 4 === 0 ? '#fff0bb' : color,
        emissive: color, emissiveIntensity: .15, roughness: .4, metalness: gain ? .4 : 0, transparent: true });
      const mesh = new THREE.Mesh(gain ? this.geometries.coin : this.geometries.spark, material);
      mesh.position.copy(position).add(new THREE.Vector3(0, .4, 0));
      this.group.add(mesh);
      this.items.push({ mesh, age: 0, life: 1.1 + i % 4 * .15,
        velocity: new THREE.Vector3(Math.cos(angle) * (.5 + i % 3 * .16), 1.3 + i % 5 * .16, Math.sin(angle) * (.5 + i % 3 * .16)) });
    }
    const ring = new THREE.Mesh(this.geometries.ring, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.copy(position); ring.position.y = .12;
    this.group.add(ring); this.items.push({ mesh: ring, age: 0, life: 1.15, ring: true });
    if (/siren|police/.test(result.vfx || '')) {
      for (const [i, color] of ['#6aa9ff', '#ff706b'].entries()) {
        const flare = new THREE.Mesh(this.geometries.spark, new THREE.MeshBasicMaterial({ color, transparent: true }));
        flare.scale.setScalar(3); flare.position.copy(position).add(new THREE.Vector3((i - .5) * .6, 1.5, 0));
        this.group.add(flare); this.items.push({ mesh: flare, age: 0, life: 1.6, flash: true });
      }
    }
  }

  update(dt, snapshot, player) {
    const elapsed = snapshot.paused || snapshot.loading ? 0 : dt * snapshot.speed;
    const event = snapshot.event;
    const context = `${snapshot.map}:${snapshot.seed}:${snapshot.active}:${event?.sequence || 0}`;
    if (context !== this.context) { this.context = context; this.clear(); }
    if (event?.result) {
      const key = `${snapshot.seed}:${event.sequence}:${event.id}`;
      if (!this.seen.has(key)) {
        this.seen.add(key); if (this.seen.size > 200) this.seen.delete(this.seen.values().next().value);
        if (event.category !== 'rest') this.burst(player.position, event.result, event.sequence);
      }
    }
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i]; item.age += elapsed;
      const progress = item.age / item.life;
      if (progress >= 1) {
        this.group.remove(item.mesh); item.mesh.material.dispose(); this.items.splice(i, 1); continue;
      }
      if (item.ring) item.mesh.scale.setScalar(1 + progress * 3);
      else if (item.flash) item.mesh.scale.setScalar(2 + Math.sin(item.age * 22) * .8);
      else {
        item.velocity.y -= elapsed * 2.4;
        item.mesh.position.addScaledVector(item.velocity, elapsed);
        item.mesh.rotation.x += elapsed * 5; item.mesh.rotation.z += elapsed * 3;
      }
      item.mesh.material.opacity = Math.min(1, (1 - progress) * 2);
    }
    if (this.pop) {
      this.pop.age += elapsed;
      if (this.pop.age >= this.pop.life) { this.pop = null; this.label.hidden = true; }
      else {
        const position = this.pop.position.clone().add(new THREE.Vector3(0, 1.5 + this.pop.age * .22, 0)).project(this.world.camera);
        const rect = this.world.renderer.domElement.getBoundingClientRect();
        this.label.style.left = `${THREE.MathUtils.clamp((position.x + 1) * .5, .15, .85) * rect.width}px`;
        this.label.style.top = `${THREE.MathUtils.clamp((1 - position.y) * .5, .28, .8) * rect.height}px`;
        this.label.style.opacity = Math.min(1, (this.pop.life - this.pop.age) * 2);
      }
    }
  }
}
