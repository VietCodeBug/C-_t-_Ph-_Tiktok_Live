import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { NEIGHBORHOODS, FORK_STARTS, createTownLayout, createTownLayouts } from '../src/layouts.js';
import { CameraDemo } from '../src/demo.js';
import { DICE_ROLL_SECONDS, DICE_RESULT_SECONDS } from '../src/dice.js';

function reachable(start, edges) {
  const seen = new Set(), queue = [start];
  for (let i = 0; i < queue.length; i++) {
    if (seen.has(queue[i])) continue;
    seen.add(queue[i]);
    queue.push(...edges.get(queue[i]));
  }
  return seen;
}

function lap(nodes, choices) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const path = ['C00'];
  for (let i = 0; i <= nodes.length; i++) {
    const node = byId.get(path.at(-1));
    path.push(node.next[node.next.length === 1 ? 0 : choices[node.id]]);
    if (path.at(-1) === 'C00') return path;
  }
  assert.fail('every route must return to its start without getting trapped');
}

for (const id of Object.keys(NEIGHBORHOODS)) {
  test(`${id}: 100 seeds preserve a winding 138-node board and all 64 fair routes`, () => {
    for (let seed = 0; seed < 100; seed++) {
      const layout = createTownLayout(id, seed);
      const byId = new Map(layout.nodes.map(n => [n.id, n]));
      assert.equal(layout.nodes.length, 138, `seed ${seed}`);
      assert.equal(byId.size, 138, 'node IDs must be unique');
      assert.equal(layout.nodes.filter(n => n.station).length, 2);
      assert.equal(layout.nodes.filter(n => n.fork).length, 6);
      assert.equal(layout.nodes.filter(n=>n.typeIndex===6).length,87,'63% of all physical nodes are genuinely quiet');
      assert.equal(new Set(layout.nodes.map(n=>n.typeIndex)).size,8,'all event categories remain available');
      const edges = new Map(), reverse = new Map(layout.nodes.map(n => [n.id, []]));
      for (const node of layout.nodes) {
        assert.equal(node.position.length, 3);
        assert.ok(node.position.every(Number.isFinite));
        assert.equal(node.position[1], 0);
        assert.ok(Math.abs(Math.hypot(...node.heading)-1)<1e-10,'road tangent is normalized');
        assert.ok(Math.abs(Math.sin(node.yaw)-node.heading[0])<1e-10&&Math.abs(Math.cos(node.yaw)-node.heading[2])<1e-10,'tile yaw follows its street tangent');
        assert.equal(node.next.length, node.fork ? 2 : 1);
        assert.ok(Number.isInteger(node.typeIndex) && node.typeIndex >= 0 && node.typeIndex <= 7);
        assert.equal(node.typeIndex === 0, node.station);
        assert.ok(node.position[0] >= layout.bounds.minX && node.position[0] <= layout.bounds.maxX);
        assert.ok(node.position[2] >= layout.bounds.minZ && node.position[2] <= layout.bounds.maxZ);
        edges.set(node.id, node.next);
        for (const next of node.next) {
          assert.ok(byId.has(next), `edge ${node.id} → ${next} must exist`);
          reverse.get(next).push(node.id);
          const length = Math.hypot(...node.position.map((n, i) => n - byId.get(next).position[i]));
          assert.ok(length > .01 && length < 4.7, `seed ${seed}: ${node.id} → ${next} length ${length}`);
        }
      }
      assert.equal(reachable('C00', edges).size, 138, 'all nodes must be reachable from spawn');
      assert.equal(reachable('C00', reverse).size, 138, 'all nodes must have a route back to spawn');
      assert.ok(layout.bounds.maxZ-layout.bounds.minZ>78,'a town should have a substantial far end');
      assert.ok(layout.nodes.some(n=>n.typeIndex===6),'some stops must be quiet spaces');
      const covered = new Set();
      for (let mask=0;mask<64;mask++) {
        const choices=Object.fromEntries(FORK_STARTS.map((n,i)=>[`C${String(n).padStart(2,'0')}`,(mask>>i)&1]));
        const path = lap(layout.nodes, choices);
        assert.equal(path.length - 1, 96, 'no fork may shorten or lengthen the lap');
        assert.equal(path.indexOf('C48'), 48, 'stations must stay 48 steps apart on each route');
        assert.equal(path.length - 1 - path.indexOf('C48'), 48);
        assert.equal(new Set(path.slice(0, -1)).size, 96, 'a route cannot repeat a tile before the finish');
        const stops=path.slice(0,-1).map(id=>byId.get(id));
        assert.equal(stops.filter(node=>node.typeIndex===6).length,60,'every branch combination has62.5% quiet stops');
        assert.ok(stops.every((node,index)=>[node,stops[(index+1)%96],stops[(index+2)%96]].some(stop=>stop.typeIndex===6)),'every three consecutive stops contain a genuine quiet tile');
        path.forEach(n => covered.add(n));
      }
      assert.equal(covered.size, 138, 'all generated branch tiles must occur on a playable route');
      const segments=layout.nodes.flatMap(n=>n.next.map(id=>[n,byId.get(id)]));
      const side=(a,b,c)=>(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
      for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
        const[a,b]=segments[i],[c,d]=segments[j];
        if(new Set([a.id,b.id,c.id,d.id]).size<4)continue;
        const crossed=side(a.position,b.position,c.position)*side(a.position,b.position,d.position)<-1e-8&&side(c.position,d.position,a.position)*side(c.position,d.position,b.position)<-1e-8;
        assert.equal(crossed,false,`seed ${seed}: roads ${a.id}→${b.id} and ${c.id}→${d.id} cross without a junction`);
      }
      for(const node of layout.nodes.filter(n=>n.fork)){
        assert.deepEqual([...node.choiceOrder].sort(),['left','right']);
        assert.equal(node.choices.length,2);
        assert.ok(node.choices.every(c=>c.name&&c.district&&c.preview.length===3));
      }
    }
  });
}

