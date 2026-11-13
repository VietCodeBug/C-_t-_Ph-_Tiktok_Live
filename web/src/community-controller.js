import { CommunityGame } from './community.js';
import { LocalShop } from './shop.js';

const clean = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').trim().replace(/\s+/g,' ').toUpperCase();

// The local adapter is the only place that mirrors board wallets to the group
// ledger. A future LIVE adapter supplies verified account IDs and message IDs.
export class CommunityController {
  constructor(demo, { onSound, onMC, accounts } = {}) {
    this.demo = demo; this.onSound = onSound; this.onMC = onMC;
    this.game = new CommunityGame({ maxAccounts: 1000 });
    for (const player of accounts || demo.players) this.game.register(player.seat, { seat: player.seat, name: player.data.name, money: player.money ?? 1000 });
    this.shop = new LocalShop(this.game);
    this.sequence = 0; this.clock = 0; this.lastGroupAt = -60; this.lastEnvelopeLap = 0;
    this.mcCues = []; this.selectedId = demo.players[0].seat; this.notice = ''; this.modal = null;
    this.settledAt = null; this.hostIndex = null; this.match = 1;
    this.investmentSequence = 0; this.envelopeSequence = 0;
    demo.chooseNextPlayer = eligible => {
      const id = this.game.takeNext(eligible.map(index => demo.players[index].seat));
      return demo.players.findIndex(player => player.seat === id);
    };
    demo.onCollectiveLanding = (index,event) => {
      if (this.clock - this.lastGroupAt < 45 || this.modal) return false;
      if (event.id === 'TRADE01') return this.openShop(index);
      if (event.category === 'invest') return this.openInvestment(index, { flavor: ['startup','cooperative','market','fair'][this.investmentSequence % 4] });
      return false;
    };
  }

  cue(id, text, variables = {}) {
    const signed = value => `${value > 0 ? '+' : ''}${value}`;
    if (id.startsWith('investment-')) {
      const event=this.game.investmentSnapshot();
      text=id.endsWith('.open')?`Gõ GÓP hoặc BỎ vào chat. Góp một trăm MONEY.`
        :event.phase==='settled'?`Góp vốn: cả nhóm ${signed(event.result.net)} MONEY.`:'Chốt góp vốn. Xem chart mô phỏng.';
    } else if (id.startsWith('shop-')) {
      const event=this.shop.snapshot();
      text=event.phase==='ordering'?`Khách chờ, gõ MUA ${event.hostId} vào chat để đặt đơn.`
        :event.phase==='returns'?`Gõ BOM ${event.hostId} vào chat để tự hủy đơn.`:`${event.hostId}: shop ${signed(event.result?.net||0)} MONEY.`;
    } else if (id.startsWith('envelope-')) {
      const event=this.game.redEnvelopeSnapshot();
      text=event?.phase==='settled'?`Lì xì ${event.result.pot}, chia ${event.participants} người.`:'Chạm màn hình thả tim để mở lì xì cả phố.';
    } else if (id==='race.new-match') text='Ván mới: ba vòng, ba người lên bục.';
    const cue = { sequence: ++this.sequence, id, text, variables, clock: this.clock, kind: 'script-only' };
    this.mcCues.push(cue); if (this.mcCues.length > 200) this.mcCues.shift();
    this.mcLine = text; this.onMC?.(cue); return cue;
  }

  syncFromRace() {
    for (const player of this.demo.players) {
      const account = this.game.accounts.get(player.seat);
      if (account && account.money !== player.money) this.game.setBalance(player.seat, player.money, 'Đồng bộ sự kiện ô đích', `race:${this.match}:${++this.sequence}:${player.seat}`);
    }
  }

  syncToRace() {
    for (const player of this.demo.players) {
      const account = this.game.accounts.get(player.seat);
      if (account) player.money = account.money;
    }
  }

  setHold(value) {
    if (this.demo.setHold) this.demo.setHold(value);
    else this.demo.globalHold = value;
  }

