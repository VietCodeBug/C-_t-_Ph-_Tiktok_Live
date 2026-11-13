import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { TikTokService, normalizeWebcast, redactTikTokError } from '../server/tiktok.mjs';
import { validateSettings, DEFAULT_SETTINGS } from '../server/config.mjs';

const ROOM = '7520012345678901234';
const packet = (msgId, extra = {}) => ({ common: { msgId, roomId: ROOM }, user: { id: '7200012345678901234', nickname: 'Ngọc', uniqueId: 'ngoc' }, ...extra });
function harness(savedState = {}) {
  let time = 1000000, serial = 0;
  const timers = new Map(), events = [];
  const adapter = new TikTokService({ now: () => time, savedState,
    setTimer: (fn, delay) => { const id = ++serial; timers.set(id, { fn, due: time + delay }); return id; },
    clearTimer: id => timers.delete(id), env: {},
  });
  adapter.on('event', event => events.push(event));
  return { adapter, events, timers, async advance(ms) { time += ms; for (const [id, timer] of [...timers]) if (timer.due <= time) { timers.delete(id); await timer.fn(); } } };
}
test('provider string IDs stay exact and never fall back to mutable handles', () => {
  const event = normalizeWebcast('comment', packet('1', { content: 'CHƠI' }), ROOM);
  assert.equal(event.user.id, '7200012345678901234');
  assert.equal(event.text, 'CHƠI');
  assert.equal(normalizeWebcast('comment', packet('2', { user: { uniqueId: 'ngoc' }, content: 'CHƠI' }), ROOM), null);
  assert.equal(normalizeWebcast('comment', packet('2', { user: { id: 7200012345678901234 }, content: 'CHƠI' }), ROOM), null);
  assert.equal(normalizeWebcast('comment', packet('3', { common: { roomId: '123' }, content: 'CHƠI' }), ROOM), null);
});
test('likes use packet deltas, duplicate receipts are ignored across restart', () => {
  const { adapter, events } = harness();
  assert.equal(adapter.ingest('likes', packet('like1', { likeCount: 30, totalLikeCount: 50000 }), ROOM), true);
  assert.equal(adapter.ingest('likes', packet('like1', { likeCount: 30 }), ROOM), false);
  assert.equal(events[0].count, 30);
  const restarted = harness(adapter.serialize());
  assert.equal(restarted.adapter.ingest('likes', packet('like1', { likeCount: 30 }), ROOM), false);
});
test('streak gift produces one finalized total and only a later higher delta', () => {
  const { adapter, events } = harness();
  const gift = (id, count, end) => packet(id, { giftId: 5655, giftType: 1, groupId: 'streak1', repeatCount: count, repeatEnd: end });
  adapter.ingest('gift', gift('g1', 1, false), ROOM);
  adapter.ingest('gift', gift('g2', 4, false), ROOM);
  assert.equal(events.length, 0);
  adapter.ingest('gift', gift('g2', 4, true), ROOM);
  adapter.ingest('gift', gift('g2', 4, true), ROOM);
  assert.deepEqual(events.map(event => event.count), [4]);
  adapter.ingest('gift', gift('g3', 6, true), ROOM);
  assert.deepEqual(events.map(event => event.count), [4, 2]);
  assert(events.every(event => event.finalized));
  const restarted = harness(adapter.serialize());
  restarted.adapter.ingest('gift', gift('reconnect-final', 6, true), ROOM);
  assert.equal(restarted.events.length, 0);
});
test('unfinished streak times out once; late final does not double-credit', async () => {
  const { adapter, events, advance } = harness();
  const gift = packet('g1', { giftId: '5655', giftType: 1, groupId: 'c1', repeatCount: 3, repeatEnd: false });
  adapter.ingest('gift', gift, ROOM);
  await advance(4000);
  adapter.ingest('gift', { ...gift, common: { ...gift.common, msgId: 'g2' }, repeatEnd: true }, ROOM);
  assert.deepEqual(events.map(event => event.count), [3]);
});
test('new ungrouped streak with same quantity receives a distinct finalized event ID', () => {
  const { adapter, events } = harness();
  for (const prefix of ['first', 'second']) {
    adapter.ingest('gift', packet(prefix + '1', { giftId: '5655', giftType: 1, repeatCount: 1, repeatEnd: false }), ROOM);
    adapter.ingest('gift', packet(prefix + '2', { giftId: '5655', giftType: 1, repeatCount: 2, repeatEnd: true }), ROOM);
  }
  assert.deepEqual(events.map(event => event.count), [2, 2]);
  assert.notEqual(events[0].eventId, events[1].eventId);
});
test('nonstreak receipt cannot be awarded again with a modified repeatCount', () => {
  const { adapter, events } = harness();
  adapter.ingest('gift', packet('g1', { giftId: 1234, giftType: 0, repeatCount: 1 }), ROOM);
  adapter.ingest('gift', packet('g1', { giftId: 1234, giftType: 0, repeatCount: 5 }), ROOM);
  assert.deepEqual(events.map(event => event.count), [1]);
  assert.equal(adapter.ingest('gift', { user: { id: '1' }, giftId: 1234, giftType: 0 }, ROOM), false);
});
test('member does not imply leave; current viewer total never removes a known identity', () => {
  const { adapter, events } = harness();
  adapter.ingest('member', packet('enter1', { action: 2 }), ROOM);
  adapter.ingest('member', packet('enter1', { action: 3 }), ROOM);
  adapter.ingest('viewer-count', { common: { roomId: ROOM }, total: 1 }, ROOM);
  assert.equal(adapter.present.size, 1);
  assert.deepEqual(events.map(event => event.type), ['member', 'viewer-count']);
  adapter.ingest('leave', packet('leave1'), ROOM);
  assert.equal(adapter.present.size, 0);
  adapter.ingest('member', packet('enter3'), ROOM);
  assert.equal(adapter.present.size, 1);
});
class FakeClient extends EventEmitter {
  constructor(result = { roomId: ROOM }) { super(); this.result = result; this.closed = 0; }
  async connect() { if (this.result instanceof Error) throw this.result; this.roomId = this.result.roomId; return this.result; }
  async disconnect() { this.closed++; }
}
test('manual disconnect cancels pending reconnect and rejects stale client packets', async () => {
  const { adapter, events, timers, advance } = harness();
  const clients = [];
  adapter.createClient = () => { const client = new FakeClient(); clients.push(client); return client; };
  await adapter.connect('@ngoc');
  clients[0].emit('chat', packet('a', { comment: 'CHƠI' }));
  clients[0].emit('disconnected');
  assert.equal(adapter.connection.status, 'reconnecting');
  assert.equal(timers.size, 1);
  await adapter.disconnect(); await advance(60000);
  clients[0].emit('chat', packet('b', { comment: 'LẮC' }));
  assert.equal(clients.length, 1);
  assert.equal(adapter.connection.status, 'disconnected');
  assert.deepEqual(events.filter(event => event.type === 'comment').map(event => event.text), ['CHƠI']);
});
test('offline uses 30 second retry and reconnect rejects replayed arrivals but passes a verified new arrival', async () => {
  const { adapter, events, advance } = harness();
  const clients = [];
  adapter.createClient = () => { const client = new FakeClient(clients.length === 0 ? Object.assign(new Error('not live'), { name: 'UserOfflineError' }) : { roomId: ROOM }); clients.push(client); return client; };
  await adapter.connect('ngoc');
  assert.equal(adapter.connection.retryAt, 1030000);
  await advance(30000);
  clients[1].emit('member', packet('m1'));
  clients[1].emit('disconnected'); await advance(5000);
  clients[2].emit('member', packet('m1'));
  assert.equal(events.filter(event => event.type === 'member').length, 1);
  clients[2].emit('member', packet('m2'));
  assert.equal(events.filter(event => event.type === 'member').length, 2);
});
test('late connect resolution cannot override a newer manual disconnect', async () => {
  const { adapter } = harness();
  let resolveConnect;
  const client = new FakeClient();
  client.connect = () => new Promise(resolve => { resolveConnect = resolve; });
  adapter.createClient = () => client;
  const connecting = adapter.connect('ngoc');
  while (!resolveConnect) await Promise.resolve();
  await adapter.disconnect(); resolveConnect({ roomId: ROOM }); await connecting;
  assert.equal(adapter.connection.status, 'disconnected');
  assert(client.closed >= 1);
});
test('errors redact credentials and settings persist only approved public fields', () => {
  const message = redactTikTokError('SIGN_API_KEY=abc cookie=anything', { SIGN_API_KEY: 'abc' });
  assert(!message.includes('abc')); assert(!message.includes('anything'));
  const settings = validateSettings({ username: '@ngoc', audio: { rate: 1.05 }, gameplay: { maxPlayers: 200 }, token: 'secret' });
  assert.equal(settings.username, 'ngoc'); assert.equal(settings.audio.rate, 1.05);
  assert.equal(settings.gameplay.maxPlayers, 20); assert.equal(settings.token, undefined);
  assert.equal(DEFAULT_SETTINGS.username, '');
});
