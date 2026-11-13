import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildNeighborhood } from './neighborhood.js';
import {waitingSlotConflicts} from './waiting-areas.js';

const MODEL_NAMES = ['house_mint', 'house_blue', 'market_tent', 'street_stall', 'street_tree', 'bush_ball', 'flower_cart', 'street_umbrella', 'bench', 'lamp_street', 'plant_pot', 'market_banner', 'warehouse_a', 'warehouse_b', 'loading_dock', 'stack_boxes', 'delivery_gate', 'traffic_cone', 'gate_start', 'podium_1', 'trophy_gold', 'stool_plastic', 'trash_can', 'grass_patch'];
const TILE_TYPES = [
  { name: 'GA PHỐ', icon: '✦', color: '#9c7334', category: 'station' },
  { name: 'NHẶT TIỀN', icon: '+', color: '#4d8060', category: 'gain' },
  { name: 'MẤT TIỀN', icon: '−', color: '#b56e58', category: 'loss' },
  { name: 'CHUYỆN PHỐ', icon: '?', color: '#9a769e', category: 'event' },
  { name: 'ĐẦU TƯ', icon: '↗', color: '#668892', category: 'invest' },
  { name: 'BUÔN BÁN', icon: '▥', color: '#a67e42', category: 'trade' },
  { name: 'NGHỈ CHÂN', icon: '·', color: '#7d8c6e', category: 'rest' },
  { name: 'MINI GAME', icon: '★', color: '#8c7ba1', category: 'minigame' }
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
  const mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92, metalness: 0, side: THREE.DoubleSide }));
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

export class TownWorld {
  constructor(canvas, base) {
    this.base = base;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#cbded5');
    this.scene.fog = new THREE.Fog('#cbded5', 90, 185);
    this.camera = new THREE.PerspectiveCamera(45, 9 / 16, .08, 440);
    this.camera.position.set(0, 59, 31);
    this.lookAt = new THREE.Vector3(0, .2, 0);
    this.camera.lookAt(this.lookAt);
    this.scene.add(new THREE.HemisphereLight(0xf5f0d9, 0x667858, 2.0));
    this.sun = new THREE.DirectionalLight(0xffe1ae, 2.5);
    this.sun.position.set(-38, 66, 28);
    this.sun.castShadow = true;
    Object.assign(this.sun.shadow.camera, { left: -65, right: 65, top: 72, bottom: -72, near: 1, far: 190 });
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -.0003;
    this.sun.shadow.normalBias = .035;
    this.sun.shadow.radius = 3;
    this.scene.add(this.sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#9eae83', roughness: 1 }));
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
    const cachedGeometry = new Set([...this.models.values()].map(m => m.geometry));
    const cachedMaterials = new Set([...this.models.values()].map(m => m.material));
    const oldGeometry = new Set(), oldMaterials = new Set(), oldTextures = new Set();
    this.town.traverse(o => {
      if (o.geometry && !cachedGeometry.has(o.geometry)) oldGeometry.add(o.geometry);
      for (const material of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!material || cachedMaterials.has(material)) continue;
        oldMaterials.add(material); if (material.map) oldTextures.add(material.map);
      }
    });
    oldTextures.forEach(t => t.dispose()); oldMaterials.forEach(m => m.dispose()); oldGeometry.forEach(g => g.dispose());
    this.town.clear(); this.occluders = []; this.hiddenProps = new Set();
    this.waitingSolidBounds=[];
    this.acceptSceneryPlacement=(object,name)=>{
      if(!layout.waitingAreas?.length)return true;
      object.updateMatrixWorld(true);
      const bounds=new THREE.Box3().setFromObject(object);
      if(bounds.isEmpty()||bounds.max.y<=.08||bounds.min.y>1.8)return true;
      const footprint={name,minX:bounds.min.x,maxX:bounds.max.x,minZ:bounds.min.z,maxZ:bounds.max.z,minY:bounds.min.y,maxY:bounds.max.y};
      if(waitingSlotConflicts(layout,footprint).length)return false;
      this.waitingSolidBounds.push(footprint);return true;
    };
    const staticDecor = new THREE.Group();
    const add = (name, x, z, scale = 1, yaw = 0, y = 0, fade = false) => {
      const original = this.models.get(name); if (!original) return;
      const prop = original.clone(); prop.position.set(x, y, z); prop.scale.setScalar(scale); prop.rotation.y = yaw;
      if(!this.acceptSceneryPlacement(prop,name))return;
      if (fade) {
        prop.material = original.material.clone(); prop.material.transparent = true;
        // These opaque-color buildings only use transparency to reveal a racer.
        // A single double-sided pass avoids drawing every facade twice.
        prop.material.forceSinglePass = true;
        this.occluders.push(prop); this.town.add(prop);
      } else staticDecor.add(prop);
      return prop;
    };
    const scenery = buildNeighborhood(this, layout, add, staticDecor);
    this.layout = layout;
    this.bounds = scenery.bounds;
    if (staticDecor.children.length) {
      const baked = batch(staticDecor); baked.name = 'Batched roads, gardens and street furniture'; this.town.add(baked);
      const transient = new Set(); staticDecor.traverse(o => { if (o.userData.transientGeometry) transient.add(o.geometry); });
      transient.forEach(g => g.dispose()); scenery.transientMaterials.forEach(m => m.dispose());
    }
    this.addTileLabels(layout);
    this.town.updateMatrixWorld(true);
    this.renderer.shadowMap.needsUpdate = true;
    this.scene.userData.mapSeed = layout.seed;
    this.scene.userData.nodeCount = layout.nodes.length;
    this.scene.userData.waitingAreaCount=layout.waitingAreas?.length??0;
    this.scene.userData.waitingSlotCount=layout.waitingAreas?.reduce((total,area)=>total+area.slots.length,0)??0;
    this.scene.userData.waitingSolidBounds=this.waitingSolidBounds;
    this.scene.userData.waitingCollisionCount=this.waitingSolidBounds.reduce((count,bounds)=>count+waitingSlotConflicts(layout,bounds).length,0);
  }

