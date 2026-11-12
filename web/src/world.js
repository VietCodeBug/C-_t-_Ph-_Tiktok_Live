import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const MODEL_NAMES = ['house_mint', 'house_blue', 'market_tent', 'street_stall', 'street_tree', 'bush_ball', 'flower_cart', 'street_umbrella', 'bench', 'lamp_street', 'plant_pot', 'market_banner', 'warehouse_a', 'warehouse_b', 'loading_dock', 'stack_boxes', 'delivery_gate', 'traffic_cone', 'gate_start', 'podium_1', 'trophy_gold'];
const TILE_TYPES = [
  { name: 'GA PHỐ', icon: '✦', color: '#e8bb4e' },
  { name: 'NHẶT XU', icon: '+', color: '#5fa88a' },
  { name: 'ĐỜI SỐNG', icon: '♡', color: '#c78299' },
  { name: 'KINH DOANH', icon: '▥', color: '#6d9bcb' },
  { name: 'SỰ CỐ', icon: '!', color: '#d48b6d' },
  { name: 'MINI GAME', icon: '★', color: '#9b8ac1' }
];

// Batch flat-color static geometry without editing the original GLB files.
function batch(root) {
  root.updateMatrixWorld(true);
  const geometries = [];
  root.traverse(o => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    const source = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    source.applyMatrix4(o.matrixWorld);
    if (!o.matrixWorld.elements.every(Number.isFinite)) throw new Error('Invalid asset transform: ' + o.name);
    if (!source.attributes.normal) source.computeVertexNormals();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', source.attributes.position.clone());
    geometry.setAttribute('normal', source.attributes.normal.clone());
    const colors = new Float32Array(source.attributes.position.count * 3);
    const vertex = source.attributes.color;
    const factor = o.material.color || new THREE.Color(1, 1, 1);
    for (let i = 0; i < source.attributes.position.count; i++) {
      colors[i * 3] = (vertex ? vertex.getX(i) : 1) * factor.r;
      colors[i * 3 + 1] = (vertex ? vertex.getY(i) : 1) * factor.g;
      colors[i * 3 + 2] = (vertex ? vertex.getZ(i) : 1) * factor.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometries.push(geometry);
    source.dispose();
  });
  const merged = mergeGeometries(geometries, false);
  if (!merged) throw new Error('Could not batch map geometry');
  geometries.forEach(g => g.dispose());
  const mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .86, metalness: 0 }));
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

