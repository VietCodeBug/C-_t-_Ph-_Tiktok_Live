import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { cleanUsername } from './config.mjs';

const text = (value, limit = 100) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, limit);
const identifier = value => {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) return '';
  const id = String(value ?? '');
  return id && id !== '0' && /^[A-Za-z0-9_:-]{1,160}$/.test(id) ? id : '';
};
const integer = (value, fallback = 0, maximum = 1000000) => Number.isFinite(Number(value))
  ? Math.max(0, Math.min(maximum, Math.floor(Number(value)))) : fallback;
const roomId = value => /^[1-9]\d{0,30}$/.test(String(value ?? '')) ? String(value) : '';
const digest = value => createHash('sha256').update(value).digest('hex').slice(0, 24);
const timestamp = value => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number * (number < 1e12 ? 1000 : 1) : 0;
};

export function redactTikTokError(value, env = process.env) {
  let message = String(value ?? 'Lỗi kết nối TikTok.');
  for (const key of ['SIGN_API_KEY', 'TIKTOK_SESSION_ID']) {
    if (env[key]) message = message.split(env[key]).join('[đã ẩn]');
  }
  return message.replace(/\b(?:authorization|cookie)\b["']?\s*[=:]\s*[^\r\n]+/gi, '[đã ẩn]')
    .replace(/\b(?:(?:sign[_-]?)?api[_-]?key|access[_-]?token|mstoken|token|sessionid)\b["']?\s*[=:]\s*["']?[^\s"'&,;]+/gi, '[đã ẩn]')
    .replace(/\bBearer\s+[^\s"']+/gi, '[đã ẩn]').slice(0, 350);
}

/** Reject missing/unsafe provider IDs; nicknames and mutable @handles are never wallet keys. */
export function normalizeWebcast(type, payload, currentRoom, { now = Date.now() } = {}) {
  if (!payload || !currentRoom) return null;
  const incomingRoom = identifier(payload.common?.roomId);
  if (incomingRoom && incomingRoom !== currentRoom) return null;
  if (type === 'viewer-count') {
    const count = payload.viewerCount ?? payload.total;
    return count === undefined || count === null || count === '' ? null : { type, roomId: currentRoom, count: integer(count), at: now };
  }
  const raw = payload.user ?? {};
  const id = identifier(raw.id) || identifier(raw.userId) || identifier(payload.userId);
  if (!id) return null;
  const uniqueId = text(raw.displayId || raw.uniqueId || payload.uniqueId, 60).replace(/^@+/, '');
  const image = [raw.avatarThumb, raw.avatarMedium, raw.avatarLarger].find(item => item?.urlList?.length || item?.url_list?.length);
  const avatar = text(image?.urlList?.[0] || image?.url_list?.[0] || raw.profilePictureUrl || payload.profilePictureUrl, 3000);
  const receipt = identifier(payload.common?.msgId) || identifier(payload.msgId) || identifier(payload.eventId) || identifier(payload.logId);
  const createdAt = timestamp(payload.common?.createTime || payload.createTime);
  const comment = text(payload.comment ?? payload.content, 240).trim();
  const count = integer(type === 'gift' ? payload.repeatCount ?? payload.quantity ?? 1 : payload.likeCount ?? payload.count, type === 'gift' ? 1 : 0);
  const gift = payload.gift ?? payload.giftDetails ?? {}, extended = payload.extendedGiftInfo ?? {};
  const giftId = identifier(payload.giftId) || identifier(gift.id) || identifier(extended.id);
  const groupId = identifier(payload.groupId) || identifier(payload.comboId);
  // No receipt: only timestamped packets can be replay-deduplicated. Never invent a fresh gift receipt.
  const fallback = !receipt && createdAt ? digest(JSON.stringify([type, currentRoom, id, createdAt, comment, count, giftId, groupId])) : '';
  if (!receipt && !fallback && !['member', 'leave'].includes(type)) return null;
  const eventId = `${currentRoom}:${type}:${receipt || fallback || digest(`${id}:${type}:${now}`)}`;
  const event = {
    type, eventId, receipt: receipt || fallback, roomId: currentRoom, at: now, createdAt,
    user: { id, nickname: text(raw.nickname || payload.nickname || uniqueId || `Khách ${id.slice(-4)}`, 60), uniqueId, avatar: /^https?:\/\//i.test(avatar) ? avatar : '' },
  };
  if (type === 'comment') { if (!comment) return null; event.text = comment; }
  if (type === 'likes') { if (!count) return null; event.count = count; }
  if (type === 'gift') {
    if (!giftId || !event.receipt && !groupId || count < 1) return null;
    const rawType = gift.type ?? gift.giftType ?? payload.giftType ?? extended.type;
    Object.assign(event, {
      count, giftId, groupId, giftType: rawType == null ? undefined : Number(rawType),
      giftName: text(gift.name || gift.giftName || extended.name || payload.giftName, 80),
      diamondCount: integer(gift.diamondCount ?? gift.diamond_count ?? extended.diamondCount ?? extended.diamond_count ?? payload.diamondCount),
      repeatEnd: [true, 1, '1'].includes(payload.repeatEnd), hasRepeatEnd: Object.hasOwn(payload, 'repeatEnd'),
    });
  }
  return event;
}

async function makeClient(username, options) {
  const { TikTokLiveConnection } = await import('tiktok-live-connector');
  return new TikTokLiveConnection(username, options);
}

/** Transport only: finalized gifts and presence; it never mutates game MONEY. */
export class TikTokService extends EventEmitter {
  constructor({ createClient = makeClient, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout, savedState = {}, env = process.env } = {}) {
    super();
    Object.assign(this, { createClient, now, setTimer, clearTimer, env });
    this.generation = 0; this.wanted = false; this.client = null; this.timer = null;
    this.host = ''; this.attempt = 0; this.lastRoom = '';
    this.connection = { status: 'disconnected', host: '', roomId: '', room: '', error: '', attempt: 0, retryAt: 0 };
    this.seen = new Map(Array.isArray(savedState.seen) ? savedState.seen : []);
    this.completed = new Map(Array.isArray(savedState.completed) ? savedState.completed : []);
    this.pending = new Map(); this.present = new Set(); this.giftTypes = new Map();
    this.stats = { received: 0, emitted: 0, duplicates: 0, rejected: 0 };
  }
  snapshot() { return { ...this.connection, diagnostics: { ...this.stats, pendingCombos: this.pending.size, present: this.present.size } }; }
  serialize() { return { schemaVersion: 1, seen: [...this.seen], completed: [...this.completed] }; }
  status(status, error = '', extra = {}) {
    this.connection = { ...this.connection, status, error: redactTikTokError(error, this.env), attempt: this.attempt, ...extra };
    this.emit('connection', this.snapshot());
  }
  _remember(key) {
    if (this.seen.has(key)) { this.stats.duplicates++; return false; }
    this.seen.set(key, this.now());
    this.prune(); this.emit('dirty'); return true;
  }
  prune() {
    const expiry = this.now() - 7 * 86400000;
    for (const [key, at] of this.seen) if (at < expiry || this.seen.size > 100000) this.seen.delete(key);
    for (const [key, value] of this.completed) if (value.at < expiry || this.completed.size > 30000) this.completed.delete(key);
  }
  _emit(event) { this.stats.emitted++; this.emit('event', event); }
  ingest(type, payload, currentRoom = this.connection.roomId) {
    this.stats.received++;
    const event = normalizeWebcast(type, payload, currentRoom, { now: this.now() });
    if (!event) { this.stats.rejected++; return false; }
    if (event.createdAt && event.createdAt < this.now() - 120000) { this.stats.rejected++; return false; }
    if (type === 'viewer-count') { this._emit(event); return true; }
    const uid = event.user.id;
    if (type === 'member') {
      this.present.add(uid);
    } else if (type === 'leave') this.present.delete(uid);
    if (type === 'gift') return this._gift(event);
    if (!this._remember(event.eventId)) return false;
    this._emit(event); return true;
  }
  _gift(event) {
    if (event.giftType !== undefined) this.giftTypes.set(event.giftId, event.giftType);
    else event.giftType = this.giftTypes.get(event.giftId);
    const streak = event.giftType === 1 || event.giftType === undefined && event.hasRepeatEnd;
    // A final streak packet can reuse msgId; count and final flag belong in packet dedupe.
    if (!this._remember(streak ? `${event.eventId}:${event.count}:${event.repeatEnd}` : event.eventId)) return false;
    if (!streak) {
      if (!event.receipt) return false;
      this._emit({ ...event, finalized: true }); return true;
    }
    let group = event.groupId || 'ungrouped';
    const base = `${event.roomId}:${event.user.id}:${event.giftId}:${group}`;
    let done = this.completed.get(base);
    // Ungrouped consecutive streaks need an actual new count=1 packet. A replay is already rejected above.
    if (group === 'ungrouped' && done && event.count === 1 && !event.repeatEnd && event.receipt !== done.receipt) {
      this.completed.delete(base); done = null;
    }
    if (done && event.count <= done.count) { this.stats.duplicates++; return false; }
    const previous = this.pending.get(base);
    if (previous) this.clearTimer(previous.timer);
    const latest = { ...event, count: Math.max(event.count, previous?.event.count || 0), streakId: previous?.event.streakId || done?.streakId || event.receipt || event.groupId };
    const timer = event.repeatEnd ? null : this.setTimer(() => this._finishCombo(base), 4000);
    timer?.unref?.();
    this.pending.set(base, { event: latest, timer });
    if (event.repeatEnd) this._finishCombo(base);
    return true;
  }
  _finishCombo(key) {
    const pending = this.pending.get(key); if (!pending) return;
    this.clearTimer(pending.timer); this.pending.delete(key);
    const { event } = pending, baseline = this.completed.get(key)?.count || 0;
    const delta = event.count - baseline;
    this.completed.set(key, { count: event.count, at: this.now(), receipt: event.receipt, streakId: event.streakId });
    this.emit('dirty');
    if (delta > 0) this._emit({ ...event, eventId: `${key}:${event.streakId}:final:${event.count}`, count: delta, comboTotal: event.count, finalized: true });
  }
  async connect(username) {
    username = cleanUsername(username);
    if (!username) throw Object.assign(new Error('Nhập username chủ phòng trước khi kết nối.'), { status: 400 });
    const closing = this.disconnect(); const generation = this.generation;
    await closing;
    if (generation !== this.generation) return;
    this.wanted = true; this.host = username; this.attempt = 0;
    return this._open(generation);
  }
  async _open(generation) {
    if (!this.wanted || generation !== this.generation) return;
    this.status('connecting', '', { host: this.host, roomId: '', room: '', retryAt: 0 });
    let client;
    try {
      client = await this.createClient(this.host, {
        processInitialData: false, enableExtendedGiftInfo: false,
        ...(this.env.SIGN_API_KEY ? { signApiKey: this.env.SIGN_API_KEY } : {}),
        webClientOptions: { timeout: { request: 12000 } }, wsClientOptions: { handshakeTimeout: 15000 },
      });
    } catch (error) { if (generation === this.generation) this._retry(generation, error); return; }
    if (!this.wanted || generation !== this.generation) { await Promise.resolve(client.disconnect()).catch(() => {}); return; }
    this.client = client;
    let room = '';
    const current = () => this.wanted && this.client === client && generation === this.generation;
    const accept = (type, payload) => { if (current()) this.ingest(type, payload, room || roomId(client.roomId) || roomId(payload?.common?.roomId)); };
    for (const [source, type] of [['member', 'member'], ['chat', 'comment'], ['like', 'likes'], ['gift', 'gift'], ['follow', 'follow'], ['share', 'share'], ['leave', 'leave'], ['roomUser', 'viewer-count']]) {
      client.on(source, payload => accept(type, payload));
    }
    client.on('error', error => { if (current()) this.emit('warning', redactTikTokError(error?.info || error?.exception?.message || error?.message || error, this.env)); });
    client.on('disconnected', () => { if (current()) this._retry(generation, 'Mất kết nối TikTok.'); });
    client.on('streamEnd', () => {
      if (!current()) return;
      this.wanted = false; this.clearTimer(this.timer); this.timer = null;
      this._clearPresence('stream-ended'); this.status('ended', 'Phòng đã kết thúc LIVE.', { retryAt: 0 });
    });
    try {
      const connected = await client.connect();
      if (!current()) { await Promise.resolve(client.disconnect()).catch(() => {}); return; }
      if (this.timer) return; // A failed handshake may resolve after disconnected scheduled retry.
      room = roomId(connected?.roomId) || roomId(client.roomId);
      if (!room) throw new Error('TikTok chưa trả mã phòng.');
      if (this.lastRoom && this.lastRoom !== room) this.present.clear();
      this.lastRoom = room;
      this.attempt = 0;
      this.status('connected', '', { roomId: room, room, retryAt: 0 });
    } catch (error) { if (current()) this._retry(generation, error); }
  }
  _retry(generation, error) {
    if (this.timer || !this.wanted || generation !== this.generation) return;
    const message = redactTikTokError(error?.message || error, this.env);
    const offline = error?.name === 'UserOfflineError' || /isn.t online|not.*live|offline/i.test(message);
    this.attempt++;
    const delay = Math.max(offline ? 30000 : 0, Math.min(60000, 5000 * 2 ** Math.min(this.attempt - 1, 4)));
    this._clearPresence('connection-lost');
    this.status('reconnecting', message, { retryAt: this.now() + delay });
    this.timer = this.setTimer(async () => {
      this.timer = null;
      const old = this.client; this.client = null;
      await Promise.resolve(old?.disconnect()).catch(() => {});
      if (generation === this.generation && this.wanted) await this._open(generation);
    }, delay);
    this.timer?.unref?.();
  }
  _clearPresence(reason) {
    // This is connection grace, not an identity-level leave. The room retains its roster/wallets.
    this._emit({ type: 'presence-clear', eventId: `presence:${this.generation}:${this.now()}:${reason}`, reason, at: this.now(), roomId: this.connection.roomId });
  }
  async disconnect() {
    this.wanted = false; this.generation++; this.clearTimer(this.timer); this.timer = null;
    const old = this.client; this.client = null;
    await Promise.resolve(old?.disconnect()).catch(() => {});
    for (const key of this.pending.keys()) this._finishCombo(key);
    this._clearPresence('manual-disconnect');
    this.present.clear();
    this.status('disconnected', '', { retryAt: 0 });
  }
}

export const TikTokAdapter = TikTokService;
