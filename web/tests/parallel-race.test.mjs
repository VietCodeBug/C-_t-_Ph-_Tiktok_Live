import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ParallelRace } from '../src/parallel-race.js';
import { createTownLayouts } from '../src/layouts.js';

async function fixture(options={}) {
  const updates={camera:0,sprites:0};
  const players=Array.from({length:options.count||100},(_,i)=>({group:new THREE.Group(),position:new THREE.Vector3(),heading:new THREE.Vector3(),
    seat:`P${String(i+1).padStart(3,'0')}`,data:{name:`Người ${i+1}`},money:1000,images:new Map(),
    setClip(clip){this.clip=clip},loadClip(){},update(){updates.sprites++}}));
  const world={playerGroup:new THREE.Group(),followHeading:new THREE.Vector3(),camera:new THREE.PerspectiveCamera(),lookAt:new THREE.Vector3(),
    renderer:{info:{render:{calls:0,triangles:0}}},async loadMap(){},updateCamera(){updates.camera++;return'follow'}};
  const game=new ParallelRace(world,players,createTownLayouts(42),null,{randomRoll:()=>2,...options});
  await game.changeMap('CHO_VIA_HE');return{game,players,world,updates};
}

function replacementPlayers(count=20,prefix='next') {
  return Array.from({length:count},(_,index)=>({accountId:`${prefix}-${index}`,seat:String(index+1),
    data:{id:'ch01',name:`Tài khoản ${prefix}-${index}`},group:new THREE.Group(),position:new THREE.Vector3(),heading:new THREE.Vector3(),
    money:1400+index,images:new Map(),setClip(clip){this.clip=clip},loadClip(){},update(){}}));
}

test('completed 20-racer roster can be replaced without old groups, finish progress or overwritten account balances',async()=>{
  const{game,players:previous,world}=await fixture({count:20,interactiveChoices:false});
  for(let index=0;index<3;index++)prepareFinishApproach(game,index,.01+index*.01);
  game.update(.1);assert.equal(game.race.over,true);
  const next=replacementPlayers(),balances=next.map(player=>player.money);
  assert.equal(game.setPlayers(next),previous);
  assert.ok(previous.every(player=>player.group.parent===null));
  assert.equal(world.playerGroup.children.length,20);assert.ok(next.every(player=>player.group.parent===world.playerGroup));
  assert.equal(game.runners.length,0);assert.equal(game.race,null);assert.equal(game.nodes.size,0);
  game.update(1);
  assert.equal(await game.changeMap('PHO_GIAO_HANG'),true);
  assert.deepEqual(game.players.map(player=>player.accountId),next.map(player=>player.accountId));
  assert.deepEqual(game.players.map(player=>player.money),balances);
  assert.ok(game.players.every(player=>player.raceSteps===0&&!player.finished&&player.node===game.race.course.finishNodeId));
  assert.equal(game.race.finishers.length,0);assert.equal(game.runners.length,20);
});

test('roster validation is atomic, requires unique account IDs and refuses unsettled collective events',async()=>{
  const{game,players,world}=await fixture({count:20});
  const originalGroups=[...world.playerGroup.children],next=replacementPlayers();
  assert.throws(()=>game.setPlayers(next),/Finish or explicitly reset/);
  const duplicate=replacementPlayers();duplicate[1].accountId=duplicate[0].accountId;
  assert.throws(()=>game.setPlayers(duplicate,{reset:true}),/unique account IDs/);
  assert.throws(()=>game.setPlayers(next.slice(0,1),{reset:true}),/2–200/);
  assert.throws(()=>game.setPlayers(replacementPlayers(201),{reset:true}),/2–200/);
  game.setHold(true);
  assert.throws(()=>game.setPlayers(next,{reset:true}),/Settle the collective event/);
  assert.equal(game.players,players);assert.deepEqual(world.playerGroup.children,originalGroups);
  game.setHold(false);assert.equal(game.setPlayers(next,{reset:true}),players);
});

