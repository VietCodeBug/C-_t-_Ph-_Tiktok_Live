import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchmakingQueue, Matchmaking, MATCHMAKING_DEFAULTS, MATCHMAKING_MC } from '../src/matchmaking.js';

const ids = count => Array.from({ length: count }, (_, i) => `P${String(i + 1).padStart(3, '0')}`);

test('100 or 200 registered accounts begin with exactly 20 distinct racers and a stable customer queue', () => {
  assert.equal(Matchmaking, MatchmakingQueue);
  for (const count of [100,200]) {
    const accounts = ids(count), queue = new MatchmakingQueue(accounts, { activeIds: accounts.slice(0,20) });
    const s = queue.snapshot();
    assert.deepEqual(s.activeIds, accounts.slice(0,20));
    assert.equal(new Set(s.activeIds).size, 20);
    assert.deepEqual(s.waitingIds, accounts.slice(20));
    assert.equal(s.waitingCount, count-20);
    assert.equal(s.accountCount, count);
  }
});

test('the first twelve old racers to cross 30 verified hearts retain seats; customers fill eight oldest waiting places', () => {
  const accounts = ids(100), queue = new MatchmakingQueue(accounts);
  assert.equal(queue.beginReserve(accounts.slice(0,20)), true);
  const arrival = [...accounts.slice(8,20), ...accounts.slice(0,8)];
  for (const [index,id] of arrival.entries()) {
    assert.equal(queue.receiveLike(id, 30, `heart-${index}`), true);
    queue.tick(.1);
  }
  const open = queue.snapshot();
  assert.deepEqual(open.reservations.map(entry=>entry.id), accounts.slice(8,20));
  assert.equal(open.qualified.length, 20);
  assert.equal(open.nextActiveIds.length, 0, 'customers do not become racers before the lock');
  assert.equal(open.eligibleIds.length, 0);
  assert.equal(queue.lock(), false, 'an accidental early lock cannot end the full reservation window');
  queue.tick(13.1);
  const closed = queue.snapshot();
  assert.equal(closed.phase, 'ready');
  assert.deepEqual(closed.nextActiveIds, [...accounts.slice(8,20),...accounts.slice(20,28)]);
  assert.deepEqual(closed.waitingIds, [...accounts.slice(28),...accounts.slice(0,8)]);
  assert.equal(closed.nextActiveIds.length,20);
  assert.equal(closed.waitingCount,80);
  assert.equal(new Set([...closed.nextActiveIds,...closed.waitingIds]).size,100);
});

test('unearned retained places are filled from the waiting queue, with no empty seats when enough people exist', () => {
  const accounts=ids(100);
  for (const retainedCount of [0,1,5,11,12]) {
    const queue=new MatchmakingQueue(accounts);
    queue.beginReserve(accounts.slice(0,20));
    for(let i=0;i<retainedCount;i++)queue.receiveLike(accounts[i],30,`qualified-${i}`);
    queue.tick(15);
    const s=queue.snapshot();
    assert.equal(s.nextActiveIds.length,20);
    assert.equal(s.result.retainedIds.length,retainedCount);
    assert.equal(s.result.fromQueueIds.length,20-retainedCount);
    assert.deepEqual(s.result.fromQueueIds,accounts.slice(20,40-retainedCount));
  }
});

test('likes count only in the reservation window and unique packet IDs cannot replay into a later window', () => {
  const accounts=ids(100),queue=new MatchmakingQueue(accounts);
  assert.equal(queue.receiveLike('P001',30,'before-window'),false);
  queue.beginReserve(accounts.slice(0,20));
  assert.equal(queue.receiveLike('P001',30,'before-window'),false);
  assert.equal(queue.receiveLike('P001',20,'packet-a'),true);
  assert.equal(queue.receiveLike('P001',20,'packet-a'),false);
  assert.equal(queue.snapshot().hearts.find(row=>row.id==='P001').count,20);
  assert.equal(queue.receiveLike('P001',10,'packet-b'),true);
  assert.equal(queue.receiveLike('P001',999,'extra-packet'),true);
  assert.equal(queue.snapshot().hearts.find(row=>row.id==='P001').count,30);
  assert.equal(queue.snapshot().reservations.length,1);
  assert.equal(queue.receiveLike('P021',30,'customer-packet'),false);
  queue.tick(15);
  assert.equal(queue.receiveLike('P001',30,'after-window'),false);
  queue.beginReserve(queue.activeIds);
  assert.equal(queue.receiveLike('P001',30,'after-window'),false);
  assert.equal(queue.receiveLike('P021',30,'customer-packet'),false,'a prior customer packet cannot become a seat claim later');
});

test('simultaneous threshold crossings use accepted packet order, not registration order or total heart count', () => {
  const accounts=ids(100),queue=new MatchmakingQueue(accounts);
  queue.beginReserve(accounts.slice(0,20));
  const reverse=accounts.slice(0,20).reverse();
  for(const [i,id]of reverse.entries())queue.receiveLike(id,i===0?1000:30,`same-clock-${i}`);
  assert.deepEqual(queue.snapshot().reservations.map(row=>row.id),reverse.slice(0,12));
  assert.ok(queue.snapshot().reservations.every(row=>row.reachedAt===0));
  assert.deepEqual(queue.snapshot().reservations.map(row=>row.inputOrder),Array.from({length:12},(_,i)=>i+1));
});

