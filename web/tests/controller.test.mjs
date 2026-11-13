import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CommunityController } from '../src/community-controller.js';
import { createInvestmentChart } from '../src/community.js';
import { ParallelRace } from '../src/parallel-race.js';
import { createTownLayouts } from '../src/layouts.js';

function fixture(count = 100, { accountCount = count } = {}) {
  const accounts = Array.from({ length: accountCount }, (_, index) => ({
    seat: `P${String(index + 1).padStart(3, '0')}`, data: { name: `Người ${index + 1}` }, money: 1000, laps: 0
  }));
  const players = accounts.slice(0,count);
  const demo = { players, active: 0, paused: false, speed: 1, globalHold: false, layout: { seed: 42 }, race: { over: false },
    completed: [], selected: [], requestRollFor(index) { this.lastRollIndex = index; return index >= 0 && index < players.length; },
    chooseForkFor(index, direction) { this.lastFork = { index, direction }; return index >= 0 && index < players.length; },
    select(index) { this.active = index; this.selected.push(index); return true; },
    setHold(value) { this.globalHold = value; },
    completeCollective(index, result) {
      this.completed.push({ index, result }); this.players[index].money = result.after; this.globalHold = false; return true;
    }
  };
  const sounds = [], cues = [];
  const controller = new CommunityController(demo, { accounts, onSound: sound => sounds.push(sound), onMC: cue => cues.push(cue) });
  return { controller, demo, players, accounts, sounds, cues };
}

function seedFor(direction) {
  for (let seed = 0; seed < 10000; seed++) if (createInvestmentChart(seed).direction === direction) return seed;
}

test('default chart seed and outcome do not depend on likes, gifts or duplicate comment traffic', () => {
  const a=fixture(),b=fixture();
  b.controller.like('P002',900,'extra-likes');b.controller.rose('P003','extra-rose');
  for(let i=0;i<10;i++)b.controller.comment('P004','GÓP',`closed-${i}`);
  assert.equal(a.controller.openInvestment(),true);assert.equal(b.controller.openInvestment(),true);
  a.controller.update(18);b.controller.update(18);
  assert.deepEqual(a.controller.game.investmentSnapshot().result,b.controller.game.investmentSnapshot().result);
});

test('unfinished shared hearts and unused rose priority carry to the next match without paying an unopened pot', () => {
  const {controller,demo,players}=fixture();
  controller.openEnvelope(42);controller.like('P003',390,'partial-hearts');controller.rose('P004','late-rose');
  demo.race.over=true;
  assert.equal(controller.like('P003',10,'after-finish'),false);
  assert.equal(controller.rose('P005','podium-rose'),true);
  assert.equal(controller.resetForMatch({manual:false}),true);
  assert.equal(controller.game.redEnvelopeSnapshot().hearts,390);
  assert.equal(controller.game.redEnvelopeSnapshot().result,null);
  assert.equal(controller.game.accounts.get('P004').roseCredits,1);
  assert.equal(controller.game.accounts.get('P005').roseCredits,1);
  assert.ok(players.every(player=>player.money===1000));
});

test('invalid startup host does not throw and a blocked lap envelope is retried after the modal closes', () => {
  const {controller,players}=fixture();
  assert.equal(controller.openInvestment(-1),false);
  assert.equal(controller.openInvestment(1000),false);
  controller.openInvestment(0,{seed:5});players[0].laps=1;
  controller.update(0);assert.equal(controller.lastEnvelopeLap,0);
  controller.update(18);controller.update(4.1);
  assert.equal(controller.game.redEnvelopeSnapshot().phase,'collecting');
  assert.equal(controller.lastEnvelopeLap,1);
});

