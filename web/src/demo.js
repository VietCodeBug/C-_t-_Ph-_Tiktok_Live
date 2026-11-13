import * as THREE from 'three';
import { rollDie, DICE_ROLL_SECONDS, DICE_RESULT_SECONDS } from './dice.js';
import { createTownLayouts, NEIGHBORHOODS } from './layouts.js';
import { EVENT_CARDS, TILE_CATEGORIES, categoryForNode, chooseLandingCard, resolveEventCard, deterministicUnit } from './events.js';
import { RaceState } from './race.js';

export class CameraDemo {
  constructor(world, players, layouts, onChange, { randomRoll = rollDie, interactiveChoices = false, raceMode = false, lapTarget = 3, chooseNextPlayer = null } = {}) {
    this.world = world; this.players = players; this.layouts = layouts; this.onChange = onChange;
    this.mode = 'auto'; this.paused = false; this.speed = 1;
    this.active = 0; this.turn = 1; this.phase = 'overview'; this.phaseTime = 0; this.clock = 0;
    this.remaining = 0; this.segment = null; this.mapId = 'CHO_VIA_HE';
    this.randomRoll = randomRoll; this.rollSequence = 0;
    this.interactiveChoices = interactiveChoices; this.eventSequence = 0;
    this.raceMode = raceMode; this.lapTarget = lapTarget; this.chooseNextPlayer = chooseNextPlayer;
    this.race = null; this.previewOrigin = null;
    this.ledger = []; this.recentEvents = []; this.settledEvents = new Set();
    this.players.forEach(player => { player.money = 1000; });
    this.randomizeRounds = false;
    this.clearRoll();
    players.forEach(p => world.playerGroup.add(p.group));
  }

  async changeMap(id, { preserveTurn = false } = {}) {
    if (this.loading) return;
    if (!this.layouts[id]) throw new Error('Unknown map: ' + id);
    const turn = this.turn;
    const keepPositions = preserveTurn && !this.raceMode;
    const positions = keepPositions ? this.players.map(p => p.node) : null;
    this.loading = true;
    try {
      const layout = this.layouts[id];
      await this.world.loadMap(layout);
      this.mapId = id; this.layout = layout;
      this.nodes = new Map(this.layout.nodes.map(n => [n.id, n]));
      this.reset({ resetEconomy: false });
      if (keepPositions) {
        this.turn = turn;
        this.players.forEach((p, i) => {
          const node = this.nodes.get(positions[i]);
          if (!node) return;
          p.node = node.id; p.position.fromArray(node.position);
          p.heading.fromArray(this.nodes.get(node.next[0]).position).sub(p.position).setY(0).normalize();
        });
        this.world.followHeading.copy(this.players[this.active].heading);
      }
    } finally { this.loading = false; }
    this.emit();
  }

  async regenerate({ nextRound = false } = {}) {
    if (this.loading) return;
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    this.layouts = createTownLayouts(seed);
    const ids = Object.keys(NEIGHBORHOODS);
    const id = nextRound ? ids[(ids.indexOf(this.mapId) + 1 + seed % (ids.length - 1)) % ids.length] : this.mapId;
    await this.changeMap(id, { preserveTurn: nextRound });
  }

  reset({ resetEconomy = true } = {}) {
    this.previewOrigin = null;
    this.active = 0; this.turn = 1; this.phase = 'overview'; this.phaseTime = 0; this.segment = null;
    this.clearRoll();
    if (resetEconomy) {
      this.players.forEach(player => { player.money = 1000; });
      this.ledger = []; this.recentEvents = []; this.settledEvents.clear();
    }
    const route = ['C00']; let current = 'C00';
    while (true) {
      const next = this.nodes.get(current).next[0];
      if (next === 'C00') break;
      route.push(next); current = next;
      if (route.length > this.nodes.size) throw new Error('Invalid map route');
    }
    this.race = this.raceMode ? new RaceState(this.layout, this.players, this.lapTarget) : null;
    this.players.forEach((p, i) => {
      p.node = this.race ? this.race.course.finishNodeId : route[Math.floor(i * route.length / this.players.length)]; p.position.fromArray(this.nodes.get(p.node).position);
      const next = this.nodes.get(this.nodes.get(p.node).next[0]).position;
      p.heading.fromArray(next).sub(p.position).setY(0).normalize();
      p.facing = 'S'; p.distance = 0; p.setClip('idle');
    });
    this.world.followHeading.copy(this.players[0].heading);
    this.emit();
  }

