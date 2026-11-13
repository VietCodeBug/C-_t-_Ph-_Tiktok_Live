import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LiveRoom } from '../server/room.mjs';

async function room(options={}){return new LiveRoom({mode:'live',seed:42,inactivitySeconds:100000,...options}).init();}
const member=(id,eventId=`arrive-${id}`)=>({type:'member',eventId,user:{id:String(id),nickname:`Người ${id}`}});
async function settle(game){await game.operations;await new Promise(resolve=>setImmediate(resolve));await game.operations;}
function finishApproach(game,index,time=.01){
  const demo=game.demo,player=demo.players[index],runner=demo.runners[index],finish=demo.nodes.get(demo.race.course.finishNodeId);
  const previous=[...demo.nodes.values()].find(node=>node.next.includes(finish.id));
  const a=new THREE.Vector3().fromArray(previous.position),b=new THREE.Vector3().fromArray(finish.position),length=a.distanceTo(b);
  runner.phase='moving';runner.phaseTime=0;runner.remaining=1;runner.stepsCompleted=0;runner.visitedNodes=[previous.id];
  runner.segment={from:previous.id,to:finish.id,a,b,length,progress:1-time*1.02/length};
  player.node=previous.id;player.position.lerpVectors(a,b,runner.segment.progress);player.raceSteps=287;player.laps=2;
  demo.holdPlayer(player.seat,false);game.introQueue=[];game.spotlight=null;
}

test('LIVE starts truly empty and only unique real arrivals enter; capacity20 keeps FIFO customers without actors',async()=>{
  const game=await room();assert.equal(game.snapshot().game,null);assert.equal(game.snapshot().roster.length,0);
  for(let i=1;i<=23;i++)await game.handleSourceEvent(member(i));
  const state=game.snapshot();assert.equal(state.roster.length,20);assert.equal(state.waiting.length,3);
  assert.deepEqual(state.waiting.map(row=>row.id),['21','22','23']);assert.equal(game.world.playerGroup.children.length,20);
  assert.equal(game.introQueue.length,20);assert.equal(game.demo.runners.length,20);assert.equal(game.community.game.accounts.size,23);
  assert.equal(await game.handleSourceEvent(member(1)),false);
  assert.equal(await game.handleSourceEvent(member(1,'reconnect-new-packet')),false);
  assert.equal(game.introQueue.length,20);
});

test('manual opt-in keeps member arrivals out of the map until CHƠI',async()=>{
  const game=await room({autoJoinOnEnter:false});
  await game.handleSourceEvent(member('a'));assert.equal(game.snapshot().roster.length,0);
  assert.equal(await game.command('a','chơi','command-a'),true);assert.equal(game.snapshot().roster.length,1);
});

test('departure promotes oldest customer at zero progress and preserves other racers movement, wallet and event identity',async()=>{
  const game=await room({maxPlayers:2});
  for(const id of ['a','b','c','d'])await game.handleSourceEvent(member(id));
  game.demo.heldSeats.clear();game.introQueue=[];
  const survivor=game.demo.players[1],runner=game.demo.runners[1];
  survivor.money=1470;survivor.raceSteps=17;survivor.laps=0;
  const node=[...game.demo.nodes.values()].find(node=>game.demo.race.course.progress.get(node.id)===(game.demo.race.course.finishIndex+17)%96);
  survivor.node=node.id;survivor.position.fromArray(node.position);runner.phase='event-choice';runner.phaseTime=4;
  runner.event={id:'LIFE01',sequence:77,choices:[{id:'wait'}],result:null};
  await game.handleSourceEvent({type:'leave',eventId:'leave-a',user:{id:'a'}});
  assert.deepEqual(game.snapshot().roster.map(row=>row.id),['b','c']);assert.deepEqual(game.snapshot().waiting.map(row=>row.id),['d']);
  assert.equal(game.demo.players[0],survivor);assert.equal(survivor.money,1470);assert.equal(survivor.raceSteps,17);
  assert.equal(game.demo.runners[0].phase,'event-choice');assert.equal(game.demo.runners[0].phaseTime,4);assert.equal(game.demo.runners[0].event.sequence,77);
  assert.equal(game.demo.players[1].raceSteps,0);assert.equal(game.demo.players[1].node,game.demo.race.course.finishNodeId);
  assert.equal(await game.command('a','LẮC','late-a'),false);assert.equal(game.world.playerGroup.children.length,2);
});

