import * as THREE from 'three';
import { loadImage, spriteImageScale } from './sprites.js';
import { drawFrontIdle } from './front-art.js';

const identity = person => String(person.userId || person.id || person.seat || '');

// Keep a customer's place stable when the front of the queue is promoted.
// All waiting users remain represented; overflow gets smaller, closely spaced
// billboards in the same courtyards instead of extra animation controllers.
export function planWaitingCrowd(layout, people, previous = new Map()) {
  const areas = (layout?.waitingAreas || []).filter(area => area.slots?.length);
  if (!areas.length) return { people: [], assignments: new Map(), groups: [] };
  const unique = new Map();
  for (const person of people || []) if (identity(person) && person.present !== false && person.enrolled !== false) unique.set(identity(person), person);
  const assignments = new Map(), used = new Set();
  for (const id of unique.keys()) {
    const slot = previous.get(id);
    if (Number.isInteger(slot) && slot >= 0 && !used.has(slot)) { assignments.set(id, slot); used.add(slot); }
  }
  let free = 0;
  for (const id of unique.keys()) if (!assignments.has(id)) {
    while (used.has(free)) free++;
    assignments.set(id, free); used.add(free);
  }
  const capacity = areas.reduce((sum, area) => sum + area.slots.length, 0);
  const scale = 1 / Math.sqrt(Math.max(1, Math.ceil(unique.size / capacity)));
  const groups = areas.map(area => ({ id: area.id, name: area.name || 'Khách chờ', position: [...area.position], count: 0 }));
  const planned = [...unique].map(([id, person]) => {
    const number = assignments.get(id), areaIndex = number % areas.length, area = areas[areaIndex];
    const within = Math.floor(number / areas.length), slot = within % area.slots.length, layer = Math.floor(within / area.slots.length);
    const position = [...area.slots[slot]];
    if (layer) {
      const angle = layer * 2.399963229728653;
      const radius = Math.min(.24, .09 * Math.sqrt(layer));
      position[0] += Math.cos(angle) * radius; position[2] += Math.sin(angle) * radius;
    }
    groups[areaIndex].count++;
    return { ...person, id, position, scale, areaId: area.id, slot: number, actorIndex: Math.max(0, Number(person.actorIndex) || 0) % 20 };
  });
  return { people: planned, assignments, groups: groups.filter(group => group.count) };
}

export class WaitingCrowd {
  constructor(world, pack, base) {
    this.world = world; this.pack = pack; this.base = base; this.assignments = new Map(); this.badges = new Map(); this.count = 0;
    this.group = new THREE.Group(); this.group.name = 'Customers waiting in neighborhood courtyards'; world.scene.add(this.group);
    this.ready = null; this.key = ''; this.clock = 0; this.people = [];
  }