  addTileLabels(layout) {
    this.types = {};
    const textures = new Map();
    const planes = new Map();
    for (const n of layout.nodes) {
      const index = n.station ? 0 : n.typeIndex ?? n.eventIndex ?? (Number(n.id.replace(/\D/g, '')) % 5) + 1;
      const type = TILE_TYPES[index] || TILE_TYPES[2];
      this.types[n.id] = type;
      if (!textures.has(index)) {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
        const c = canvas.getContext('2d');
        c.textAlign = 'center'; c.fillStyle = type.color;
        if (index !== 6) {
          c.font = '900 20px Nunito Variable, sans-serif'; c.fillText(type.name, 128, 53);
          c.font = '800 92px sans-serif'; c.fillText(type.icon, 128, 165);
        } else {
          // Quiet stops have no event badge: leave space for the neighborhood.
          c.globalAlpha = .7; c.font = '700 26px sans-serif'; c.fillText('·  ·  ·',128,140);
        }
        const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
        textures.set(index, texture);
      }
      const geometry=new THREE.PlaneGeometry(1.25,1.25);
      geometry.rotateX(-Math.PI/2);geometry.rotateY(n.yaw??0);geometry.translate(n.position[0],.043,n.position[2]);
      if(!planes.has(index))planes.set(index,[]);planes.get(index).push(geometry);
    }
    for(const[index,geometries]of planes){
      const geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());
      const label=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:textures.get(index),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));
      label.name=`Batched tile labels ${index}`;this.town.add(label);
    }
  }

  updateCamera(dt, actor, mode, isOverview, forkNode = null) {
    const overview = !!forkNode || mode === 'overview' || (mode === 'auto' && isOverview);
    const destination = new THREE.Vector3();
    const target = new THREE.Vector3();
    if (forkNode) {
      const nearby = this.layout.nodes.filter(n => forkNode.next.includes(n.id));
      const centroid = nearby.reduce((sum,n)=>sum.add(new THREE.Vector3().fromArray(n.position)),new THREE.Vector3()).multiplyScalar(1/Math.max(nearby.length,1));
      target.copy(actor.position).lerp(centroid,.7);
      target.y = .1;
      destination.copy(target).add(new THREE.Vector3(0,14,11));
      this.scene.fog.near=75; this.scene.fog.far=180;
    } else if (overview) {
      const b = this.bounds || { minX: -6, maxX: 6, minZ: -12, maxZ: 12 };
      const halfWidth = (b.maxX - b.minX) / 2 + 3.1, halfLength = (b.maxZ - b.minZ) / 2 + 3.1;
      const tangent = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
      target.set((b.minX + b.maxX) / 2 + .7, 0, (b.minZ + b.maxZ) / 2);
      const direction = new THREE.Vector3(Math.sin(this.overviewYaw) * .45, .91, Math.cos(this.overviewYaw) * .49).normalize();
      const right = new THREE.Vector3(direction.z, 0, -direction.x).normalize();
      const up = new THREE.Vector3().crossVectors(direction, right).normalize();
      let fit = 0;
      for (const x of [-halfWidth, halfWidth]) for (const z of [-halfLength, halfLength]) {
        const corner = new THREE.Vector3(x, 0, z), depth = corner.dot(direction);
        fit = Math.max(fit, depth + Math.abs(corner.dot(right)) / (tangent * this.camera.aspect), depth + Math.abs(corner.dot(up)) / tangent);
      }
      const distance = fit * 1.04 * this.zoom;
      this.scene.fog.near = distance + 18;
      this.scene.fog.far = distance + 140;
      destination.copy(target).addScaledVector(direction, distance);
      target.z -= 1.5;
    } else {
      this.scene.fog.near = 75;
      this.scene.fog.far = 180;
      this.followHeading.lerp(actor.heading, 1 - Math.exp(-dt * 3.5)).normalize();
      if (this.followHeading.lengthSq() < .1) this.followHeading.set(0, 0, -1);
      destination.copy(actor.position).addScaledVector(this.followHeading, -4.6 * this.zoom);
      destination.y += 3.35 * this.zoom;
      target.copy(actor.position).addScaledVector(this.followHeading, 1.1);
      target.y += .58;
    }
    this.camera.position.lerp(destination, 1 - Math.exp(-dt * (overview ? 2.6 : 3.4)));
    this.lookAt.lerp(target, 1 - Math.exp(-dt * 3.8));
    this.camera.lookAt(this.lookAt);
    this.camera.updateMatrixWorld();
    this.activeRing.position.copy(actor.position);
    this.activeRing.position.y = .085;
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
    const link = document.createElement('a'); link.href = url; link.download = 'Co-Ty-Phi-khu-pho-1080x1920.png'; link.click();
  }
}