test('welcome spotlight holds later new racers until the current movement and event finish',async()=>{
  const game=await room({maxPlayers:3});for(const id of ['a','b','c'])await game.handleSourceEvent(member(id));
  game.tick(.05);assert.equal(game.snapshot().spotlight.userId,'a');
  game.tick(2);assert.equal(game.demo.runners[0].phase,'roll');assert.equal(game.demo.runners[1].phase,'overview');assert.equal(game.demo.runners[1].phaseTime,0);
  game.tick(2.2);assert.notEqual(game.demo.runners[0].phase,'roll-result');assert.ok(game.demo.players[0].position.distanceTo(new THREE.Vector3().fromArray(game.demo.race.course.finishPosition))>0);
  assert.equal(game.demo.active,0);assert.equal(game.demo.runners[1].phase,'overview');
  for(let i=0;i<2000&&game.demo.active===0;i++)game.tick(.05);
  assert.equal(game.demo.active,1);assert.equal(game.demo.runners[0].phase,'overview');
});

test('solo true three-lap finish closes solo race; top3 closes a larger real room',async()=>{
  const solo=await room();await solo.handleSourceEvent(member('solo'));finishApproach(solo,0);solo.tick(.05);
  assert.equal(solo.demo.players[0].raceSteps,288);assert.equal(solo.demo.race.over,true);assert.equal(solo.snapshot().phase,'podium');
  const group=await room();for(const id of ['a','b','c','d'])await group.handleSourceEvent(member(id));
  for(let i=0;i<3;i++)finishApproach(group,i,.01+i*.005);group.tick(.05);
  assert.equal(group.demo.race.finishLimit,3);assert.equal(group.demo.race.finishers.length,3);assert.equal(group.snapshot().phase,'podium');assert.equal(group.demo.players[3].raceSteps,0);
});

test('collective host departure waits for one settlement, then replaces the actor safely',async()=>{
  const game=await room({maxPlayers:2});for(const id of ['a','b','c'])await game.handleSourceEvent(member(id));
  game.introQueue=[];game.demo.heldSeats.clear();game.demo.select(0);game.demo.previewEvent('invest');
  assert.equal(game.demo.globalHold,true);const event=game.community.game.investment;
  await game.handleSourceEvent({type:'leave',eventId:'leave-host',user:{id:'a'}});
  assert.equal(game.snapshot().roster[0].pendingLeave,true);assert.equal(game.demo.players[0].seat,event.hostId);
  assert.equal(await game.command('a','GÓP','stale-host'),false);
  game.tick(24);await settle(game);
  assert.equal(game.demo.globalHold,false);assert.deepEqual(game.snapshot().roster.map(row=>row.id),['b','c']);
  assert.equal(game.community.game.escrow,0);assert.equal(game.community.game.investment,null);
});

test('capture disconnect freezes rather than evicts; finalized rose credits remain exactly once through pause',async()=>{
  const game=await room({inactivitySeconds:10});await game.handleSourceEvent(member('a'));
  game.setConnection({status:'connected'});game.tick(2);const before=game.demo.players[0].position.toArray();
  const activityAge=game.clock-game.members.get('a').lastActiveAt;
  game.setConnection({status:'reconnecting'});game.tick(330);
  assert.equal(game.snapshot().roster.length,1);assert.deepEqual(game.demo.players[0].position.toArray(),before);
  const gift={type:'gift',eventId:'rose-final',user:{id:'a'},giftId:'5655',count:2,finalized:true};
  assert.equal(await game.handleSourceEvent(gift),true);assert.equal(await game.handleSourceEvent(gift),false);
  assert.equal(game.community.game.accounts.get('P001').roseCredits,2);
  game.setConnection({status:'connected'});assert.equal(game.demo.paused,false);
  assert.ok(game.clock-game.members.get('a').lastActiveAt<=activityAge+1e-6);
  assert.ok(game.members.get('a').lastActiveAt<=game.clock);
  game.tick(.1);await settle(game);assert.equal(game.snapshot().roster.length,1);
});

