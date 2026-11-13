// Local game MONEY only. A LIVE adapter must identify accounts and provide a
// finalized unique event ID; this module never connects to TikTok or payments.
export const COLLECTIVE_EVENTS = {
  startup: { id: 'GROUP01', title: 'Startup xe bánh mì',
    body: 'Chủ quầy và cả phố cùng góp vốn một mẻ hàng. Đóng cửa góp rồi mới chạy chart mô phỏng.',
    mc: { open: 'Ghế {host} mở xe bánh mì! Góp {stake} MONEY thì gõ GÓP, đứng xem thì gõ BỎ. Đây là điểm trong game nha.',
      lock: 'Khóa sổ! {count} người góp tổng {total} MONEY. Bé Két mở chart mô phỏng!',
      win: 'Chart xanh rồi! Hoàn vốn và chia lợi tức cho {count} người, có cả chủ quầy.',
      loss: 'Chart chúi xuống rồi! Cả nhóm, kể cả chủ quầy, nhận lại phần vốn còn lại. Tiền đã báo rõ trên sổ.' } },
  cooperative: { id: 'GROUP02', title: 'Hợp tác xã trà tắc',
    body: 'Cả hẻm góp một mẻ trà tắc; có thể lời hoặc lỗ phần vốn đã góp.',
    mc: { open: 'Hợp tác xã trà tắc gọi vốn! Gõ GÓP để góp {stake} MONEY, BỎ để giữ ví.',
      lock: 'Đủ {count} cổ đông trà tắc. Chốt {total} MONEY, cùng xem mẻ này ra sao!',
      win: 'Trà tắc đắt hàng! Vốn về, lợi tức cũng về.', loss: 'Mưa tới đúng giờ bán trà! Chủ quầy cũng chịu lỗ như mọi người.' } },
  market: { id: 'GROUP03', title: 'Góp quỹ phiên chợ',
    body: 'Mỗi người góp cùng một mức vốn để dựng phiên chợ cuối tuần.',
    mc: { open: 'Phiên chợ cần vốn dựng sạp. Góp {stake} MONEY thì gõ GÓP, không tham gia gõ BỎ.',
      lock: 'Chốt danh sách {count} người. Tổng vốn {total} MONEY đã vào quỹ phiên chợ.',
      win: 'Phiên chợ đông vui! Cả nhóm nhận vốn và phần lời.', loss: 'Phiên chợ vắng hơn dự kiến. Mỗi người nhận lại phần vốn còn lại.' } },
  fair: { id: 'GROUP04', title: 'Sân khấu đầu hẻm',
    body: 'Cùng góp vốn cho một tối hội phố; kết quả được mô phỏng, không phải thị trường thật.',
    mc: { open: 'Hội phố cần dựng sân khấu! Ai góp {stake} MONEY gõ GÓP, muốn cổ vũ thôi thì gõ BỎ.',
      lock: 'Đã khóa {count} người góp, tổng {total} MONEY. Mở màn chart hội phố!',
      win: 'Hội phố kín chỗ! Hoàn vốn, chia phần lời cho cả nhóm.', loss: 'Loa hát hay mà trời mưa quá! Chủ hội và người góp cùng nhận phần vốn còn lại.' } }
};

function integer(value, min = 0, max = 1_000_000_000) {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

export function communityRandom(...parts) {
  let state = 2166136261;
  for (const character of parts.join('|')) state = Math.imul(state ^ character.charCodeAt(0), 16777619);
  return (state >>> 0) / 4294967296;
}

export function createInvestmentChart(seed, flavor = 'startup', count = 48) {
  if (!integer(count, 2, 10000)) throw new RangeError('Invalid chart sample count');
  const up = communityRandom(seed, flavor, 'direction') >= .5;
  const multiplierBps = up
    ? 12000 + Math.floor(communityRandom(seed, flavor, 'return') * 6001)
    : 1500 + Math.floor(communityRandom(seed, flavor, 'return') * 5501);
  const end = multiplierBps / 10000;
  const points = Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count;
    const noise = (communityRandom(seed, flavor, 'point', i) - .5) * .3 * Math.sin(t * Math.PI);
    return { x: t, y: i === 0 ? 1 : i === count ? end : Math.max(.04, 1 + (end - 1) * t + noise) };
  });
  return { direction: up ? 'up' : 'down', multiplierBps, points };
}