test('100-person collective mirrors each escrow debit and payout once to race wallets', () => {
  const { controller, demo, players, sounds, cues } = fixture();
  assert.equal(controller.openInvestment(7, { seed: seedFor('up') }), true);
  assert.equal(demo.active, 7);
  assert.equal(demo.globalHold, true);
  assert.equal(players[7].money, 900);
  assert.equal(controller.simulateJoins(), 99);
  assert.ok(players.every(player => player.money === 900));
  assert.equal(controller.comment('P099', 'GÓP', 'duplicate-join'), false);
  controller.update(10);
  assert.equal(controller.game.investmentSnapshot().phase, 'chart');
  assert.equal(controller.game.investmentSnapshot().result, null);
  controller.update(8);
  const event = controller.game.investmentSnapshot();
  assert.equal(event.result.results.length, 100);
  const hostResult = event.result.results.find(row => row.id === 'P008');
  assert.ok(players.every(player => player.money === 1000 + hostResult.net));
  assert.equal(demo.completed.length, 0);
  controller.update(4.1);
  assert.equal(demo.completed.length, 1);
  assert.equal(demo.completed[0].result.before, 1000);
  assert.equal(demo.completed[0].result.after, 1000 + hostResult.net);
  assert.equal(demo.completed[0].result.delta, hostResult.net);
  assert.equal(demo.globalHold, false);
  assert.equal(controller.modal, null);
  assert.equal(controller.game.investment, null);
  controller.update(20);
  assert.equal(demo.completed.length, 1, 'arrival presentation cannot apply the group money twice');
  assert.ok(players.every(player => player.money === 1000 + hostResult.net));
  assert.equal(controller.game.ledger.filter(row => row.type === 'investment-join').length, 100);
  assert.equal(controller.game.ledger.filter(row => row.type === 'investment-settlement').length, 100);
  assert.equal(controller.game.snapshot().totals.conserved, true);
  assert.deepEqual(sounds, ['sfx_coin_up']);
  assert.ok(cues.every(cue => cue.kind === 'script-only'));
});

test('a losing chart debits only committed capital including the owner and returns remaining principal', () => {
  const { controller, demo, players, sounds } = fixture(10);
  controller.openInvestment(0, { seed: seedFor('down') });
  controller.simulateJoins();
  controller.update(18);
  const result = controller.game.investmentSnapshot().result;
  const returned = result.results[0].returned;
  assert.ok(returned >= 15 && returned <= 70);
  assert.ok(players.every(player => player.money === 900 + returned));
  controller.update(4.1);
  assert.equal(demo.completed[0].result.delta, returned - 100);
  assert.ok(players.every(player => player.money >= 0 && player.money === 900 + returned));
  assert.deepEqual(sounds, ['sfx_coin_down']);
  assert.equal(controller.game.snapshot().totals.conserved, true);
});

test('ordinary landing income and fees survive synchronization before and after collective play', () => {
  const { controller, players } = fixture(10);
  players[3].money += 60;
  players[8].money -= 35;
  controller.update(0);
  assert.equal(controller.game.accounts.get('P004').money, 1060);
  assert.equal(controller.game.accounts.get('P009').money, 965);
  const ledgerSize = controller.game.ledger.length;
  controller.update(0);
  assert.equal(controller.game.ledger.length, ledgerSize, 'an unchanged mirrored wallet is not posted again');
  controller.openInvestment(3, { seed: seedFor('up') });
  controller.simulateJoins(); controller.update(18);
  const net = controller.game.investmentSnapshot().result.results[0].net;
  controller.update(4.1);
  assert.equal(players[3].money, 1060 + net);
  assert.equal(players[8].money, 965 + net);
  assert.equal(controller.game.accounts.get('P004').money, players[3].money);
  assert.equal(controller.game.snapshot().totals.conserved, true);
});

test('paused controller rejects comments, likes and roses and freezes collective clocks', () => {
  const { controller, demo, players } = fixture(10);
  controller.openInvestment();
  const before = controller.game.snapshot();
  demo.paused = true;
  assert.equal(controller.comment('P002', 'GÓP', 'paused-comment'), false);
  assert.equal(controller.like('P002', 1000, 'paused-like'), false);
  assert.equal(controller.rose('P002', 'paused-gift'), false);
  assert.equal(controller.simulateJoins(), 0);
  controller.update(100);
  assert.deepEqual(controller.game.investmentSnapshot(), before.investment);
  assert.equal(players[1].money, 1000);
  assert.equal(controller.game.accounts.get('P002').roseCredits, 0);
  demo.paused = false;
  assert.equal(controller.comment('P002', 'GÓP', 'paused-comment'), true);
  assert.equal(players[1].money, 900);
});

