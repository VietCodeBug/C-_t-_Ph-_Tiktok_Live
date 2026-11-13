import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CameraDemo } from '../src/demo.js';
import { createTownLayouts } from '../src/layouts.js';
import { DICE_ROLL_SECONDS, DICE_RESULT_SECONDS } from '../src/dice.js';
import { EVENT_CARDS, TILE_CATEGORIES, chooseLandingCard, resolveEventCard } from '../src/events.js';

async function fixture({ roll = 6 } = {}) {
  const world = { playerGroup: new THREE.Group(), followHeading: new THREE.Vector3(),
    camera: new THREE.PerspectiveCamera(), lookAt: new THREE.Vector3(),
    renderer: { info: { render: { calls: 0, triangles: 0 } } },
    async loadMap() {}, updateCamera() { return 'overview'; } };
  const players = Array.from({ length: 10 }, (_, i) => ({
    group: new THREE.Group(), position: new THREE.Vector3(), heading: new THREE.Vector3(),
    seat: String.fromCharCode(65 + i), data: { name: `Player ${i}` }, images: new Map(),
    setClip(name) { this.clip = name; }, loadClip() {}, update() {} }));
  const demo = new CameraDemo(world, players, createTownLayouts(42), null, { randomRoll: () => roll, interactiveChoices: true });
  await demo.changeMap('CHO_VIA_HE');
  return { demo, players, world };
}

function beginFork(demo) {
  assert.equal(demo.previewFork(), true);
  demo.update(DICE_ROLL_SECONDS); demo.update(DICE_RESULT_SECONDS);
  assert.equal(demo.phase, 'fork-choice');
}

test('runtime catalog has 50 unique complete cards covering eight readable tile categories', () => {
  assert.equal(EVENT_CARDS.length, 50);
  assert.equal(new Set(EVENT_CARDS.map(card => card.id)).size, 50);
  assert.equal(TILE_CATEGORIES.length, 8);
  for (const card of EVENT_CARDS) {
    assert.ok(TILE_CATEGORIES.some(category => category.id === card.category));
    assert.ok(card.title && card.body && card.mc && card.sfx && card.vfx);
    assert.ok(card.choices.length || Number.isInteger(card.delta));
    for (const choice of card.choices) {
      assert.ok(choice.id && choice.label && choice.description);
      if (choice.outcomes) {
        assert.ok(Math.abs(choice.outcomes.reduce((sum, outcome) => sum + outcome.weight, 0) - 1) < 1e-10);
        assert.ok(choice.outcomes.every(outcome => Number.isInteger(outcome.delta)));
      } else assert.ok(Number.isInteger(choice.delta));
    }
  }
});

test('fees stop at zero, investments reject unaffordable choices and outcomes match advertised probabilities', () => {
  const fee = EVENT_CARDS.find(card => card.category === 'loss');
  assert.deepEqual([resolveEventCard(fee, null, 12).delta, resolveEventCard(fee, null, 12).after], [-12, 0]);
  const investment = EVENT_CARDS.find(card => card.category === 'invest');
  const [safe, risky] = investment.choices;
  assert.equal(resolveEventCard(investment, 'bogus', 1000), null);
  assert.equal(resolveEventCard(investment, risky.id, risky.minMoney - 1), null);
  assert.equal(resolveEventCard(investment, safe.id, 0).after, safe.delta);
  assert.equal(resolveEventCard(investment, risky.id, 1000, 0).delta, risky.outcomes[0].delta);
  assert.equal(resolveEventCard(investment, risky.id, 1000, .999).delta, risky.outcomes[1].delta);
});

test('a seed replays the same event and recent-card cooldown avoids immediate repeat when alternatives exist', () => {
  const node = { id: 'C03', station: false, typeIndex: 3 };
  const context = { node, seed: 17, turn: 9, seat: 'A' };
  const first = chooseLandingCard(context);
  assert.deepEqual(chooseLandingCard(context), first);
  assert.notEqual(chooseLandingCard({ ...context, recentIds: [first.id] }).id, first.id);
});

test('fork prompt freezes movement and time on pause; a player selection wins over crowd votes without spending a step', async () => {
  const { demo, players } = await fixture(); beginFork(demo);
  const node = players[0].node, position = players[0].position.toArray();
  assert.equal(demo.stepsCompleted, 0); assert.equal(demo.remaining, 6);
  const branch = demo.snapshot().branch;
  assert.deepEqual(branch.options.map(option => option.id), ['left', 'right']);
  demo.voteFork('one', 'right'); demo.voteFork('two', 'right');
  demo.setPaused(true); demo.update(20);
  assert.equal(demo.snapshot().branch.remainingSeconds, branch.remainingSeconds);
  assert.equal(demo.chooseFork('left'), false);
  assert.equal(players[0].node, node); assert.deepEqual(players[0].position.toArray(), position);
  demo.setPaused(false);
  assert.equal(demo.chooseFork('left'), true);
  assert.equal(demo.chooseFork('right'), false);
  assert.equal(demo.segment.to, branch.options.find(option => option.id === 'left').target);
  assert.equal(demo.lastChoice.source, 'player');
  assert.equal(demo.remaining, 6, 'choosing a direction itself costs no step');
  for (let i = 0; demo.phase === 'moving' && i < 2000; i++) demo.update(.1);
  assert.equal(demo.stepsCompleted, 6); assert.equal(demo.remaining, 0);
  assert.ok(['arrive', 'event-choice'].includes(demo.phase));
  assert.equal(players[0].clip === 'run', false, 'regular movement uses relaxed walk art');
});

