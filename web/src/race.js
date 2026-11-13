// Race progress counts logical edges, never scene distance or the number of
// turns. Every alternate route must have the same step count as its main lane.
function unit(seed) {
  let hash = (Number(seed) >>> 0) ^ 0x9e3779b9;
  hash = Math.imul(hash ^ hash >>> 16, 0x21f0aaad);
  hash = Math.imul(hash ^ hash >>> 15, 0x735a2d97);
  return ((hash ^ hash >>> 15) >>> 0) / 4294967296;
}

export function raceCourse(layout) {
  const nodes = new Map(layout.nodes.map(node => [node.id, node]));
  const first = nodes.has('C00') ? 'C00' : layout.nodes[0]?.id;
  const route = []; let current = first;
  do {
    if (!nodes.has(current) || route.includes(current)) throw new Error('Invalid race main route');
    route.push(current); current = nodes.get(current).next[0];
    if (route.length > nodes.size) throw new Error('Race route cannot close');
  } while (current !== first);
  const lapSteps = route.length;
  const progress = new Map([[first, 0]]), queue = [first];
  for (let at = 0; at < queue.length; at++) {
    const id = queue[at], nextProgress = (progress.get(id) + 1) % lapSteps;
    for (const target of nodes.get(id).next) {
      if (!nodes.has(target)) throw new Error('Race edge has no destination');
      if (progress.has(target)) {
        if (progress.get(target) !== nextProgress) throw new Error('Race branches must have equal step counts');
      } else { progress.set(target, nextProgress); queue.push(target); }
    }
  }
  if (progress.size !== nodes.size) throw new Error('Race board has unreachable nodes');
  const multiplicity = new Map();
  for (const step of progress.values()) multiplicity.set(step, (multiplicity.get(step) || 0) + 1);
  // A finish position must be crossed on every legal route, not on a main-lane
  // tile that an alternate lane could bypass. The highest Z is the bottom view.
  const forced = route.map(id => nodes.get(id)).filter(node => multiplicity.get(progress.get(node.id)) === 1 && node.next.length === 1);
  const bottom = [...forced].sort((a,b) => b.position[2] - a.position[2]).slice(0, 5);
  const candidates = bottom.length ? bottom : [nodes.get(first)];
  const finish = candidates[Math.floor(unit(layout.seed) * candidates.length)];
  const next = nodes.get(finish.next[0]);
  const dx = next.position[0] - finish.position[0], dz = next.position[2] - finish.position[2];
  const length = Math.hypot(dx, dz) || 1;
  return { lapSteps, progress, finishNodeId: finish.id, finishIndex: progress.get(finish.id),
    finishPosition: [...finish.position], finishHeading: [dx / length, 0, dz / length],
    finishCandidates: candidates.map(node => node.id) };
}

export class RaceState {
  constructor(layout, players, lapTarget = 3, finishLimit = 3) {
    if (!Array.isArray(players) || players.length < 1 || players.length > 200) throw new RangeError('Race needs 1–200 racers');
    if (!Number.isInteger(lapTarget) || lapTarget < 1) throw new RangeError('Race lap target must be positive');
    this.course = raceCourse(layout); this.players = players; this.lapTarget = lapTarget; this.finishers = [];
    this.finishLimit = Math.min(players.length, Math.max(1, Math.floor(finishLimit)));
    this.totalSteps = this.course.lapSteps * lapTarget;
    for (const [index, player] of players.entries()) {
      player.raceSteps = 0; player.laps = 0; player.finished = false; player.finishRank = null;
      // Presentation offsets are separate from node coordinates and progress.
      const columns = Math.min(10, Math.max(1, Math.ceil(Math.sqrt(players.length))));
      const rows = Math.ceil(players.length / columns);
      player.spawnOffset = [(index % columns - (columns - 1) / 2) * .32, (Math.floor(index / columns) - (rows - 1) / 2) * .29];
    }
  }

  get over() { return this.finishers.length >= this.finishLimit; }

  recordEdge(player, destination, turn) {
    if (player.finished || this.over) return false;
    const nextSteps = player.raceSteps + 1;
    const expected = (this.course.finishIndex + nextSteps) % this.course.lapSteps;
    if (this.course.progress.get(destination) !== expected) throw new Error('Race progress does not match the traversed edge');
    player.raceSteps = nextSteps;
    player.laps = Math.min(this.lapTarget, Math.floor(nextSteps / this.course.lapSteps));
    if (nextSteps === this.totalSteps) {
      if (destination !== this.course.finishNodeId) throw new Error('Finish must cross the shared finish tile');
      player.finished = true; player.finishRank = this.finishers.length + 1;
      this.finishers.push({ seat: player.seat, index: this.players.indexOf(player), rank: player.finishRank, turn });
      return true;
    }
    return false;
  }

  rankings() {
    return this.players.map((player,index) => ({ index, seat: player.seat, name: player.data.name, money: player.money,
      laps: player.laps, raceSteps: player.raceSteps, lapProgress: player.raceSteps % this.course.lapSteps,
      progress: Math.min(1, player.raceSteps / this.totalSteps), finished: player.finished, finishRank: player.finishRank }))
      .sort((a,b) => (a.finishRank ?? Infinity) - (b.finishRank ?? Infinity) || b.raceSteps - a.raceSteps || b.money - a.money || a.index - b.index)
      .map((row,index) => ({ ...row, rank: index + 1 }));
  }

  moneyStandings() {
    const rows = this.players.map((player,index) => ({ index, seat: player.seat, name: player.data.name,
      money: player.money, laps: player.laps, raceSteps: player.raceSteps, finished: player.finished, finishRank: player.finishRank }))
      .sort((a,b) => b.money - a.money || a.index - b.index);
    let rank = 0;
    return rows.map((row,index) => {
      if (!index || row.money !== rows[index-1].money) rank = index + 1;
      return { ...row, rank };
    });
  }

  snapshot(preview = false) {
    return { lapTarget: this.lapTarget, lapSteps: this.course.lapSteps, totalSteps: this.totalSteps, finishLimit: this.finishLimit,
      finishNodeId: this.course.finishNodeId, finishPosition: [...this.course.finishPosition], finishHeading: [...this.course.finishHeading],
      finishCandidates: [...this.course.finishCandidates], finishers: this.finishers.map(entry => ({ ...entry, money: this.players[entry.index].money })),
      over: this.over, preview, players: this.rankings(), moneyStandings: this.moneyStandings(),
      finalStandings: this.over ? this.finishers.map(entry => ({ ...entry, name: this.players[entry.index].data.name, money: this.players[entry.index].money })) : [] };
  }
}
