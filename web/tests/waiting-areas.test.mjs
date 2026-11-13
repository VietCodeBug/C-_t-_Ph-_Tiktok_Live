import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createTownLayout,NEIGHBORHOODS} from '../src/layouts.js';
import {graphSegments,distanceToSegments,riverAt,waitingSlotConflicts} from '../src/waiting-areas.js';
import {TownWorld} from '../src/world.js';

test('all town seeds reserve200 deterministic waiting slots away from roads, water and the clock garden',()=>{
  for(const id of Object.keys(NEIGHBORHOODS))for(let seed=0;seed<100;seed++){
    const layout=createTownLayout(id,seed),segments=graphSegments(layout);
    assert.equal(layout.waitingAreas.length,8,`${id}/${seed}`);
    assert.equal(layout.waitingAreas.reduce((sum,area)=>sum+area.slots.length,0),200);
    for(const area of layout.waitingAreas){
      assert.equal(area.slots.length,25);assert.equal(area.spacing,.75);
      assert.ok(Math.hypot(area.position[0],area.position[2]+34)>7.6);
      for(const slot of area.slots){
        assert.equal(slot[1],0);
        assert.ok(distanceToSegments(slot,segments)>1.75,'feet and body stay outside playable street');
        const river=riverAt(layout,slot[2]);assert.ok(Math.abs(slot[0]-river.center)>river.width/2+.3);
        assert.ok(Math.hypot(slot[0]-area.position[0],slot[2]-area.position[2])<area.radius-.3);
      }
      assert.ok(area.slots.every((slot,index)=>area.slots.every((other,j)=>index===j||Math.hypot(slot[0]-other[0],slot[2]-other[2])>=.75-1e-9)));
    }
  }
});

test('prop-footprint hit testing detects exactly blocked waiting feet and ignores distant scenery',()=>{
  const layout=createTownLayout('CHO_VIA_HE',42),area=layout.waitingAreas[0],[x,,z]=area.slots[0];
  assert.deepEqual(waitingSlotConflicts(layout,{minX:x-.1,maxX:x+.1,minZ:z-.1,maxZ:z+.1}),[{areaId:area.id,slot:0}]);
  assert.equal(waitingSlotConflicts(layout,{minX:100,maxX:101,minZ:100,maxZ:101}).length,0);
  assert.equal(waitingSlotConflicts(layout,{minX:area.position[0]-2,maxX:area.position[0]+2,minZ:area.position[2]-2,maxZ:area.position[2]+2}).length,25);
});

test('rendered scenery guards the real transformed solid bounds and keeps inset labels on the local street tangent',async()=>{
  const previous=globalThis.document;
  const context=new Proxy({},{get:(object,key)=>object[key]??(()=>{}),set:(object,key,value)=>{object[key]=value;return true;}});
  globalThis.document={createElement:()=>({width:256,height:256,getContext:()=>context})};
  try{
    const models=new Map(['house_mint','house_blue','bench','plant_pot','street_stall','market_tent'].map(name=>[name,new THREE.Mesh(new THREE.BoxGeometry(2.8,2.2,2.8),new THREE.MeshStandardMaterial({color:'#aabbcc'}))]));
    const world=Object.create(TownWorld.prototype);
    Object.assign(world,{models,town:new THREE.Group(),scene:new THREE.Scene(),renderer:{capabilities:{getMaxAnisotropy:()=>1},shadowMap:{}}});
    const layout=createTownLayout('CHO_VIA_HE',42);await world.loadMap(layout);
    assert.equal(world.scene.userData.waitingSlotCount,200);assert.equal(world.scene.userData.waitingCollisionCount,0);
    assert.ok(world.waitingSolidBounds.length>50,'the audit covers actual rendered props and procedural solids');
    assert.ok(world.waitingSolidBounds.every(bounds=>waitingSlotConflicts(layout,bounds).length===0));
    const quiet=layout.nodes.find(node=>node.typeIndex===6&&Math.abs(node.yaw)>.3),quietNodes=layout.nodes.filter(node=>node.typeIndex===6),index=quietNodes.indexOf(quiet);
    const labels=world.town.children.find(child=>child.name==='Batched tile labels 6'),vertices=labels.geometry.attributes.position;
    const edge=new THREE.Vector3(vertices.getX(index*4+1)-vertices.getX(index*4),0,vertices.getZ(index*4+1)-vertices.getZ(index*4)).normalize();
    assert.ok(Math.abs(edge.dot(new THREE.Vector3(Math.cos(quiet.yaw),0,-Math.sin(quiet.yaw))))>1-1e-6,'label square follows inset and curb local X');
    assert.ok(Math.abs(vertices.getY(index*4)-.043)<1e-7);
  }finally{globalThis.document=previous;}
});