test('a seed replays the same geometry and events, while another seed changes both', () => {
  for (const id of Object.keys(NEIGHBORHOODS)) {
    const a = createTownLayout(id, 47), same = createTownLayout(id, 47), b = createTownLayout(id, 48);
    assert.deepEqual(a, same);
    assert.notDeepEqual(a.nodes.map(n => n.position), b.nodes.map(n => n.position));
    assert.notDeepEqual(a.nodes.map(n => n.typeIndex), b.nodes.map(n => n.typeIndex));
  }
  assert.equal(Object.keys(createTownLayouts(12)).length, 3);
  assert.throws(() => createTownLayout('UNKNOWN', 0), /Unknown neighborhood/);
});

function fixture(layouts) {
  const loaded = [];
  const world = {
    playerGroup: new THREE.Group(), followHeading: new THREE.Vector3(),
    camera: new THREE.PerspectiveCamera(), lookAt: new THREE.Vector3(),
    renderer: { info: { render: { calls: 0, triangles: 0 } } },
    async loadMap(layout) { loaded.push(layout.id); }, updateCamera() { return 'overview'; }
  };
  const players = Array.from({ length: 10 }, (_, i) => ({
    group: new THREE.Group(), position: new THREE.Vector3(), heading: new THREE.Vector3(),
    seat: String.fromCharCode(65 + i), data: { name: `Player ${i}` }, images: new Map(),
    setClip(name) { this.clip = name; }, loadClip() {}, update() {}
  }));
  return { demo: new CameraDemo(world, players, layouts, null, { randomRoll: () => 6 }), world, players, loaded };
}

