import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RaceState, raceCourse } from '../src/race.js';
import { CameraDemo } from '../src/demo.js';
import { createTownLayouts, FORK_STARTS } from '../src/layouts.js';
import { DICE_ROLL_SECONDS, DICE_RESULT_SECONDS } from '../src/dice.js';

function players(count=10) {
  return Array.from({length:count},(_,i)=>({group:new THREE.Group(),position:new THREE.Vector3(),heading:new THREE.Vector3(),
    seat:String(i+1),data:{name:`Người ${i+1}`},money:1000,images:new Map(),setClip(clip){this.clip=clip},loadClip(){},update(){}}));
}

test('finish line is reproducible, varies by seed and occupies a bottom tile crossed by every route',()=>{
  const finishes=new Set();
  for(let seed=0;seed<100;seed++) for(const layout of Object.values(createTownLayouts(seed))) {
    const a=raceCourse(layout), b=raceCourse(layout);
    finishes.add(a.finishNodeId);assert.equal(a.finishNodeId,b.finishNodeId);assert.equal(a.lapSteps,96);
    assert.ok(a.finishPosition[2]>=layout.bounds.maxZ-8);
    assert.equal([...a.progress.values()].filter(value=>value===a.finishIndex).length,1);
  }
  assert.ok(finishes.size>1);
});

test('all 64 branch choices require exactly 288 real edges to finish three complete circuits',()=>{
  for(const layout of Object.values(createTownLayouts(42))) for(let mask=0;mask<64;mask++) {
    const racers=players(1),race=new RaceState(layout,racers),p=racers[0],nodes=new Map(layout.nodes.map(n=>[n.id,n]));
    let current=race.course.finishNodeId;
    for(let step=1;step<=288;step++) {
      const node=nodes.get(current), fork=FORK_STARTS.indexOf(Number(current.slice(1)));
      current=node.next.length>1?node.next[(mask>>fork)&1]:node.next[0];
      const finished=race.recordEdge(p,current,1);
      assert.equal(p.laps,Math.floor(step/96));assert.equal(finished,step===288);
      assert.equal(p.finished,step===288);
    }
    assert.equal(current,race.course.finishNodeId);assert.equal(p.money,1000);
    assert.equal(race.recordEdge(p,current,2),false);assert.equal(race.finishers.length,1);
  }
});

test('100 racers advance independently and the third finish closes the podium while MONEY standings remain separate',()=>{
  const layout=createTownLayouts(55).CHO_VIA_HE, racers=players(100),race=new RaceState(layout,racers);
  const nodes=new Map(layout.nodes.map(node=>[node.id,node]));
  const positions=racers.map(()=>race.course.finishNodeId);
  assert.equal(new Set(racers.map(p=>p.spawnOffset.join(','))).size,100);
  for(let step=1;step<=288;step++) for(let i=0;i<100;i++) {
    const node=nodes.get(positions[i]);positions[i]=node.next[(i+step)%node.next.length];
    race.recordEdge(racers[i],positions[i],step);
  }
  assert.equal(race.over,true);assert.equal(race.finishers.length,3);
  assert.equal(racers[2].raceSteps,288);assert.equal(racers[3].raceSteps,287);
  racers[99].money=2000;racers[50].money=2000;
  const final=race.snapshot().moneyStandings;
  assert.deepEqual(final.slice(0,2).map(row=>row.rank),[1,1]);assert.equal(final[2].rank,3);
  assert.equal(final[0].index,50);assert.equal(final[1].index,99);assert.equal(racers[99].finishRank,null);
  assert.deepEqual(race.snapshot().finalStandings.map(row=>row.index),[0,1,2]);
});

async function fixture(options={}) {
  const racers=players(options.count||10),loaded=[];
  const world={playerGroup:new THREE.Group(),followHeading:new THREE.Vector3(),camera:new THREE.PerspectiveCamera(),lookAt:new THREE.Vector3(),
    renderer:{info:{render:{calls:0,triangles:0}}},async loadMap(layout){loaded.push(layout.id)},updateCamera(){return'overview'}};
  const demo=new CameraDemo(world,racers,createTownLayouts(42),null,{raceMode:true,randomRoll:()=>6,...options});
  await demo.changeMap('CHO_VIA_HE');return{demo,racers,loaded};
}

test('race starts all players fairly at the random line and finishes on the precise crossing even mid-roll',async()=>{
  const {demo,racers}=await fixture();const finish=demo.race.course.finishNodeId;
  assert.ok(racers.every(p=>p.node===finish&&p.raceSteps===0));
  const p=racers[0],before=[...demo.race.course.progress].find(([id,at])=>at===(demo.race.course.finishIndex+95)%96&&id.startsWith('C'))[0];
  p.node=before;p.position.fromArray(demo.nodes.get(before).position);p.raceSteps=287;p.laps=2;
  demo.requestRoll();demo.update(DICE_ROLL_SECONDS);demo.update(DICE_RESULT_SECONDS);
  for(let i=0;demo.phase==='moving'&&i<100;i++)demo.update(.2);
  assert.equal(demo.phase,'finished');assert.equal(p.node,finish);assert.equal(demo.stepsCompleted,1);assert.equal(demo.remaining,0);
  assert.equal(p.finished,true);assert.equal(p.raceSteps,288);assert.equal(p.money,1000);
  demo.update(2.5);assert.equal(demo.active,1);assert.equal(demo.race.finishers.length,1);
});

test('priority dispatch hook receives only eligible players and race mode never regenerates the map between turns',async()=>{
  let received;const{demo,racers,loaded}=await fixture({count:100,chooseNextPlayer:(eligible,current)=>{received={eligible,current};return 99}});
  demo.randomizeRounds=true;racers[0].finished=true;demo.nextTurn();
  assert.equal(demo.active,99);assert.equal(received.eligible.length,99);assert.ok(!received.eligible.includes(0));
  demo.chooseNextPlayer=()=>500;demo.nextTurn();assert.equal(demo.active,1);
  assert.equal(loaded.length,1);assert.equal(demo.race.snapshot().players.length,100);
});

test('preview movement never skips race progress and restores the original logical position',async()=>{
  const{demo,racers}=await fixture({interactiveChoices:true});const origin=racers[0].node;
  demo.previewFork();demo.update(DICE_ROLL_SECONDS);demo.update(DICE_RESULT_SECONDS);demo.chooseFork('left');
  for(let i=0;demo.phase==='moving'&&i<1000;i++)demo.update(.2);
  assert.equal(racers[0].raceSteps,0);assert.equal(demo.snapshot().race.preview,true);
  demo.nextTurn();assert.equal(racers[0].node,origin);assert.equal(demo.snapshot().race.preview,false);
});