test('Vietnamese comment aliases target the current host, and withdrawal refunds once before lock', () => {
  const { controller, players } = fixture(10);
  controller.openInvestment(7);
  assert.equal(controller.comment('P002', '  tham gia   p008  ', 'alias-join'), true);
  assert.equal(players[1].money, 900);
  assert.equal(controller.comment('P002', 'KHÔNG THAM GIA P008', 'alias-pass'), true);
  assert.equal(players[1].money, 1000);
  assert.equal(controller.comment('P002', 'KHÔNG THAM GIA P008', 'alias-pass'), false);
  assert.equal(controller.comment('P003', 'GÓP P999', 'wrong-startup'), false);
  assert.equal(controller.comment('missing', 'GÓP', 'missing-account'), false);
  controller.update(10);
  assert.equal(controller.comment('P002', 'GÓP P008', 'late-join'), false);
  assert.equal(players[1].money, 1000);
});

test('envelope pays all participants once, retains ordinary income and releases the shared hold', () => {
  const { controller, demo, players, sounds } = fixture(10);
  assert.equal(controller.openEnvelope(42), true);
  assert.equal(demo.globalHold, false, 'normal race can continue while hearts are being collected');
  players[9].money += 70;
  controller.update(0);
  assert.equal(controller.like('P001', 1000, 'full-bar'), true);
  const result = controller.game.redEnvelopeSnapshot().result;
  const leader = result.payouts.find(row => row.id === 'P010');
  assert.equal(leader.rank, 1);
  assert.equal(players[9].money, 1070 + leader.amount);
  assert.equal(result.payouts.length, 10);
  assert.equal(result.totalPaid, result.pot);
  controller.update(0);
  assert.equal(controller.modal, 'envelope');
  assert.equal(demo.globalHold, true);
  const balances = players.map(player => player.money);
  controller.update(5.1);
  assert.equal(controller.modal, null);
  assert.equal(demo.globalHold, false);
  assert.equal(controller.game.redEnvelope, null);
  controller.update(10);
  assert.deepEqual(players.map(player => player.money), balances);
  assert.deepEqual(sounds, ['sfx_coin_up']);
  assert.equal(controller.game.snapshot().totals.conserved, true);
});

test('manual new match restores balances and keeps unused finalized rose credits', () => {
  const { controller, demo, players } = fixture(10);
  controller.openInvestment();
  controller.simulateJoins();
  controller.rose('P010', 'late-final-rose');
  assert.equal(controller.resetForMatch({ manual: true }), true);
  assert.equal(controller.match, 2);
  assert.equal(demo.globalHold, false);
  assert.ok(players.every(player => player.money === 1000));
  assert.equal(controller.game.accounts.get('P010').roseCredits, 1);
  assert.equal(controller.rose('P010', 'late-final-rose'), false);
  assert.equal(demo.chooseNextPlayer(players.map((_, index) => index)), 9);
  assert.equal(controller.game.snapshot().totals.conserved, true);
});

test('real 100-runner landing callback holds the race and completes group money without ordinary double debit', async () => {
  const world = { playerGroup: new THREE.Group(), followHeading: new THREE.Vector3(), camera: new THREE.PerspectiveCamera(),
    lookAt: new THREE.Vector3(), renderer: { info: { render: { calls: 0, triangles: 0 } } }, async loadMap() {}, updateCamera() { return 'follow'; } };
  const players = Array.from({ length: 100 }, (_, index) => ({
    group: new THREE.Group(), position: new THREE.Vector3(), heading: new THREE.Vector3(),
    seat: `P${String(index + 1).padStart(3, '0')}`, data: { name: `Người ${index + 1}` }, money: 1000, images: new Map(),
    setClip(clip) { this.clip = clip; }, loadClip() {}, update() {}
  }));
  const demo = new ParallelRace(world, players, createTownLayouts(42), null, { randomRoll: () => 1 });
  await demo.changeMap('CHO_VIA_HE');
  const controller = new CommunityController(demo);
  demo.select(7);
  assert.equal(demo.previewEvent('invest', 'INV01'), true);
  assert.equal(demo.runners[7].phase, 'community');
  assert.equal(demo.globalHold, true);
  assert.equal(players[7].money, 900);
  controller.simulateJoins();
  controller.update(18);
  const result = controller.game.investmentSnapshot().result;
  const host = result.results.find(row => row.id === 'P008');
  controller.update(4.1);
  assert.equal(demo.runners[7].phase, 'arrive');
  assert.equal(demo.runners[7].event.result.community, true);
  assert.equal(demo.runners[7].event.result.delta, host.net);
  assert.equal(players[7].money, 1000 + host.net);
  assert.equal(demo.ledger.filter(row => row.collective).length, 1);
  demo.update(1); controller.update(0);
  assert.equal(players[7].money, 1000 + host.net);
  assert.equal(controller.game.ledger.filter(row => row.type === 'investment-settlement').length, 100);
  assert.equal(controller.game.snapshot().totals.conserved, true);
});

