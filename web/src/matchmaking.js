// Local matchmaking state. The LIVE adapter must supply verified like counts
// and unique event IDs; a customer account remains outside the racer list
// until the reservation window has closed and the next list is committed.
export const MATCHMAKING_DEFAULTS = Object.freeze({ seats: 20, reserved: 12, threshold: 30, duration: 15, podiumSeconds: 8 });

export const MATCHMAKING_MC = Object.freeze({
  podium: 'Ba người đã hoàn thành ba vòng! Mời cả phố xem bục trong tám giây, rồi mở sảnh ván mới.',
  reserveOpen: 'Sảnh mở mười lăm giây! Người vừa chơi đủ ba mươi tim được đăng ký giữ ghế; tối đa mười hai suất, theo thứ tự đủ tim. Các ghế còn lại dành cho người đã chờ lâu nhất.',
  earned: '{name} đã đủ ba mươi tim và giữ được một ghế. Còn {remaining} suất giữ ghế.',
  quotaFull: 'Đã đủ mười hai suất giữ ghế. Người chưa giữ được ghế sẽ vào cuối hàng chờ; ít nhất tám ghế dành cho người đang đợi khi đủ người.',
  customer: 'Bạn đang chờ ghế vẫn được góp vốn, mua hàng và nhận lì xì cùng cả phố.',
  locked: 'Khóa sảnh! {retained} người giữ ghế, {newcomers} người từ hàng chờ. Hai mươi quân chuẩn bị xuất phát!',
  start: 'Ván mới bắt đầu! Ba vòng đường, ba người về đích đầu tiên lên bục. Hoa hồng chưa dùng vẫn giữ ưu tiên cho lượt hợp lệ tiếp theo.'
});

function positiveInteger(value, maximum = 10000) {
  return Number.isSafeInteger(value) && value > 0 && value <= maximum;
}

function identifier(value) { return String(value ?? '').trim(); }

function uniqueIds(values) {
  return Array.isArray(values) ? [...new Set(values.map(identifier).filter(Boolean))] : [];
}

export class MatchmakingQueue {
  constructor(accountIds = [], options = {}) {
    this.accounts = new Map(); this.waitingIds = []; this.activeIds = [];
    this.nextActiveIds = []; this.oldActiveIds = []; this.reservations = [];
    this.qualified = new Map(); this.hearts = new Map(); this.seenEvents = new Set();
    this.sequence = 0; this.inputSequence = 0; this.clock = 0; this.phase = 'ready'; this.elapsed = 0;
    this.settings = this._options(options);
    if (!this.settings) throw new RangeError('Invalid matchmaking configuration');
    for (const id of uniqueIds(accountIds)) this.register(id);
    const chosen = uniqueIds(options.activeIds).filter(id => this.accounts.has(id)).slice(0, this.settings.seats);
    const fill = [...this.accounts.keys()].filter(id => !chosen.includes(id));
    this.activeIds = [...chosen, ...fill.slice(0, Math.max(0, this.settings.seats - chosen.length))];
    this.nextActiveIds = [...this.activeIds];
    this.waitingIds = [...this.accounts.keys()].filter(id => !this.activeIds.includes(id));
    this.oldActiveIds = [...this.activeIds]; this.windowId = null;
  }

  _options(options) {
    const settings = { ...MATCHMAKING_DEFAULTS, ...this.settings, ...options };
    if (!positiveInteger(settings.seats) || !Number.isSafeInteger(settings.reserved) || settings.reserved < 0
      || settings.reserved > settings.seats || !positiveInteger(settings.threshold, 1_000_000)
      || !Number.isFinite(settings.duration) || settings.duration <= 0
      || !Number.isFinite(settings.podiumSeconds) || settings.podiumSeconds < 0) return null;
    return { seats: settings.seats, reserved: settings.reserved, threshold: settings.threshold,
      duration: settings.duration, podiumSeconds: settings.podiumSeconds };
  }

  register(value) {
    const id = identifier(value);
    if (!id || id.length > 128) return false;
    if (this.accounts.has(id)) return true;
    this.accounts.set(id, { id, registeredOrder: this.accounts.size });
    this.waitingIds.push(id);
    return true;
  }

  registerMany(ids) { return uniqueIds(ids).reduce((count, id) => count + Number(this.register(id)), 0); }

  _prepare(activeIds, options) {
    if (this.phase !== 'ready') return false;
    const settings = this._options(options);
    if (!settings) return false;
    const active = uniqueIds(activeIds).filter(id => this.accounts.has(id)).slice(0, settings.seats);
    if (!active.length) return false;
    const activeSet = new Set(active);
    // Removed old racers go behind customers who were already waiting. No
    // repeat registration or reservation attempt can jump that waiting line.
    this.waitingIds = uniqueIds([...this.waitingIds, ...this.activeIds]).filter(id => this.accounts.has(id) && !activeSet.has(id));
    this.settings = settings; this.activeIds = active; this.oldActiveIds = [...active];
    this.nextActiveIds = []; this.hearts = new Map(active.map(id => [id, 0]));
    this.reservations = []; this.qualified.clear(); this.elapsed = 0;
    this.windowId = `reservation-${++this.sequence}`; this.lastAction = null; this.lastResult = null;
    return true;
  }

  beginReserve(activeIds = this.activeIds, options = {}) {
    if (!this._prepare(activeIds, options)) return false;
    this.phase = 'reserving'; this.phaseStartedAt = this.clock;
    return true;
  }