// Half the pot is shared equally, half is weighted by rank. Integer remainders
// go to the largest fractional claims, then the better rank. No MONEY vanishes.
export function allocateRankedPot(rankedIds, pot) {
  if (!integer(pot) || !Array.isArray(rankedIds) || !rankedIds.length || new Set(rankedIds).size !== rankedIds.length) throw new RangeError('Invalid red-envelope allocation');
  const n = rankedIds.length, base = Math.floor(pot / (2 * n)), remainder = pot - base * n;
  const weightTotal = n * (n + 1) / 2;
  const shares = rankedIds.map((id, i) => {
    const claim = remainder * (n - i) / weightTotal;
    return { id, rank: i + 1, amount: base + Math.floor(claim), fraction: claim % 1 };
  });
  let left = pot - shares.reduce((sum, value) => sum + value.amount, 0);
  const fractional = [...shares].sort((a, b) => b.fraction - a.fraction || a.rank - b.rank);
  for (let i = 0; i < left; i++) fractional[i].amount++;
  return shares.map(({ id, rank, amount }) => ({ id, rank, amount }));
}

function line(template, params) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ''));
}

export class CommunityGame {
  constructor({ maxAccounts = 100, startingMoney = 1000 } = {}) {
    if (!integer(maxAccounts, 1, 10000) || !integer(startingMoney)) throw new RangeError('Invalid community configuration');
    this.maxAccounts = maxAccounts; this.startingMoney = startingMoney;
    this.accounts = new Map(); this.ledger = []; this.postedOperations = new Set(); this.seenInputs = new Set();
    this.sequence = 0; this.inputSequence = 0; this.clock = 0;
    this.escrow = 0; this.bank = 0; this.initialMoney = 0;
    this.served = new Set(); this.cycle = 1; this.investment = null; this.redEnvelope = null;
  }

  register(id, { name, seat = '', money = this.startingMoney } = {}) {
    id = String(id ?? '').trim();
    if (!id || id.length > 128 || !integer(money)) return null;
    if (this.accounts.has(id)) return this.accounts.get(id);
    if (this.accounts.size >= this.maxAccounts) return null;
    const account = { id, name: String(name || id).slice(0, 64), seat: String(seat).slice(0, 12),
      money, order: this.accounts.size, likes: 0, likeBoost: 0, roses: 0, roseCredits: 0, rosePriorityAt: 0, turnsTaken: 0 };
    this.accounts.set(id, account); this.initialMoney += money;
    return account;
  }

  reset({ money = this.startingMoney, preservePriority = false, cancelActive = false } = {}) {
    if (!integer(money)) return false;
    const activeInvestment = this.investment && this.investment.phase !== 'settled';
    const activeEnvelope = this.redEnvelope?.phase === 'collecting';
    if ((activeInvestment || activeEnvelope) && !cancelActive) return false;
    if (activeInvestment) {
      const event = this.investment;
      for (const contribution of event.contributors.values()) {
        this._move(contribution.id, contribution.stake, 'Hủy ván bằng điều khiển: hoàn vốn đang tạm giữ', `${event.id}:cancel:${contribution.id}`,
          { escrowDelta: -contribution.stake, bankDelta: 0, eventId: event.id, type: 'investment-cancel' });
      }
    }
    for (const account of this.accounts.values()) Object.assign(account, { money, likes: 0, likeBoost: 0,
      roses: preservePriority ? account.roses : 0, roseCredits: preservePriority ? account.roseCredits : 0,
      rosePriorityAt: preservePriority ? account.rosePriorityAt : 0, turnsTaken: 0 });
    this.ledger = []; this.escrow = 0; this.bank = 0; this.initialMoney = this.accounts.size * money;
    this.served.clear(); this.cycle = 1; this.investment = null; this.redEnvelope = null;
    this.lastAction = null;
    // External IDs remain seen across resets so late old packets cannot replay.
    return true;
  }

  _action(ok, reason) { this.lastAction = { ok, reason }; return ok; }

