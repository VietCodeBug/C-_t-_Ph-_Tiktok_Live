// Comment-driven local shop. Orders are free game interactions: customers are
// never charged, and only the host's fictional MONEY enters the ledger.
export const SHOP_RULES = Object.freeze({ cost: 80, maxOrders: 8, orderSec: 12, returnSec: 12, minimumMoney: 120, fulfilledIncome: 30, cancelledFee: 5 });

export const SHOP_MC = Object.freeze({
  'shop.open': 'Quầy {host} mở cửa! Chủ quầy nhập hàng hết {cost} MONEY. Khách đang chờ ghế gõ {host} để đặt một đơn; tối đa {maxOrders} đơn.',
  'shop.order': 'Quầy {host} đã nhận {count}/{maxOrders} đơn. Mỗi khách một đơn, không trừ ví khách.',
  'shop.full': 'Quầy đã đủ đơn! Chờ tiếng chuông rồi mới mở cửa trả đơn.',
  'shop.returns': 'Đóng nhận đơn! Ai đã đặt mà đổi ý, gõ BOM {host} để hủy đúng đơn của mình trong {returnSec} giây.',
  'shop.return': 'Một đơn của quầy {host} quay xe. Những đơn khác vẫn giữ nguyên nhé!',
  'shop.settled-profit': 'Chốt quầy {host}! {fulfilled} đơn xong, {cancelled} đơn hủy; cả vụ lời {net} MONEY.',
  'shop.settled-loss': 'Báo cáo quầy {host}: {fulfilled} đơn xong, {cancelled} đơn quay xe. Cả vụ lỗ {loss} MONEY, đã gồm tiền nhập hàng.',
  'shop.settled-even': 'Quầy {host} hòa vốn. Shipper thì thuộc đường rồi!',
  'shop.cancelled': 'Tạm dừng quầy {host} bằng điều khiển. Hoàn {cost} MONEY nhập hàng; đơn thử được đóng, ví khách giữ nguyên.'
});

const integer = (value, min = 0, max = 1_000_000_000) => Number.isSafeInteger(value) && value >= min && value <= max;
const idOf = value => String(value ?? '').trim();
const render = (text, values) => text.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''));
const idsOf = values => values instanceof Set || Array.isArray(values) ? [...new Set([...values].map(idOf).filter(Boolean))] : [];

export class LocalShop {
  constructor(community, { customerIds = [] } = {}) {
    if (!community?.accounts || typeof community.adjustBalance !== 'function') throw new TypeError('LocalShop requires a CommunityGame');
    this.community = community; this.defaultCustomers = idsOf(customerIds);
    this.sequence = 0; this.inputSequence = 0; this.clock = 0; this.current = null; this.seenInputs = new Set();
  }

  open(hostId, { customerIds = this.defaultCustomers, cost = SHOP_RULES.cost, maxOrders = SHOP_RULES.maxOrders,
    orderSec = SHOP_RULES.orderSec, returnSec = SHOP_RULES.returnSec, seed = 1 } = {}) {
    hostId = idOf(hostId);
    if (this.current && this.current.phase !== 'closed') return null;
    const host = this.community.accounts.get(hostId);
    if (!host || !integer(cost, 1) || !integer(maxOrders, 1, 1000) || !Number.isFinite(orderSec) || orderSec <= 0
      || !Number.isFinite(returnSec) || returnSec <= 0) return null;
    const minimumMoney = Math.max(SHOP_RULES.minimumMoney, cost + maxOrders * SHOP_RULES.cancelledFee);
    if (host.money < minimumMoney) { this.lastAction = { ok: false, reason: `Chủ quầy cần ít nhất ${minimumMoney} MONEY` }; return null; }
    const id = `shop-${this.community.sequence + 1}-${++this.sequence}`;
    const before = host.money;
    if (!this.community.adjustBalance(hostId, -cost, 'Nhập hàng quầy phố', `${id}:inventory`)) return null;
    this.current = { id, hostId, hostName: host.seat || host.name || hostId, phase: 'ordering', elapsed: 0,
      cost, maxOrders, orderSec, returnSec, minimumMoney, seed: seed >>> 0, before,
      customerIds: new Set(idsOf(customerIds).filter(id => id !== hostId && this.community.accounts.has(id))),
      orders: new Map(), result: null };
    this._cue('shop.open'); this.lastAction = { ok: true, reason: 'Đã mở quầy, chỉ trừ tiền nhập hàng một lần' };
    return this.snapshot();
  }

  _cue(id) {
    const event = this.current;
    const cancelled = [...event.orders.values()].filter(order => order.cancelled).length;
    const values = { host: event.hostName, cost: event.cost, maxOrders: event.maxOrders, count: event.orders.size,
      returnSec: event.returnSec, fulfilled: event.orders.size - cancelled, cancelled,
      net: event.result?.net || 0, loss: Math.abs(event.result?.net || 0) };
    event.mcCue = { id, variables: values, text: render(SHOP_MC[id], values) };
  }

  _input(customerId, eventId) {
    const id = idOf(customerId), packet = idOf(eventId);
    if (!id || !packet || packet.length > 256) return null;
    if (this.seenInputs.has(packet)) { this.lastAction = { ok: false, reason: 'Lệnh shop đã được xử lý' }; return null; }
    this.seenInputs.add(packet);
    return id;
  }

  _action(ok, reason) { this.lastAction = { ok, reason }; return ok; }