  async init() {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      const cell = 256, columns = 5, rows = 4;
      const canvas = document.createElement('canvas'); canvas.width = cell * columns; canvas.height = cell * rows;
      const context = canvas.getContext('2d');
      const images = await Promise.all(this.pack.actors.map(async actor => ({
        sheet: await loadImage(this.base + actor.animations.idle.image, { atlas: true }),
        front: actor.frontIdle ? await loadImage(this.base + actor.frontIdle.image) : null
      })));
      this.pack.actors.forEach((actor, index) => {
        context.save(); context.translate(index % columns * cell, Math.floor(index / columns) * cell);
        if (images[index].front) drawFrontIdle(context, images[index].front, actor.frontIdle);
        else {
          const frame = actor.animations.idle.directions.S[0], scale = spriteImageScale(images[index].sheet);
          const [x, y, w, h] = frame.rect;
          context.drawImage(images[index].sheet, x * scale, y * scale, w * scale, h * scale, 0, 0, cell, cell);
        }
        context.restore();
      });
      this.texture = new THREE.CanvasTexture(canvas); this.texture.colorSpace = THREE.SRGBColorSpace;
      this.texture.generateMipmaps = false; this.texture.minFilter = this.texture.magFilter = THREE.LinearFilter;
      const geometry = new THREE.PlaneGeometry(1, 1), capacity = 1000;
      geometry.setAttribute('instanceUv', new THREE.InstancedBufferAttribute(new Float32Array(capacity * 2), 2));
      geometry.setAttribute('instanceScale', new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1));
      this.material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: true,
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { atlas: { value: this.texture }, grid: { value: new THREE.Vector2(columns, rows) }, time: { value: 0 } }]),
        vertexShader: `
          attribute vec2 instanceUv;
          attribute float instanceScale;
          uniform vec2 grid;
          uniform float time;
          varying vec2 sheetUv;
          #include <fog_pars_vertex>
          void main() {
            sheetUv = uv / grid + instanceUv;
            vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            float breath = 1.0 + sin(time * 2.0 + instanceUv.x * 19.0 + instanceUv.y * 7.0) * 0.008;
            mvPosition.xy += vec2(position.x, (position.y + 0.3515625) * breath) * 1.42 * instanceScale;
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
          }`,
        fragmentShader: `
          uniform sampler2D atlas;
          varying vec2 sheetUv;
          #include <fog_pars_fragment>
          void main() {
            vec4 pixel = texture2D(atlas, sheetUv);
            if (pixel.a < 0.08) discard;
            gl_FragColor = pixel;
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
            #include <fog_fragment>
          }`
      });
      this.mesh = new THREE.InstancedMesh(geometry, this.material, capacity); this.mesh.count = 0;
      this.mesh.name = 'Waiting customers · shared chibi atlas'; this.mesh.frustumCulled = false; this.mesh.renderOrder = 1;
      this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.group.add(this.mesh);
      const shadowGeometry = new THREE.CircleGeometry(.17, 10); shadowGeometry.rotateX(-Math.PI / 2);
      this.shadows = new THREE.InstancedMesh(shadowGeometry, new THREE.MeshBasicMaterial({ color: '#314c31', transparent: true, opacity: .13, depthWrite: false }), capacity);
      this.shadows.count = 0; this.shadows.frustumCulled = false; this.group.add(this.shadows);
    })();
    return this.ready;
  }

  badge(id) {
    if (this.badges.has(id)) return this.badges.get(id);
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 72;
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false }));
    sprite.renderOrder = 130; sprite.scale.set(2.25, .51, 1); this.group.add(sprite);
    const badge = { canvas, texture, sprite, text: '' }; this.badges.set(id, badge); return badge;
  }

  drawBadge(id, label, position) {
    const badge = this.badge(id); badge.sprite.visible = true; badge.sprite.position.fromArray(position); badge.sprite.position.y += 1.65;
    if (badge.text !== label) {
      badge.text = label; const c = badge.canvas.getContext('2d'); c.clearRect(0, 0, 320, 72);
      c.fillStyle = '#294f3de8'; c.beginPath(); c.roundRect(4, 5, 312, 61, 17); c.fill();
      c.strokeStyle = '#d5ba78'; c.lineWidth = 2; c.stroke(); c.fillStyle = '#f6e7ba';
      c.font = '900 27px Nunito Variable, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, 160, 37, 292);
      badge.texture.needsUpdate = true;
    }
  }

  async setPeople(layout, people) {
    const key = `${layout?.id}:${layout?.seed}:` + (people || []).map(person => `${identity(person)}:${person.actorIndex}`).join('|');
    if (key === this.key) return;
    if (!people?.length) {
      this.key = key; this.people = []; this.assignments.clear(); this.count = 0;
      if (this.mesh) this.mesh.count = this.shadows.count = 0;
      this.badges.forEach(badge => { badge.sprite.visible = false; }); return;
    }
    await this.init();
    const plan = planWaitingCrowd(layout, people, this.assignments);
    this.key = key; this.people = plan.people.slice(0, 1000); this.assignments = plan.assignments; this.count = this.people.length;
    this.mesh.count = this.shadows.count = this.count;
    const matrix = new THREE.Matrix4(), shadowMatrix = new THREE.Matrix4();
    const offsets = this.mesh.geometry.getAttribute('instanceUv'), scales = this.mesh.geometry.getAttribute('instanceScale');
    this.people.forEach((person, index) => {
      matrix.makeTranslation(person.position[0], person.position[1] + .025, person.position[2]); this.mesh.setMatrixAt(index, matrix);
      shadowMatrix.makeScale(person.scale, 1, person.scale); shadowMatrix.setPosition(person.position[0], person.position[1] + .018, person.position[2]); this.shadows.setMatrixAt(index, shadowMatrix);
      offsets.setXY(index, person.actorIndex % 5 / 5, (3 - Math.floor(person.actorIndex / 5)) / 4); scales.setX(index, person.scale);
    });
    this.mesh.instanceMatrix.needsUpdate = this.shadows.instanceMatrix.needsUpdate = offsets.needsUpdate = scales.needsUpdate = true;
    this.badges.forEach(badge => { badge.sprite.visible = false; });
    for (const group of plan.groups) this.drawBadge(group.id, `KHÁCH CHỜ · ${group.count}`, group.position);
  }

  update(dt, state) {
    if (!state?.paused) this.clock += dt;
    if (this.material) this.material.uniforms.time.value = this.clock;
    const focus = state?.spotlight?.queued && this.people.find(person => person.seat === state.spotlight.seat);
    const badge = this.badges.get('focused-customer'); if (badge) badge.sprite.visible = false;
    if (focus) this.drawBadge('focused-customer', `${focus.seat} · ${focus.name || 'Khách chờ'}`, focus.position);
  }
  snapshot() { return { count: this.count, drawBatches: this.count ? 2 : 0, people: this.people.map(person => ({ id: person.id, seat: person.seat, areaId: person.areaId, position: [...person.position] })) }; }
  dispose() {
    this.world.scene.remove(this.group); this.mesh?.geometry.dispose(); this.material?.dispose(); this.texture?.dispose();
    this.shadows?.geometry.dispose(); this.shadows?.material.dispose();
    this.badges.forEach(badge => { badge.texture.dispose(); badge.sprite.material.dispose(); }); this.group.clear();
  }
}