test('map changes and reset distribute all ten seats on distinct valid tiles and clear pending turns', async () => {
  for (const seed of [0, 42, 99]) {
    const { demo, players, world, loaded } = fixture(createTownLayouts(seed));
    for (const id of Object.keys(NEIGHBORHOODS)) {
      await demo.changeMap(id);
      const initial = players.map(p => p.node);
      assert.equal(new Set(initial).size, 10);
      for (const player of players) {
        assert.deepEqual(player.position.toArray(), demo.nodes.get(player.node).position);
        assert.ok(Math.abs(player.heading.length() - 1) < 1e-10);
        assert.equal(player.clip, 'idle');
      }
      assert.deepEqual(world.followHeading.toArray(), players[0].heading.toArray());
      demo.requestRoll();
      demo.update(DICE_ROLL_SECONDS);
      assert.equal(demo.roll, 6);
      demo.reset();
      assert.equal(demo.phase, 'overview');
      assert.equal(demo.roll, 0);
      assert.equal(demo.pendingRoll, 0);
      assert.equal(demo.remaining, 0);
      assert.deepEqual(demo.visitedNodes, []);
      assert.deepEqual(players.map(p => p.node), initial);
    }
    assert.deepEqual(loaded, Object.keys(NEIGHBORHOODS));
  }
});

test('a generated fork traverses exactly six edges for either choice', async () => {
  const { demo, players } = fixture(createTownLayouts(2026));
  for (const id of Object.keys(NEIGHBORHOODS)) {
    await demo.changeMap(id);
    for (const fork of FORK_STARTS.map(n=>`C${String(n).padStart(2,'0')}`)) for (const choice of [0, 1]) {
      demo.reset();
      const player = players[0];
      player.node = fork;
      player.position.fromArray(demo.nodes.get(fork).position);
      demo.turn = choice;
      demo.requestRoll(); demo.update(DICE_ROLL_SECONDS); demo.update(DICE_RESULT_SECONDS);
      for (let i = 0; demo.phase === 'moving' && i < 1000; i++) demo.update(.2);
      assert.equal(demo.phase, 'arrive');
      assert.equal(demo.stepsCompleted, 6);
      assert.equal(demo.visitedNodes.length, 7);
      assert.equal(demo.visitedNodes[1], demo.nodes.get(fork).next[choice]);
      assert.deepEqual(player.position.toArray(), demo.nodes.get(player.node).position);
    }
  }
});

test('automatic regeneration waits for the tenth arrival and preserves turn 11 across asynchronous loading', async () => {
  const { demo, world, loaded } = fixture(createTownLayouts(733));
  await demo.changeMap('CHO_VIA_HE');
  const oldLayout = demo.layout;
  let releaseLoad, requestedLayout;
  world.loadMap = async layout => {
    requestedLayout = layout;
    await new Promise(resolve => { releaseLoad = resolve; });
  };
  demo.randomizeRounds = true;
  demo.select(9); demo.turn = 10;
  assert.equal(demo.requestRoll(), true);
  demo.update(DICE_ROLL_SECONDS); demo.update(DICE_RESULT_SECONDS);
  for (let i = 0; demo.phase === 'moving' && i < 1000; i++) {
    demo.update(.2);
    assert.equal(demo.layout, oldLayout, 'the visible layout must stay fixed during the last player movement');
    assert.equal(requestedLayout, undefined, 'regeneration must not begin before arrival');
  }
  assert.equal(demo.phase, 'arrive');
  const completedNodes = demo.players.map(p => p.node);
  assert.equal(loaded.length, 1);
  demo.update(1.56);
  assert.equal(demo.turn, 11);
  assert.equal(demo.active, 0);
  assert.equal(demo.loading, true);
  assert.equal(demo.layout, oldLayout, 'keep the previous board until the new scene is ready');
  assert.notEqual(requestedLayout.id, oldLayout.id, 'a new round should move to another neighborhood');
  const phaseTime = demo.phaseTime;
  demo.update(100);
  assert.equal(demo.phaseTime, phaseTime, 'loading cannot consume the next player turn');
  releaseLoad();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(demo.loading, false);
  assert.equal(demo.layout, requestedLayout);
  assert.equal(demo.turn, 11);
  assert.equal(demo.active, 0);
  assert.equal(demo.phase, 'overview');
  assert.equal(demo.roll, 0);
  assert.equal(demo.pendingRoll, 0);
  assert.equal(new Set(demo.players.map(p => p.node)).size, 10);
  assert.deepEqual(demo.players.map(p => p.node), completedNodes, 'round regeneration preserves each player logical tile');
  for (const player of demo.players) assert.deepEqual(player.position.toArray(), demo.nodes.get(player.node).position);
});
