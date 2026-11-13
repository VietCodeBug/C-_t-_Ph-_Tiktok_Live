import test from 'node:test';
import assert from 'node:assert/strict';
import { LiveRoom } from '../server/room.mjs';

const arrival = id => ({ type: 'member', eventId: `arrival-${id}`, user: { id: String(id), nickname: `Bạn ${id}` } });
const gift = (eventId, userId, extra = {}) => ({ type: 'gift', eventId, user: { id: String(userId), nickname: `Bạn ${userId}` }, finalized: true, giftId: '9001', giftName: 'Pháo hoa', count: 1, ...extra });
const createRoom = options => new LiveRoom({ mode: 'live', seed: 42, inactivitySeconds: 100000, ...options }).init();

test('empty LIVE publishes no invented leaderboard rows or gift receipts', async () => {
  const room = await createRoom();
  assert.deepEqual(room.snapshot().leaderboard, []);
  assert.deepEqual(room.snapshot().gifts, []);
  assert.equal(await room.control('demo-start', { count: 20 }), false);
  assert.equal(room.members.size, 0);
});
test('all finalized gift types enter one deduplicated feed without MONEY effects; only roses keep existing priority', async () => {
  const room = await createRoom({ maxPlayers: 1 });
  await room.handleSourceEvent(arrival('a')); await room.handleSourceEvent(arrival('b'));
  const wallet = id => room.community.game.accounts.get(id);
  const before = [...room.community.game.accounts].map(([id, account]) => [id, account.money]);
  room.setConnection({ status: 'reconnecting' });
  const nonRose = gift('combo-final-3', 'b', { count: 3, diamondCount: 10 });
  assert.equal(await room.handleSourceEvent(nonRose), true);
  assert.equal(await room.handleSourceEvent(nonRose), false);
  assert.equal(wallet('P002').roseCredits, 0);
  assert.equal(await room.handleSourceEvent(gift('combo-final-5-delta', 'b', { count: 2, diamondCount: 10 })), true);
  assert.equal(await room.handleSourceEvent(gift('rose-final', 'a', { count: 2, giftId: '5655', giftName: 'Hoa hồng', diamondCount: 1 })), true);
  assert.equal(wallet('P001').roseCredits, 2);
  assert.deepEqual([...room.community.game.accounts].map(([id, account]) => [id, account.money]), before);
  const state = room.snapshot();
  assert.equal(state.gifts.length, 3);
  assert.equal(state.gifts[0].id, 'rose-final');
  assert.equal(state.gifts[1].count, 2);
  assert.equal(state.gifts[2].coins, 30);
  assert.equal(state.gifts[2].userId, 'b'); assert.equal(state.gifts[2].seat, 'P002');
  assert.equal(state.gifts[2].at, state.at);
  assert.equal(state.waiting[0].giftCount, 5); assert.equal(state.waiting[0].giftCoins, 50);
  assert.equal(state.leaderboard.find(row => row.userId === 'b').giftCount, 5);
});
test('partial/invalid gifts never enter the feed; unknown donors do not acquire a game wallet or actor', async () => {
  const room = await createRoom();
  assert.equal(await room.handleSourceEvent(gift('partial', 'donor', { finalized: false })), false);
  assert.equal(await room.handleSourceEvent(gift('bad-count', 'donor', { count: Infinity })), false);
  assert.equal(await room.handleSourceEvent(gift('bad-id', 'donor', { giftId: '<bad>' })), false);
  assert.equal(room.snapshot().gifts.length, 0);
  assert.equal(await room.handleSourceEvent(gift('valid-donor', 'donor')), true);
  const state = room.snapshot();
  assert.equal(state.gifts.length, 1); assert.equal(state.gifts[0].coins, undefined);
  assert.equal(state.roster.length, 0); assert.equal(state.waiting.length, 0); assert.equal(state.leaderboard.length, 0);
  assert.equal(room.community, null);
});
test('receipt list remains bounded while per-member totals survive trimming and match resets', async () => {
  const room = await createRoom(); await room.handleSourceEvent(arrival('a'));
  for (let i = 1; i <= 45; i++) await room.handleSourceEvent(gift(`g-${i}`, 'a', { count: 2, diamondCount: 3 }));
  let state = room.snapshot();
  assert.equal(state.gifts.length, 40); assert.equal(state.gifts[0].eventId, 'g-45'); assert.equal(state.gifts.at(-1).eventId, 'g-6');
  assert.equal(state.roster[0].giftCount, 90); assert.equal(state.roster[0].giftCoins, 270);
  await room.control('new-match'); state = room.snapshot();
  assert.equal(state.gifts.length, 40); assert.equal(state.roster[0].giftCount, 90); assert.equal(state.roster[0].money, 1000);
});
test('MONEY standings include waiting customers, use a stable tie order, and omit departures without deleting wallets', async () => {
  const room = await createRoom();
  for (let i = 1; i <= 100; i++) await room.handleSourceEvent(arrival(i));
  room.community.game.adjustBalance('P100', 500, 'test-income', 'income-p100');
  room.community.game.adjustBalance('P002', 200, 'test-income', 'income-p002'); room.community.syncToRace();
  let state = room.snapshot();
  assert.equal(state.leaderboard.length, 100); assert.equal(state.roster.length, 20); assert.equal(state.waiting.length, 80);
  assert.deepEqual(state.leaderboard.slice(0, 4).map(row => row.seat), ['P100', 'P002', 'P001', 'P003']);
  assert.equal(state.leaderboard[0].rank, 1); assert.equal(state.leaderboard[0].money, 1500); assert.equal(state.leaderboard[0].waiting, true);
  await room.handleSourceEvent({ type: 'leave', eventId: 'leave-100', user: { id: '100' } }); state = room.snapshot();
  assert.equal(state.leaderboard.length, 99); assert.equal(state.leaderboard.some(row => row.seat === 'P100'), false);
  assert.equal(room.community.game.accounts.get('P100').money, 1500); assert.equal(room.community.game.accounts.size, 100);
});
test('concurrent DEMO start requests create one playable20-seat table and never reset an existing game', async () => {
  const room = await createRoom({ mode: 'demo' });
  await Promise.all([room.control('demo-start', { count: 20 }), room.control('demo-start', { count: 20 })]);
  assert.equal(room.snapshot().roster.length, 20); assert.equal(room.members.size, 20); assert.equal(room.snapshot().waiting.length, 0);
  room.community.game.adjustBalance('P001', 70, 'test-income', 'demo-income'); room.community.syncToRace();
  await room.control('demo-start', { count: 20 });
  assert.equal(room.snapshot().roster.length, 20); assert.equal(room.snapshot().roster[0].money, 1070);
  await room.control('demo-gift', { userId: 'demo-1', giftId: '9001', giftName: 'Pháo hoa', count: 4, diamondCount: 5 });
  assert.equal(room.snapshot().gifts[0].count, 4); assert.equal(room.snapshot().gifts[0].coins, 20);
  assert.equal(room.community.game.accounts.get('P001').roseCredits, 0);
  assert.equal(room.snapshot().roster[0].money, 1070);
});
