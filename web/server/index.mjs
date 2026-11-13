import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { TikTokService, redactTikTokError } from './tiktok.mjs';
import { DEFAULT_SETTINGS, serverConfig, validateSettings, cleanUsername } from './config.mjs';
import { createStateWriter, readJson, writeJsonAtomic } from './state-writer.mjs';
import { AUDIO_TEST_TEXT } from '../src/live-speech-policy.js';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4' };
const validMode = mode => mode === 'demo' ? 'demo' : 'live';
const localHost = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i;
export { AUDIO_TEST_TEXT };

function json(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(value));
}
async function bodyJSON(request) {
  if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) throw Object.assign(new Error('Yêu cầu phải dùng application/json.'), { status: 415 });
  const chunks = []; let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 32000) throw Object.assign(new Error('Yêu cầu JSON quá dài.'), { status: 413 });
    chunks.push(chunk);
  }
  let value;
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw Object.assign(new Error('JSON không hợp lệ.'), { status: 400 }); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Object.assign(new Error('Dữ liệu JSON phải là một đối tượng.'), { status: 400 });
  return value;
}
function safeAsset(root, pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  if (decoded.includes('\0') || decoded.includes('\\')) return null;
  const file = resolve(root, '.' + decoded);
  return file.startsWith(resolve(root) + sep) ? file : null;
}