  _move(id, delta, reason, operationId, { escrowDelta = 0, bankDelta = -delta, eventId = null, type = 'adjustment' } = {}) {
    const account = this.accounts.get(String(id));
    if (!account || !Number.isSafeInteger(delta) || !Number.isSafeInteger(escrowDelta) || !Number.isSafeInteger(bankDelta)
      || delta + escrowDelta + bankDelta !== 0 || account.money + delta < 0 || this.escrow + escrowDelta < 0
      || !Number.isSafeInteger(account.money + delta) || !Number.isSafeInteger(this.escrow + escrowDelta)
      || !Number.isSafeInteger(this.bank + bankDelta) || this.postedOperations.has(operationId)) return false;
    const before = account.money;
    account.money += delta; this.escrow += escrowDelta; this.bank += bankDelta;
    this.postedOperations.add(operationId);
    this.ledger.push({ id: operationId, sequence: ++this.sequence, eventId, type, accountId: account.id,
      delta, before, after: account.money, escrowDelta, bankDelta, reason });
    return true;
  }

  setBalance(id, money, reason = 'Đồng bộ ví game', operationId = `sync-${++this.inputSequence}`) {
    const account = this.accounts.get(String(id));
    if (!account || !integer(money)) return false;
    return this._move(account.id, money - account.money, reason, operationId);
  }

  adjustBalance(id, delta, reason = 'Chuyện khu phố', operationId = `adjust-${++this.inputSequence}`) {
    return this._move(String(id), delta, reason, operationId);
  }

  openInvestment(hostId, { stake = 100, joinSeconds = 10, chartSeconds = 8, seed = 1, flavor = 'startup' } = {}) {
    hostId = String(hostId);
    if (this.investment && this.investment.phase !== 'settled') return null;
    const host = this.accounts.get(hostId), config = COLLECTIVE_EVENTS[flavor];
    if (!host || !config || !integer(stake, 1) || host.money < stake || !Number.isFinite(joinSeconds) || joinSeconds <= 0
      || !Number.isFinite(chartSeconds) || chartSeconds <= 0) return null;
    const id = `investment-${++this.sequence}`;
    this.investment = { id, hostId, stake, seed: seed >>> 0, flavor, config, phase: 'joining', elapsed: 0,
      joinSeconds, chartSeconds, contributors: new Map(), passed: new Set(), revisions: new Map(), result: null };
    this._join(hostId);
    this.investment.mcLine = line(config.mc.open, { host: host.seat || host.name, stake });
    return this.investmentSnapshot();
  }

  _join(id) {
    const event = this.investment;
    if (event.contributors.has(id)) return this._action(false, 'Đã góp vốn rồi');
    const account = this.accounts.get(id);
    if (!account || account.money < event.stake) return this._action(false, 'Không đủ MONEY để góp vốn');
    const revision = (event.revisions.get(id) || 0) + 1;
    const posted = this._move(id, -event.stake, 'Góp vốn vào quỹ tạm giữ', `${event.id}:join:${id}:${revision}`,
      { escrowDelta: event.stake, bankDelta: 0, eventId: event.id, type: 'investment-join' });
    if (!posted) return false;
    event.revisions.set(id, revision); event.passed.delete(id);
    event.contributors.set(id, { id, stake: event.stake, revision, before: account.money + event.stake, committedAt: this.clock });
    return this._action(true, 'Đã góp vốn; MONEY đang được tạm giữ');
  }

  joinInvestment(id, choice, commandId = `local-command-${++this.inputSequence}`) {
    id = String(id); const event = this.investment;
    if (!event || event.phase !== 'joining' || !this.accounts.has(id) || !['join', 'pass'].includes(choice)) return this._action(false, 'Cửa góp vốn chưa mở hoặc đã khóa');
    const key = `comment:${String(commandId)}`;
    if (this.seenInputs.has(key)) return this._action(false, 'Lệnh đã được xử lý');
    this.seenInputs.add(key);
    if (choice === 'join') return this._join(id);
    if (id === event.hostId) return this._action(false, 'Chủ startup đã cam kết vốn của mình');
    const contribution = event.contributors.get(id);
    if (contribution) {
      if (!this._move(id, contribution.stake, 'Rút trước giờ khóa, hoàn vốn', `${event.id}:withdraw:${id}:${contribution.revision}`,
        { escrowDelta: -contribution.stake, bankDelta: 0, eventId: event.id, type: 'investment-withdraw' })) return false;
      event.contributors.delete(id);
    } else if (event.passed.has(id)) return this._action(false, 'Đã chọn không tham gia');
    event.passed.add(id);
    return this._action(true, 'Không tham gia; sau giờ khóa không thể đổi ý');
  }

