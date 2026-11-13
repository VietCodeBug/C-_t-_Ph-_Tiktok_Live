import * as THREE from 'three';
import {graphSegments,riverAt} from './waiting-areas.js';
export {graphSegments} from './waiting-areas.js';

// One seed drives scenery as well as the playable graph: a round can be replayed.
function randomFor(seed) {
  let state = Number(seed) || 137;
  return () => {
    state |= 0; state = state + 0x6d2b79f5 | 0;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function pointSegment(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[2] - a[2];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - a[0] - t * dx, z - a[2] - t * dz);
}

export function buildNeighborhood(world, layout, add, decor) {
  const random = randomFor(layout.seed);
  const nodes = layout.nodes;
  const bounds = layout.bounds || {
    minX: Math.min(...nodes.map(n => n.position[0])), maxX: Math.max(...nodes.map(n => n.position[0])),
    minZ: Math.min(...nodes.map(n => n.position[2])), maxZ: Math.max(...nodes.map(n => n.position[2]))
  };
  const segments = graphSegments(layout);
  const roadDistance = (x, z) => Math.min(...segments.map(([a, b]) => pointSegment(x, z, a, b)));
  const occupied = (layout.waitingAreas||[]).map(area=>({x:area.position[0],z:area.position[2],radius:area.reserveRadius,kind:'waiting'}));
  const waitingPaths=(layout.waitingAreas||[]).map(area=>area.path);
  const clear = (x, z, radius = 1) => roadDistance(x, z) > radius + 1.15 && occupied.every(lot => Math.hypot(lot.x - x, lot.z - z) > lot.radius + radius)
    &&waitingPaths.every(([a,b])=>pointSegment(x,z,a,b)>radius+.5);
  const reserve = (x, z, radius) => occupied.push({ x, z, radius });
  const materials = new Map();
  const material = color => {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .94 }));
    return materials.get(color);
  };
  const mesh = (geometry, color, x, y, z, sx = 1, sy = 1, sz = 1, yaw = 0) => {
    const result = new THREE.Mesh(geometry, material(color));
    result.position.set(x, y, z); result.scale.set(sx, sy, sz); result.rotation.y = yaw;
    result.userData.transientGeometry = true;
    if(world.acceptSceneryPlacement&&!world.acceptSceneryPlacement(result,'procedural')){geometry.dispose();return null;}
    decor.add(result); return result;
  };
  const box = (x, y, z, w, h, d, color, yaw = 0) => mesh(new THREE.BoxGeometry(w, h, d), color, x, y, z, 1, 1, 1, yaw);
  const disk = (x, y, z, radius, height, color, count = 32) => mesh(new THREE.CylinderGeometry(radius, radius, height, count), color, x, y, z);
  const strip = (a, b, width, height, y, color) => {
    const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
    if (length < .001) return;
    return box((a[0] + b[0]) / 2, y, (a[2] + b[2]) / 2, width, height, length, color, Math.atan2(b[0] - a[0], b[2] - a[2]));
  };

  // An unbroken street surface joins graph nodes. Event tiles are insets in the
  // street, leaving the town readable as a place instead of a floating board.
  for (const [a, b] of segments) {
    strip(a, b, 2.75, .11, -.13, '#c5bba6');
    strip(a, b, 2.26, .07, -.045, '#e1d7be');
  }
  for (const node of nodes) {
    const [x, , z] = node.position;
    disk(x, -.13, z, 1.375, .11, '#c5bba6', 20);
    disk(x, -.045, z, 1.13, .07, '#e1d7be', 20);
    const colors = ['#e8d6a4', '#c5d9b5', '#e0bca7', '#d5c6db', '#b5cdd2', '#dfc89d', '#d4d7bc', '#cec7e2'];
    const index = node.station ? 0 : node.typeIndex ?? node.eventIndex ?? (Number(node.id.replace(/\D/g, '')) % 5) + 1;
    const yaw=node.yaw??0;
    box(x, .0075, z, 1.4, .065, 1.4, index===6?'#ded5bd':colors[index],yaw);
    // A slim embedded curb is enough to distinguish a playable stop.
    for (const sign of [-1, 1]) box(x + Math.cos(yaw)*sign*.68, .045, z-Math.sin(yaw)*sign*.68, .035, .035, 1.36, '#f7f0db',yaw);
  }

  const width = bounds.maxX - bounds.minX, length = bounds.maxZ - bounds.minZ;
  const centerX = (bounds.maxX + bounds.minX) / 2, centerZ = (bounds.maxZ + bounds.minZ) / 2;
  const riverCenter = z => riverAt({...layout,bounds},z).center;
  const waterWidth = layout.theme === 'riverside' ? 5.2 : 3.7;
  const riverStart = bounds.minZ - 35, riverEnd = bounds.maxZ + 35;
  function ribbon(halfWidth, color, y, water = false) {
    const positions = [], colors = [], indices = [];
    for (let i = 0; i <= 100; i++) {
      const z = riverStart + (riverEnd - riverStart) * i / 100;
      const cx = riverCenter(z);
      for (const side of [-1, 1]) {
        positions.push(cx + side * halfWidth, y, z);
        const c = new THREE.Color(color).multiplyScalar(.96 + Math.sin(i * .8) * .025);
        colors.push(c.r, c.g, c.b);
      }
      if (i < 100) { const at = i * 2; indices.push(at, at + 2, at + 1, at + 1, at + 2, at + 3); }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: water ? .28 : 1, metalness: water ? .16 : 0, side: THREE.DoubleSide });
    const object = new THREE.Mesh(geometry, mat); object.receiveShadow = true;
    world.town.add(object); return object;
  }
  ribbon(waterWidth / 2 + 1.3, '#acae88', -.17);
  ribbon(waterWidth / 2 + .55, '#d4c29b', -.145);
  const water = ribbon(waterWidth / 2, '#589d99', -.12, true);
  water.name = 'Curved neighborhood canal';
  // Narrow solid geometry catches daylight as scattered ripples.
  for (let i = 0; i < 110; i++) {
    const z = riverStart + random() * (riverEnd - riverStart);
    box(riverCenter(z) + (random() - .5) * (waterWidth - .5), -.112, z, .15 + random() * .65, .004, .018, i % 3 ? '#88b6a9' : '#c3d8c2');
  }

  // Terrain has gentle height and color changes. The road corridor is leveled
  // explicitly, so billboards keep the foot-pivot contract at y=0.
  const terrain = new THREE.PlaneGeometry(width + 100, length + 100, 62, 80);
  terrain.rotateX(-Math.PI / 2);
  const pos = terrain.attributes.position, groundColors = [];
  const low = new THREE.Color('#96aa79'), high = new THREE.Color('#b3bd8c');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + centerX, z = pos.getZ(i) + centerZ;
    const noise = Math.sin(x * .31 + z * .08) * .5 + Math.cos(z * .25 - x * .17) * .32;
    const nearRoad = roadDistance(x, z) < 3;
    const nearCourt=(layout.waitingAreas||[]).some(area=>Math.hypot(x-area.position[0],z-area.position[2])<area.radius+.6)||waitingPaths.some(([a,b])=>pointSegment(x,z,a,b)<.8);
    pos.setXYZ(i, x, nearRoad||nearCourt ? -.23 : -.36 + noise * .10, z);
    const c = low.clone().lerp(high, .5 + noise * .4 + random() * .10);
    groundColors.push(c.r, c.g, c.b);
  }
  terrain.setAttribute('color', new THREE.Float32BufferAttribute(groundColors, 3)); terrain.computeVertexNormals();
  const ground = new THREE.Mesh(terrain, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  ground.receiveShadow = true; ground.name = 'Continuous planted terrain'; world.town.add(ground);

  const tree = (x, z, scale = 1) => {
    const trunkHeight = (1.05 + random() * .45) * scale;
    mesh(new THREE.CylinderGeometry(.06 * scale, .115 * scale, trunkHeight, 7), '#826d50', x, trunkHeight / 2 - .13, z);
    const leaves = ['#62864f', '#6f9255', '#829d63', '#527b52', '#99aa6c'];
    for (let i = 0; i < 4; i++) {
      const crown = new THREE.IcosahedronGeometry((.65 + random() * .25) * scale, 1);
      const a = i * 2.4, offset = i === 0 ? 0 : .35 * scale;
      mesh(crown, leaves[(random() * leaves.length) | 0], x + Math.cos(a) * offset, trunkHeight + (i === 0 ? .65 : .20 + random() * .35) * scale, z + Math.sin(a) * offset, 1, .85 + random() * .35, 1, random() * 6);
    }
  };
  const shrubs = (x, z, radius = .45) => {
    mesh(new THREE.IcosahedronGeometry(radius, 1), random() > .5 ? '#779563' : '#8ca16c', x, radius * .50 - .1, z, 1.3, .7, 1);
  };

  const sign = (text, x, z, yaw = 0, color = '#355c50') => {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
    const c = canvas.getContext('2d'); c.fillStyle = color; c.fillRect(0, 0, 512, 128);
    c.strokeStyle = '#e7d6a8'; c.lineWidth = 6; c.strokeRect(9, 9, 494, 110);
    c.font = '900 42px Nunito Variable, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff4d2'; c.fillText(text, 256, 67, 460);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.35, .59), new THREE.MeshStandardMaterial({ map: texture, roughness: .8, side: THREE.DoubleSide }));
    plaque.position.set(x, 1.75, z); plaque.rotation.y = yaw;
    plaque.position.x += Math.sin(yaw) * .08;
    plaque.position.z += Math.cos(yaw) * .08;
    world.town.add(plaque);
    box(x, 1.75, z, 2.45, .69, .13, '#695b44', yaw);
    for (const side of [-1, 1]) box(x + Math.cos(yaw) * side * 1.02, .82, z - Math.sin(yaw) * side * 1.02, .07, 1.88, .07, '#776747');
  };

  const pennants = (a, b) => {
    const delta = new THREE.Vector3().subVectors(b, a), side = delta.clone().normalize().cross(new THREE.Vector3(0, 1, 0));
    const colors = ['#d9a459', '#c67967', '#93aaa0', '#e0c87e', '#7b9a7d'];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12, at = a.clone().lerp(b, t); at.y -= Math.sin(t * Math.PI) * .32;
      const p = at.clone().addScaledVector(side, -.14), q = at.clone().addScaledVector(side, .14), r = at.clone().add(new THREE.Vector3(0, -.37, 0));
      const geometry = new THREE.BufferGeometry().setFromPoints([p, q, r]); geometry.computeVertexNormals();
      const flag = mesh(geometry, colors[i % colors.length], 0, 0, 0); flag.material.side = THREE.DoubleSide;
    }
    const cable = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 30 }, (_, i) => { const at = a.clone().lerp(b, i / 29); at.y -= Math.sin(i / 29 * Math.PI) * .32; return at; })), new THREE.LineBasicMaterial({ color: '#726951' }));
    world.town.add(cable);
  };

  // Actual waiting footprints are reserved before any houses, stalls or trees.
  // Plain paving stays clear for billboards; benches and signs sit outside slots.
  for(const area of layout.waitingAreas||[]){
    const[x,,z]=area.position;
    disk(x,-.09,z,area.radius+.14,.08,'#b9b69a',40);
    disk(x,-.035,z,area.radius,.07,'#d9cfb1',40);
    strip(area.path[0],area.path[1],.9,.035,-.05,'#d4c9ad');
    for(const offset of[-1.5,-.75,0,.75,1.5]){
      box(x+offset,.002,z,.012,.004,3.8,'#bfb79d');
      box(x,.002,z+offset,3.8,.004,.012,'#bfb79d');
    }
    for(const side of[-1,1])add('bench',x+side*(area.radius+.65),z,.75,-side*Math.PI/2);
    add('plant_pot',x-area.radius-.55,z-1.5,.7);
    add('plant_pot',x+area.radius+.55,z+1.5,.7);
    sign('SÂN HẸN KHU PHỐ',x,z+area.radius+.65,0,'#667354');
  }

  // Small courtyards give the center a neighborhood scale. Placement is checked
  // against every graph edge, including newly generated fork branches.
  // A raised clock-tower garden anchors the far end of the winding town.
  // Its reserved footprint is checked against every road before it is built.
  const landmarkCandidates=[-34,-33,-35,-32].map(z=>({x:0,z}));
  const landmark=landmarkCandidates.find(p=>clear(p.x,p.z,4.35));
  if (landmark) {
    const {x,z}=landmark; reserve(x,z,4.5);
    disk(x,-.08,z,4.2,.26,'#a4ab80',48);
    disk(x,.10,z,3.5,.24,'#b7b58a',48);
    disk(x,.28,z,2.8,.22,'#d2c29a',48);
    for(let i=0;i<4;i++) box(x,.04+i*.1,z+3.7-i*.43,2.2,.18,.56,'#d8cdb0');
    box(x,.46,z,2.7,.18,2.7,'#d9c9a7');
    box(x,2.55,z,1.8,4.0,1.8,'#d7d1ae');
    for(const side of[-1,1]){
      box(x+side*.92,2.55,z,.16,4.1,1.94,'#b8ab84');
      box(x,2.55,z+side*.92,1.94,4.1,.16,'#b8ab84');
    }
    box(x,4.62,z,2.17,.22,2.17,'#e8d8af');
    mesh(new THREE.ConeGeometry(1.87,1.18,4),'#a76e5d',x,5.30,z,1,1,1,Math.PI/4);
    box(x,5.98,z,.10,.56,.10,'#80694c');
    const clockCanvas=document.createElement('canvas');clockCanvas.width=clockCanvas.height=256;
    const clock=clockCanvas.getContext('2d');clock.clearRect(0,0,256,256);
    clock.fillStyle='#f8edc8';clock.beginPath();clock.arc(128,128,116,0,Math.PI*2);clock.fill();
    clock.strokeStyle='#6c6954';clock.lineWidth=10;clock.stroke();
    for(let i=0;i<12;i++){const a=i*Math.PI/6;clock.beginPath();clock.moveTo(128+Math.sin(a)*92,128-Math.cos(a)*92);clock.lineTo(128+Math.sin(a)*106,128-Math.cos(a)*106);clock.lineWidth=5;clock.stroke();}
    clock.lineCap='round';clock.lineWidth=10;clock.beginPath();clock.moveTo(128,128);clock.lineTo(128,60);clock.moveTo(128,128);clock.lineTo(173,143);clock.stroke();
    const clockTexture=new THREE.CanvasTexture(clockCanvas);clockTexture.colorSpace=THREE.SRGBColorSpace;
    const clockMaterial=new THREE.MeshStandardMaterial({map:clockTexture,transparent:true,roughness:.8});
    for(let i=0;i<4;i++){const yaw=i*Math.PI/2,face=new THREE.Mesh(new THREE.PlaneGeometry(1.30,1.30),clockMaterial);face.rotation.y=yaw;face.position.set(x+Math.sin(yaw)*1.015,3.48,z+Math.cos(yaw)*1.015);world.town.add(face);}
    add('bench',x-2.7,z+1.4,.9,Math.PI/2,.22);
    add('bench',x+2.7,z+1.4,.9,-Math.PI/2,.22);
    tree(x-2.6,z-1.6,1.35);tree(x+2.6,z-1.6,1.15);
    sign('ĐỒI HỘI PHỐ',x,z+3.2,0,'#795e45');
    pennants(new THREE.Vector3(x-3.6,3.3,z+2.4),new THREE.Vector3(x+3.6,3.3,z+2.4));
    for(const side of[-1,1])box(x+side*3.6,1.55,z+2.4,.07,3.4,.07,'#8e7956');
  }
  const lots = [];
  for (let z = bounds.minZ + 4; z < bounds.maxZ - 2; z += 4.8) {
    for (let x = bounds.minX + 3; x < bounds.maxX - 2; x += 4.1) {
      const px = x + (random() - .5) * .65, pz = z + (random() - .5) * .65;
      const normalized = ((px - centerX) / (width * .48)) ** 2 + ((pz - centerZ) / (length * .49)) ** 2;
      if (normalized > .9 || !clear(px, pz, 1.5)) continue;
      lots.push({ x: px, z: pz }); reserve(px, pz, 1.65);
    }
  }
  // The first free center plot becomes a shaded public square.
  lots.sort((a, b) => Math.hypot(a.x - centerX, a.z - centerZ) - Math.hypot(b.x - centerX, b.z - centerZ));
  const plaza = lots.shift();
  if (plaza) {
    const { x, z } = plaza;
    disk(x, -.12, z, 2.05, .16, '#b8b398');
    disk(x, -.025, z, 1.86, .06, '#ddd1af');
    disk(x, .08, z, .75, .18, '#b6ab8d');
    tree(x, z, 1.4);
    add('bench', x - 1.25, z, .9, Math.PI / 2);
    add('bench', x + 1.25, z, .9, -Math.PI / 2);
    add('flower_cart', x, z + 1.5, .85);
    sign('GÓC HẸN KHU PHỐ', x, z - 1.55, 0);
  }
  const delivery = layout.theme === 'delivery' || layout.file?.startsWith('pho');
  let lotIndex = 0;
  for (const { x, z } of lots) {
    const yaw = x < centerX ? Math.PI / 2 : -Math.PI / 2;
    const isMarket = Math.abs(z - centerZ) < length * .22;
    box(x, -.15, z, 3.65, .12, 3.8, isMarket ? '#cbbd9f' : '#b6b99a');
    const scale = 1.05 + random() * .25;
    // Quiet garden courts break up rows of repeated houses.
    if (lotIndex%7===3) {
      disk(x,-.08,z,1.6,.18,'#b0b28c',24);
      tree(x,z-.35,1.25);add('bench',x,z+1,.9,Math.PI);
      add('flower_cart',x+1.1,z-.9,.65,Math.PI/2);
      shrubs(x-1.25,z+.8,.5);lotIndex++;continue;
    }
    const name = delivery && z < centerZ ? (lotIndex % 2 ? 'warehouse_a' : 'warehouse_b') : lotIndex % 3 ? 'house_mint' : 'house_blue';
    const house = add(name, x, z - .3, scale, yaw + (random() - .5) * .08, -.08, true);
    if (house) {
      house.scale.y *= .95 + random() * .30;
      house.material.color.set(lotIndex % 4 === 0 ? '#e3d4b8' : lotIndex % 4 === 1 ? '#d4e2c7' : '#f1e6d7');
    }
    if (isMarket) {
      add(lotIndex % 2 ? 'street_stall' : 'market_tent', x, z + 1.05, .82, yaw, -.04, true);
      add('street_umbrella', x - .8, z + 1.25, .95, random() * 6);
      add('stool_plastic', x + .9, z + 1.15, .9, random() * 6);
      add('plant_pot', x - 1.3, z - 1, .8);
      if (lotIndex % 2 === 0) add('flower_cart', x + .85, z - 1.25, .75);
    } else {
      add(delivery && z < centerZ ? 'stack_boxes' : 'plant_pot', x + 1.15, z + .8, .7, random() * 1.2);
      box(x, -.04, z + 1.4, 2.8, .08, .42, '#d4c8ab');
      shrubs(x - 1.35, z + 1.15, .42);
    }
    lotIndex++;
  }
  // Two awning rows and flags make the market recognizable from the aerial view.
  if (plaza) {
    const px = plaza.x, pz = plaza.z;
    pennants(new THREE.Vector3(px - 2.3, 3.3, pz + 1.9), new THREE.Vector3(px + 2.3, 3.3, pz + 1.9));
    for (const side of [-1, 1]) box(px + side * 2.3, 1.55, pz + 1.9, .065, 3.4, .065, '#8e7956');
  }

  // Homes beyond the playable loop continue the street into the background.
  for (const side of [-1, 1]) {
    for (let z = bounds.minZ - 1; z <= bounds.maxZ + 1; z += 4.5) {
      const x = side < 0 ? bounds.minX - 3.2 - random() * 1.2 : riverCenter(z) + waterWidth / 2 + 3.3 + random() * 1.3;
      if (!clear(x, z, 1.5)) continue;
      const house = add(delivery && z < 0 ? 'warehouse_b' : random() < .5 ? 'house_mint' : 'house_blue', x, z, 1.15 + random() * .35, side * Math.PI / 2, -.15, true);
      if (house) house.scale.y *= .95 + random() * .45;
      reserve(x, z, 1.5);
      box(x, -.15, z, 3.5, .10, 3.5, '#b9b59a');
      tree(x + side * 1.4, z + 1.75, .9 + random() * .35);
      add('plant_pot', x - side * 1.3, z + 1.1, .8);
    }
  }

  // A pedestrian bridge belongs to the scenery; the playable route never
  // crosses an unconnected piece of water.
  for (const z of [bounds.minZ + length * .29, bounds.minZ + length * .74]) {
    const x = riverCenter(z);
    box(x, -.005, z, waterWidth + 2.9, .22, 1.6, '#a18d6b');
    for (let i = 0; i < 12; i++) box(x - (waterWidth + 2.9) / 2 + i * (waterWidth + 2.9) / 11, .12, z, .035, .025, 1.6, '#c9b690');
    for (const side of [-1, 1]) {
      box(x, .68, z + side * .72, waterWidth + 2.8, .09, .09, '#e0cf9e');
      for (let i = 0; i <= 5; i++) box(x - (waterWidth + 2.8) / 2 + i * (waterWidth + 2.8) / 5, .35, z + side * .72, .08, .76, .08, '#c3ae80');
    }
    for (let i = 0; i < 4; i++) box(x + (i < 2 ? -1 : 1) * (waterWidth / 2 + 1.6), -.04, z + (i % 2 ? .43 : -.43), .8, .10, .45, '#b4aa8b');
  }

  // Riverbank groves are deliberately irregular, with short undergrowth at the
  // path edge and taller trees behind. No prop may cover a playable edge.
  for (let i = 0; i < 220; i++) {
    const z = bounds.minZ - 11 + random() * (length + 22);
    const bankSide = i % 2 ? -1 : 1;
    const x = riverCenter(z) + bankSide * (waterWidth / 2 + 1.1 + random() * 3.3);
    if (!clear(x, z, .75)) continue;
    if (i % 3 === 0) { tree(x, z, .85 + random() * .6); reserve(x, z, .7); }
    else shrubs(x, z, .25 + random() * .35);
  }
  for (let i = 0; i < 180; i++) {
    const x = bounds.minX - 10 + random() * (width + 15), z = bounds.minZ - 9 + random() * (length + 18);
    if (x > riverCenter(z) - waterWidth / 2 - 1 || !clear(x, z, .85)) continue;
    if (i % 4 === 0) { tree(x, z, .8 + random() * .8); reserve(x, z, .85); }
    else shrubs(x, z, .25 + random() * .3);
  }
  // Road furniture follows the perimeter, with breathing space around stops.
  for (let i = 0; i < nodes.length; i += 4) {
    const node = nodes[i], [x, , z] = node.position;
    const angle = Math.atan2(x - centerX, z - centerZ);
    const nx = Math.sin(angle), nz = Math.cos(angle);
    const px = x + nx * 1.9, pz = z + nz * 1.9;
    if (clear(px, pz, .15)) add('lamp_street', px, pz, .92, angle);
    if (i % 8 === 0 && clear(x + nx * 2.2, z + nz * 2.2, .5)) add('bench', x + nx * 2.2, z + nz * 2.2, .8, angle + Math.PI);
  }
  for (const node of nodes.filter(n => n.station)) {
    const [x, , z] = node.position;
    // Leave the station itself open for a full group of sprites.
    add(delivery ? 'delivery_gate' : 'gate_start', x, z - 1.4, .8, 0, 0, true);
  }
  for (const node of nodes.filter(n => n.fork)) {
    const [x, , z] = node.position;
    box(x + 1.45, .52, z, .08, 1.25, .08, '#877653');
    box(x + 1.45, 1.0, z, .70, .22, .11, '#c4935c', .18);
    box(x + 1.45, .73, z, .70, .22, .11, '#84a097', -.18);
  }
  // These materials are consumed into a vertex-colored batch by the caller.
  return { bounds, segments, transientMaterials: [...materials.values()] };
}