  setMode(mode) { this.mode = mode; this.emit(); }
  setPaused(value) { this.paused = value; this.emit(); }

  clearRoll() {
    this.roll = 0; this.pendingRoll = 0; this.remaining = 0;
    this.stepsCompleted = 0; this.visitedNodes = [];
    this.branch = null; this.event = null; this.eventCard = null; this.lastChoice = null;
  }

  requestRoll() {
    if (this.loading || this.paused || this.phase !== 'overview' || this.race?.over || this.raceMode && this.players[this.active].finished) return false;
    const value = this.randomRoll();
    if (!Number.isInteger(value) || value < 1 || value > 6) throw new Error('Dice result must be 1–6');
    this.clearRoll(); this.pendingRoll = value; this.rollSequence++;
    this.phase = 'roll'; this.phaseTime = 0;
    const player = this.players[this.active];
    this.visitedNodes = [player.node];
    player.setClip('roll_dice'); player.loadClip(this.interactiveChoices ? 'walk' : 'run')?.catch(()=>{});
    this.emit();
    return true;
  }

  diceState() {
    return { phase: this.loading ? 'loading' : this.phase, elapsed: this.phaseTime, value: this.roll,
      sequence: this.rollSequence, seat: this.players[this.active].seat, paused: this.paused };
  }