test('twenty racers and eighty waiting customers all retain community wallets and can join collective money events', () => {
  const {controller,players}=fixture(20,{accountCount:100});
  assert.equal(players.length,20);
  assert.equal(controller.snapshot().accounts.length,100);
  assert.equal(controller.waitingCustomerIds().length,80);
  controller.openInvestment();
  assert.equal(controller.simulateJoins(),99);
  controller.update(18);
  assert.equal(controller.game.investmentSnapshot().result.results.length,100);
  controller.update(4.1);
  controller.openEnvelope(42);
  assert.equal(controller.simulateHearts(),100);
  assert.equal(controller.game.redEnvelopeSnapshot().result.payouts.length,100);
  assert.equal(controller.game.snapshot().totals.conserved,true);
});

test('shop controller accepts eight waiting-customer orders and six returns, holds four seconds, then commits host950 once', () => {
  const {controller,demo,players,sounds,cues}=fixture(20,{accountCount:100});
  controller.matchmaking={snapshot:()=>({waitingIds:[...controller.game.accounts.keys()].slice(20)})};
  assert.equal(controller.openShop(),true);
  assert.equal(controller.modal,'shop');
  assert.equal(demo.globalHold,true);
  assert.equal(players[0].money,920);
  assert.equal(controller.snapshot().shop.eligibleCustomerIds.length,80);
  assert.equal(controller.ordersAll(8),8);
  assert.equal(controller.comment('P002','MUA P001','active-racer-order'),false);
  assert.equal(controller.comment('P001','MUA P001','host-order'),false);
  controller.update(12);
  assert.equal(controller.snapshot().shop.phase,'returns');
  assert.equal(controller.cancelOrders(6),6);
  controller.update(12);
  const settled=controller.snapshot().shop;
  assert.equal(settled.phase,'settled');
  assert.equal(settled.result.net,-50);
  assert.equal(settled.settledRemainingSeconds,4);
  assert.equal(players[0].money,950);
  assert.equal(demo.completed.length,0);
  controller.update(3.9);
  assert.equal(demo.globalHold,true);
  controller.update(.2);
  assert.equal(controller.modal,null);
  assert.equal(demo.globalHold,false);
  assert.equal(demo.completed.length,1);
  assert.equal(demo.completed[0].result.delta,-50);
  assert.equal(demo.completed[0].result.after,950);
  assert.equal(demo.completed[0].result.shop,true);
  controller.update(20);
  assert.equal(demo.completed.length,1);
  assert.equal(players[0].money,950);
  assert.ok([...controller.game.accounts.values()].slice(20).every(account=>account.money===1000));
  assert.equal(controller.game.ledger.filter(row=>row.id.endsWith(':inventory')).length,1);
  assert.equal(controller.game.ledger.filter(row=>row.id.endsWith(':settlement')).length,1);
  assert.equal(sounds.filter(sound=>sound==='sfx_order').length,8);
  assert.equal(sounds.filter(sound=>sound==='sfx_return').length,6);
  assert.equal(sounds.at(-1),'sfx_coin_down');
  assert.ok(cues.some(cue=>cue.id.endsWith('.returns')));
  assert.ok(cues.some(cue=>cue.id.endsWith('.settled')));
  assert.equal(controller.game.snapshot().totals.conserved,true);
});

test('shop comment aliases are targeted and idempotent, while pause freezes both windows and rejects order inputs', () => {
  const {controller,demo}=fixture(20,{accountCount:100});
  controller.openShop();
  assert.equal(controller.comment('P021','  mua p001  ','first-order'),true);
  assert.equal(controller.comment('P022','P001','bare-host-alias'),true);
  assert.equal(controller.comment('P021','MUA P001','first-order'),false);
  assert.equal(controller.comment('P023','MUA P999','wrong-host'),false);
  const before=controller.snapshot().shop;
  demo.paused=true;
  assert.equal(controller.comment('P023','MUA P001','paused-order'),false);
  controller.update(100);
  assert.equal(controller.snapshot().shop.remainingSeconds,before.remainingSeconds);
  assert.equal(controller.snapshot().shop.count,2);
  demo.paused=false;
  assert.equal(controller.comment('P023','MUA P001','paused-order'),true);
  controller.update(12);
  assert.equal(controller.comment('P021','BOM P001','return-own'),true);
  assert.equal(controller.comment('P021','BOM P001','repeat-return'),false);
  assert.equal(controller.comment('P022','TRẢ P001','return-alias'),true);
  assert.equal(controller.comment('P024','BOM P001','no-order'),false);
  assert.equal(controller.snapshot().shop.cancelled,2);
});

