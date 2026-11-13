import test from 'node:test';
import assert from 'node:assert/strict';
import { EVENT_CARDS } from '../src/events.js';
import { MC_CUES, SHOP_MC_CUES, createMCPack, renderMCLine } from '../src/mc-script.js';

test('MC pack covers every runtime event and all variable declarations match actual placeholders',()=> {
  const pack = createMCPack();
  assert.equal(pack.eventCount,EVENT_CARDS.length);
  assert.equal(new Set(MC_CUES.map(cue=>cue.id)).size,MC_CUES.length);
  for(const card of EVENT_CARDS) {
    assert.ok(MC_CUES.some(cue=>cue.eventId===card.id && cue.phase==='event.open'));
    for(const result of ['gain','loss','neutral']) assert.ok(MC_CUES.some(cue=>cue.id===`event.${card.id}.${result}`));
    const prompt=MC_CUES.find(cue=>cue.id===`event.${card.id}.choose`);
    assert.equal(!!prompt,card.choices.length>0);
    if(prompt) assert.deepEqual(Object.values(prompt.commandMap),card.choices.map(choice=>choice.id));
  }
  for(const selected of MC_CUES) {
    const tokens=[...new Set([...selected.line.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/g)].map(match=>match[1]))];
    assert.deepEqual(selected.variables,tokens);
    const vars=Object.fromEntries(tokens.map(name=>[name,name==='playerName'?'Nguyễn Ánh':'100']));
    const result=renderMCLine(selected.id,vars,{strict:true});
    assert.equal(result.missingVariables.length,0); assert.ok(!/[{}]/.test(result.line));
  }
});

test('MC money cues use distinct SFX and missing values cannot silently become undefined',()=> {
  assert.equal(MC_CUES.find(cue=>cue.id==='event.LOSS01.loss').sfx,'sfx_coin_down');
  assert.equal(MC_CUES.find(cue=>cue.id==='event.GAIN01.gain').sfx,'sfx_coin_up');
  assert.equal(MC_CUES.find(cue=>cue.id==='event.REST01.open').sfx,null);
  assert.throws(()=>renderMCLine('race.turn',{}, {strict:true}),/Missing MC variables/);
  const safe=renderMCLine('race.turn',{playerName:'A\n{hacked}',playerTag:'P01'},{strict:true});
  assert.ok(!safe.line.includes('\n')); assert.ok(!safe.line.includes('{'));
  const pack=createMCPack();
  assert.equal(pack.gameFacts.actualRacers,20);assert.equal(pack.gameFacts.totalAccounts,100);assert.equal(pack.gameFacts.stressModeRacers,100); assert.equal(pack.gameFacts.targetLaps,3);
  assert.equal(pack.gameFacts.finishersToEndMatch,3); assert.equal(pack.gameFacts.resultHoldSeconds,8);
  assert.equal(pack.gameFacts.matchmaking.reserveSeconds,15);assert.equal(pack.gameFacts.matchmaking.heartTarget,30);
  assert.equal(pack.gameFacts.matchmaking.retainedSeats+pack.gameFacts.matchmaking.waitingSeats,20);
  assert.equal(pack.gameFacts.queue.giftsChangeDice,false); assert.equal(pack.gameFacts.queue.giftsChangeChart,false);
});

test('shop MC describes simulated own-order cancellation without charging customers or setup twice',()=> {
  const pack=createMCPack();
  assert.equal(SHOP_MC_CUES.length,9);
  assert.equal(pack.gameFacts.shop.hostMinimumWallet,120);
  assert.equal(pack.gameFacts.shop.preSettlementAbortRefund,80);
  assert.equal(pack.gameFacts.shop.refundAfterSettlement,false);
  assert.equal(pack.gameFacts.shop.customerWalletCharge,0);
  assert.equal(pack.gameFacts.shop.realPurchase,false);
  assert.equal(pack.gameFacts.shop.cancelOwnOrderOnly,true);
  assert.equal(pack.gameFacts.shop.chargeSetupOnce,true);
  assert.equal(pack.gameFacts.shop.orderSeconds,12);assert.equal(pack.gameFacts.shop.returnSeconds,12);
  const settle=MC_CUES.find(cue=>cue.id==='shop.settle');
  assert.deepEqual(settle.resultSfxByDelta,{positive:'sfx_coin_up',negative:'sfx_coin_down',zero:null});
  assert.equal(renderMCLine('shop.settle',{salesDelta:30}).sfx,'sfx_coin_up');
  assert.equal(renderMCLine('shop.settle',{salesDelta:-5}).sfx,'sfx_coin_down');
  assert.equal(renderMCLine('shop.settle',{salesDelta:0}).sfx,null);
  assert.equal(1000-pack.gameFacts.shop.setupCost+2*pack.gameFacts.shop.goodReward-6*pack.gameFacts.shop.cancelPenalty,950);
});