  openInvestment(index = this.demo.active, { seed, flavor = 'startup' } = {}) {
    if(this.demo.loading || !this.demo.layout)return false;
    if (this.modal || this.demo.race?.over) return false;
    if (!Number.isInteger(index) || !this.demo.players[index]) return false;
    this.syncFromRace();
    const player = this.demo.players[index];
    const event = this.game.openInvestment(player.seat, { seed: seed ?? ((this.demo.layout.seed + (this.investmentSequence + 1) * 7919) >>> 0), flavor, stake: 100, joinSeconds: 10, chartSeconds: 8 });
    if (!event) { this.notice = 'Chủ quầy cần đủ 100 MONEY để mở phiên góp vốn.'; return false; }
    this.investmentSequence++;
    this.hostIndex = index; this.hostBefore = player.money; this.modal = 'investment';
    this.lastGroupAt = this.clock; this.settledAt = null; this.previousPhase = 'joining';
    this.demo.select(index); this.setHold(true); this.syncToRace();
    this.cue(`${event.id}.open`, event.mcLine, { host: player.seat, stake: 100 });
    return true;
  }

  openEnvelope(seed) {
    if(this.demo.loading || !this.demo.layout)return false;
    if (this.modal || this.game.redEnvelope || this.demo.race?.over) return false;
    this.syncFromRace();
    const event = this.game.openRedEnvelope(seed ?? ((this.demo.layout.seed + (this.envelopeSequence + 1) * 3571) >>> 0), 1000, { minPot: 1000, maxPot: 5000 });
    if (!event) return false;
    this.envelopeSequence++;
    this.envelopeShown = null; this.cue(`${event.id}.open`, event.mcLine); return true;
  }

  waitingCustomerIds() {
    const active = new Set(this.demo.players.map(player => player.seat));
    const waiting = this.matchmaking?.snapshot().waitingIds || [...this.game.accounts.keys()];
    return [...new Set(waiting)].filter(id => this.game.accounts.has(id) && !active.has(id));
  }

  openShop(index = this.demo.active) {
    if (this.demo.loading || !this.demo.layout || this.modal || this.demo.race?.over
      || !Number.isInteger(index) || !this.demo.players[index]) return false;
    this.syncFromRace();
    const player = this.demo.players[index], before = player.money;
    const event = this.shop.open(player.seat, { customerIds: this.waitingCustomerIds() });
    if (!event) { this.notice = this.shop.lastAction?.reason || 'Chủ quầy cần đủ 120 MONEY để mở shop.'; return false; }
    this.hostIndex = index; this.hostBefore = before; this.modal = 'shop';
    this.lastGroupAt = this.clock; this.settledAt = null; this.previousShopPhase = event.phase;
    this.demo.select(index); this.setHold(true); this.syncToRace();
    this.onSound?.('sfx_coin_down');
    this.cue(`${event.id}.open`, event.mcLine, event.mcCue.variables);
    return true;
  }

  order(id = this.selectedId, eventId = `demo-order-${this.match}-${++this.sequence}`) {
    if (!this.canInput()) return false;
    this.syncFromRace();
    const ok = this.shop.order(id, eventId);
    this.syncToRace(); this.notice = this.shop.lastAction?.reason || 'Chưa có cửa đặt đơn.';
    if (ok) this.onSound?.('sfx_order');
    return ok;
  }

  cancelOrder(id = this.selectedId, eventId = `demo-return-${this.match}-${++this.sequence}`) {
    if (!this.canInput()) return false;
    this.syncFromRace();
    const ok = this.shop.cancel(id, eventId);
    this.syncToRace(); this.notice = this.shop.lastAction?.reason || 'Chưa có cửa trả đơn.';
    if (ok) this.onSound?.('sfx_return');
    return ok;
  }

  canInput() {
    if (this.demo.paused) { this.notice = 'Đang tạm dừng, hãy tiếp tục trước khi gửi lệnh.'; return false; }
    if (this.demo.race?.over) { this.notice = 'Ván đã khóa, đang chuẩn bị ván mới.'; return false; }
    return true;
  }