test('a roster replacement during a pending scene load cancels old state and serializes the replacement map last',async()=>{
  const{game,world}=await fixture({count:20});
  const loaded=[];let release;
  world.loadMap=async layout=>{
    loaded.push(layout.id);
    if(layout.id==='PHO_GIAO_HANG')await new Promise(resolve=>{release=resolve});
  };
  const oldLoad=game.changeMap('PHO_GIAO_HANG');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(typeof release,'function');assert.equal(game.loading,true);
  const next=replacementPlayers(20,'replacement');game.setPlayers(next);
  const newLoad=game.changeMap('BEN_SONG');release();
  assert.equal(await oldLoad,false);assert.equal(await newLoad,true);
  assert.equal(game.mapId,'BEN_SONG');assert.equal(game.loading,false);
  assert.deepEqual(loaded,['PHO_GIAO_HANG','BEN_SONG']);
  assert.ok(game.players.every(player=>player.accountId.startsWith('replacement-')&&player.raceSteps===0));
  assert.deepEqual(game.players.map(player=>player.money),next.map((_,index)=>1400+index));
});

test('roster replacement accepts the configured upper bound and resets all controllers for that roster',async()=>{
  const{game}=await fixture({count:20});
  game.setPlayers(replacementPlayers(200),{reset:true});
  await game.changeMap('CHO_VIA_HE');
  assert.equal(game.players.length,200);assert.equal(game.runners.length,200);assert.equal(game.race.players.length,200);
});

test('a nonfocused racer can queue its own comment roll without changing the camera',async()=>{
  const {game}=await fixture();
  assert.equal(game.active,0);
  assert.equal(game.requestRollFor(99),true);
  assert.equal(game.requestRollFor(99),false);
  assert.equal(game.active,0);
  assert.equal(game.requestRollFor(-1),false);
  assert.equal(game.requestRollFor(100),false);
});

test('100 actors dispatch independently but each frame updates the real camera once and each sprite once',async()=>{
  const{game,players,updates}=await fixture();
  for(let i=0;i<70;i++)game.update(.1);
  assert.ok(game.runners.filter(r=>r.phase==='moving').length>10);
  assert.ok(players.filter(p=>p.raceSteps>0).length>1);
  assert.equal(updates.camera,70);assert.equal(updates.sprites,7000);
  assert.equal(game.world.playerGroup.children.length,100);
  assert.equal(game.snapshot().crowd.length,100);
});

test('focus selection never cancels another actor movement and pause/collective hold freeze all progress',async()=>{
  const{game,players}=await fixture({count:10});
  for(let i=0;i<35;i++)game.update(.1);
  const runner=game.runners[0],phase=runner.phase,remaining=runner.remaining;
  game.select(8);assert.equal(runner.phase,phase);assert.equal(runner.remaining,remaining);
  game.setPaused(true);const frozen=players.map(p=>({position:p.position.toArray(),steps:p.raceSteps}));
  game.update(50);assert.deepEqual(players.map(p=>({position:p.position.toArray(),steps:p.raceSteps})),frozen);
  game.setPaused(false);game.setHold(true);game.update(50);
  assert.deepEqual(players.map(p=>({position:p.position.toArray(),steps:p.raceSteps})),frozen);
  assert.equal(game.snapshot().paused,false);assert.equal(game.diceState().paused,true);
});

test('global dice and event sequences remain unique as focus changes between actors',async()=>{
  const{game}=await fixture({count:10});
  for(let i=0;i<8;i++)game.update(.1);
  const rollSequences=game.runners.map(r=>r.rollSequence);
  assert.equal(new Set(rollSequences).size,10);
  const events=[];
  for(let i=0;i<10;i++){game.select(i);game.previewEvent('gain');events.push(game.snapshot().event.sequence);}
  assert.equal(new Set(events).size,10);
  assert.equal(new Set(game.ledger.map(row=>row.id)).size,game.ledger.length);
});

test('focused collective landing holds everyone and result injection never applies the individual card twice',async()=>{
  let triggered=0;
  const{game,players}=await fixture({count:10,onCollectiveLanding:(index,event)=>{triggered++;return event.category==='invest'}});
  game.previewEvent('invest');assert.equal(triggered,1);assert.equal(game.phase,'community');assert.equal(game.globalHold,true);
  const sequence=game.snapshot().event.sequence;
  players[0].money=1120;
  assert.equal(game.completeCollective(0,{before:1000,after:1120,delta:120,reasonText:'Startup có lời'}),true);
  assert.equal(game.globalHold,false);assert.equal(players[0].money,1120);
  assert.equal(game.chooseEvent('save'),false);assert.equal(game.completeCollective(0,{}),false);
  assert.equal(game.snapshot().event.sequence,sequence);
  assert.equal(game.ledger.length,1);assert.equal(game.ledger[0].delta,120);
});

