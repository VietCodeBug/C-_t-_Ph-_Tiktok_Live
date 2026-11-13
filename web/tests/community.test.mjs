import test from 'node:test';
import assert from 'node:assert/strict';
import { CommunityGame, COLLECTIVE_EVENTS, createInvestmentChart, allocateRankedPot } from '../src/community.js';

function fixture(count = 100) {
  const game = new CommunityGame();
  for (let i = 0; i < count; i++) game.register(`viewer-${i}`, { name: `Người ${i + 1}`, seat: `P${i + 1}` });
  return game;
}

function seedFor(direction) {
  for (let seed = 0; seed < 10000; seed++) if (createInvestmentChart(seed).direction === direction) return seed;
  throw new Error('No seed found');
}

test('100 racers have distinct account wallets; duplicate registration cannot overwrite money', () => {
  const game = fixture();
  assert.equal(game.accounts.size, 100);
  const first = game.register('viewer-0', { money: 999999 });
  assert.equal(first.money, 1000);
  assert.equal(game.register('overflow'), null);
  assert.equal(game.register(''), null);
  assert.equal(game.register('negative', { money: -1 }), null);
  assert.equal(game.snapshot().totals.conserved, true);
  assert.equal(game.snapshot().totals.wallets, 100000);
});

test('four collective flavors contain Vietnamese MC phase scripts and reproducible finite charts', () => {
  assert.equal(Object.keys(COLLECTIVE_EVENTS).length, 4);
  for (const [flavor, event] of Object.entries(COLLECTIVE_EVENTS)) {
    assert.ok(event.id && event.title && event.body);
    for (const phase of ['open', 'lock', 'win', 'loss']) assert.ok(event.mc[phase]);
    const chart = createInvestmentChart(42, flavor);
    assert.equal(chart.points.length, 49);
    assert.equal(chart.points[0].y, 1);
    assert.equal(chart.points.at(-1).y, chart.multiplierBps / 10000);
    assert.ok(chart.points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y) && point.y > 0));
    assert.deepEqual(chart, createInvestmentChart(42, flavor));
  }
  assert.throws(() => createInvestmentChart(1, 'startup', 0), /chart sample/);
});

test('host and 99 guests commit once; duplicate comments do not debit again', () => {
  const game = fixture();
  const opened = game.openInvestment('viewer-0', { seed: 42 });
  assert.equal(opened.participants, 1);
  assert.equal(game.accounts.get('viewer-0').money, 900);
  assert.equal(game.openInvestment('viewer-0'), null);
  for (let i = 1; i < 100; i++) assert.equal(game.joinInvestment(`viewer-${i}`, 'join', `comment-${i}`), true);
  assert.equal(game.joinInvestment('viewer-1', 'join', 'comment-1'), false);
  assert.equal(game.joinInvestment('viewer-1', 'join', 'another-comment'), false);
  assert.equal(game.investmentSnapshot().participants, 100);
  assert.equal(game.investmentSnapshot().totalCommitted, 10000);
  assert.equal(game.escrow, 10000);
  assert.ok([...game.accounts.values()].every(account => account.money === 900));
  assert.equal(game.ledger.filter(entry => entry.type === 'investment-join').length, 100);
  assert.equal(game.snapshot().totals.conserved, true);
});

test('a guest can opt out before lock and receive exactly their escrow; host cannot abandon stake', () => {
  const game = fixture(3);
  game.openInvestment('viewer-0');
  assert.equal(game.joinInvestment('viewer-1', 'join', 'join-a'), true);
  assert.equal(game.joinInvestment('viewer-1', 'pass', 'pass-a'), true);
  assert.equal(game.accounts.get('viewer-1').money, 1000);
  assert.equal(game.escrow, 100);
  assert.equal(game.joinInvestment('viewer-1', 'pass', 'pass-a'), false);
  assert.equal(game.joinInvestment('viewer-1', 'pass', 'pass-b'), false);
  assert.equal(game.joinInvestment('viewer-0', 'pass', 'host-pass'), false);
  assert.equal(game.joinInvestment('viewer-1', 'join', 'join-b'), true);
  assert.equal(game.accounts.get('viewer-1').money, 900);
  assert.equal(game.escrow, 200);
  game.tick(10);
  assert.equal(game.joinInvestment('viewer-1', 'pass', 'late-pass'), false);
  assert.equal(game.accounts.get('viewer-1').money, 900);
  assert.equal(game.snapshot().totals.conserved, true);
});