  comment(id, text, eventId = `demo-comment-${this.match}-${++this.sequence}`) {
    if (!this.canInput()) return false;
    const value = clean(text), parts = value.split(' '), last = parts.at(-1);
    if (!this.game.accounts.has(id)) { this.notice = 'Mã người chơi chưa vào ván.'; return false; }
    let ok = false, communityInput = false;
    const investment = this.game.investment;
    if (/^(MUA\s+)?P\d+$/.test(value) || /^(BOM|TRA)\s+P\d+$/.test(value)) {
      const shop = this.shop.snapshot();
      if (!shop || shop.hostId !== last) { this.notice = 'Lệnh đang nhắm một shop khác hoặc cửa đã đóng.'; return false; }
      return /^(BOM|TRA)\s+/.test(value) ? this.cancelOrder(id, eventId) : this.order(id, eventId);
    } else if (/^(GOP|THAM GIA)(\s+P\d+)?$/.test(value) || /^(BO|KHONG GOP|KHONG THAM GIA)(\s+P\d+)?$/.test(value)) {
      communityInput = true;
      if (last.startsWith('P') && investment?.hostId !== last) { this.notice = 'Lệnh đang nhắm một startup khác hoặc cửa cũ.'; return false; }
      const join = value.startsWith('GOP') || value.startsWith('THAM GIA');
      this.syncFromRace(); ok = this.game.joinInvestment(id, join ? 'join' : 'pass', eventId); this.syncToRace();
    } else if (value === 'LAC') {
      const index = this.demo.players.findIndex(player => player.seat === id);
      if (index < 0) { this.notice = 'Bạn đang là khách chờ ghế; vẫn có thể góp vốn, đặt đơn, nhận lì xì và bỏ phiếu rẽ đường.'; return false; }
      ok = this.demo.requestRollFor ? this.demo.requestRollFor(index) : index === this.demo.active && this.demo.requestRoll();
    } else if (value === 'TRAI' || value === 'PHAI') {
      const index = this.demo.players.findIndex(player => player.seat === id), direction = value === 'TRAI' ? 'left' : 'right';
      if (index < 0) {
        ok = typeof this.demo.voteFork === 'function' && this.demo.voteFork(id, direction);
        this.notice = ok ? 'Đã ghi nhận phiếu rẽ đường của khách chờ ghế.' : 'Chưa có cửa bình chọn rẽ đường đang mở.';
        return !!ok;
      }
      ok = this.demo.chooseForkFor ? this.demo.chooseForkFor(index, direction) : index === this.demo.active && this.demo.chooseFork(direction);
    } else {
      const index=this.demo.players.findIndex(player=>player.seat===id);
      const event=this.demo.runners?.[index]?.event;
      const choice=event?.choices?.find(choice=>clean(choice.id)===value || clean(choice.label)===value);
      if(choice && this.demo.chooseEventFor) {ok=this.demo.chooseEventFor(index,choice.id);this.notice=ok?'Đã chốt lựa chọn sự kiện.':'Cửa lựa chọn đã khóa.';}
      else this.notice = 'Lệnh thử: GÓP, KHÔNG THAM GIA, MUA P001, BOM P001, LẮC, TRÁI, PHẢI hoặc lựa chọn trên thẻ.';
    }
    if (communityInput && this.game.lastAction) this.notice = this.game.lastAction.reason;
    else if (value === 'LAC' || value === 'TRAI' || value === 'PHAI') this.notice = ok ? 'Đã nhận lệnh của người chơi.' : 'Lệnh chưa đúng cửa hoặc quân đang di chuyển.';
    return !!ok;
  }

  like(id = this.selectedId, count = 10, eventId = `demo-like-${this.match}-${++this.sequence}`) {
    if (this.demo.paused) { this.notice='Đang tạm dừng.';return false; }
    const lobby=this.matchmaking?.snapshot();
    const reserved=this.matchmaking?.receiveLike(id,count,eventId);
    if (this.demo.race?.over && !['podium','reserving'].includes(lobby?.phase)) {this.notice='Đang ghép ván mới.';return false;}
    this.syncFromRace(); const ok = this.game.receiveLike(id, count, eventId); this.syncToRace();
    this.notice = lobby?.phase==='reserving' && lobby.oldActiveIds.includes(id) ? this.matchmaking.lastAction?.reason : this.game.lastAction?.reason || '';
    return ok || !!reserved;
  }

  rose(id = this.selectedId, eventId = `demo-rose-${this.match}-${++this.sequence}`, count = 1) {
    if (this.demo.paused) { this.notice = 'Đang tạm dừng.'; return false; }
    const ok = this.game.receiveRose(id, eventId, count); this.notice = this.game.lastAction?.reason || ''; return ok;
  }

