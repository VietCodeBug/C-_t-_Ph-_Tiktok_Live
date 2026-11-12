import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { CameraDemo } from '../src/demo.js';
import { rollDie, dieFaceSVG, DICE_ROLL_SECONDS, DICE_RESULT_SECONDS } from '../src/dice.js';

const { layouts } = JSON.parse(await readFile(new URL('../../assets/map/board_layouts.json', import.meta.url)));

async function fixture(mapId, result) {
  let calls = 0;
  const world = {
    playerGroup: new THREE.Group(), followHeading: new THREE.Vector3(),
    camera: new THREE.PerspectiveCamera(), lookAt: new THREE.Vector3(),
    renderer: { info: { render: { calls: 0, triangles: 0 } } },
    async loadMap() {}, updateCamera() { return 'overview'; }
  };
  const players = Array.from({ length: 10 }, (_, i) => ({
    group: new THREE.Group(), position: new THREE.Vector3(), heading: new THREE.Vector3(),
    seat: String.fromCharCode(65 + i), data: { name: `Player ${i}` }, images: new Map(),
    setClip(name) { this.clip = name; }, loadClip() {}, update() {}
  }));
  const demo = new CameraDemo(world, players, layouts, null, { randomRoll: () => { calls++; return result; } });
  await demo.changeMap(mapId);
  return { demo, player: players[0], calls: () => calls };
}

test('die supports all six faces and rejects the biased uint32 tail', () => {
  for (let n = 0; n < 6; n++) assert.equal(rollDie(values => { values[0] = n; }), n + 1);
  let fills = 0;
  assert.equal(rollDie(values => { values[0] = fills++ === 0 ? 0xffffffff : 5; }), 6);
  assert.equal(fills, 2);
  for (let n = 1; n <= 6; n++) assert.equal((dieFaceSVG(n).match(/<circle/g) || []).length, n);
});

for (const mapId of Object.keys(layouts)) {
  for (let result = 1; result <= 6; result++) {
    test(`${mapId}: roll ${result} moves exactly ${result} edges, including both fork routes`, async () => {
      for (const start of ['C00', 'C02', 'C10']) {
        for (const turn of [1, 2]) {
          const { demo, player, calls } = await fixture(mapId, result);
          player.node = start; player.position.fromArray(demo.nodes.get(start).position);
          demo.turn = turn;
          const origin = player.position.toArray();
          assert.equal(demo.requestRoll(), true);
          assert.equal(demo.requestRoll(), false);
          assert.equal(calls(), 1, 'busy clicks cannot reroll');
          demo.update(DICE_ROLL_SECONDS / 2);
          assert.equal(demo.phase, 'roll');
          assert.equal(demo.snapshot().roll, 0, 'result stays hidden while spinning');
          assert.deepEqual(player.position.toArray(), origin);
          const spinTime = demo.phaseTime;
          demo.setPaused(true); demo.update(3);
          assert.equal(demo.phaseTime, spinTime, 'pause freezes the dice clock');
          assert.equal(demo.requestRoll(), false);
          demo.setPaused(false); demo.update(DICE_ROLL_SECONDS / 2);
          assert.equal(demo.phase, 'roll-result');
          assert.equal(demo.diceState().value, result);
          assert.equal(demo.remaining, result);
          demo.update(DICE_RESULT_SECONDS - .01);
          assert.equal(demo.phase, 'roll-result');
          assert.deepEqual(player.position.toArray(), origin, 'reveal precedes any movement');
          demo.update(.02);
          assert.equal(demo.phase, 'moving');
          for (let i = 0; demo.phase === 'moving' && i < 10000; i++) demo.update(.08);
          assert.equal(demo.phase, 'arrive');
          assert.equal(demo.remaining, 0);
          assert.equal(demo.stepsCompleted, result);
          const expected = [start];
          for (let i = 0; i < result; i++) {
            const next = demo.nodes.get(expected.at(-1)).next;
            expected.push(next.length === 1 ? next[0] : next[turn % 2]);
          }
          assert.deepEqual(demo.visitedNodes, expected);
          assert.equal(player.node, expected.at(-1));
          assert.deepEqual(player.position.toArray(), demo.nodes.get(player.node).position);
          assert.equal(calls(), 1);
          demo.update(1.56);
          assert.equal(demo.active, 1, 'next seat starts only after arrival');
          assert.equal(demo.roll, 0, 'next seat cannot inherit a die result');
        }
      }
    });
  }
}

test('seat changes, map changes, and reset cancel a pending die result', async () => {
  const { demo } = await fixture('CHO_VIA_HE', 6);
  demo.requestRoll(); demo.select(4);
  assert.equal(demo.phase, 'overview'); assert.equal(demo.roll, 0); assert.equal(demo.pendingRoll, 0);
  demo.requestRoll(); demo.reset();
  assert.equal(demo.phase, 'overview'); assert.equal(demo.roll, 0); assert.equal(demo.pendingRoll, 0);
  demo.requestRoll(); await demo.changeMap('PHO_GIAO_HANG');
  assert.equal(demo.phase, 'overview'); assert.equal(demo.roll, 0); assert.deepEqual(demo.visitedNodes, []);
});

test('invalid dice cannot start movement', async () => {
  for (const value of [0, 7, 1.5, NaN]) {
    const { demo } = await fixture('CHO_VIA_HE', value);
    assert.throws(() => demo.requestRoll(), /1–6/);
    assert.equal(demo.phase, 'overview');
    assert.equal(demo.segment, null);
  }
});