  _lockInvestment() {
    const event = this.investment;
    event.phase = 'chart'; event.elapsed = 0;
    event.chart = createInvestmentChart(event.seed, event.flavor);
    event.mcLine = line(event.config.mc.lock, { count: event.contributors.size, total: event.contributors.size * event.stake });
  }

  _settleInvestment() {
    const event = this.investment;
    if (!event || event.phase !== 'chart' || event.result) return false;
    const results = [];
    for (const contribution of event.contributors.values()) {
      const account = this.accounts.get(contribution.id), before = account.money;
      const returned = Math.floor(contribution.stake * event.chart.multiplierBps / 10000);
      const net = returned - contribution.stake;
      this._move(account.id, returned, 'Hoàn vốn và chốt kết quả chart mô phỏng', `${event.id}:settle:${account.id}`,
        { escrowDelta: -contribution.stake, bankDelta: contribution.stake - returned, eventId: event.id, type: 'investment-settlement' });
      results.push({ id: account.id, stake: contribution.stake, returned, net, before, after: account.money });
    }
    const invested = results.reduce((sum, value) => sum + value.stake, 0), returned = results.reduce((sum, value) => sum + value.returned, 0);
    event.result = { direction: event.chart.direction, multiplierBps: event.chart.multiplierBps,
      totalInvested: invested, totalReturned: returned, net: returned - invested, results };
    event.phase = 'settled'; event.elapsed = event.chartSeconds;
    event.mcLine = line(event.config.mc[event.chart.direction === 'up' ? 'win' : 'loss'], { count: results.length });
    return true;
  }

  tick(dt) {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Invalid simulation time');
    if (dt === 0) return;
    this.clock += dt;
    const event = this.investment;
    if (!event || event.phase === 'settled') return;
    if (event.phase === 'joining') {
      const remaining = event.joinSeconds - event.elapsed;
      if (dt < remaining) { event.elapsed += dt; return; }
      dt -= remaining; this._lockInvestment();
    }
    if (event.phase === 'chart') {
      event.elapsed = Math.min(event.chartSeconds, event.elapsed + dt);
      if (event.elapsed >= event.chartSeconds) this._settleInvestment();
    }
  }

  receiveLike(id, count, eventId) {
    const account = this.accounts.get(String(id));
    if (!account || !integer(count, 1, 1_000_000) || !eventId) return this._action(false, 'Like không hợp lệ');
    const key = `like:${String(eventId)}`;
    if (this.seenInputs.has(key)) return this._action(false, 'Like đã được tính');
    this.seenInputs.add(key); account.likes += count; account.likeBoost = Math.min(1000, account.likeBoost + count);
    const envelope = this.redEnvelope;
    if (envelope?.phase === 'collecting') {
      envelope.hearts = Math.min(envelope.target, envelope.hearts + count);
      envelope.contributors.add(account.id);
      if (envelope.hearts >= envelope.target) this._settleRedEnvelope();
    }
    return this._action(true, 'Đã nhận tim');
  }

  receiveRose(id, eventId, count = 1) {
    const account = this.accounts.get(String(id));
    if (!account || !eventId || !integer(count, 1, 1_000_000)) return this._action(false, 'Quà chưa được xác nhận');
    const key = `gift:${String(eventId)}`;
    if (this.seenInputs.has(key)) return this._action(false, 'Quà đã được tính');
    this.seenInputs.add(key); account.roses += count;
    if (!account.roseCredits) account.rosePriorityAt = ++this.inputSequence;
    account.roseCredits = Math.min(2, account.roseCredits + count);
    return this._action(true, 'Ưu tiên lượt hợp lệ kế tiếp; mỗi người vẫn có lượt trong chu kỳ');
  }