test('background fork/event choices resolve after three seconds while focused decisions keep ten seconds',async()=>{
  const{game}=await fixture({count:3});
  game.select(0);game.previewEvent('invest');
  game.select(1);game.previewEvent('invest');
  const first=game.runners[0],focused=game.runners[1];
  game.update(3.1);game.update(.1);
  assert.equal(first.phase,'arrive');assert.equal(focused.phase,'event-choice');
  assert.ok(focused.phaseTime<10);
});

test('third finisher ends the race immediately and later actors do not advance in that frame',async()=>{
  const{game,players}=await fixture({count:5,interactiveChoices:false});
  const finish=game.race.course.finishNodeId;
  const before=[...game.race.course.progress].find(([id,at])=>id.startsWith('C')&&at===(game.race.course.finishIndex+95)%96)[0];
  for(let i=0;i<5;i++) {
    const runner=game.runners[i],player=players[i];player.raceSteps=287;player.laps=2;player.node=before;
    player.position.fromArray(game.nodes.get(before).position);
    runner.phase='moving';runner.remaining=2;runner.roll=2;runner.stepsCompleted=0;runner.visitedNodes=[before];runner.startSegment();
    runner.segment.progress=.99;
  }
  game.update(.1);
  assert.equal(game.race.over,true);assert.equal(game.race.finishers.length,3);
  assert.deepEqual(game.race.snapshot().finalStandings.map(p=>p.index),[0,1,2]);
  assert.equal(players[3].raceSteps,287);assert.ok(game.runners[3].segment.progress>.99&&game.runners[3].segment.progress<1-1e-7);
  assert.equal(game.phase,'race-over');assert.equal(game.requestRoll(),false);
  const positions=players.map(p=>p.position.toArray());game.update(100);
  assert.deepEqual(players.map(p=>p.position.toArray()),positions);
});

test('same-frame podium follows crossing fractions rather than actor indices and everyone stops at third place time',async()=>{
  const{game,players}=await fixture({count:5,interactiveChoices:false});
  const finish=game.race.course.finishNodeId;
  const before=[...game.race.course.progress].find(([id,at])=>id.startsWith('C')&&at===(game.race.course.finishIndex+95)%96)[0];
  const fractions=[.2,.8,.9,.95];
  for(let index=0;index<4;index++) {
    const runner=game.runners[index],player=players[index];
    player.raceSteps=287;player.laps=2;player.node=before;
    runner.phase='moving';runner.remaining=2;runner.roll=2;runner.stepsCompleted=0;runner.visitedNodes=[before];runner.startSegment();
    runner.segment.progress=fractions[index];
    player.position.lerpVectors(runner.segment.a,runner.segment.b,fractions[index]);
  }
  const normal=game.runners[4];normal.phase='moving';normal.remaining=2;normal.roll=2;normal.startSegment();
  const initial=players[4].position.clone();
  const length=game.runners[1].segment.length,thirdTime=(1-fractions[1])*length/1.02;
  game.update(1);
  assert.equal(game.race.over,true);
  assert.deepEqual(game.race.finishers.map(entry=>entry.index),[3,2,1]);
  assert.ok(Math.abs(game.clock-thirdTime)<1e-12);
  assert.ok(Math.abs(players[4].position.distanceTo(initial)-thirdTime*1.02)<1e-10);
  assert.ok(Math.abs(game.runners[0].segment.progress-.4)<1e-10);
  assert.equal(players[0].raceSteps,287);assert.equal(players[0].node,before);
  const times=game.race.finishers.map(entry=>entry.crossingTime);
  assert.ok(times[0]<times[1]&&times[1]<times[2]);
});

function prepareFinishApproach(game,index,distance) {
  const player=game.players[index],runner=game.runners[index],finish=game.race.course.finishNodeId;
  const before=[...game.race.course.progress].find(([id,step])=>id.startsWith('C')&&step===(game.race.course.finishIndex+95)%96)[0];
  player.node=before;player.raceSteps=287;player.laps=2;
  runner.phase='moving';runner.remaining=2;runner.roll=2;runner.stepsCompleted=0;runner.visitedNodes=[before];runner.startSegment();
  runner.segment.progress=1-distance/runner.segment.length;
  player.position.lerpVectors(runner.segment.a,runner.segment.b,runner.segment.progress);
  assert.equal(runner.segment.to,finish);
}