test('all human card windows use ten seconds; numeric comments choose only the sender own pending card',async()=>{
  const game=await room();for(const id of ['a','b'])await game.handleSourceEvent(member(id));
  game.introQueue=[];game.demo.heldSeats.clear();game.demo.select(0);game.demo.previewEvent('minigame','MINI01');
  game.demo.select(1);assert.equal(game.demo.backgroundDecisionSeconds,10);
  game.tick(4);assert.equal(game.demo.runners[0].phase,'event-choice');
  assert.equal(await game.command('b','1','other-choice'),false);
  assert.equal(await game.command('a','1','right-choice'),true);assert.equal(game.demo.players[0].money,1070);
});

test('inactive policy removes actual members after grace and re-arrival can enroll again',async()=>{
  const game=await room({inactivitySeconds:10});await game.handleSourceEvent(member('a'));game.tick(10.1);await settle(game);
  assert.equal(game.snapshot().roster.length,0);assert.equal(game.snapshot().game,null);
  assert.equal(await game.handleSourceEvent(member('a','arrive-again')),true);assert.equal(game.snapshot().roster.length,1);
});

test('MC ids are unique and welcome names are sanitized; demo controls never create fake live viewers',async()=>{
  const game=await room();const cues=[];game.on('mc',cue=>cues.push(cue));
  await game.handleSourceEvent({type:'member',eventId:'badname',user:{id:'a',nickname:'fuck'}});game.tick(.05);
  game.announce('same','Lời dẫn thứ nhất');game.announce('same','Lời dẫn thứ hai');
  assert.equal(new Set(cues.map(cue=>cue.id)).size,cues.length);assert.ok(cues.every(cue=>!cue.text.includes('fuck')));
  assert.equal(await game.control('demo-join',{count:10}),false);assert.equal(game.snapshot().roster.length,1);
});

test('a real arrival during a collective hold is seated after close without waiting for another leave',async()=>{
  const game=await room({maxPlayers:2});await game.handleSourceEvent(member('a'));
  game.introQueue=[];game.demo.heldSeats.clear();game.demo.previewEvent('invest');
  await game.handleSourceEvent(member('b'));assert.equal(game.snapshot().roster.length,1);assert.equal(game.snapshot().waiting.length,1);
  game.tick(24);await settle(game);
  assert.equal(game.snapshot().roster.length,2);assert.equal(game.snapshot().waiting.length,0);assert.equal(game.demo.players[1].raceSteps,0);
});

test('an already handled personal command cannot settle a different later event',async()=>{
  const game=await room();await game.handleSourceEvent(member('a'));game.introQueue=[];game.demo.heldSeats.clear();
  game.demo.previewEvent('minigame','MINI01');assert.equal(await game.command('a','1','same-choice'),true);
  game.demo.previewEvent('minigame','MINI01');assert.equal(await game.command('a','1','same-choice'),false);
  assert.equal(game.demo.runners[0].phase,'event-choice');assert.equal(game.demo.players[0].money,1070);
});

test('departed finishers retain their archived podium and remaining racers keep stable visual identities',async()=>{
  const game=await room({maxPlayers:3});for(const id of ['a','b','c','d'])await game.handleSourceEvent(member(id));
  const visual=game.snapshot().roster.find(row=>row.id==='c').actorIndex;
  finishApproach(game,0);game.tick(.05);assert.equal(game.demo.race.finishers.length,1);
  await game.handleSourceEvent({type:'leave',eventId:'winner-left',user:{id:'a'}});
  assert.equal(game.snapshot().game.race.finishers[0].name,'Người a');assert.equal(game.snapshot().game.race.finishers[0].index,-1);
  assert.equal(game.snapshot().roster.find(row=>row.id==='c').actorIndex,visual);
  assert.deepEqual(game.snapshot().roster.map(row=>row.id),['b','c','d']);
});