export class TownWorld {
  constructor(canvas, base) {
    this.base = base;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#dce9e6');
    this.scene.fog = new THREE.Fog('#dce9e6', 34, 80);
    this.camera = new THREE.PerspectiveCamera(42, 9 / 16, .07, 150);
    this.camera.position.set(0, 31, 20);
    this.lookAt = new THREE.Vector3(0, .2, 0);
    this.camera.lookAt(this.lookAt);
    this.scene.add(new THREE.HemisphereLight(0xf3faf9, 0x778968, 2.2));
    this.sun = new THREE.DirectionalLight(0xfff0d3, 3.2);
    this.sun.position.set(-12, 22, 10);
    this.sun.castShadow = true;
    Object.assign(this.sun.shadow.camera, { left: -19, right: 19, top: 21, bottom: -21, near: 1, far: 65 });
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.bias = -.0006;
    this.sun.shadow.normalBias = .025;
    this.scene.add(this.sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#d1dfca', roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -.75;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.town = new THREE.Group();
    this.scene.add(this.town);
    this.playerGroup = new THREE.Group();
    this.scene.add(this.playerGroup);
    this.activeRing = new THREE.Mesh(new THREE.TorusGeometry(.39, .027, 8, 48), new THREE.MeshBasicMaterial({ color: '#ffcd63' }));
    this.activeRing.rotation.x = -Math.PI / 2;
    this.scene.add(this.activeRing);
    this.loader = new GLTFLoader();
    this.models = new Map();
    this.mapCache = new Map();
    this.occluders = [];
    this.ray = new THREE.Raycaster();
    this.overviewYaw = 0;
    this.zoom = 1;
    this.followHeading = new THREE.Vector3(0, 0, -1);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    this.resize();
  }

  resize() {
    const rect = this.renderer.domElement.parentElement.getBoundingClientRect();
    this.renderer.setSize(rect.width, rect.height, false);
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
  }

  async loadModels(progress) {
    let count = 0;
    await Promise.all(MODEL_NAMES.map(async name => {
      const gltf = await this.loader.loadAsync(this.base + 'models/' + name + '.glb');
      this.models.set(name, batch(gltf.scene));
      progress?.(++count / MODEL_NAMES.length);
    }));
  }

  async loadMap(layout) {
    if (!this.mapCache.has(layout.file)) {
      const gltf = await this.loader.loadAsync(this.base + 'maps/' + layout.file);
      this.mapCache.set(layout.file, batch(gltf.scene));
    }
    const cachedGeometry = new Set([...this.models.values(), ...this.mapCache.values()].map(m => m.geometry));
    const cachedMaterials = new Set([...this.models.values(), ...this.mapCache.values()].map(m => m.material));
    const retiredTextures = new Set();
    this.town.traverse(o => {
      if (!o.isMesh) return;
      if (!cachedGeometry.has(o.geometry)) o.geometry.dispose();
      if (!cachedMaterials.has(o.material)) {
        if (o.material.map) retiredTextures.add(o.material.map);
        o.material.dispose();
      }
    });
    retiredTextures.forEach(texture => texture.dispose());
    this.town.clear();
    this.occluders = [];
    const floor = this.mapCache.get(layout.file).clone();
    this.town.add(floor);
    const staticDecor = new THREE.Group();
    const delivery = layout.file.startsWith('pho');
    const add = (name, x, z, scale = 1, yaw = 0, y = 0, fade = false) => {
      const original = this.models.get(name);
      if (!original) return;
      const prop = original.clone();
      prop.position.set(x, y, z);
      prop.scale.setScalar(scale);
      prop.rotation.y = yaw;
      if (fade) {
        prop.material = original.material.clone();
        prop.material.transparent = true;
        this.occluders.push(prop);
        this.town.add(prop);
      } else staticDecor.add(prop);
      return prop;
    };
    // Keep the central branch lanes clear; use the source pack's modular buildings.
    for (const sign of [-1, 1]) {
      const z = sign * 8.1;
      if (delivery) {
        add('warehouse_a', -.95, z, .82, sign < 0 ? Math.PI : 0, 0, true);
        add('warehouse_b', 1.05, z, .78, sign < 0 ? Math.PI : 0, 0, true);
        add('stack_boxes', 0, z - sign * 1.5, .8);
        add('loading_dock', -.7, z + sign * 1.1, .7);
      } else {
        add('house_mint', -.95, z, .83, sign < 0 ? Math.PI : 0, 0, true);
        add('house_blue', 1.02, z + .16, .8, sign < 0 ? Math.PI : 0, 0, true);
        add('market_tent', -.82, sign * 6.15, .63, sign < 0 ? Math.PI : 0, 0, true);
        add('street_stall', .82, sign * 6.2, .75, 0, 0, true);
        add('street_umbrella', .85, sign * 7.0, .68);
      }
      add('flower_cart', 0, sign * 4.1, .49, Math.PI / 2);
      add('bench', 0, sign * 2.0, .62, Math.PI / 2);
      add('plant_pot', 0, sign * 3.0, .6);
      for (const side of [-1, 1]) {
        for (const zz of [2.3, 6, 9.7, 12.1]) {
          add('street_tree', side * (delivery ? 6.55 : 6.0), sign * zz, .8 + (zz % 1) * .25);
          if (zz !== 12.1) add('bush_ball', side * (delivery ? 6.5 : 5.95), sign * (zz + .7), .7);
        }
        add('lamp_street', side * (delivery ? 5.65 : 5.15), sign * 7.0, .65);
      }
    }
    add('bush_ball', 0, 0, .75);
    add('plant_pot', 0, .7, .65);
    add('plant_pot', 0, -.7, .65);
    // A few edge houses frame the skyline in the third-person camera.
    for (const sign of [-1, 1]) {
      for (let j = 0; j < 5; j++) {
        const z = -10 + j * 5;
        add(delivery ? (j % 2 ? 'warehouse_b' : 'warehouse_a') : (j % 2 ? 'house_mint' : 'house_blue'), sign * 8.3, z, .85, -sign * Math.PI / 2, -.7, true);
      }
    }
    for (const n of layout.nodes.filter(n => n.station)) {
      add(delivery ? 'delivery_gate' : 'gate_start', n.position[0], n.position[2] - .7, .7, 0, 0, true);
    }
    if (staticDecor.children.length) this.town.add(batch(staticDecor));
    this.addTileLabels(layout);
    this.renderer.shadowMap.needsUpdate = true;
  }

  addTileLabels(layout) {
    this.types = {};
    const textures = new Map();
    for (const n of layout.nodes) {
      const index = n.station ? 0 : (Number(n.id.replace(/\D/g, '')) % 5) + 1;
      const type = TILE_TYPES[index];
      this.types[n.id] = type;
      if (!textures.has(index)) {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
        const c = canvas.getContext('2d');
        c.textAlign = 'center'; c.fillStyle = type.color;
        c.font = '800 42px sans-serif'; c.fillText(type.name, 256, 128);
        c.font = '700 150px sans-serif'; c.fillText(type.icon, 256, 310);
        const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
        textures.set(index, texture);
      }
      const label = new THREE.Mesh(new THREE.PlaneGeometry(1.58, 1.58), new THREE.MeshBasicMaterial({ map: textures.get(index), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      label.rotation.x = -Math.PI / 2;
      label.position.set(n.position[0], .022, n.position[2]);
      this.town.add(label);
    }
  }

  updateCamera(dt, actor, mode, isOverview) {
    const overview = mode === 'overview' || (mode === 'auto' && isOverview);
    const destination = new THREE.Vector3();
    const target = new THREE.Vector3();
    if (overview) {
      const radius = 19 * this.zoom;
      destination.set(Math.sin(this.overviewYaw) * radius, 36 * this.zoom, Math.cos(this.overviewYaw) * 24 * this.zoom);
      target.set(0, .15, 0);
    } else {
      this.followHeading.lerp(actor.heading, 1 - Math.exp(-dt * 3.5)).normalize();
      if (this.followHeading.lengthSq() < .1) this.followHeading.set(0, 0, -1);
      destination.copy(actor.position).addScaledVector(this.followHeading, -3.8 * this.zoom);
      destination.y += 2.9 * this.zoom;
      target.copy(actor.position).addScaledVector(this.followHeading, 1.1);
      target.y += .58;
    }
    this.camera.position.lerp(destination, 1 - Math.exp(-dt * (overview ? 2.6 : 3.4)));
    this.lookAt.lerp(target, 1 - Math.exp(-dt * 3.8));
    this.camera.lookAt(this.lookAt);
    this.camera.updateMatrixWorld();
    this.activeRing.position.copy(actor.position);
    this.activeRing.position.y = .042;
    this.activeRing.visible = true;
    this.activeRing.scale.setScalar(1 + Math.sin(performance.now() * .003) * .055);
    this.checkOcclusion(actor, dt, overview);
    return overview ? 'overview' : 'follow';
  }

  checkOcclusion(actor, dt, overview) {
    this.occlusionTime = (this.occlusionTime || 0) + dt;
    if (this.occlusionTime > .12) {
      this.occlusionTime = 0;
      const from = actor.position.clone().add(new THREE.Vector3(0, .65, 0));
      const toward = this.camera.position.clone().sub(from);
      this.ray.set(from, toward.clone().normalize());
      this.ray.far = toward.length();
      this.hiddenProps = new Set(overview ? [] : this.ray.intersectObjects(this.occluders, false).map(x => x.object));
    }
    for (const mesh of this.occluders) {
      const target = this.hiddenProps?.has(mesh) ? .18 : 1;
      mesh.material.opacity = THREE.MathUtils.damp(mesh.material.opacity, target, 9, dt);
      mesh.material.depthWrite = mesh.material.opacity > .96;
    }
  }

  render() { this.renderer.render(this.scene, this.camera); }

  screenshot() {
    const size = this.renderer.getSize(new THREE.Vector2());
    const ratio = this.renderer.getPixelRatio();
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(1080, 1920, false);
    this.camera.aspect = 9 / 16; this.camera.updateProjectionMatrix();
    this.render();
    const url = this.renderer.domElement.toDataURL('image/png');
    this.renderer.setPixelRatio(ratio); this.renderer.setSize(size.x, size.y, false);
    this.camera.aspect = size.x / size.y; this.camera.updateProjectionMatrix();
    const link = document.createElement('a'); link.href = url; link.download = 'Co-Ty-Phi-camera-1080x1920.png'; link.click();
  }
}
