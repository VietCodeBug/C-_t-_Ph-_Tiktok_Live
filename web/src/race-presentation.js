import * as THREE from 'three';

function podiumSet(snapshot, players) {
  const result = new Set();
  for (const entry of snapshot.race?.finishers?.slice(0,3) || []) {
    if (Number.isInteger(entry)) { result.add(entry); continue; }
    const index = entry?.index ?? entry?.playerIndex ?? entry?.active;
    if (Number.isInteger(index)) result.add(index);
    else {
      const identity = entry?.id ?? entry?.seat ?? entry?.tag;
      const found = players.findIndex(player => player.seat === identity || player.id === identity);
      if (found >= 0) result.add(found);
    }
  }
  return result;
}

// This is visibility planning only. A hundred players retain a hundred logical
// positions, wallets and race records even when a shared-tile pile is grouped.
export function planRaceCrowd(players, snapshot, camera) {
  const active = snapshot.active || 0, moving = snapshot.phase === 'moving';
  const overview = snapshot.cameraView === 'overview' || camera.position.y > 18;
  const podium = podiumSet(snapshot, players), activePosition = players[active]?.position;
  const largeRoom = players.length > 12, groups = new Map();
  const plan = players.map((player,index) => {
    const focused = index === active || podium.has(index);
    const nearby = activePosition && player.position.distanceTo(activePosition) < 8;
    return { visible:true, showName:!largeRoom || focused || (!overview && nearby && camera.position.distanceTo(player.position)<14),
      detailed:!largeRoom || focused || (!overview && nearby), offset:[0,0] };
  });
  if (!largeRoom) return { plan, badges:[] };
  players.forEach((player,index)=> {
    if (snapshot.players?.[index]?.phase === 'moving' || (moving && index === active)) return;
    const key = player.node || `${player.position.x.toFixed(2)}:${player.position.z.toFixed(2)}`;
    if (!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(index);
  });
  const badges = [];
  for (const [node,indices] of groups) {
    const priority=index=>index===active?0:podium.has(index)?1:2;
    const ordered = [...indices].sort((a,b)=>priority(a)-priority(b)||a-b);
    const limit = indices.includes(active) ? 7 : 6;
    const shown = ordered.slice(0,limit), ring = shown.filter(index=>index!==active);
    const needsSpread = indices.length > 1;
    for (const index of indices) {
      plan[index].visible = shown.includes(index);
      if (!plan[index].visible) { plan[index].showName=false; plan[index].detailed=false; }
    }
    if (needsSpread) ring.forEach((index,slot)=> {
      const angle = slot/Math.max(1,ring.length)*Math.PI*2;
      plan[index].offset = [Math.cos(angle)*.62,Math.sin(angle)*.62];
    });
    if (indices.length > 1) {
      const position = players[indices[0]].position;
      badges.push({ node,count:indices.length,position:position.toArray(),distance:camera.position.distanceTo(position),overview });
    }
  }
  badges.sort((a,b)=>a.distance-b.distance || b.count-a.count);
  return { plan,badges:badges.slice(0,25) };
}

export function finishPlacement(race) {
  if (!race || !Array.isArray(race.finishPosition) || race.finishPosition.length<3 || !race.finishPosition.slice(0,3).every(Number.isFinite)) return null;
  const heading = race.finishHeading || [0,0,-1];
  const x = Number.isFinite(heading[0]) ? heading[0] : 0;
  const z = Number.isFinite(heading[2]) ? heading[2] : -1;
  return { position:race.finishPosition.slice(0,3),yaw:Math.abs(x)+Math.abs(z)<1e-8 ? Math.PI : Math.atan2(x,z) };
}

export class RacePresentation {
  constructor(world,players) {
    this.world=world; this.players=players; this.badges=[];
    this.marker=new THREE.Group(); this.marker.name='Seeded physical race finish';
    world.scene.add(this.marker);
    this.badgeGroup=new THREE.Group(); this.badgeGroup.name='Shared tile player counts'; world.scene.add(this.badgeGroup);
  }

  disposeMarker() {
    const geometries=new Set(),materials=new Set(),textures=new Set();
    this.marker.traverse(object=> {
      if(object.geometry)geometries.add(object.geometry);
      for(const material of Array.isArray(object.material)?object.material:[object.material]) {
        if(!material)continue;materials.add(material);if(material.map)textures.add(material.map);
      }
    });
    textures.forEach(value=>value.dispose());materials.forEach(value=>value.dispose());geometries.forEach(value=>value.dispose());
    this.marker.clear();
  }

  rebuildFinish(race) {
    this.disposeMarker();
    const placement=finishPlacement(race);
    if(!placement){this.marker.visible=false;return;}
    this.marker.visible=true;this.marker.position.fromArray(placement.position);this.marker.rotation.y=placement.yaw;
    const ivory=new THREE.MeshStandardMaterial({color:'#fff1ce',roughness:.92});
    const dark=new THREE.MeshStandardMaterial({color:'#395747',roughness:.88});
    const gold=new THREE.MeshStandardMaterial({color:'#d7b56e',roughness:.6,metalness:.12});
    const box=(w,h,d,material,x,y,z)=> {
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);
      mesh.castShadow=mesh.receiveShadow=true;this.marker.add(mesh);return mesh;
    };
    box(2.75,.014,.86,gold,0,.043,0);
    for(let row=0;row<2;row++)for(let column=0;column<8;column++)
      box(.32,.012,.35,(row+column)%2?dark:ivory,(column-3.5)*.32,.058,(row-.5)*.35);
    for(const side of[-1,1]) {
      box(.09,2.25,.09,gold,side*1.46,1.1,0);
      const cap=new THREE.Mesh(new THREE.SphereGeometry(.105,10,8),gold);cap.position.set(side*1.46,2.27,0);this.marker.add(cap);
    }
    box(3.04,.46,.14,dark,0,2.04,0);
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;
    const context=canvas.getContext('2d');context.fillStyle='#304d3e';context.fillRect(0,0,512,96);
    context.strokeStyle='#d8bd79';context.lineWidth=5;context.strokeRect(6,6,500,84);
    context.fillStyle='#fff1cc';context.font='900 46px Nunito Variable, sans-serif';context.textAlign='center';context.textBaseline='middle';
    context.fillText(`ĐÍCH · ${race.lapTarget || race.targetLaps || 3} VÒNG`,256,51,470);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const faceMaterial=new THREE.MeshBasicMaterial({map:texture});
    for(const side of[-1,1]) {
      const face=new THREE.Mesh(new THREE.PlaneGeometry(2.93,.42),faceMaterial);face.position.set(0,2.04,side*.076);face.rotation.y=side<0?Math.PI:0;this.marker.add(face);
    }
    this.world.renderer.shadowMap.needsUpdate=true;
  }

  badge(index) {
    if(this.badges[index])return this.badges[index];
    const canvas=document.createElement('canvas');canvas.width=192;canvas.height=64;
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}));
    sprite.renderOrder=125;this.badgeGroup.add(sprite);
    const entry={canvas,texture,sprite,count:null};this.badges[index]=entry;return entry;
  }

  update(snapshot) {
    const race=snapshot.race;
    const finishKey=race?`${snapshot.seed}:${race.finishNodeId}:${JSON.stringify(race.finishPosition)}`:'none';
    if(finishKey!==this.finishKey){this.finishKey=finishKey;this.rebuildFinish(race);}
    const result=planRaceCrowd(this.players,snapshot,this.world.camera);
    result.plan.forEach((entry,index)=> {
      const player=this.players[index];player.group.visible=entry.visible;player.showName=entry.showName;
      player.detailed=entry.detailed;player.visualOffset=entry.offset;
      player.group.position.x=player.position.x+entry.offset[0];player.group.position.z=player.position.z+entry.offset[1];
      if(player.label&&!entry.showName)player.label.visible=false;
    });
    this.badges.forEach(entry=>{entry.sprite.visible=false;});
    result.badges.forEach((data,index)=> {
      const entry=this.badge(index);entry.sprite.visible=true;entry.sprite.position.fromArray(data.position);entry.sprite.position.y+=data.node===race?.finishNodeId?3.05:2.0;
      const width=data.overview?3.1:1.25;entry.sprite.scale.set(width,width/3,1);
      if(entry.count!==data.count){
        entry.count=data.count;const c=entry.canvas.getContext('2d');c.clearRect(0,0,192,64);
        c.fillStyle='#254535';c.beginPath();c.roundRect(3,6,186,52,18);c.fill();
        c.strokeStyle='#dcc382';c.lineWidth=3;c.stroke();c.fillStyle='#fff0c2';c.font='900 34px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(`×${data.count}`,96,34);entry.texture.needsUpdate=true;
      }
    });
    this.last={logicalPlayers:this.players.length,visiblePlayers:result.plan.filter(entry=>entry.visible).length,
      namedPlayers:result.plan.filter(entry=>entry.showName&&entry.visible).length,clusters:result.badges.map(({node,count})=>({node,count})),
      finishVisible:this.marker.visible,finishNodeId:race?.finishNodeId || null};
  }

  snapshot(){return this.last || {logicalPlayers:this.players.length,visiblePlayers:0,namedPlayers:0,clusters:[],finishVisible:false};}

  dispose(){
    this.disposeMarker();this.world.scene.remove(this.marker,this.badgeGroup);
    for(const entry of this.badges){entry.texture.dispose();entry.sprite.material.dispose();}
    this.badges.length=0;this.badgeGroup.clear();
  }
}