  openRedEnvelope(seed = 1, target = 1000, { minPot = 1000, maxPot = 5000 } = {}) {
    if (this.redEnvelope?.phase === 'collecting' || !this.accounts.size || !integer(target, 1)
      || !integer(minPot) || !integer(maxPot, minPot)) return null;
    this.redEnvelope = { id: `envelope-${++this.sequence}`, seed: seed >>> 0, phase: 'collecting', target, hearts: 0,
      eligibleIds: [...this.accounts.keys()], contributors: new Set(), minPot, maxPot, result: null,
      mcLine: `Cả phố cùng thả tim! Đủ ${target} tim sẽ mở lì xì MONEY cho những người đã vào ván.` };
    return this.redEnvelopeSnapshot();
  }

  _netWorth(id) {
    return this.accounts.get(id).money + (this.investment?.phase !== 'settled' ? this.investment?.contributors.get(id)?.stake || 0 : 0);
  }

  awardGiftEnvelope(eventId, seed, eligibleIds = [], { minPot=1000,maxPot=5000 } = {}) {
    const key=`gift-envelope:${String(eventId||'')}`;
    if(!eventId||this.seenInputs.has(key)||!integer(minPot)||!integer(maxPot,minPot))return null;
    const ranked=[...new Set(eligibleIds.map(String))].filter(id=>this.accounts.has(id)).sort((a,b)=>this._netWorth(b)-this._netWorth(a)||this.accounts.get(a).order-this.accounts.get(b).order);
    if(!ranked.length)return null;
    this.seenInputs.add(key);
    const pot=minPot+Math.floor(communityRandom(seed,eventId,'gift-envelope-pot')*(maxPot-minPot+1));
    const payouts=allocateRankedPot(ranked,pot).map(share=>{
      const before=this.accounts.get(share.id).money;
      this._move(share.id,share.amount,'Lì xì quà cả phố',`${key}:payout:${share.id}`,{eventId:String(eventId),type:'gift-red-envelope'});
      return {...share,before,after:this.accounts.get(share.id).money};
    });
    return {id:key,eventId:String(eventId),source:'gift',pot,payouts,totalPaid:payouts.reduce((sum,payout)=>sum+payout.amount,0)};
  }

  _settleRedEnvelope() {
    const event = this.redEnvelope;
    if (!event || event.phase !== 'collecting' || event.result) return false;
    const ranked = event.eligibleIds.filter(id => this.accounts.has(id)).sort((a, b) => this._netWorth(b) - this._netWorth(a)
      || this.accounts.get(a).order - this.accounts.get(b).order);
    if (!ranked.length) return false;
    const pot = event.minPot + Math.floor(communityRandom(event.seed, 'envelope-pot') * (event.maxPot - event.minPot + 1));
    const payouts = allocateRankedPot(ranked, pot).map(share => {
      const account = this.accounts.get(share.id), before = account.money;
      this._move(share.id, share.amount, 'Lì xì hội phố theo thứ hạng', `${event.id}:payout:${share.id}`, { eventId: event.id, type: 'red-envelope' });
      return { ...share, before, after: account.money };
    });
    event.phase = 'settled'; event.result = { pot, payouts, totalPaid: payouts.reduce((sum, value) => sum + value.amount, 0) };
    event.mcLine = `Đủ tim rồi! Mở quỹ ${pot} MONEY, chia cho ${payouts.length} người theo thứ hạng đã chốt.`;
    return true;
  }

  _priority(eligible) {
    return eligible.sort((a, b) => {
      const x = this.accounts.get(a), y = this.accounts.get(b);
      return Number(y.roseCredits > 0) - Number(x.roseCredits > 0)
        || (x.roseCredits && y.roseCredits ? x.rosePriorityAt - y.rosePriorityAt : 0)
        || y.likeBoost - x.likeBoost || x.order - y.order;
    });
  }

  nextOrder(eligibleIds = [...this.accounts.keys()]) {
    if (!Array.isArray(eligibleIds)) return null;
    const eligible = [...new Set(eligibleIds.map(String))].filter(id => this.accounts.has(id));
    if (!eligible.length) return null;
    let pending = eligible.filter(id => !this.served.has(id));
    if (!pending.length) { this.served.clear(); this.cycle++; pending = eligible; }
    const id = this._priority(pending)[0], account = this.accounts.get(id);
    this.served.add(id); account.turnsTaken++; account.likeBoost = 0;
    if (account.roseCredits) {
      account.roseCredits--; if (account.roseCredits) account.rosePriorityAt = ++this.inputSequence;
    }
    return id;
  }