test('waiting-customer LẮC does not dispatch an invalid racer and their left/right command becomes a crowd vote', () => {
  const {controller,demo}=fixture(20,{accountCount:100});
  controller.like('P021',10,'stale-notice-source');
  assert.equal(controller.comment('P021','LẮC','guest-roll'),false);
  assert.match(controller.notice,/khách chờ ghế/);
  assert.equal(demo.lastRollIndex,undefined);
  const votes=[];
  demo.voteFork=(id,direction)=>{votes.push({id,direction});return true;};
  assert.equal(controller.comment('P021','TRÁI','guest-vote-left'),true);
  assert.deepEqual(votes,[{id:'P021',direction:'left'}]);
  assert.match(controller.notice,/phiếu rẽ đường/);
  assert.equal(controller.comment('P001','PHẢI','racer-choice-right'),true);
  assert.deepEqual(demo.lastFork,{index:0,direction:'right'});
  assert.equal(votes.length,1);
});

test('manual reset refunds an open shop before rebasing wallets, while an automatic reset refuses an unsettled shop', () => {
  const {controller,players}=fixture(20,{accountCount:100});
  controller.openShop();controller.ordersAll();
  assert.equal(controller.resetForMatch(),false);
  assert.equal(players[0].money,920);
  assert.equal(controller.shop.snapshot().phase,'ordering');
  let walletAtReset=null,phaseAtReset=null;
  const reset=controller.game.reset.bind(controller.game);
  controller.game.reset=options=>{walletAtReset=controller.game.accounts.get('P001').money;phaseAtReset=controller.shop.snapshot().phase;return reset(options);};
  assert.equal(controller.resetForMatch({manual:true}),true);
  assert.equal(walletAtReset,1000);
  assert.equal(phaseAtReset,'closed');
  assert.equal(players[0].money,1000);
  assert.equal(controller.game.snapshot().totals.conserved,true);
  assert.equal(controller.resetForMatch({manual:true}),true);
  assert.equal(walletAtReset,1000,'closed shop inventory is not refunded a second time');
});

test('TRADE01 opens a focused collective shop and shares the investment cooldown without hijacking other trade cards', () => {
  const {controller,demo}=fixture(20,{accountCount:100});
  assert.equal(demo.onCollectiveLanding(0,{id:'TRADE02',category:'trade'}),false);
  assert.equal(demo.onCollectiveLanding(0,{id:'TRADE01',category:'trade'}),true);
  controller.ordersAll();controller.update(12);controller.cancelOrders();controller.update(12);controller.update(4.1);
  assert.equal(demo.onCollectiveLanding(0,{id:'INV01',category:'invest'}),false);
  controller.update(17);
  assert.equal(demo.onCollectiveLanding(0,{id:'INV01',category:'invest'}),true);
});

test('real twenty-runner TRADE01 callback settles a customer shop once instead of applying the ordinary sale choice', async () => {
  const world={playerGroup:new THREE.Group(),followHeading:new THREE.Vector3(),camera:new THREE.PerspectiveCamera(),
    lookAt:new THREE.Vector3(),renderer:{info:{render:{calls:0,triangles:0}}},async loadMap(){},updateCamera(){return'follow';}};
  const accounts=Array.from({length:100},(_,index)=>({seat:`P${String(index+1).padStart(3,'0')}`,data:{name:`Người ${index+1}`},money:1000}));
  const players=accounts.slice(0,20).map(account=>Object.assign(account,{group:new THREE.Group(),position:new THREE.Vector3(),heading:new THREE.Vector3(),images:new Map(),setClip(clip){this.clip=clip;},loadClip(){},update(){}}));
  const demo=new ParallelRace(world,players,createTownLayouts(42),null,{randomRoll:()=>1});
  await demo.changeMap('CHO_VIA_HE');
  const controller=new CommunityController(demo,{accounts});
  assert.equal(demo.previewEvent('trade','TRADE01'),true);
  assert.equal(demo.runners[0].phase,'community');
  assert.equal(demo.globalHold,true);
  assert.equal(players[0].money,920);
  assert.equal(controller.ordersAll(),8);
  controller.update(12);assert.equal(controller.cancelOrders(),6);controller.update(12);controller.update(4.1);
  assert.equal(players[0].money,950);
  assert.equal(demo.runners[0].event.result.shop,true);
  assert.equal(demo.runners[0].event.result.delta,-50);
  assert.equal(demo.ledger.filter(row=>row.collective).length,1);
  assert.equal(demo.chooseEvent('salary'),false);
  assert.equal(players[0].money,950);
  assert.equal(controller.game.snapshot().totals.conserved,true);
});