  select(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.players.length || this.loading) return false;
    if (this.previewOrigin) {
      const origin = this.previewOrigin, actor = this.players[origin.index];
      actor.node = origin.node; actor.position.fromArray(this.nodes.get(origin.node).position);
      actor.heading.fromArray(this.nodes.get(this.nodes.get(origin.node).next[0]).position).sub(actor.position).setY(0).normalize();
      this.previewOrigin = null; this.segment = null;
    }
    const old = this.players[this.active];
    if (this.segment) {
      old.node = this.segment.progress > .5 ? this.segment.to : this.segment.from;
      old.position.fromArray(this.nodes.get(old.node).position);
    }
    old.setClip('idle');
    this.active = index; this.segment = null; this.phase = 'overview';
    this.clearRoll();
    this.phaseTime = this.mode === 'follow' ? 2.6 : 1.5;
    if (this.race?.over) this.phase = 'race-over';
    else if (this.raceMode && this.players[index].finished) this.phase = 'finished';
    this.world.followHeading.copy(this.players[index].heading);
    this.emit();
    return true;
  }

  nextTurn() {
    if (this.loading) return;
    const eligible = this.players.map((player,index) => ({ player,index })).filter(({ player }) => !this.raceMode || !player.finished).map(({ index }) => index);
    if (!eligible.length) {
      this.phase = 'race-over'; this.phaseTime = 0; this.segment = null; this.clearRoll(); this.emit(); return;
    }
    const chosen = this.chooseNextPlayer?.([...eligible], this.active, this);
    const next = Number.isInteger(chosen) && eligible.includes(chosen) ? chosen : eligible.find(index => index > this.active) ?? eligible[0];
    this.turn++; this.select(next);
    if (!this.raceMode && this.active === 0 && this.randomizeRounds) this.regenerate({ nextRound: true }).catch(error => { console.error(error); });
  }

  startSegment(chosenTarget) {
    const player = this.players[this.active];
    const node = this.nodes.get(player.node), next = node.next;
    if (!chosenTarget && next.length > 1 && this.interactiveChoices) {
      const directions = node.choiceOrder || ['left', 'right'];
      this.branch = { nodeId: node.id, default: node.defaultDirection || 'left', voters: new Map(),
        options: next.map((target, index) => {
          const detail = node.choices?.find(choice => choice.target === target) || {};
          const direction = detail.direction || directions[index];
          const destination = this.nodes.get(target);
          return { id: direction, target, label: direction === 'left' ? 'TRÁI' : 'PHẢI',
            preview: Array.isArray(detail.preview) ? detail.preview.join(' → ') : detail.preview || TILE_CATEGORIES[destination.typeIndex ?? 6]?.name || 'Đi tiếp',
            name: detail.name || destination.district || '', risk: detail.risk || '' };
        }).sort((a, b) => a.id === 'left' ? -1 : b.id === 'left' ? 1 : 0) };
      this.phase = 'fork-choice'; this.phaseTime = 0; player.setClip('idle');
      this.world.overviewYaw = 0; this.emit(); return false;
    }
    const to = chosenTarget || (next.length === 1 ? next[0] : next[(this.active + this.turn) % 2]);
    const a = new THREE.Vector3().fromArray(this.nodes.get(player.node).position);
    const b = new THREE.Vector3().fromArray(this.nodes.get(to).position);
    player.heading.copy(b).sub(a).setY(0).normalize();
    this.segment = { from: player.node, to, a, b, length: a.distanceTo(b), progress: 0 };
    return true;
  }

  forkVotes() {
    const votes = { left: 0, right: 0 };
    for (const direction of this.branch?.voters.values() || []) votes[direction]++;
    return votes;
  }

  voteFork(viewerId, direction) {
    if (this.loading || this.paused || this.phase !== 'fork-choice' || !viewerId || !['left', 'right'].includes(direction)) return false;
    this.branch.voters.set(String(viewerId), direction); this.emit(); return true;
  }

  chooseFork(direction, source = 'player') {
    if (this.loading || this.paused || this.phase !== 'fork-choice') return false;
    const option = this.branch.options.find(option => option.id === direction);
    if (!option) return false;
    this.lastChoice = { kind: 'fork', source, direction, text: source === 'votes' ? `Khán giả chọn ${option.label}` : source === 'timeout' ? `Hết giờ · ${option.label} mặc định` : `Đã chọn ${option.label}` };
    this.branch = null; this.phase = 'moving'; this.phaseTime = 0;
    this.players[this.active].setClip('walk'); this.startSegment(option.target); this.emit(); return true;
  }

  landOnTile(previewCardId = null) {
    const player = this.players[this.active];
    if (!this.interactiveChoices) {
      this.phase = 'arrive'; this.phaseTime = 0; player.setClip('happy'); this.emit(); return;
    }
    const node = this.nodes.get(player.node);
    this.eventCard = EVENT_CARDS.find(card => card.id === previewCardId && card.category === categoryForNode(node)) || chooseLandingCard({ node, seed: this.layout.seed, turn: this.turn, seat: player.seat, recentIds: this.recentEvents });
    this.recentEvents.push(this.eventCard.id);
    this.event = { ...this.eventCard, sequence: ++this.eventSequence, nodeId: player.node,
      choices: this.eventCard.choices.map(choice => ({ ...choice, disabled: player.money < (choice.minMoney || 0) })), result: null };
    this.phaseTime = 0;
    if (this.eventCard.choices.length) { this.phase = 'event-choice'; player.setClip('idle'); this.emit(); }
    else this.applyEvent(null);
  }

  applyEvent(choiceId) {
    if (!this.event || this.event.result || this.settledEvents.has(this.event.sequence)) return false;
    const player = this.players[this.active];
    const result = resolveEventCard(this.eventCard, choiceId, player.money,
      deterministicUnit(this.layout.seed, this.turn, player.seat, this.eventCard.id, choiceId, 'outcome'));
    if (!result) return false;
    this.settledEvents.add(this.event.sequence); player.money = result.after;
    this.event.result = result;
    this.ledger.push({ id: `event-${this.event.sequence}`, eventId: this.event.id, nodeId: player.node,
      turn: this.turn, seat: player.seat, delta: result.delta, before: result.before, after: result.after,
      reason: this.event.title, choiceId: result.choiceId });
    this.phase = 'arrive'; this.phaseTime = 0; player.setClip(result.delta > 0 ? 'happy' : 'idle'); this.emit(); return true;
  }

  chooseEvent(choiceId) {
    if (this.loading || this.paused || this.phase !== 'event-choice') return false;
    return this.applyEvent(choiceId);
  }

  previewEvent(category, cardId = null) {
    if (!this.interactiveChoices || this.loading) return false;
    if (cardId && !EVENT_CARDS.some(card => card.id === cardId && card.category === category)) return false;
    const node = this.layout.nodes.find(node => categoryForNode(node) === category);
    if (!node) return false;
    this.select(this.active);
    const player = this.players[this.active];
    if (this.raceMode) this.previewOrigin = { index: this.active, node: player.node };
    player.node = node.id; player.position.fromArray(node.position);
    this.landOnTile(cardId); return true;
  }

  previewFork() {
    if (!this.interactiveChoices || this.loading) return false;
    const node = this.layout.nodes.find(node => node.next.length > 1);
    if (!node) return false;
    this.select(this.active);
    const player = this.players[this.active];
    if (this.raceMode) this.previewOrigin = { index: this.active, node: player.node };
    player.node = node.id; player.position.fromArray(node.position);
    this.phaseTime = 0; return this.requestRoll();
  }

  update(dt) {
    if (this.loading) return;
    const gameDt = this.paused ? 0 : dt * this.speed;
    this.clock += gameDt; this.phaseTime += gameDt;
    const player = this.players[this.active];
    if (!this.paused) {
      if (this.phase === 'overview' && this.phaseTime >= 2.7) {
        this.requestRoll();
      } else if (this.phase === 'roll' && this.phaseTime >= DICE_ROLL_SECONDS) {
        this.roll = this.pendingRoll; this.pendingRoll = 0; this.remaining = this.roll;
        this.phase = 'roll-result'; this.phaseTime = 0;
        player.setClip('idle'); this.emit();
      } else if (this.phase === 'roll-result' && this.phaseTime >= DICE_RESULT_SECONDS) {
        this.phase = 'moving'; this.phaseTime = 0;
        player.setClip(this.interactiveChoices ? 'walk' : 'run');
        this.startSegment(); this.emit();
      } else if (this.phase === 'moving') {
        if (!this.segment && !this.startSegment()) { /* A fork opens without consuming a step. */ }
        else {
        const distance = gameDt * 1.02;
        const step = Math.min(distance, (1 - this.segment.progress) * this.segment.length);
        this.segment.progress += step / this.segment.length;
        player.distance += step;
        player.position.lerpVectors(this.segment.a, this.segment.b, this.segment.progress);
        if (this.segment.progress >= 1 - 1e-7) {
          player.position.copy(this.segment.b);
          player.node = this.segment.to; this.segment = null; this.remaining--; this.stepsCompleted++;
          this.visitedNodes.push(player.node);
          if (this.race && !this.previewOrigin && this.race.recordEdge(player, player.node, this.turn)) {
            this.remaining = 0; this.phase = 'finished'; this.phaseTime = 0; this.branch = null; this.event = null; this.eventCard = null;
            player.setClip('happy'); this.emit();
          } else if (!this.remaining) {
            this.landOnTile();
          }
        }
        }
      } else if (this.phase === 'fork-choice' && this.phaseTime >= 10) {
        const votes = this.forkVotes(), tied = votes.left === votes.right;
        this.chooseFork(tied ? this.branch.default : votes.left > votes.right ? 'left' : 'right', tied ? 'timeout' : 'votes');
      } else if (this.phase === 'event-choice' && this.phaseTime >= (this.event?.timeoutSeconds || 10)) {
        this.chooseEvent(this.event.defaultChoiceId || this.event.choices[0].id);
      } else if (this.phase === 'finished' && this.phaseTime >= 2.4) {
        player.setClip('idle'); this.nextTurn(); this.phaseTime = 0;
      } else if (this.phase === 'arrive' && this.phaseTime >= (this.interactiveChoices ? this.event?.category === 'rest' ? 1.6 : 3.3 : 1.55)) {
        player.setClip('idle');
        // Keep only the active movement/gesture bitmap in addition to each player's idle.
        for (const key of ['run', 'walk', 'roll_dice', 'happy']) player.images.delete(key);
        this.nextTurn(); this.phaseTime = 0;
      }
    }
    this.cameraView = this.world.updateCamera(dt, this.players[this.active], this.mode, this.phase === 'overview' || this.phase === 'fork-choice', this.phase === 'fork-choice' ? this.nodes.get(this.players[this.active].node) : null);
    for (let i = 0; i < this.players.length; i++) {
      this.players[i].update(gameDt, this.world.camera, i === this.active && this.phase === 'moving', i === this.active, this.clock);
    }
    this.emitTime = (this.emitTime || 0) + dt;
    if (this.emitTime > .2) { this.emitTime = 0; this.emit(); }
  }

  snapshot() {
    const p = this.players[this.active];
    return { map: this.mapId, active: this.active, seat: p.seat, name: p.data.name, mode: this.mode,
      cameraView: this.cameraView || 'overview', phase: this.phase, paused: this.paused, speed: this.speed,
      turn: this.turn, roll: this.roll || 0, remaining: this.remaining, node: p.node,
      seed: this.layout?.seed, mapName: this.layout?.name, story: this.layout?.story,
      nodeCount: this.layout?.nodes.length, randomizeRounds: this.randomizeRounds, loading: !!this.loading,
      interactiveChoices: this.interactiveChoices, money: p.money,
      race: this.race?.snapshot(!!this.previewOrigin) || null,
      branch: this.branch ? { nodeId: this.branch.nodeId, options: this.branch.options, default: this.branch.default,
        remainingSeconds: Math.max(0, 10 - this.phaseTime), votes: this.forkVotes() } : null,
      event: this.event ? { ...this.event, remainingSeconds: this.phase === 'event-choice' ? Math.max(0, (this.event.timeoutSeconds || 10) - this.phaseTime) : 0 } : null,
      lastChoice: this.lastChoice, ledger: this.ledger.slice(-100),
      stepsCompleted: this.stepsCompleted, visitedNodes: [...this.visitedNodes], dice: this.diceState(),
      destination: this.segment?.to || p.node, tile: this.world.types?.[p.node]?.name || 'ĐANG VÀO PHỐ',
      players: this.players.map(x => ({ seat: x.seat, name: x.data.name, money: x.money, node: x.node, position: x.position.toArray(), heading: x.heading.toArray(), clip: x.clip, frame: x.frame, facing: x.facing,
        laps: x.laps || 0, raceSteps: x.raceSteps || 0, finished: !!x.finished, finishRank: x.finishRank ?? null, spawnOffset: x.spawnOffset ? [...x.spawnOffset] : [0,0] })),
      camera: { position: this.world.camera.position.toArray(), target: this.world.lookAt.toArray(),
        distanceToPlayer: this.world.camera.position.distanceTo(p.position) },
      spriteVersion: '2.3', runtime: { calls: this.world.renderer.info.render.calls, triangles: this.world.renderer.info.render.triangles } };
  }

  emit() { this.onChange?.(this.snapshot()); }
}