test('eight-second podium transitions to a full fifteen-second reservation window; pause dt0 freezes both', () => {
  const accounts=ids(100),queue=new MatchmakingQueue(accounts);
  assert.equal(queue.beginPodium(accounts.slice(0,20)),true);
  assert.equal(queue.snapshot().phase,'podium');
  assert.equal(queue.snapshot().timeleft,8);
  queue.tick(0);
  assert.equal(queue.snapshot().timeleft,8);
  assert.equal(queue.receiveLike('P001',30,'podium-packet'),false);
  queue.tick(8);
  assert.equal(queue.snapshot().phase,'reserving');
  assert.equal(queue.snapshot().timeleft,15);
  assert.equal(queue.receiveLike('P001',30,'podium-packet'),false);
  queue.receiveLike('P001',30,'real-reserve-packet');
  queue.tick(0);
  assert.equal(queue.snapshot().timeleft,15);
  queue.tick(14.9);
  assert.equal(queue.snapshot().phase,'reserving');
  assert.equal(queue.isEligibleForNextMatch('P001'),false);
  queue.tick(.2);
  assert.equal(queue.snapshot().phase,'ready');
  assert.equal(queue.isEligibleForNextMatch('P001'),true);
});

test('one large time step can cross podium and reservation without duplicating or exceeding twenty seats', () => {
  const queue=new MatchmakingQueue(ids(200));
  queue.beginPodium(queue.activeIds);
  queue.tick(30);
  assert.equal(queue.snapshot().phase,'ready');
  assert.equal(queue.snapshot().nextActiveIds.length,20);
  assert.equal(new Set(queue.snapshot().nextActiveIds).size,20);
  assert.equal(queue.lock(),false);
  assert.equal(queue.snapshot().waitingCount,180);
});

test('waiting customers rotate fairly even if the same twelve old racers always retain seats', () => {
  const accounts=ids(100),queue=new MatchmakingQueue(accounts),seen=new Set(queue.activeIds);
  for(let match=0;match<11;match++) {
    const old=[...queue.activeIds];
    queue.beginReserve(old);
    for(const id of accounts.slice(0,12))queue.receiveLike(id,30,`match-${match}:${id}`);
    queue.tick(15);
    for(const id of queue.activeIds)seen.add(id);
    assert.equal(queue.snapshot().result.retainedIds.length,12);
    assert.equal(queue.snapshot().result.fromQueueIds.length,8);
    assert.equal(queue.activeIds.length,20);
    assert.equal(queue.waitingIds.length,80);
  }
  assert.equal(seen.size,100,'every original waiting customer eventually receives a racing seat');
});

test('late registrations append behind existing customers and cannot claim a retained seat', () => {
  const accounts=ids(100),queue=new MatchmakingQueue(accounts);
  queue.beginReserve(queue.activeIds);
  assert.equal(queue.register('P101'),true);
  assert.equal(queue.register('P101'),true);
  assert.equal(queue.receiveLike('P101',30,'late-customer'),false);
  queue.tick(15);
  assert.equal(queue.accounts.size,101);
  assert.equal(queue.activeIds.includes('P101'),false);
  const waiting=queue.snapshot().waitingIds;
  assert.ok(waiting.indexOf('P101')>waiting.indexOf('P100'));
  assert.ok(waiting.indexOf('P101')<waiting.indexOf('P001'),'old non-retained racers join behind already waiting customers');
});

test('fewer than twenty registered people use all available accounts without inventing duplicates', () => {
  const accounts=ids(15),queue=new MatchmakingQueue(accounts);
  queue.beginReserve(queue.activeIds);
  for(const id of accounts)queue.receiveLike(id,30,`qualified:${id}`);
  queue.tick(15);
  assert.equal(queue.activeIds.length,15);
  assert.equal(new Set(queue.activeIds).size,15);
  assert.equal(queue.waitingIds.length,0);
});

test('invalid configuration, unknown IDs, bad counts and repeated opening do not corrupt a current window', () => {
  assert.throws(()=>new MatchmakingQueue(ids(100),{reserved:21}),/configuration/);
  const queue=new MatchmakingQueue(ids(100));
  assert.equal(queue.beginReserve(queue.activeIds,{threshold:0}),false);
  assert.equal(queue.beginReserve(['unknown']),false);
  assert.equal(queue.beginReserve(queue.activeIds),true);
  assert.equal(queue.beginReserve(queue.activeIds),false);
  assert.equal(queue.receiveLike('unknown',30,'unknown-packet'),false);
  assert.equal(queue.receiveLike('P001',0,'zero'),false);
  assert.equal(queue.receiveLike('P001',-5,'negative'),false);
  assert.equal(queue.receiveLike('P001',30,''),false);
  assert.throws(()=>queue.tick(-1),/matchmaking time/);
  assert.throws(()=>queue.tick(Infinity),/matchmaking time/);
  assert.equal(queue.snapshot().reservations.length,0);
  assert.equal(queue.snapshot().waitingCount,80);
  assert.deepEqual(MATCHMAKING_DEFAULTS,{seats:20,reserved:12,threshold:30,duration:15,podiumSeconds:8});
  for(const key of ['podium','reserveOpen','earned','quotaFull','customer','locked','start'])assert.ok(MATCHMAKING_MC[key]);
});