test('podium and reserve produce the next real roster without fake fill accounts',async()=>{
  const game=await room({maxPlayers:3});for(const id of ['a','b','c','d','e'])await game.handleSourceEvent(member(id));
  for(let i=0;i<3;i++)finishApproach(game,i,.01+i*.005);game.tick(.05);
  game.tick(23.1);await settle(game);
  assert.equal(game.snapshot().phase,'race');assert.deepEqual(game.snapshot().roster.map(row=>row.id),['d','e','a']);
  assert.deepEqual(game.snapshot().waiting.map(row=>row.id),['b','c']);assert.ok(game.demo.players.every(player=>player.raceSteps===0&&player.money===1000));
});

test('new envelope recipient lists exclude departed accounts without deleting their wallet history',async()=>{
  const game=await room({maxPlayers:2});for(const id of ['a','b','c'])await game.handleSourceEvent(member(id));
  await game.handleSourceEvent({type:'leave',eventId:'b-left',user:{id:'b'}});
  assert.equal(game.community.game.accounts.size,3);assert.equal(game.community.openEnvelope(4),true);
  assert.deepEqual(game.community.game.redEnvelope.eligibleIds,['P001','P003']);
});

test('configured starting MONEY remains authoritative on initial entry and reset rounds',async()=>{
  const game=await room({startingMoney:500});await game.handleSourceEvent(member('a'));
  assert.equal(game.demo.players[0].money,500);assert.equal(game.community.game.accounts.get('P001').money,500);
  game.demo.players[0].money=700;game.community.syncFromRace();
  assert.equal(await game.control('new-match'),true);
  assert.equal(game.demo.players[0].money,500);assert.equal(game.community.game.accounts.get('P001').money,500);
});

test('lowering capacity preserves current racers until reset then sends overflow behind existing FIFO customers',async()=>{
  const game=await room({maxPlayers:3});for(const id of ['a','b','c','d'])await game.handleSourceEvent(member(id));
  await game.control('settings',{maxPlayers:2});assert.equal(game.snapshot().roster.length,3);
  await game.control('new-match');assert.deepEqual(game.snapshot().roster.map(row=>row.id),['a','b']);
  assert.deepEqual(game.snapshot().waiting.map(row=>row.id),['d','c']);assert.equal(game.world.playerGroup.children.length,2);
});

test('collective narration suppresses the underlying individual card before and after its single settlement',async()=>{
  const game=await room();await game.handleSourceEvent(member('a'));
  game.introQueue=[];game.demo.heldSeats.clear();
  const cues=[];game.on('mc',cue=>cues.push(cue));
  game.demo.previewEvent('invest');
  const cardId=game.demo.runners[0].event.id;
  assert.equal(game.community.modal,'investment');
  game.tick(.1);
  assert.ok(cues.some(cue=>cue.scriptId.startsWith('investment-')&&cue.scriptId.endsWith('.open')));
  assert.equal(cues.filter(cue=>cue.scriptId.startsWith(`event.${cardId}.`)).length,0);
  game.tick(23);
  assert.equal(game.community.modal,null);
  assert.equal(game.demo.runners[0].event.result.community,true);
  assert.equal(cues.filter(cue=>cue.scriptId.startsWith('investment-')&&cue.scriptId.endsWith('.settled')).length,1);
  assert.equal(cues.filter(cue=>cue.scriptId.startsWith(`event.${cardId}.`)).length,0);
  game.tick(1);
  assert.equal(cues.filter(cue=>cue.scriptId.startsWith('investment-')&&cue.scriptId.endsWith('.settled')).length,1);
});
