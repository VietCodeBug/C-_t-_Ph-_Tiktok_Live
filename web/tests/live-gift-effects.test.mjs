import test from 'node:test';
import assert from 'node:assert/strict';
import {GIFT_CATALOG} from '../src/gift-catalog.js';
import {GiftEffectState,giftDonorPosition,normalizeGiftEffect} from '../src/live-gift-effects-rules.js';

const effect=(giftKey='rose',id='gift1',extra={})=>({id,eventId:id,giftKey,effect:GIFT_CATALOG.find(gift=>gift.key===giftKey).effect,userId:'u1',seat:'P001',name:'Người thật',count:1,at:10,expiresAt:18,...extra});
test('the pre-SSE null state is safe and does not stop the render loop',()=>{
  const state=new GiftEffectState();assert.deepEqual(state.update(.016,null),[]);assert.deepEqual(state.update(.016,undefined),[]);
  assert.equal(state.snapshot().activeCount,0);
});
test('fresh cosmetic types are presentation data and duplicate SSE snapshots never restart them',()=>{
  for(const gift of GIFT_CATALOG.filter(gift=>gift.effect!=='red-envelope')){
    const state=new GiftEffectState(),packet={at:10.1,giftEffects:[effect(gift.key)]};
    assert.equal(state.update(.05,packet).length,1);assert.equal(state.update(.05,packet).length,0);
    assert.equal(state.snapshot().received,1);assert.equal(state.snapshot().active[0].isPayout,false);assert.equal(state.snapshot().lastPayout,null);
  }
});
test('old reload effects and already expired packets remain ignored on subsequent updates',()=>{
  const state=new GiftEffectState();
  assert.equal(state.update(.1,{at:12,giftEffects:[effect('rose')]}).length,0);
  assert.equal(state.update(.1,{at:10.1,giftEffects:[effect('rose')]}).length,0,'remember an old receipt even if an out-of-order snapshot follows');
  assert.equal(normalizeGiftEffect(effect('rose','expired',{expiresAt:10}),10),null);
  assert.equal(normalizeGiftEffect(effect('rose','future',{at:12}),10),null);
});
test('a burst remains bounded to four effects and twenty particles regardless of combo count',()=>{
  const state=new GiftEffectState();
  state.update(.05,{at:10,giftEffects:Array.from({length:30},(_,index)=>effect('donut',`burst-${index}`,{count:100000}))});
  assert.equal(state.snapshot().activeCount,4);assert.ok(state.snapshot().particleCount<=20);
  assert.ok(state.snapshot().active.every(item=>item.effect==='confetti'));
});
test('HandHeart only announces a committed server payout once and a cosmetic burst cannot displace it',()=>{
  const state=new GiftEffectState(),payout=effect('hand-heart','paid',{pot:2700,participants:100,totalPaid:2700});
  const accepted=state.update(.1,{at:10,giftEffects:[payout]});
  assert.equal(accepted.filter(item=>item.isPayout).length,1);assert.deepEqual(state.snapshot().lastPayout,{id:'paid',pot:2700,participants:100,totalPaid:2700});
  const burst=Array.from({length:20},(_,index)=>effect('heart-me',`heart-${index}`));state.update(.1,{at:10.2,giftEffects:[payout,...burst]});
  assert.ok(state.snapshot().active.some(item=>item.id==='paid'));assert.equal(state.update(.1,{at:10.3,giftEffects:[payout]}).length,0);
  assert.equal(normalizeGiftEffect(effect('hand-heart','bad',{pot:300,participants:2,totalPaid:600}),10),null);
});
test('renderer effects expire locally without requiring another server event',()=>{
  const state=new GiftEffectState(),packet={at:10,giftEffects:[effect('corgi')]};state.update(0,packet);
  for(let index=0;index<20;index++)state.update(.25,packet);
  assert.equal(state.snapshot().activeCount,0);assert.equal(state.snapshot().received,1);
});
test('donor anchors use actual racer or waiting positions and never infer an avatar from a name',()=>{
  const source=effect();
  assert.deepEqual(giftDonorPosition(source,{actors:[{seat:'P001',position:[1,0,2]}]}),[1,0,2]);
  assert.deepEqual(giftDonorPosition(source,{waiting:[{userId:'u1',position:[3,0,4]}]}),[3,0,4]);
  assert.equal(giftDonorPosition(source,{actors:[{name:'Người thật',seat:'P002',position:[1,0,2]}]}),null);
});