  order(customerId, eventId = `local-order-${++this.inputSequence}`) {
    const id = this._input(customerId, eventId), event = this.current;
    if (!id) return false;
    if (!event || event.phase !== 'ordering') return this._action(false, 'Quầy chưa mở hoặc đã đóng nhận đơn');
    if (!event.customerIds.has(id)) return this._action(false, 'Chỉ khách đang chờ ghế của phiên này được đặt đơn');
    if (event.orders.has(id)) return this._action(false, 'Mỗi khách chỉ có một đơn');
    if (event.orders.size >= event.maxOrders) return this._action(false, 'Quầy đã đủ đơn');
    event.orders.set(id, { customerId: id, number: event.orders.size + 1, cancelled: false, placedAt: this.clock });
    this._cue(event.orders.size === event.maxOrders ? 'shop.full' : 'shop.order');
    return this._action(true, 'Đã đặt một đơn; ví khách không đổi');
  }

  cancel(customerId, eventId = `local-return-${++this.inputSequence}`) {
    const id = this._input(customerId, eventId), event = this.current;
    if (!id) return false;
    if (!event || event.phase !== 'returns') return this._action(false, 'Chưa tới cửa trả đơn hoặc cửa đã khóa');
    const order = event.orders.get(id);
    if (!event.customerIds.has(id) || !order) return this._action(false, 'Bạn chỉ được hủy đơn do chính mình đã đặt');
    if (order.cancelled) return this._action(false, 'Đơn này đã hủy rồi');
    order.cancelled = true; order.cancelledAt = this.clock;
    this._cue('shop.return'); return this._action(true, 'Đã hủy đúng đơn của bạn; ví khách không đổi');
  }

  _settle() {
    const event = this.current;
    if (!event || event.phase !== 'returns' || event.result) return false;
    const cancelled = [...event.orders.values()].filter(order => order.cancelled).length;
    const fulfilled = event.orders.size - cancelled;
    const proposed = SHOP_RULES.fulfilledIncome * fulfilled - SHOP_RULES.cancelledFee * cancelled;
    const host = this.community.accounts.get(event.hostId), beforeSettlement = host.money;
    // The opening balance normally reserves the maximum return fee. If another
    // local rule changed the wallet, mandatory fees still stop at zero.
    const delta = Math.max(-host.money, proposed);
    if (!this.community.adjustBalance(event.hostId, delta, 'Chốt đơn quầy phố, không trừ lại tiền nhập', `${event.id}:settlement`)) return false;
    event.result = { fulfilled, cancelled, orders: event.orders.size, cost: event.cost,
      income: SHOP_RULES.fulfilledIncome * fulfilled, returnFee: SHOP_RULES.cancelledFee * cancelled,
      settlementDelta: delta, proposedSettlementDelta: proposed, before: event.before, beforeSettlement,
      after: host.money, net: -event.cost + delta, cancelledByControl: false };
    event.phase = 'settled'; event.elapsed = event.returnSec;
    this._cue(event.result.net > 0 ? 'shop.settled-profit' : event.result.net < 0 ? 'shop.settled-loss' : 'shop.settled-even');
    return true;
  }

  tick(dt) {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Invalid shop time');
    if (dt === 0) return;
    this.clock += dt;
    const event = this.current;
    if (!event || !['ordering','returns'].includes(event.phase)) return;
    if (event.phase === 'ordering') {
      const remaining = event.orderSec - event.elapsed;
      if (dt < remaining) { event.elapsed += dt; return; }
      dt -= remaining; event.phase = 'returns'; event.elapsed = 0; this._cue('shop.returns');
    }
    if (event.phase === 'returns') {
      event.elapsed = Math.min(event.returnSec, event.elapsed + dt);
      if (event.elapsed >= event.returnSec) this._settle();
    }
  }

  close() {
    if (!this.current || this.current.phase !== 'settled') return false;
    this.current.phase = 'closed'; return true;
  }

  cancelOpen() {
    const event = this.current;
    if (!event || !['ordering','returns'].includes(event.phase)) return false;
    const host = this.community.accounts.get(event.hostId), beforeRefund = host.money;
    if (!this.community.adjustBalance(event.hostId, event.cost, 'Hủy quầy bằng điều khiển, hoàn tiền nhập', `${event.id}:abort-refund`)) return false;
    event.result = { fulfilled: 0, cancelled: 0, orders: event.orders.size, cost: event.cost, income: 0, returnFee: 0,
      settlementDelta: event.cost, before: event.before, beforeSettlement: beforeRefund, after: host.money, net: 0, cancelledByControl: true };
    event.phase = 'closed'; this._cue('shop.cancelled');
    return true;
  }

  snapshot() {
    const event = this.current;
    if (!event) return null;
    const orders = [...event.orders.values()].map(order => ({ ...order, name: this.community.accounts.get(order.customerId)?.name || order.customerId }));
    return { id: event.id, hostId: event.hostId, hostName: event.hostName, phase: event.phase,
      cost: event.cost, maxOrders: event.maxOrders, orderSec: event.orderSec, returnSec: event.returnSec,
      eligibleCustomerIds: [...event.customerIds], count: orders.length, fulfilled: orders.filter(order => !order.cancelled).length,
      cancelled: orders.filter(order => order.cancelled).length, orders,
      remainingSeconds: event.phase === 'ordering' ? Math.max(0,event.orderSec-event.elapsed)
        : event.phase === 'returns' ? Math.max(0,event.returnSec-event.elapsed) : 0,
      result: event.result ? { ...event.result } : null, mcLine: event.mcCue.text,
      mcCue: { ...event.mcCue, variables: { ...event.mcCue.variables } }, lastAction: this.lastAction ? { ...this.lastAction } : null };
  }
}