  takeNext(eligibleIds) { return this.nextOrder(eligibleIds); }

  // LIVE can show an already-served donor's next real roll without resetting
  // the fair cycle. Call consumeRosePriority only after a roll was accepted.
  peekRosePriority(eligibleIds = []) {
    const eligible=[...new Set(eligibleIds.map(String))].filter(id=>this.accounts.get(id)?.roseCredits>0);
    return eligible.sort((a,b)=>this.accounts.get(a).rosePriorityAt-this.accounts.get(b).rosePriorityAt||this.accounts.get(a).order-this.accounts.get(b).order)[0]??null;
  }
  consumeRosePriority(id) {
    const account=this.accounts.get(String(id));if(!account?.roseCredits)return false;
    account.roseCredits--;account.turnsTaken++;account.likeBoost=0;this.served.add(account.id);
    if(account.roseCredits)account.rosePriorityAt=++this.inputSequence;
    return true;
  }

  closeInvestment(eventId = this.investment?.id) {
    if (!this.investment || this.investment.id !== eventId || this.investment.phase !== 'settled') return false;
    this.investment = null; return true;
  }

  closeRedEnvelope(eventId = this.redEnvelope?.id) {
    if (!this.redEnvelope || this.redEnvelope.id !== eventId || this.redEnvelope.phase !== 'settled') return false;
    this.redEnvelope = null; return true;
  }

  investmentSnapshot() {
    const event = this.investment;
    if (!event) return null;
    const progress = event.phase === 'joining' ? 0 : Math.min(1, event.elapsed / event.chartSeconds);
    const chartPoints = event.chart ? event.chart.points.slice(0, Math.floor(progress * (event.chart.points.length - 1)) + 1).map(point => ({ ...point })) : [];
    return { id: event.id, flavor: event.flavor, title: event.config.title, body: event.config.body,
      hostId: event.hostId, phase: event.phase, stake: event.stake, participants: event.contributors.size,
      rules: { winReturnMinBps: 12000, winReturnMaxBps: 18000, lossReturnMinBps: 1500, lossReturnMaxBps: 7000,
        upChance: .5, withdrawBeforeLock: true, hostCanWithdraw: false, label: 'Lời 20–80% hoặc lỗ 30–85% phần vốn góp; chart mô phỏng' },
      passed: event.passed.size, totalCommitted: event.contributors.size * event.stake,
      remainingSeconds: event.phase === 'joining' ? Math.max(0, event.joinSeconds - event.elapsed) : event.phase === 'chart' ? Math.max(0, event.chartSeconds - event.elapsed) : 0,
      contributions: [...event.contributors.values()].map(value => ({ ...value })),
      chart: { points: chartPoints, currentValue: chartPoints.at(-1)?.y ?? 1, progress, simulated: true },
      result: event.result ? { ...event.result, results: event.result.results.map(value => ({ ...value })) } : null,
      mcLine: event.mcLine };
  }

  redEnvelopeSnapshot() {
    const event = this.redEnvelope;
    if (!event) return null;
    return { id: event.id, phase: event.phase, hearts: event.hearts, target: event.target, progress: event.hearts / event.target,
      participants: event.eligibleIds.length, contributors: event.contributors.size, mcLine: event.mcLine,
      result: event.result ? { ...event.result, payouts: event.result.payouts.map(value => ({ ...value })) } : null };
  }

  snapshot() {
    const accounts = [...this.accounts.values()].map(value => ({ ...value, netWorth: this._netWorth(value.id) }));
    const total = accounts.reduce((sum, value) => sum + value.money, 0);
    return { accounts, investment: this.investmentSnapshot(), redEnvelope: this.redEnvelopeSnapshot(),
      scheduler: { cycle: this.cycle, servedIds: [...this.served], queue: this._priority([...this.accounts.keys()].filter(id => !this.served.has(id))),
        pendingRoses: accounts.reduce((sum, value) => sum + value.roseCredits, 0) },
      totals: { wallets: total, escrow: this.escrow, bank: this.bank, initialMoney: this.initialMoney,
        conserved: total + this.escrow + this.bank === this.initialMoney },
      ledger: this.ledger.slice(-500).map(value => ({ ...value })), lastAction: this.lastAction ? { ...this.lastAction } : null };
  }
}