  simulateJoins(count = this.game.accounts.size) {
    if (!this.canInput()) return 0;
    let accepted = 0;
    for (const id of [...this.game.accounts.keys()].slice(0,count)) if (this.comment(id, 'GÓP', `batch:${this.match}:${this.game.investment?.id}:${id}`)) accepted++;
    this.notice = `Đã mô phỏng góp vốn cho ${accepted} người mới; chủ quầy đã góp từ đầu.`; return accepted;
  }

  simulateHearts() {
    if (this.demo.paused) return 0;
    let accepted = 0;
    for (const id of this.game.accounts.keys()) if (this.like(id, 10)) accepted++;
    this.notice = `Đã mô phỏng ${accepted} lượt tim riêng biệt.`; return accepted;
  }

  simulateOrders(count = 8) {
    if (!this.canInput()) return 0;
    const event = this.shop.snapshot();
    if (!event || event.phase !== 'ordering') { this.notice = 'Chưa có cửa đặt đơn.'; return 0; }
    const limit = Number.isInteger(count) ? Math.max(0, Math.min(event.maxOrders, count)) : 0;
    let accepted = 0;
    for (const id of event.eligibleCustomerIds) {
      if (accepted >= limit || this.shop.snapshot().count >= event.maxOrders) break;
      if (this.order(id, `batch-order:${this.match}:${event.id}:${id}`)) accepted++;
    }
    this.notice = `Đã mô phỏng ${accepted} đơn mới từ khách chờ ghế.`; return accepted;
  }

  simulateCancels(count = 6) {
    if (!this.canInput()) return 0;
    const event = this.shop.snapshot();
    if (!event || event.phase !== 'returns') { this.notice = 'Chưa có cửa trả đơn.'; return 0; }
    const limit = Number.isInteger(count) ? Math.max(0, Math.min(event.maxOrders, count)) : 0;
    let accepted = 0;
    for (const order of event.orders) {
      if (accepted >= limit) break;
      if (!order.cancelled && this.cancelOrder(order.customerId, `batch-return:${this.match}:${event.id}:${order.customerId}`)) accepted++;
    }
    this.notice = `Đã mô phỏng ${accepted} khách hủy đúng đơn của mình.`; return accepted;
  }

  ordersAll(count = 8) { return this.simulateOrders(count); }
  cancelOrders(count = 6) { return this.simulateCancels(count); }

  update(dt) {
    this.syncFromRace();
    const elapsed = this.demo.paused ? 0 : dt * this.demo.speed;
    this.clock += elapsed; this.game.tick(elapsed); this.shop.tick(elapsed); this.syncToRace();
    const investment = this.game.investmentSnapshot();
    if (investment && this.modal === 'investment') {
      if (investment.phase !== this.previousPhase) {
        this.previousPhase = investment.phase; this.cue(`${investment.id}.${investment.phase}`, investment.mcLine);
        if (investment.phase === 'settled') { this.settledAt = this.clock; this.onSound?.(investment.result.net >= 0 ? 'sfx_coin_up' : 'sfx_coin_down'); }
      }
      if (investment.phase === 'settled' && this.clock - this.settledAt >= 4) {
        const row = investment.result.results.find(row => row.id === investment.hostId);
        const net = row?.net || 0, after = this.demo.players[this.hostIndex].money;
        const result = { before: after - net, after, delta: net, openingBalance: this.hostBefore,
          reasonText: 'Kết quả góp vốn tập thể', community: true,
          sfx: (row?.net || 0) >= 0 ? 'sfx_coin_up' : 'sfx_coin_down', vfx: (row?.net || 0) >= 0 ? 'coin_burst' : 'coin_loss' };
        if (this.demo.completeCollective) this.demo.completeCollective(this.hostIndex, result);
        this.game.closeInvestment(investment.id); this.modal = null; this.setHold(false); this.settledAt = null;
      }
    }
    const shop = this.shop.snapshot();
    if (shop && this.modal === 'shop') {
      if (shop.phase !== this.previousShopPhase) {
        this.previousShopPhase = shop.phase;
        this.cue(`${shop.id}.${shop.phase}`, shop.mcLine, shop.mcCue.variables);
        if (shop.phase === 'settled') {
          this.settledAt = this.clock;
          this.onSound?.(shop.result.net > 0 ? 'sfx_coin_up' : shop.result.net < 0 ? 'sfx_coin_down' : 'sfx_question');
        }
      }
      if (shop.phase === 'settled' && this.clock - this.settledAt >= 4) {
        const net = shop.result.net;
        const after = this.demo.players[this.hostIndex].money;
        const result = { before: after - net, after, delta: net, openingBalance: this.hostBefore,
          reasonText: 'Chốt shop cộng đồng', community: true, shop: true,
          sfx: net > 0 ? 'sfx_coin_up' : net < 0 ? 'sfx_coin_down' : 'sfx_question',
          vfx: net > 0 ? 'coin_burst' : net < 0 ? 'coin_loss' : 'rest' };
        this.demo.completeCollective?.(this.hostIndex, result);
        this.shop.close(); this.modal = null; this.setHold(false); this.settledAt = null;
      }
    }
    const envelope = this.game.redEnvelopeSnapshot();
    if (envelope?.phase === 'settled' && this.envelopeShown !== envelope.id && !this.modal) {
      this.envelopeShown = envelope.id; this.modal = 'envelope'; this.settledAt = this.clock;
      this.setHold(true); this.onSound?.('sfx_coin_up'); this.cue(`${envelope.id}.settled`, envelope.mcLine);
    }
    if (this.modal === 'envelope' && this.clock - this.settledAt >= 5) {
      this.game.closeRedEnvelope(envelope.id); this.modal = null; this.setHold(false); this.settledAt = null;
    }
    const leaderLap = Math.max(0, ...this.demo.players.map(player => player.laps || 0));
    if (leaderLap > this.lastEnvelopeLap && leaderLap < 3) {
      if (this.openEnvelope()) this.lastEnvelopeLap = leaderLap;
    }
  }