  beginPodium(activeIds = this.activeIds, options = {}) {
    if (!this._prepare(activeIds, options)) return false;
    this.phase = this.settings.podiumSeconds > 0 ? 'podium' : 'reserving';
    this.phaseStartedAt = this.clock;
    return true;
  }

  _action(ok, reason) { this.lastAction = { ok, reason }; return ok; }

  receiveLike(value, count, eventId) {
    const id = identifier(value), packetId = identifier(eventId);
    if (!id || !packetId || packetId.length > 256 || !positiveInteger(count, 1_000_000)) return this._action(false, 'Gói tim không hợp lệ');
    if (this.seenEvents.has(packetId)) return this._action(false, 'Gói tim đã được xử lý');
    // Also remember packets outside the window: a delayed replay must never
    // turn an old customer's heart packet into a later seat reservation.
    this.seenEvents.add(packetId);
    if (!this.accounts.has(id)) return this._action(false, 'Tài khoản chưa đăng ký');
    if (this.phase !== 'reserving') return this._action(false, 'Cửa giữ ghế chưa mở hoặc đã khóa');
    if (!this.hearts.has(id)) return this._action(false, 'Bạn đang ở hàng chờ; tim vẫn có thể dùng cho hoạt động chung');
    const before = this.hearts.get(id), after = Math.min(this.settings.threshold, before + count);
    this.hearts.set(id, after);
    const inputOrder = ++this.inputSequence;
    if (before < this.settings.threshold && after >= this.settings.threshold) {
      const rank = this.qualified.size + 1, reserved = this.reservations.length < this.settings.reserved;
      const entry = { id, hearts: after, reachedAt: this.clock, inputOrder, qualifiedRank: rank, reserved };
      this.qualified.set(id, entry);
      if (reserved) this.reservations.push(entry);
      return this._action(true, reserved ? 'Đã đủ tim và giữ được một ghế' : 'Đã đủ tim nhưng hết suất giữ ghế; bạn sẽ vào hàng chờ');
    }
    return this._action(true, after >= this.settings.threshold ? 'Đã ghi nhận đủ tim; không chiếm thêm ghế' : `Đã ghi nhận ${after}/${this.settings.threshold} tim giữ ghế`);
  }

  tick(dt) {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Invalid matchmaking time');
    if (dt === 0) return;
    this.clock += dt;
    let left = dt;
    while (left > 0 && this.phase !== 'ready') {
      const limit = this.phase === 'podium' ? this.settings.podiumSeconds : this.settings.duration;
      const remaining = Math.max(0, limit - this.elapsed);
      if (left < remaining) { this.elapsed += left; return; }
      left -= remaining; this.elapsed = limit;
      if (this.phase === 'podium') {
        this.phase = 'reserving'; this.elapsed = 0; this.phaseStartedAt = this.clock - left;
      } else this.lock();
    }
  }

  lock({ force = false } = {}) {
    if (this.phase !== 'reserving' || (!force && this.elapsed < this.settings.duration)) return false;
    const retained = this.reservations.slice(0, this.settings.reserved).map(entry => entry.id);
    const retainedSet = new Set(retained);
    const queue = uniqueIds([...this.waitingIds, ...this.oldActiveIds.filter(id => !retainedSet.has(id))])
      .filter(id => this.accounts.has(id) && !retainedSet.has(id));
    const slots = Math.max(0, this.settings.seats - retained.length);
    const newcomers = queue.slice(0, slots);
    this.nextActiveIds = [...retained, ...newcomers];
    this.waitingIds = queue.slice(newcomers.length);
    this.activeIds = [...this.nextActiveIds]; this.phase = 'ready'; this.elapsed = this.settings.duration;
    this.lastResult = { retainedIds: retained, fromQueueIds: newcomers,
      activeIds: [...this.nextActiveIds], waitingCount: this.waitingIds.length, windowId: this.windowId };
    return true;
  }

  isEligibleForNextMatch(value) {
    return this.phase === 'ready' && this.nextActiveIds.includes(identifier(value));
  }

  snapshot() {
    const remaining = this.phase === 'ready' ? 0 : Math.max(0,
      (this.phase === 'podium' ? this.settings.podiumSeconds : this.settings.duration) - this.elapsed);
    return { phase: this.phase, windowId: this.windowId, timeleft: remaining, remainingSeconds: remaining,
      settings: { ...this.settings }, activeIds: [...this.activeIds], oldActiveIds: [...this.oldActiveIds],
      reservations: this.reservations.map(entry => ({ ...entry })),
      qualified: [...this.qualified.values()].map(entry => ({ ...entry })),
      hearts: [...this.hearts].map(([id, count]) => ({ id, count, threshold: this.settings.threshold,
        reserved: this.reservations.some(entry => entry.id === id), qualifiedRank: this.qualified.get(id)?.qualifiedRank ?? null })),
      nextActiveIds: [...this.nextActiveIds], nextActive: [...this.nextActiveIds],
      eligibleIds: this.phase === 'ready' ? [...this.nextActiveIds] : [],
      waitingIds: [...this.waitingIds], waitingCount: this.waitingIds.length, accountCount: this.accounts.size,
      result: this.lastResult ? { ...this.lastResult, retainedIds: [...this.lastResult.retainedIds], fromQueueIds: [...this.lastResult.fromQueueIds], activeIds: [...this.lastResult.activeIds] } : null,
      lastAction: this.lastAction ? { ...this.lastAction } : null };
  }
}

export { MatchmakingQueue as Matchmaking };