test('a collecting envelope does not block investment; its result waits and cannot replace the investment hold or inflate its profit',()=>{
  const {controller,demo,players}=fixture(20,{accountCount:100});
  controller.openEnvelope(42);
  controller.like('P021',300,'first-envelope-hearts');
  assert.equal(controller.openInvestment(0,{seed:seedFor('up')}),true);
  controller.simulateJoins();
  controller.like('P022',700,'finish-envelope-during-investment');
  const envelope=controller.game.redEnvelopeSnapshot();
  const hostShare=envelope.result.payouts.find(row=>row.id==='P001').amount;
  assert.equal(envelope.phase,'settled');
  controller.update(0);
  assert.equal(controller.modal,'investment');
  assert.equal(demo.globalHold,true);
  assert.equal(controller.openEnvelope(9),false,'a paid but not yet presented envelope cannot be overwritten');
  controller.update(18);
  const net=controller.game.investmentSnapshot().result.results.find(row=>row.id==='P001').net;
  controller.update(4.1);
  assert.equal(controller.modal,'envelope');
  assert.equal(demo.globalHold,true,'modal handoff retains the hold in the same update');
  assert.equal(demo.completed.length,1);
  assert.equal(demo.completed[0].result.delta,net);
  assert.equal(demo.completed[0].result.before,1000+hostShare);
  assert.equal(demo.completed[0].result.after,1000+hostShare+net);
  assert.equal(demo.completed[0].result.openingBalance,1000);
  assert.equal(players[0].money,1000+hostShare+net);
  controller.update(5.1);
  assert.equal(controller.modal,null);
  assert.equal(demo.globalHold,false);
  assert.equal(controller.game.ledger.filter(row=>row.type==='red-envelope').length,100);
  assert.equal(controller.game.ledger.filter(row=>row.type==='investment-settlement').length,100);
  assert.equal(controller.game.snapshot().totals.conserved,true);
});

test('a collecting envelope does not block the shop; deferred payout presentation keeps host net950 plus separate lìxì and never releases hold early',()=>{
  const {controller,demo,players}=fixture(20,{accountCount:100});
  controller.openEnvelope(42);
  controller.like('P021',300,'partial-hearts-before-shop');
  assert.equal(controller.openShop(),true);
  assert.equal(controller.ordersAll(),8);
  controller.update(12);
  controller.like('P030',700,'finish-envelope-during-shop');
  const share=controller.game.redEnvelopeSnapshot().result.payouts.find(row=>row.id==='P001').amount;
  controller.update(0);
  assert.equal(controller.modal,'shop');
  assert.equal(demo.globalHold,true);
  assert.equal(controller.cancelOrders(),6);
  controller.update(12);
  const settled=controller.snapshot().shop.result;
  assert.equal(settled.net,-50);
  assert.equal(settled.openingBalance,1000);
  assert.equal(settled.concurrentDelta,share);
  assert.equal(settled.before,1000+share);
  assert.equal(settled.after,950+share);
  assert.equal(players[0].money,950+share);
  controller.update(4.1);
  assert.equal(controller.modal,'envelope');
  assert.equal(demo.globalHold,true);
  assert.equal(demo.completed.length,1);
  assert.equal(demo.completed[0].result.delta,-50);
  assert.equal(demo.completed[0].result.after,950+share);
  controller.update(5.1);
  assert.equal(controller.modal,null);
  assert.equal(demo.globalHold,false);
  assert.equal(players[0].money,950+share);
  assert.equal(controller.game.ledger.filter(row=>row.id.endsWith(':inventory')).length,1);
  assert.equal(controller.game.ledger.filter(row=>row.id.endsWith(':settlement')).length,1);
  assert.equal(controller.game.ledger.filter(row=>row.type==='red-envelope').length,100);
  assert.equal(controller.game.snapshot().totals.conserved,true);
});
