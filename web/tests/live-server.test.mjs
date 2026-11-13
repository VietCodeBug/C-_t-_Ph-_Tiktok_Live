import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLiveServer, AUDIO_TEST_TEXT } from '../server/index.mjs';

class FakeRoom extends EventEmitter {
  constructor(mode) { super(); this.mode = mode; this.revision = 0; this.received = []; this.actions = []; this.running = false; }
  async init() {}
  start() { this.running = true; }
  stop() { this.running = false; }
  snapshot() { return { revision: this.revision, mode: this.mode, roster: this.received.map(event => event.user?.id).filter(Boolean), game: null }; }
  setConnection(value) { this.connection = value; }
  async handleSourceEvent(event) { await Promise.resolve(); this.received.push(event); this.revision++; this.emit('state', this.snapshot()); }
  async control(action, payload) { this.actions.push({ action, payload }); this.revision++; this.emit('state'); return { ok: true }; }
  configure(settings) { this.settings = settings; }
}
class FakeTikTok extends EventEmitter {
  constructor() { super(); this.connection = { status: 'disconnected', host: '' }; this.connections = []; }
  snapshot() { return this.connection; }
  serialize() { return { seen: [], completed: [] }; }
  async connect(host) { this.connections.push(host); this.connection = { status: 'connected', host, roomId: '123' }; this.emit('connection', this.connection); }
  async disconnect() { this.connection = { status: 'disconnected', host: '' }; this.emit('connection', this.connection); }
}
async function fixture(t, extra = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'co-ty-phi-server-test-'));
  const distDir = join(dir, 'dist'), dataDir = join(dir, 'runtime'), adminFile = join(dir, 'admin.html');
  await mkdir(join(distDir, 'assets'), { recursive: true });
  await writeFile(join(distDir, 'live.html'), '<!doctype html><title>Overlay</title>');
  await writeFile(join(distDir, 'assets', 'sample.glb'), '0123456789');
  await writeFile(adminFile, '<!doctype html><title>Admin</title>');
  const rooms = { live: new FakeRoom('live'), demo: new FakeRoom('demo') }, tiktok = new FakeTikTok(), spoken = [];
  const app = await createLiveServer({ rooms, tiktok, distDir, dataDir, adminFile, synthesizeTTS: async input => { spoken.push(input); return { buffer: Buffer.from('mp3'), contentType: 'audio/mpeg', cacheHit: false, provider: 'google' }; }, ...extra });
  const address = await app.listen(0); const base = `http://127.0.0.1:${address.port}`;
  t.after(async () => { await app.close(); assert(dir.startsWith(join(tmpdir(), 'co-ty-phi-server-test-'))); await rm(dir, { recursive: true, force: true }); });
  const post = (path, value, origin = base) => fetch(base + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  return { app, base, post, rooms, tiktok, spoken, dataDir };
}
test('localhost startup is disconnected; settings contain no secrets and rendering selects independent rooms', async t => {
  const { app, base, tiktok } = await fixture(t);
  assert.equal(tiktok.connections.length, 0);
  assert.equal(app.settings.username, '');
  const health = await (await fetch(base + '/api/health')).json();
  assert.equal(health.app, 'co-ty-phi-live'); assert.equal(health.version, '0.3.0');
  assert.equal((await (await fetch(base + '/api/state?mode=demo')).json()).mode, 'demo');
  for (const path of ['/overlay', '/overlay/', '/demo']) assert.match(await (await fetch(base + path)).text(), /Overlay/);
  assert.match(await (await fetch(base + '/admin')).text(), /Admin/);
});
test('cross-origin and invalid JSON mutations are rejected; control payload goes only to selected mode', async t => {
  const { post, base, rooms } = await fixture(t);
  assert.equal((await post('/api/control', { action: 'reset' }, 'https://evil.example')).status, 403);
  assert.equal(rooms.live.actions.length, 0);
  const bad = await fetch(base + '/api/control', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: 'null' });
  assert.equal(bad.status, 400);
  const reply = await post('/api/control', { mode: 'demo', action: 'seed', payload: { count: 100 } });
  assert.equal(reply.status, 200);
  assert.deepEqual(rooms.demo.actions, [{ action: 'seed', payload: { count: 100 } }]);
  assert.equal(rooms.live.actions.length, 0);
});
test('source ingestion is serialized once and never enters the demo room', async t => {
  const { tiktok, rooms } = await fixture(t);
  tiktok.emit('event', { type: 'comment', eventId: 'e1', user: { id: 'u1' }, text: 'CHƠI' });
  tiktok.emit('event', { type: 'likes', eventId: 'e2', user: { id: 'u1' }, count: 30 });
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.deepEqual(rooms.live.received.map(event => event.eventId), ['e1', 'e2']);
  assert.equal(rooms.demo.received.length, 0);
});
test('queued presence loss cannot overwrite a newer successful connection', async t => {
  const { tiktok, rooms } = await fixture(t);
  rooms.live.handleSourceEvent = async event => {
    await new Promise(resolve => setTimeout(resolve, 2));
    if (event.type === 'presence-clear') rooms.live.setConnection({ status: 'disconnected' });
  };
  tiktok.emit('event', { type: 'presence-clear', reason: 'connection-lost' });
  tiktok.emit('connection', { status: 'reconnecting' });
  tiktok.emit('connection', { status: 'connected', roomId: '123' });
  await new Promise(resolve => setTimeout(resolve, 8));
  assert.equal(rooms.live.connection.status, 'connected');
});
test('SSE reconnect begins with current snapshot and never replays historical MC cues', async t => {
  const { base, rooms } = await fixture(t);
  rooms.live.emit('mc', { id: 'old', eventId: 'START', text: 'Lời cũ' });
  const abort = new AbortController();
  const stream = await fetch(base + '/api/events?mode=live', { signal: abort.signal });
  const reader = stream.body.getReader(), decoder = new TextDecoder();
  const first = decoder.decode((await reader.read()).value);
  assert.match(first, /event: state/); assert.match(first, /event: connection/); assert.match(first, /event: settings/);
  assert(!first.includes('Lời cũ'));
  rooms.live.emit('mc', { id: 'new', eventId: 'GO', text: 'Lời mới' });
  const second = decoder.decode((await reader.read()).value);
  assert.match(second, /event: mc/); assert.match(second, /Lời mới/);
  abort.abort(); await reader.cancel().catch(() => {});
});
test('TTS synthesizes canonical MC only and one fixed operator test phrase', async t => {
  const { post, rooms, spoken } = await fixture(t);
  assert.equal((await post('/api/tts', { id: 'x', eventId: 'CHAT', text: 'tự do' })).status, 403);
  rooms.live.emit('mc', { id: 'cue1', eventId: 'GROUP01', text: 'Cả phố cùng góp vốn!' });
  assert.equal((await post('/api/tts', { id: 'cue1', eventId: 'GROUP01', text: 'khác' })).status, 403);
  const audio = await post('/api/tts', { id: 'cue1', eventId: 'GROUP01', text: 'Cả phố cùng góp vốn!' });
  assert.equal(audio.status, 200); assert.equal(audio.headers.get('x-tts-provider'), 'google');
  assert.equal((await post('/api/tts', { mode: 'demo', id: 'cue1', eventId: 'GROUP01', text: 'Cả phố cùng góp vốn!' })).status, 403);
  assert.equal((await post('/api/tts', { id: 'audio-test', eventId: 'SYSTEM', text: AUDIO_TEST_TEXT })).status, 200);
  assert.deepEqual(spoken.map(item => item.text), ['Cả phố cùng góp vốn!', AUDIO_TEST_TEXT]);
});
test('settings updates serialize without losing other fields; connect is explicit', async t => {
  const { post, app, tiktok, dataDir } = await fixture(t);
  await Promise.all([post('/api/settings', { audio: { volume: .4 } }), post('/api/settings', { autoJoinOnEnter: false })]);
  assert.equal(app.settings.audio.volume, .4); assert.equal(app.settings.autoJoinOnEnter, false);
  assert.equal(tiktok.connections.length, 0);
  assert.equal((await post('/api/connect', { username: '@vietcode' })).status, 202);
  assert.deepEqual(tiktok.connections, ['vietcode']);
  assert.equal(JSON.parse(await readFile(join(dataDir, 'settings.json'), 'utf8')).username, 'vietcode');
  assert.equal((await post('/api/disconnect', {})).status, 200);
  assert.equal(tiktok.connection.status, 'disconnected');
});
test('static media supports ranges, rejects traversal, and supports relative asset URLs under overlay', async t => {
  const { base } = await fixture(t);
  const range = await fetch(base + '/assets/sample.glb', { headers: { Range: 'bytes=2-5' } });
  assert.equal(range.status, 206); assert.equal(await range.text(), '2345');
  assert.equal((await fetch(base + '/assets/sample.glb', { headers: { Range: 'bytes=90-100' } })).status, 416);
  assert.equal(await (await fetch(base + '/overlay/assets/sample.glb')).text(), '0123456789');
  assert.equal((await fetch(base + '/assets/%2e%2e%5csettings.json')).status, 404);
});
test('shutdown rejects stale/cross-origin requests, acknowledges then saves and stops rooms and SSE', async t => {
  const { app, base, post, rooms, dataDir } = await fixture(t);
  assert.equal((await post('/api/shutdown', { serverId: app.serverId }, 'https://evil.example')).status, 403);
  assert.equal((await post('/api/shutdown', { serverId: 'old-instance' })).status, 409);
  assert.equal(app.server.listening, true);
  await post('/api/settings', { audio: { volume: .3 } });
  const stream = await fetch(base + '/events?mode=live'); const reader = stream.body.getReader();
  await reader.read();
  const stopped = new Promise(resolve => app.server.once('close', resolve));
  const response = await post('/api/shutdown', { serverId: app.serverId });
  assert.equal(response.status, 202); assert.equal((await response.json()).stopping, true);
  while (!(await reader.read()).done) {}
  await stopped;
  assert.equal(rooms.live.running, false); assert.equal(rooms.demo.running, false);
  assert.equal(app.server.listening, false);
  assert.equal(JSON.parse(await readFile(join(dataDir, 'settings.json'), 'utf8')).audio.volume, .3);
  assert.deepEqual(JSON.parse(await readFile(join(dataDir, 'tiktok-state.json'), 'utf8')).seen, []);
});