test('insufficient or invalid participation is rejected and a replay cannot become a later debit', () => {
  const game = fixture(2);
  game.setBalance('viewer-1', 20, 'Thiếu vốn', 'set-poor');
  game.openInvestment('viewer-0');
  const count = game.ledger.length;
  assert.equal(game.joinInvestment('viewer-1', 'join', 'poor-comment'), false);
  assert.equal(game.joinInvestment('missing', 'join', 'unknown'), false);
  assert.equal(game.joinInvestment('viewer-1', 'invalid', 'invalid'), false);
  assert.equal(game.ledger.length, count);
  game.setBalance('viewer-1', 1000, 'Tái cấp điểm', 'fund-again');
  assert.equal(game.joinInvestment('viewer-1', 'join', 'poor-comment'), false);
  assert.equal(game.accounts.get('viewer-1').money, 1000);
  assert.equal(game.joinInvestment('viewer-1', 'join', 'fresh-comment'), true);
  assert.equal(game.snapshot().totals.conserved, true);
});

test('join and chart windows are separate; dt zero pauses and future chart points stay hidden', () => {
  const game = fixture(2);
  game.openInvestment('viewer-0');
  const paused = game.investmentSnapshot();
  game.tick(0);
  assert.deepEqual(game.investmentSnapshot(), paused);
  assert.equal(paused.chart.points.length, 0);
  game.tick(5);
  assert.equal(game.investmentSnapshot().remainingSeconds, 5);
  game.joinInvestment('viewer-1', 'join', 'join');
  game.tick(5);
  assert.equal(game.investmentSnapshot().phase, 'chart');
  assert.equal(game.investmentSnapshot().chart.points.length, 1);
  assert.equal(game.investmentSnapshot().result, null);
  game.tick(4);
  assert.equal(game.investmentSnapshot().chart.points.length, 25);
  assert.equal(game.investmentSnapshot().result, null);
  game.tick(4);
  assert.equal(game.investmentSnapshot().phase, 'settled');
  assert.equal(game.investmentSnapshot().chart.points.length, 49);
  assert.throws(() => game.tick(-1), /simulation time/);
  assert.throws(() => game.tick(Infinity), /simulation time/);
});

for (const direction of ['up', 'down']) {
  test(`100 contributors including the owner share the ${direction} chart; escrow and bank reconcile exactly`, () => {
    const game = fixture();
    game.openInvestment('viewer-0', { seed: seedFor(direction) });
    for (let i = 1; i < 100; i++) game.joinInvestment(`viewer-${i}`, 'join', `join-${i}`);
    game.tick(18);
    const result = game.investmentSnapshot().result;
    const returned = Math.floor(100 * result.multiplierBps / 10000);
    assert.equal(result.direction, direction);
    assert.equal(result.results.length, 100);
    assert.equal(result.totalReturned, returned * 100);
    assert.equal(result.totalInvested, 10000);
    assert.equal(result.net, (returned - 100) * 100);
    assert.equal(game.escrow, 0);
    assert.ok([...game.accounts.values()].every(account => account.money === 900 + returned && account.money >= 0));
    assert.equal(game.accounts.get('viewer-0').money, game.accounts.get('viewer-99').money);
    assert.ok(direction === 'up' ? returned >= 120 && returned <= 180 : returned >= 15 && returned <= 70);
    assert.equal(game.snapshot().totals.conserved, true);
    const ledger = game.ledger.length;
    game.tick(100);
    assert.equal(game.ledger.length, ledger, 'settlement cannot be posted again');
  });
}