/** Two authoritative rooms. Browser renderers subscribe; rendering never advances a room. */
export async function createLiveServer(options = {}) {
  const config = { ...serverConfig(), ...options.config };
  for (const key of ['dataDir', 'distDir', 'adminFile']) if (options[key]) config[key] = options[key];
  const serverId = randomUUID();
  const settingsFile = resolve(config.dataDir, 'settings.json');
  const adapterFile = resolve(config.dataDir, 'tiktok-state.json');
  let settings = validateSettings(await readJson(settingsFile, DEFAULT_SETTINGS));
  let settingsWrite = Promise.resolve();
  let stopping = false, publishing = null, closePromise = null;
  const streams = new Set(), recentCues = { live: new Map(), demo: new Map() }, sourceQueue = [];
  const errors = [], subscriptions = [];
  let processing = false;
  const reportError = error => { errors.push({ at: Date.now(), message: redactTikTokError(error?.message || error) }); if (errors.length > 30) errors.shift(); };
  const rooms = options.rooms || await (async () => {
    const { LiveRoom } = await import('./room.mjs');
    return Object.fromEntries(['live', 'demo'].map(mode => [mode, new LiveRoom({ mode, ...settings.gameplay, autoJoinOnEnter: settings.autoJoinOnEnter, gifts: settings.gifts, roseIds: settings.gifts.roseIds })]));
  })();
  for (const room of Object.values(rooms)) await room.init?.();
  const tiktok = options.tiktok || new TikTokService({ savedState: await readJson(adapterFile, {}) });
  const writer = createStateWriter({ snapshot: () => tiktok.serialize(), write: value => writeJsonAtomic(adapterFile, value), onError: reportError });
  const snapshot = (mode = 'live') => ({
    ...(rooms[validMode(mode)].getSnapshot?.() ?? rooms[validMode(mode)].snapshot()),
    mode: validMode(mode), serverId, settings,
    connection: mode === 'demo' ? { status: 'demo', host: '', roomId: '', error: '', attempt: 0 } : tiktok.snapshot(),
  });
  function send(stream, type, data) {
    if (stream.response.destroyed) return;
    if (stream.response.writableLength > 512000) { stream.response.destroy(); return; }
    stream.response.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  }
  function broadcast(type, data, mode = null) {
    for (const stream of streams) if (!mode || stream.mode === mode) send(stream, type, data);
  }
  function scheduleState() {
    if (publishing || stopping) return;
    publishing = setTimeout(() => {
      publishing = null;
      const states = {};
      for (const stream of streams) send(stream, 'state', states[stream.mode] ??= snapshot(stream.mode));
    }, 70).unref();
  }
  function subscribe(emitter, event, handler) {
    emitter.on(event, handler); subscriptions.push(() => emitter.off(event, handler));
  }
  for (const [mode, room] of Object.entries(rooms)) {
    subscribe(room, 'state', scheduleState);
    subscribe(room, 'change', scheduleState);
    subscribe(room, 'room-error', reportError);
    subscribe(room, 'mc', cue => {
      if (!cue?.id || typeof cue.text !== 'string') return;
      recentCues[mode].set(String(cue.id), { ...cue, rememberedAt: Date.now() });
      while (recentCues[mode].size > 250) recentCues[mode].delete(recentCues[mode].keys().next().value);
      broadcast('mc', cue, mode);
    });
  }
  // Keep ingestion serialized even if an event initializes a new match asynchronously.
  async function drain() {
    if (processing) return;
    processing = true;
    try {
      while (sourceQueue.length) {
        const entry = sourceQueue.shift();
        try {
          if (entry.kind === 'connection') rooms.live.setConnection?.(entry.data);
          else await rooms.live.handleSourceEvent(entry);
        } catch (error) { reportError(error); }
      }
    } finally { processing = false; scheduleState(); }
  }
  subscribe(tiktok, 'event', event => {
    sourceQueue.push(event);
    void drain();
  });
  subscribe(tiktok, 'connection', connection => {
    // Preserve wire order with presence/arrival events. An old queued disconnect
    // must never pause a room after a newer successful handshake has resumed it.
    sourceQueue.push({ kind: 'connection', data: connection }); void drain();
    broadcast('connection', connection, 'live'); scheduleState(); writer.mark();
  });
  subscribe(tiktok, 'dirty', () => writer.mark());
  subscribe(tiktok, 'warning', message => reportError(message));
  rooms.live.setConnection?.(tiktok.snapshot());
  for (const room of Object.values(rooms)) room.start?.();

  async function persistSettings(input) {
    const job = settingsWrite.then(async () => {
      const updated = validateSettings(input, settings);
      await writeJsonAtomic(settingsFile, updated);
      settings = updated;
      for (const room of Object.values(rooms)) await room.configure?.(settings);
      broadcast('settings', settings); scheduleState();
      return updated;
    });
    settingsWrite = job.catch(() => {});
    return job;
  }
  async function connect(input) {
    const username = cleanUsername(input.username ?? input.host ?? settings.username);
    if (!username) throw Object.assign(new Error('Nhập username TikTok của chủ phòng.'), { status: 400 });
    await persistSettings({ username });
    // Connecting/offline timeout must not block the admin HTTP response.
    void tiktok.connect(username).catch(error => { reportError(error); tiktok.status?.('error', redactTikTokError(error?.message || error)); });
    return snapshot('live');
  }
  let synthesize = options.synthesizeTTS;
  const server = createServer(async (request, response) => {
    const host = request.headers.host || '';
    if (!localHost.test(host)) return json(response, 403, { error: 'Chỉ mở server qua localhost hoặc 127.0.0.1.' });
    try {
      const url = new URL(request.url, `http://${host}`);
      const mode = validMode(url.searchParams.get('mode'));
      if (request.method === 'POST') {
        if (stopping) return json(response, 503, { error: 'Server đang lưu và dừng.' });
        if (request.headers.origin !== `http://${host}`) return json(response, 403, { error: 'Mở bảng điều khiển cùng địa chỉ localhost với server.' });
        const input = await bodyJSON(request);
        const selected = validMode(input.mode ?? mode);
        if (url.pathname === '/api/shutdown') {
          if (input.serverId !== serverId) return json(response, 409, { error: 'Phiên server đã thay đổi. Đọc lại /api/health trước khi dừng.' });
          response.once('finish', () => { void close().catch(error => { reportError(error); console.error('Lỗi khi lưu và dừng:', redactTikTokError(error?.message || error)); }); });
          return json(response, 202, { ok: true, stopping: true, serverId });
        }
        if (url.pathname === '/api/settings') return json(response, 200, await persistSettings(input));
        if (url.pathname === '/api/connect') return json(response, 202, await connect(input));
        if (url.pathname === '/api/disconnect') { await tiktok.disconnect(); return json(response, 200, snapshot('live')); }
        if (url.pathname === '/api/control') {
          const action = String(input.action || '');
          const payload = input.payload && typeof input.payload === 'object' && !Array.isArray(input.payload) ? input.payload : input;
          if (action === 'connect') return json(response, 202, await connect(payload));
          if (action === 'disconnect') { await tiktok.disconnect(); return json(response, 200, snapshot('live')); }
          const result = await rooms[selected].control(action, payload);
          scheduleState(); return json(response, 200, { ...snapshot(selected), actionResult: result ?? null });
        }
        if (url.pathname === '/api/tts') {
          let canonical;
          if (input.id === 'audio-test' && input.eventId === 'SYSTEM' && input.text === AUDIO_TEST_TEXT) canonical = { text: AUDIO_TEST_TEXT };
          else canonical = recentCues[selected].get(String(input.id || ''));
          if (!canonical || Date.now() - canonical.rememberedAt > 120000 && input.id !== 'audio-test' || canonical.text !== input.text || canonical.eventId && canonical.eventId !== input.eventId) {
            return json(response, 403, { error: 'Chỉ đọc lời MC chuẩn của phòng, không đọc bình luận tự do.' });
          }
          synthesize ||= (await import('./tts.mjs')).synthesizeTTS;
          const abort = new AbortController(); response.once('close', () => { if (!response.writableEnded) abort.abort(); });
          const audio = await synthesize({ text: canonical.text, voice: input.voice || settings.audio.voice, rate: input.rate || settings.audio.rate, signal: abort.signal });
          response.writeHead(200, { 'Content-Type': audio.contentType || 'audio/mpeg', 'Content-Length': audio.buffer.length, 'Cache-Control': 'private, max-age=300', 'X-TTS-Cache': audio.cacheHit ? 'hit' : 'miss', 'X-TTS-Provider': audio.provider || 'online', 'X-Content-Type-Options': 'nosniff' });
          return response.end(audio.buffer);
        }
        return json(response, 404, { error: 'Không có API này.' });
      }
      if (!['GET', 'HEAD'].includes(request.method)) return json(response, 405, { error: 'Phương thức không hợp lệ.' });
      if (url.pathname === '/api/health') return json(response, 200, { ok: true, app: 'co-ty-phi-live', version: '0.3.0', serverId, port: server.address()?.port || config.port, connection: tiktok.snapshot(), modes: ['live', 'demo'], clients: streams.size, runtimeQueue: sourceQueue.length, processing, stopping, errors: errors.slice(-5), uptime: Math.floor(process.uptime()) });
      if (url.pathname === '/api/settings') return json(response, 200, settings);
      if (url.pathname === '/api/state') return json(response, 200, snapshot(mode));
      if (url.pathname === '/api/events' || url.pathname === '/events') {
        response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        response.write('retry: 1500\n\n');
        const stream = { response, mode }; streams.add(stream);
        send(stream, 'state', snapshot(mode)); send(stream, 'connection', snapshot(mode).connection); send(stream, 'settings', settings);
        const heartbeat = setInterval(() => { if (!response.destroyed) response.write(': heartbeat\n\n'); }, 15000).unref();
        response.once('close', () => { clearInterval(heartbeat); streams.delete(stream); });
        return;
      }
      let file;
      const page = ['/', '/admin', '/admin/', '/overlay', '/overlay/', '/demo', '/demo/'].includes(url.pathname);
      if (url.pathname === '/' || url.pathname === '/admin' || url.pathname === '/admin/') file = config.adminFile;
      else if (page) file = resolve(config.distDir, 'live.html');
      else file = safeAsset(config.distDir, url.pathname.replace(/^\/(?:overlay|demo)\//, '/'));
      if (!file) return json(response, 404, { error: 'Không tìm thấy tệp.' });
      let info;
      try { info = await stat(file); } catch { return json(response, 404, { error: page ? 'Chưa có bản build. Chạy npm run build trong thư mục web.' : 'Không tìm thấy tệp.' }); }
      if (!info.isFile()) return json(response, 404, { error: 'Không tìm thấy tệp.' });
      const headers = { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': page ? 'no-store' : 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff', 'Content-Length': info.size, 'Accept-Ranges': 'bytes' };
      let range;
      if (request.headers.range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
        if (!match || !match[1] && !match[2]) { response.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); return response.end(); }
        let start = match[1] ? Number(match[1]) : Math.max(0, info.size - Number(match[2]));
        let end = match[1] && match[2] ? Math.min(info.size - 1, Number(match[2])) : info.size - 1;
        if (start > end || start >= info.size) { response.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); return response.end(); }
        range = { start, end }; headers['Content-Length'] = end - start + 1; headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
      }
      response.writeHead(range ? 206 : 200, headers);
      if (request.method === 'HEAD') return response.end();
      const stream = createReadStream(file, range); stream.on('error', () => response.destroy()); stream.pipe(response);
    } catch (error) { if (!response.headersSent) json(response, Number(error.status) || 400, { error: redactTikTokError(error?.message || error) }); else response.destroy(); }
  });

  function close() {
    if (closePromise) return closePromise;
    stopping = true; clearTimeout(publishing);
    closePromise = (async () => {
      await tiktok.disconnect();
      while (processing) await new Promise(resolveWait => setTimeout(resolveWait, 5));
      for (const room of Object.values(rooms)) room.stop?.();
      try { await settingsWrite; await writer.flush(); }
      finally {
        for (const stream of streams) stream.response.end();
        subscriptions.forEach(off => off());
        if (server.listening) await new Promise((resolveClose, reject) => { server.close(error => error ? reject(error) : resolveClose()); server.closeIdleConnections?.(); });
      }
    })();
    return closePromise;
  }

  return {
    server, serverId, rooms, tiktok, snapshot,
    get settings() { return settings; },
    async listen(port = config.port) {
      await new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(port, config.host, () => { server.off('error', reject); resolveListen(); }); });
      return server.address();
    },
    close,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const app = await createLiveServer();
  const address = await app.listen();
  console.log(`Cờ Tý Phí Studio  http://127.0.0.1:${address.port}/admin\nKhung LIVE        http://127.0.0.1:${address.port}/overlay\nKhung DEMO        http://127.0.0.1:${address.port}/demo\nChưa kết nối TikTok. Nhập username ở bảng điều khiển khi cần.`);
  let exiting = false;
  async function shutdown() { if (exiting) return; exiting = true; try { await app.close(); process.exitCode = 0; } catch (error) { console.error(redactTikTokError(error?.message || error)); process.exitCode = 1; } }
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
}