test('each audience ID has one latest vote; timeout follows majority and ties use visible default', async () => {
  const { demo } = await fixture(); beginFork(demo);
  demo.voteFork('repeat', 'left'); demo.voteFork('repeat', 'left'); demo.voteFork('repeat', 'right');
  demo.voteFork('other', 'right');
  assert.deepEqual(demo.snapshot().branch.votes, { left: 0, right: 2 });
  demo.update(10);
  assert.equal(demo.lastChoice.direction, 'right'); assert.equal(demo.lastChoice.source, 'votes');
  demo.select(0); beginFork(demo);
  demo.voteFork('one', 'left'); demo.voteFork('two', 'right');
  const fallback = demo.snapshot().branch.default;
  demo.update(10);
  assert.equal(demo.lastChoice.direction, fallback); assert.equal(demo.lastChoice.source, 'timeout');
  assert.equal(demo.voteFork('late', 'right'), false);
});

test('only the landing tile opens an event, quick fees record once and rest changes no MONEY', async () => {
  const { demo } = await fixture({ roll: 2 });
  demo.requestRoll(); demo.update(DICE_ROLL_SECONDS); demo.update(DICE_RESULT_SECONDS);
  assert.equal(demo.ledger.length, 0);
  for (let i = 0; demo.stepsCompleted < 1 && i < 1000; i++) demo.update(.1);
  assert.equal(demo.stepsCompleted, 1); assert.equal(demo.ledger.length, 0, 'passing an ordinary tile cannot settle its event');
  for (let i = 0; demo.phase === 'moving' && i < 1000; i++) demo.update(.1);
  assert.ok(demo.event); assert.equal(demo.event.nodeId, demo.players[0].node);
  demo.previewEvent('loss');
  const first = demo.snapshot(), entries = demo.ledger.length;
  assert.ok(first.event.result.delta < 0); assert.equal(first.money, first.event.result.after);
  assert.equal(demo.applyEvent(null), false); assert.equal(demo.chooseEvent('wrong'), false);
  assert.equal(demo.ledger.length, entries);
  const balance = demo.players[0].money;
  demo.previewEvent('rest');
  assert.equal(demo.event.result.delta, 0); assert.equal(demo.players[0].money, balance);
});

test('event choice holds and pauses, cannot debit twice, and risk outcome is deterministic', async () => {
  const { demo } = await fixture(); demo.previewEvent('invest');
  assert.equal(demo.phase, 'event-choice');
  const choice = demo.event.choices[1], event = structuredClone(demo.event);
  demo.setPaused(true); demo.update(100);
  assert.equal(demo.snapshot().event.remainingSeconds, 10); assert.equal(demo.chooseEvent(choice.id), false);
  assert.equal(demo.ledger.length, 0);
  demo.setPaused(false); assert.equal(demo.chooseEvent(choice.id), true);
  const result = structuredClone(demo.event.result);
  assert.equal(demo.chooseEvent(choice.id), false); assert.equal(demo.ledger.length, 1);
  assert.equal(demo.players[0].money, result.after);
  const same = await fixture(); same.demo.previewEvent('invest'); same.demo.chooseEvent(choice.id);
  assert.equal(same.demo.event.id, event.id); assert.deepEqual(same.demo.event.result, result);
});

test('mini-game timeout earns zero; choice timeout uses the safe option', async () => {
  const { demo } = await fixture(); demo.previewEvent('minigame');
  assert.equal(demo.event.defaultChoiceId, 'wrong'); demo.update(10);
  assert.equal(demo.event.result.delta, 0); assert.equal(demo.players[0].money, 1000);
  demo.previewEvent('trade'); const expected = demo.event.choices[0]; demo.update(10);
  assert.equal(demo.event.result.choiceId, expected.id); assert.equal(demo.event.result.delta, expected.delta);
});

test('scene changes retain wallets and ledger; restart restores 1000 while event sequences stay unique', async () => {
  const { demo } = await fixture(); demo.previewEvent('gain');
  const money = demo.players[0].money, sequence = demo.event.sequence, count = demo.ledger.length;
  assert.ok(money > 1000);
  await demo.changeMap('BEN_SONG');
  assert.equal(demo.players[0].money, money); assert.equal(demo.ledger.length, count);
  demo.previewEvent('gain'); assert.ok(demo.event.sequence > sequence);
  demo.turn = 11; const nodes = demo.players.map(player => player.node), before = demo.players.map(player => player.money);
  await demo.changeMap('CHO_VIA_HE', { preserveTurn: true });
  assert.equal(demo.turn, 11); assert.deepEqual(demo.players.map(player => player.node), nodes);
  assert.deepEqual(demo.players.map(player => player.money), before);
  const previousSequence = demo.eventSequence; demo.reset();
  assert.ok(demo.players.every(player => player.money === 1000)); assert.equal(demo.ledger.length, 0);
  demo.previewEvent('gain'); assert.ok(demo.event.sequence > previousSequence);
});