  resetForMatch({ manual = false } = {}) {
    const shop = this.shop.snapshot();
    if (shop && ['ordering','returns'].includes(shop.phase)) {
      if (!manual || !this.shop.cancelOpen()) return false;
      this.syncToRace();
    } else if (shop?.phase === 'settled') this.shop.close();
    const pending = this.game.redEnvelope?.phase === 'collecting' ? { hearts: this.game.redEnvelope.hearts, target: this.game.redEnvelope.target, contributors: [...this.game.redEnvelope.contributors] } : null;
    if (!this.game.reset({ preservePriority: true, cancelActive: manual || !!pending })) return false;
    this.match++; this.modal = null; this.hostIndex = null; this.settledAt = null; this.lastEnvelopeLap = 0;
    this.investmentSequence = 0; this.envelopeSequence = 0;
    this.lastGroupAt = this.clock - 60; this.setHold(false); this.syncToRace();
    if (pending && !manual) {
      this.game.openRedEnvelope((this.demo.layout.seed + this.match * 3571) >>> 0, pending.target);
      this.game.redEnvelope.hearts = pending.hearts;
      this.game.redEnvelope.contributors = new Set(pending.contributors);
    }
    this.cue('race.new-match', 'Ván mới mở cửa! Ba vòng đường, ba người về đích đầu tiên lên bục.'); return true;
  }

  snapshot() {
    const state=this.game.snapshot(), active=new Set(this.demo.players.filter(p=>!p.finished).map(p=>p.seat));
    state.scheduler.queue=state.scheduler.queue.filter(id=>active.has(id));
    const shop=this.shop.snapshot();
    if(shop){
      shop.settledRemainingSeconds=shop.phase==='settled'&&this.modal==='shop'?Math.max(0,4-(this.clock-this.settledAt)):0;
      if(shop.result && shop.phase==='settled' && this.modal==='shop'){
        const after=this.game.accounts.get(shop.hostId)?.money ?? shop.result.after;
        shop.result={...shop.result,openingBalance:shop.result.before,concurrentDelta:after-shop.result.before-shop.result.net,
          before:after-shop.result.net,after};
      }
    }
    return { ...state, shop, activeIds:this.demo.players.map(p=>p.seat), modal: this.modal, selectedId: this.selectedId, notice: this.notice,
      mcLine: this.mcLine || 'Cả phố đã sẵn sàng. Mỗi quân có ba vòng đường để chinh phục!', mcCues: this.mcCues.slice(-20) };
  }
}