test('chart output is independent of like/gift inputs and the die has no input into this module', () => {
  const a = fixture(3), b = fixture(3);
  a.openInvestment('viewer-0', { seed: 73 });
  b.openInvestment('viewer-0', { seed: 73 });
  b.receiveLike('viewer-0', 99999, 'many-likes');
  b.receiveRose('viewer-0', 'gift', 100);
  a.tick(18); b.tick(18);
  assert.deepEqual(a.investmentSnapshot().result, b.investmentSnapshot().result);
  assert.deepEqual(a.investmentSnapshot().chart, b.investmentSnapshot().chart);
});

test('a time step crossing both windows settles once without waiting an extra frame', () => {
  const game = fixture(1);
  game.openInvestment('viewer-0', { joinSeconds: 2, chartSeconds: 3 });
  game.tick(5);
  assert.equal(game.investmentSnapshot().phase, 'settled');
  assert.equal(game.ledger.length, 2);
  assert.equal(game.snapshot().totals.conserved, true);
});

test('ranked pot allocation conserves every integer for large and tiny pots', () => {
  const ids = Array.from({ length: 100 }, (_, i) => String(i));
  for (const pot of [0, 27, 99, 100, 1000, 3719, 5000]) {
    const shares = allocateRankedPot(ids, pot);
    assert.equal(shares.length, 100);
    assert.equal(shares.reduce((sum, share) => sum + share.amount, 0), pot);
    assert.ok(shares.every(share => Number.isInteger(share.amount) && share.amount >= 0));
    assert.ok(shares.every((share, i) => i === 0 || shares[i - 1].amount >= share.amount));
  }
  assert.throws(() => allocateRankedPot([], 100), /Invalid/);
});

test('1000 unique hearts open one finite envelope for all 100 registered racers, including non-likers', () => {
  const game = fixture();
  const opened = game.openRedEnvelope(42);
  assert.equal(opened.participants, 100);
  assert.equal(opened.progress, 0);
  assert.equal(game.openRedEnvelope(99), null);
  for (let i = 0; i < 10; i++) assert.equal(game.receiveLike(`viewer-${i}`, 100, `like-${i}`), true);
  const event = game.redEnvelopeSnapshot();
  assert.equal(event.phase, 'settled');
  assert.equal(event.hearts, 1000);
  assert.equal(event.contributors, 10);
  assert.equal(event.result.payouts.length, 100);
  assert.ok(event.result.pot >= 1000 && event.result.pot <= 5000);
  assert.equal(event.result.totalPaid, event.result.pot);
  assert.ok(event.result.payouts.every(share => share.amount > 0));
  assert.ok(game.accounts.get('viewer-99').money > 1000, 'non-likers are still participants');
  const ledger = game.ledger.length;
  assert.equal(game.receiveLike('viewer-9', 100, 'like-9'), false);
  game.receiveLike('viewer-9', 100, 'extra-like');
  assert.equal(game.ledger.length, ledger, 'a settled pot cannot pay a second time');
  assert.equal(game.snapshot().totals.conserved, true);
});

test('envelope ranks include held capital and snapshot eligible IDs at opening', () => {
  const game = fixture(2);
  game.openInvestment('viewer-0');
  game.openRedEnvelope(1, 1, { minPot: 1001, maxPot: 1001 });
  game.register('late', { money: 100000 });
  game.receiveLike('viewer-1', 1, 'heart');
  const result = game.redEnvelopeSnapshot().result;
  assert.equal(result.payouts.length, 2);
  assert.equal(result.payouts[0].id, 'viewer-0', 'held stake does not lower tied ranking');
  assert.ok(result.payouts[0].amount >= result.payouts[1].amount);
  assert.equal(result.totalPaid, 1001);
  assert.equal(game.accounts.get('late').money, 100000);
  assert.equal(game.snapshot().totals.conserved, true);
});

