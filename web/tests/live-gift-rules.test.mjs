import test from 'node:test';
import assert from 'node:assert/strict';
import { LiveRoom } from '../server/room.mjs';
import { CommunityGame } from '../src/community.js';
import { GIFT_CATALOG, resolveGift } from '../src/gift-catalog.js';

const arrival=id=>({type:'member',eventId:`join-${id}`,user:{id:String(id),nickname:`Minh ${id}`}});
const gift=(eventId,id,giftId,count=1,extra={})=>({type:'gift',eventId,user:{id:String(id),nickname:`Minh ${id}`},giftId,count,finalized:true,...extra});
async function room(count=3,options={}){
  const value=await new LiveRoom({seed:42,autoRollSeconds:999,inactivitySeconds:100000,...options}).init();
  for(let i=1;i<=count;i++)await value.handleSourceEvent(arrival(i));
  value.introQueue=[];value.spotlight=null;value.demo.heldSeats.clear();return value;
}
test('verified gift IDs win over names; prices never identify a gift and exact normalized aliases are supported',()=>{
  assert.equal(GIFT_CATALOG.length,7);
  assert.equal(resolveGift({giftId:'7168',giftName:'Rose'}).key,'money-gun');
  assert.equal(resolveGift({giftId:'unknown',diamondCount:1}),null);
  assert.equal(resolveGift({giftId:'unknown',diamondCount:100}),null);
  assert.equal(resolveGift({giftName:'  HAND-HEART '}).key,'hand-heart');
  assert.equal(resolveGift({giftName:'Hoa Hồng'}).key,'rose');
  assert.equal(resolveGift({giftName:'rose something else'}),null);
  assert.equal(resolveGift({giftId:'7934'}).key,'heart-me');
  assert.equal(resolveGift({giftName:'Hear Me Out'}),null);
});
test('rose waits for visible die, then focuses the donor and consumes exactly one credit while background rolls remain concurrent',async()=>{
  const value=await room();const demo=value.demo;
  demo.select(0);demo.requestRollFor(0);value.tick(.1);assert.equal(demo.runners[0].phase,'roll');
  value.community.game.served.add('P003');
  await value.handleSourceEvent(gift('rose-3','3','5655',5));
  demo.requestRollFor(1);value.tick(.15);
  assert.equal(demo.active,0);assert.equal(demo.runners[1].phase,'roll');
  assert.equal(demo.runners[2].phase,'overview');assert.equal(value.community.game.accounts.get('P003').roseCredits,2);
  for(let i=0;i<100&&demo.runners[2].phase==='overview';i++)value.tick(.05);
  assert.equal(demo.active,2);assert.equal(demo.runners[2].phase,'roll');assert.equal(demo.lastDispatched,2);
  assert.equal(value.community.game.accounts.get('P003').roseCredits,1);
  assert.equal(demo.runners[0].phase,'moving');
  const sequence=demo.rollSequence;value.tick(.2);assert.equal(demo.rollSequence,sequence);
});
test('failed rose dispatch keeps its credit and waiting donors do not acquire a seat',async()=>{
  const value=await room(2);await value.handleSourceEvent(gift('rose','2','5655',1));
  const runner=value.demo.runners[1],request=runner.requestRoll;runner.requestRoll=()=>false;
  value.tick(.1);assert.equal(value.community.game.accounts.get('P002').roseCredits,1);assert.equal(value.demo.active,0);
  runner.requestRoll=request;value.tick(.1);assert.equal(value.community.game.accounts.get('P002').roseCredits,0);assert.equal(value.demo.active,1);
  const small=await room(2,{maxPlayers:1});await small.handleSourceEvent(gift('waiter-rose','2','5655',3));small.tick(.2);
  assert.equal(small.snapshot().roster.length,1);assert.equal(small.snapshot().waiting[0].seat,'P002');
  assert.equal(small.community.game.accounts.get('P002').roseCredits,2);
});
test('the20-seat LIVE table retains concurrent background dice throughput',async()=>{
  const value=await room(20);value.demo.autoRollSeconds=0;
  value.tick(1.3);
  assert.equal(value.demo.rollSequence,20);
  assert(value.demo.runners.filter(runner=>['roll','roll-result','moving'].includes(runner.phase)).length>=15);
});
test('gift lìxì pays exact finite pot to active and waiting accounts once and preserves the separate heart bar',async()=>{
  const value=await room(23);value.community.openEnvelope(42);value.community.like('P001',123,'hearts');
  const progress=value.community.game.redEnvelope,initial=value.community.game.snapshot().totals.wallets;
  assert.equal(await value.handleSourceEvent(gift('hands-final','23','5660',4)),true);
  const effect=value.snapshot().giftEffects.find(effect=>effect.effect==='red-envelope');
  assert(effect.pot>=1000&&effect.pot<=5000);assert.equal(effect.participants,23);assert.equal(effect.totalPaid,effect.pot);
  assert.equal(value.community.game.snapshot().totals.wallets-initial,effect.pot);
  assert.equal(value.community.game.redEnvelope,progress);assert.equal(progress.hearts,123);
  assert(value.community.game.accounts.get('P023').money>1000);assert.equal(value.snapshot().roster.length,20);
  assert.equal(await value.handleSourceEvent(gift('hands-final','23','5660',4)),false);
  assert.equal(value.community.game.snapshot().totals.wallets-initial,effect.pot);
  assert.equal(value.community.game.snapshot().totals.conserved,true);
});
test('hand-heart queues behind a collective and coalesces bursts within cooldown without changing startup net',async()=>{
  const value=await room(3);value.demo.previewEvent('invest');const before=value.community.game.investment;
  await value.handleSourceEvent(gift('hand1','2','5924'));await value.handleSourceEvent(gift('hand2','3','5660'));
  assert.equal(value.snapshot().giftEnvelopePending,true);assert.equal(value.snapshot().giftEffects.length,0);
  value.tick(23);const effect=value.snapshot().giftEffects.find(effect=>effect.effect==='red-envelope');assert(effect);
  assert.equal(value.snapshot().giftEnvelopePending,false);assert.equal(before.phase,'settled');
  const initial=value.community.game.snapshot().totals.wallets;
  await value.handleSourceEvent(gift('hand3','2','5660'));await value.handleSourceEvent(gift('hand4','2','5660'));
  assert.equal(value.snapshot().giftEnvelopePending,true);assert.equal(value.community.game.snapshot().totals.wallets,initial);
  // Only the reward clock is advanced here; no extra race turn or synthetic heart is issued.
  value.clock+=30;assert.equal(value.processGiftEnvelope(),true);assert.equal(value.snapshot().giftEnvelopePending,false);
  assert.equal(value.community.game.snapshot().totals.conserved,true);
});
test('cosmetic gifts do not alter MONEY, progress, dice or active seat and effects stay bounded',async()=>{
  const value=await room();const before=value.demo.snapshot(),money=value.community.game.snapshot().totals.wallets;
  const ids=['7934','5879','5586','6267','7168'];
  for(let i=0;i<20;i++)await value.handleSourceEvent(gift(`cosmetic-${i}`,'1',ids[i%ids.length],10));
  const after=value.demo.snapshot();assert.equal(after.active,before.active);assert.equal(after.dice.sequence,before.dice.sequence);
  assert.deepEqual(after.players.map(player=>player.raceSteps),before.players.map(player=>player.raceSteps));
  assert.equal(value.community.game.snapshot().totals.wallets,money);assert.equal(value.snapshot().giftEffects.length,12);
});
test('gift envelope core dedupes recipients and event IDs with exact deterministic integer payouts',()=>{
  const game=new CommunityGame();for(let i=0;i<100;i++)game.register(String(i));
  const result=game.awardGiftEnvelope('confirmed-gift',42,[...game.accounts.keys(),'0']);
  assert.equal(result.payouts.length,100);assert.equal(result.totalPaid,result.pot);assert.equal(game.snapshot().totals.wallets,100000+result.pot);
  assert.equal(game.awardGiftEnvelope('confirmed-gift',42,[...game.accounts.keys()]),null);
  assert.equal(game.snapshot().totals.conserved,true);
});
test('automatic MC is one brief line, quiet tiles are silent and outcomes omit bodies and full wallets',async()=>{
  const value=await room(2),cues=[];value.on('mc',cue=>cues.push(cue));
  value.demo.previewEvent('rest','REST01');value.observeBoard();assert.equal(cues.length,0);
  value.demo.previewEvent('gain','GAIN01');value.observeBoard();
  const gain=cues.find(cue=>cue.scriptId==='event.GAIN01.result');assert(gain);assert.match(gain.text,/\+60/);assert(!gain.text.includes('1060'));assert(gain.text.includes(value.demo.snapshot().event.title));
  value.demo.previewEvent('invest');value.tick(23);
  for(const cue of cues){assert(!/[\r\n]/.test(cue.text));assert(cue.text.split(/\s+/).length<=12, cue.text);assert(!/ví hiện|vốn về|Chiếc ví|góp tổng/i.test(cue.text));}
});
