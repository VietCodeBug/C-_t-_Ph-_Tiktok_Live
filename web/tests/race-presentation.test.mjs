import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {planRaceCrowd,finishPlacement}from'../src/race-presentation.js';

const room=(different=false)=>Array.from({length:100},(_,index)=>({seat:`P${String(index+1).padStart(3,'0')}`,node:different?`C${index}`:'C00',position:new THREE.Vector3(different?index:0,0,0)}));
test('100 racers stay logical while a shared node shows six peers plus the active racer and a count badge',()=>{
  const players=room(),positions=players.map(player=>player.position.toArray());
  const camera=new THREE.PerspectiveCamera();camera.position.set(0,40,20);
  const result=planRaceCrowd(players,{active:30,phase:'overview',cameraView:'overview',race:{finishers:[]}},camera);
  assert.equal(result.plan.filter(entry=>entry.visible).length,7);assert.equal(result.badges[0].count,100);
  assert.equal(result.plan[30].visible,true);assert.deepEqual(result.plan[30].offset,[0,0]);
  assert.equal(result.plan.filter(entry=>entry.showName).length,1);
  assert.deepEqual(players.map(player=>player.position.toArray()),positions);
});
test('moving racer is always visible, unshifted, and excluded from the stationary pile count',()=>{
  const players=room(),camera=new THREE.PerspectiveCamera();camera.position.set(0,4,5);
  const result=planRaceCrowd(players,{active:70,phase:'moving',cameraView:'follow'},camera);
  assert.equal(result.plan[70].visible,true);assert.deepEqual(result.plan[70].offset,[0,0]);
  assert.equal(result.badges[0].count,99);assert.equal(result.plan.filter(entry=>entry.visible).length,7);
});
test('overview keeps all separated racers visible but names only the active racer and podium',()=>{
  const players=room(true),camera=new THREE.PerspectiveCamera();camera.position.set(0,70,20);
  const result=planRaceCrowd(players,{active:0,phase:'overview',cameraView:'overview',race:{finishers:[3,7,9]}},camera);
  assert.equal(result.plan.filter(entry=>entry.visible).length,100);assert.equal(result.plan.filter(entry=>entry.showName).length,4);
  assert.equal(result.badges.length,0);
});
test('finish heading makes a finite cross-road marker and missing race data hides it',()=>{
  assert.equal(finishPlacement(null),null);
  const placement=finishPlacement({finishPosition:[2,0,36],finishHeading:[1,0,0]});
  assert.deepEqual(placement.position,[2,0,36]);assert.equal(placement.yaw,Math.PI/2);
  assert.ok(Number.isFinite(finishPlacement({finishPosition:[2,0,36],finishHeading:[0,0,0]}).yaw));
});