test('a custom pot below participant count may give zero but never invents MONEY', () => {
  const game = fixture();
  game.openRedEnvelope(1, 1, { minPot: 27, maxPot: 27 });
  game.receiveLike('viewer-0', 1, 'heart');
  const payouts = game.redEnvelopeSnapshot().result.payouts;
  assert.equal(payouts.reduce((sum, share) => sum + share.amount, 0), 27);
  assert.ok(payouts.some(share => share.amount === 0));
  assert.equal(game.snapshot().totals.conserved, true);
});

test('likes and finalized rose IDs dedupe, cap priority and never alter wallet or die outcome', () => {
  const game = fixture(3);
  assert.equal(game.receiveLike('viewer-2', 1000000, 'likes'), true);
  assert.equal(game.receiveLike('viewer-2', 1000000, 'likes'), false);
  assert.equal(game.accounts.get('viewer-2').likeBoost, 1000);
  assert.equal(game.receiveRose('viewer-1', 'rose-final', 30), true);
  assert.equal(game.receiveRose('viewer-1', 'rose-final', 30), false);
  assert.equal(game.accounts.get('viewer-1').roses, 30);
  assert.equal(game.accounts.get('viewer-1').roseCredits, 2);
  assert.equal(game.takeNext(), 'viewer-1');
  assert.equal(game.takeNext(), 'viewer-2');
  assert.equal(game.takeNext(), 'viewer-0');
  assert.ok([...game.accounts.values()].every(account => account.money === 1000));
  assert.equal(game.receiveLike('missing', 1, 'unknown'), false);
  assert.equal(game.receiveLike('viewer-0', -1, 'bad'), false);
  assert.equal(game.receiveRose('viewer-0', ''), false);
});

test('rose priority is FIFO and a gift to an already served racer waits for the next fair cycle', () => {
  const game = fixture(4);
  game.receiveRose('viewer-3', 'first-rose');
  game.receiveRose('viewer-2', 'second-rose');
  assert.equal(game.nextOrder(), 'viewer-3');
  game.receiveRose('viewer-3', 'new-rose');
  assert.equal(game.nextOrder(), 'viewer-2');
  assert.equal(game.nextOrder(), 'viewer-0');
  assert.equal(game.nextOrder(), 'viewer-1');
  assert.equal(game.nextOrder(), 'viewer-3');
  assert.equal(game.cycle, 2);
});

test('100 racers cannot be starved even while one racer continually receives many roses and likes', () => {
  const game = fixture();
  for (let cycle = 0; cycle < 3; cycle++) {
    const served = new Set();
    for (let step = 0; step < 100; step++) {
      game.receiveRose('viewer-0', `rose-${cycle}-${step}`, 1000);
      game.receiveLike('viewer-0', 1000000, `like-${cycle}-${step}`);
      const id = game.takeNext();
      assert.equal(served.has(id), false, 'no one repeats while an eligible racer is still waiting');
      served.add(id);
    }
    assert.equal(served.size, 100);
  }
  assert.ok([...game.accounts.values()].every(account => account.turnsTaken === 3));
  assert.equal(game.nextOrder([]), null);
  assert.equal(game.nextOrder(null), null);
  assert.equal(game.nextOrder(['missing']), null);
});