function prepareFocusedInvestment(game,index,distance) {
  const node=game.layout.nodes.find(node=>node.typeIndex===4);
  const before=game.layout.nodes.find(candidate=>candidate.next.includes(node.id));
  const player=game.players[index],runner=game.runners[index];
  player.node=before.id;
  player.raceSteps=(game.race.course.progress.get(before.id)-game.race.course.finishIndex+96)%96;
  runner.phase='moving';runner.remaining=1;runner.roll=1;runner.stepsCompleted=0;runner.visitedNodes=[before.id];runner.startSegment(node.id);
  runner.segment.progress=1-distance/runner.segment.length;
  player.position.lerpVectors(runner.segment.a,runner.segment.b,runner.segment.progress);
  game.select(index);
}

test('an earlier collective landing pauses every racer before a later same-frame podium crossing',async()=>{
  let calls=0;
  const{game,players}=await fixture({count:5,onCollectiveLanding:()=>{calls++;return true}});
  for(let i=0;i<3;i++)prepareFinishApproach(game,i,.05+i*.01);
  prepareFocusedInvestment(game,4,.01);
  game.update(.1);
  assert.equal(calls,1);assert.equal(game.globalHold,true);assert.equal(game.race.over,false);
  assert.equal(game.race.finishers.length,0);
  assert.ok(Math.abs(game.clock-.01/1.02)<1e-10);
  assert.ok(players.slice(0,3).every(player=>player.raceSteps===287));
  assert.equal(game.completeCollective(4,{before:1000,after:1050,delta:50}),true);
  game.update(.1);
  assert.equal(game.race.over,true);assert.equal(game.race.finishers.length,3);assert.equal(players[4].money,1050);
});

test('a declined collective callback consumes the remaining frame without reopening the event',async()=>{
  let calls=0;
  const{game}=await fixture({count:5,onCollectiveLanding:()=>{calls++;return false}});
  for(let i=0;i<3;i++)prepareFinishApproach(game,i,.05+i*.01);
  prepareFocusedInvestment(game,4,.01);
  game.update(.1);
  assert.equal(calls,1);assert.equal(game.globalHold,false);assert.equal(game.race.over,true);
  assert.ok(Math.abs(game.clock-.07/1.02)<1e-10);
});

test('a later collective landing never opens escrow after third place has already crossed',async()=>{
  let calls=0;
  const{game}=await fixture({count:5,onCollectiveLanding:()=>{calls++;return true}});
  for(let i=0;i<3;i++)prepareFinishApproach(game,i,.01+i*.01);
  prepareFocusedInvestment(game,4,.05);
  game.update(.1);
  assert.equal(game.race.over,true);assert.equal(game.globalHold,false);assert.equal(calls,0);
  assert.equal(game.runners[4].phase,'moving');
  assert.ok(Math.abs(game.clock-.03/1.02)<1e-10);
});

test('dispatch priority hook only receives ready actors and cannot dispatch an already running player twice',async()=>{
  const calls=[];const{game}=await fixture({count:5,chooseNextPlayer:eligible=>{calls.push([...eligible]);return eligible.at(-1)}});
  game.update(.31);
  assert.deepEqual(calls.map(eligible=>eligible.at(-1)),[4,3,2,1,0]);
  assert.ok(game.runners.every(r=>r.phase==='roll'));
  const sequences=game.runners.map(r=>r.rollSequence);game.update(.1);
  assert.deepEqual(game.runners.map(r=>r.rollSequence),sequences);
});

test('a complete concurrent 100-racer simulation reaches the top-three podium only after real three-lap crossings',async()=>{
  const{game,players}=await fixture({count:100,interactiveChoices:false,randomRoll:()=>6});
  let frames=0;
  for(;!game.race.over&&frames<10000;frames++)game.update(.25);
  assert.ok(frames<10000,'all independent rules controllers must make progress');
  assert.equal(game.race.finishers.length,3);
  for(const finisher of game.race.finishers) {
    const player=players[finisher.index];
    assert.equal(player.raceSteps,288);assert.equal(player.laps,3);
    assert.equal(player.node,game.race.course.finishNodeId);
  }
  assert.ok(players.every(player=>player.raceSteps<=288));
  assert.ok(players.filter(player=>player.raceSteps>0).length===100);
  assert.equal(game.ledger.length,0,'finishing does not invent a MONEY reward');
});