test('reset cancels old escrow, restores wallets and preserves external packet deduplication', () => {
  const game = fixture(2);
  game.openInvestment('viewer-0');
  const previousId = game.investment.id;
  game.receiveRose('viewer-1', 'old-rose');
  game.receiveLike('viewer-1', 100, 'old-like');
  assert.equal(game.reset({ cancelActive: true }), true);
  assert.equal(game.investment, null);
  assert.equal(game.escrow, 0);
  assert.equal(game.ledger.length, 0);
  assert.equal(game.receiveRose('viewer-1', 'old-rose'), false);
  assert.equal(game.receiveLike('viewer-1', 100, 'old-like'), false);
  assert.ok([...game.accounts.values()].every(account => account.money === 1000 && account.roseCredits === 0 && account.likeBoost === 0));
  game.openInvestment('viewer-0');
  assert.notEqual(game.investment.id, previousId);
  assert.equal(game.snapshot().totals.conserved, true);
});

test('sync transactions reject duplicate operation IDs and negative balances', () => {
  const game = fixture(1);
  assert.equal(game.setBalance('viewer-0', 1200, 'Ô nhận tiền', 'ordinary-event'), true);
  assert.equal(game.setBalance('viewer-0', 1400, 'Lặp', 'ordinary-event'), false);
  assert.equal(game.adjustBalance('viewer-0', -1300, 'Không âm', 'too-poor'), false);
  assert.equal(game.accounts.get('viewer-0').money, 1200);
  assert.equal(game.setBalance('viewer-0', -1), false);
  assert.equal(game.snapshot().totals.conserved, true);
});

test('only a settled matching event can be closed, so active escrow never disappears', () => {
  const game = fixture(1);
  game.openInvestment('viewer-0');
  const id = game.investment.id;
  assert.equal(game.closeInvestment(), false);
  assert.equal(game.escrow, 100);
  game.tick(18);
  assert.equal(game.closeInvestment('wrong-event'), false);
  assert.equal(game.closeInvestment(id), true);
  assert.equal(game.investment, null);
  game.openRedEnvelope(1, 1);
  assert.equal(game.closeRedEnvelope(), false);
  game.receiveLike('viewer-0', 1, 'finish-envelope');
  assert.equal(game.closeRedEnvelope(), true);
  assert.equal(game.redEnvelope, null);
  assert.equal(game.snapshot().totals.conserved, true);
});

test('automatic new-match reset carries an unused finalized rose priority and refuses unsettled collective windows', () => {
  const game = fixture(4);
  game.takeNext();
  game.receiveRose('viewer-3', 'late-rose');
  game.receiveLike('viewer-3', 1000, 'late-likes');
  game.openInvestment('viewer-0');
  assert.equal(game.reset({ preservePriority: true }), false);
  assert.equal(game.escrow, 100);
  game.tick(18);
  game.openRedEnvelope(1, 1);
  assert.equal(game.reset({ preservePriority: true }), false);
  game.receiveLike('viewer-1', 1, 'fill-envelope');
  assert.equal(game.reset({ preservePriority: true }), true);
  assert.equal(game.accounts.get('viewer-3').money, 1000);
  assert.equal(game.accounts.get('viewer-3').roseCredits, 1);
  assert.equal(game.accounts.get('viewer-3').roses, 1);
  assert.equal(game.accounts.get('viewer-3').likeBoost, 0);
  assert.equal(game.receiveRose('viewer-3', 'late-rose'), false);
  assert.equal(game.takeNext(), 'viewer-3');
  assert.equal(game.accounts.get('viewer-3').roseCredits, 0);
  assert.equal(game.snapshot().totals.conserved, true);
});

test('explicit restart can cancel held capital before resetting wallets while carrying pending rose credits', () => {
  const game = fixture(3);
  game.openInvestment('viewer-0');
  game.joinInvestment('viewer-1', 'join', 'join-for-cancel');
  game.receiveRose('viewer-2', 'rose-for-new-match', 2);
  assert.equal(game.escrow, 200);
  assert.equal(game.reset({ preservePriority: true, cancelActive: true }), true);
  assert.equal(game.escrow, 0);
  assert.ok([...game.accounts.values()].every(account => account.money === 1000));
  assert.equal(game.accounts.get('viewer-2').roseCredits, 2);
  assert.equal(game.snapshot().totals.conserved, true);
});
