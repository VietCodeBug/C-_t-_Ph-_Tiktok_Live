import * as THREE from 'three';
import { CameraDemo } from './demo.js';
import { RaceState } from './race.js';
import { rollDie } from './dice.js';
import { createTownLayouts, NEIGHBORHOODS } from './layouts.js';

// One small rules controller per racer, one shared Three.js world. Their world
// adapters never render, move the real camera or redraw a sprite. This keeps
// the active racers moving independently while the broadcast follows one person.
export class ParallelRace {
  constructor(world, players, layouts, onChange, options = {}) {
    this.world = world; this.players = players; this.layouts = layouts; this.onChange = onChange;
    this.mode = 'auto'; this.paused = false; this.speed = 1; this.globalHold = false;
    this.active = 0; this.turn = 0; this.clock = 0; this.loading = false;
    this.mapId = 'CHO_VIA_HE'; this.randomizeRounds = false; this.raceMode = true;
    this.randomRoll = options.randomRoll || rollDie;
    this.interactiveChoices = options.interactiveChoices !== false;
    this.lapTarget = options.lapTarget || 3;
    this.chooseNextPlayer = options.chooseNextPlayer || null;
    this.onCollectiveLanding = options.onCollectiveLanding || null;
    this.dispatchInterval = Math.max(.001, options.dispatchInterval ?? .06);
    this.backgroundDecisionSeconds = Math.max(.1, options.backgroundDecisionSeconds ?? 3);
    this.autoRollSeconds = Math.max(0, options.autoRollSeconds ?? 0);
    this.heldSeats = new Set();
    this.runners = []; this.ledger = []; this.previewOrigins = new Map(); this.manualQueue = new Set();
    this.eventSequence = 0; this.rollSequence = 0; this.dispatchClock = 0; this.lastDispatched = -1;
    this.nodes = new Map(); this.emitTime = 0;
    this.loadVersion=0;this.sceneLoad=Promise.resolve();
    players.forEach(player => world.playerGroup.add(player.group));
  }

  // Incoming actors are already initialized by the caller. This method detaches
  // the previous roster but leaves disposal to the owner of its sprite caches.
  // Call changeMap/regenerate immediately afterwards to create the new race.
  setPlayers(players,{reset=false}={}) {
    if (!Array.isArray(players)||players.length<2||players.length>200) throw new RangeError('Active roster needs 2–200 racers');
    const ids=players.map(player=>String(player?.accountId??player?.id??player?.seat??'').trim());
    if (ids.some(id=>!id)||new Set(ids).size!==players.length) throw new Error('Active racers need unique account IDs');
    if (players.some(player=>!player.group?.isObject3D||!player.position?.isVector3||!player.heading?.isVector3)) throw new TypeError('Active racers need initialized sprite actors');
    if (new Set(players.map(player=>player.group)).size!==players.length) throw new Error('Active racers cannot share a scene group');
    if (this.globalHold) throw new Error('Settle the collective event before changing racers');
    if (!reset&&!this.loading&&this.race&&!this.race.over) throw new Error('Finish or explicitly reset the race before changing racers');
    const previous=this.players;
    this.loadVersion++;this.loading=false;
    for (const player of previous) this.world.playerGroup.remove(player.group);
    this.players=[...players];
    for (const player of this.players) this.world.playerGroup.add(player.group);
    this.runners=[];this.race=null;this.layout=null;this.nodes=new Map();
    this.active=0;this.turn=0;this.clock=0;this.dispatchClock=0;this.lastDispatched=-1;
    this.advanceFocus=false;this.pendingCollective=null;this.inSimulation=false;this.dispatching=null;
    this.previewOrigins.clear();this.manualQueue.clear();this.ledger=[];
    return previous;
  }

  makeRunner(player, index) {
    const actor = new Proxy(player, { get(target, key, receiver) {
      if (key === 'update') return () => {};
      return Reflect.get(target, key, receiver);
    } });
    const world = { playerGroup: { add() {} }, followHeading: new THREE.Vector3(), camera: this.world.camera,
      lookAt: this.world.lookAt, renderer: this.world.renderer, async loadMap() {},
      updateCamera: () => this.cameraView || 'overview' };
    const runner = new CameraDemo(world, [actor], this.layouts, null,
      { randomRoll: this.randomRoll, interactiveChoices: this.interactiveChoices });
    const originalRoll = runner.requestRoll.bind(runner);
    runner.requestRoll = () => this.dispatching === index ? originalRoll() : false;
    const originalLanding = runner.landOnTile.bind(runner);
    runner.landOnTile = cardId => {
      if (!this.previewOrigins.has(index) && this.race && player.raceSteps + 1 === this.race.totalSteps && player.node === this.race.course.finishNodeId) {
        runner.phase = 'finished'; runner.phaseTime = 0; return;
      }
      runner.eventSequence = this.eventSequence;
      originalLanding(cardId);
      this.eventSequence = Math.max(this.eventSequence, runner.eventSequence);
      if (runner.event && runner.phase === 'event-choice' && index === this.active && this.onCollectiveLanding) {
        const pending={index,runner,event:runner.event,node:this.nodes.get(player.node)};
        if (this.inSimulation) this.pendingCollective=pending;
        else this.beginCollective(pending);
      }
    };
    const originalNext = runner.nextTurn.bind(runner);
    runner.nextTurn = () => {
      this.restorePreview(index);
      if (player.finished) { runner.phase = this.race?.over ? 'race-over' : 'finished'; return; }
      originalNext();
      if (index === this.active) this.advanceFocus = true;
    };
    runner._ledgerCursor = 0;
    return runner;
  }

  // LIVE membership changes preserve every remaining actor's current segment,
  // event, wallet and completed edges. Rebind index-capturing adapters only.
  async updatePlayers(players, { finishLimit = null } = {}) {
    if (this.loading || this.globalHold) throw new Error('Wait for the current scene or collective event');
    if (!Array.isArray(players) || players.length > 200) throw new RangeError('Active roster needs 0–200 racers');
    const ids=players.map(player=>String(player?.accountId??player?.id??player?.seat??'').trim());
    if (ids.some(id=>!id)||new Set(ids).size!==ids.length) throw new Error('Active racers need unique account IDs');
    if (players.some(player=>!player.group?.isObject3D||!player.position?.isVector3||!player.heading?.isVector3)) throw new TypeError('Active racers need initialized sprite actors');
    const oldPlayers=this.players,oldRunners=this.runners,oldFocus=oldPlayers[this.active]?.seat;
    const queued=new Set([...this.manualQueue].map(index=>oldPlayers[index]?.seat));
    const retained=new Map(oldPlayers.map((player,index)=>[player,oldRunners[index]]));
    for(const [index] of this.previewOrigins)this.restorePreview(index);
    for(const player of oldPlayers)if(!players.includes(player))this.world.playerGroup.remove(player.group);
    this.players=[...players];
    this.runners=[];
    for(const [index,player] of this.players.entries()) {
      const money=player.money??1000,old=retained.get(player),runner=this.makeRunner(player,index);
      if(old) {
        for(const key of Object.keys(old))if(typeof old[key]!=='function'&&!['players','world','onChange'].includes(key))runner[key]=old[key];
      } else {
        await runner.changeMap(this.mapId);
        const node=this.nodes.get(this.race.course.finishNodeId);
        player.node=node.id;player.position.fromArray(node.position);
        player.heading.fromArray(this.nodes.get(node.next[0]).position).sub(player.position).setY(0).normalize();
        player.raceSteps=0;player.laps=0;player.finished=false;player.finishRank=null;player.spawnOffset=[0,0];
      }
      player.money=money;this.world.playerGroup.add(player.group);this.runners.push(runner);
    }
    this.race.players=this.players;
    for(const entry of this.race.finishers) {
      const old=oldPlayers[entry.index];
      entry.name??=old?.data.name;entry.money??=old?.money;
      entry.index=this.players.findIndex(player=>player.seat===entry.seat);
    }
    if(Number.isInteger(finishLimit)&&finishLimit>0)this.race.finishLimit=Math.min(3,finishLimit);
    this.active=Math.max(0,this.players.findIndex(player=>player.seat===oldFocus));
    this.manualQueue=new Set(this.players.flatMap((player,index)=>queued.has(player.seat)?[index]:[]));
    this.lastDispatched=-1;this.previewOrigins.clear();this.pendingCollective=null;this.advanceFocus=false;
    this.emit();return oldPlayers;
  }

  holdPlayer(seat, value = true) {
    if(value)this.heldSeats.add(seat);else this.heldSeats.delete(seat);
  }

  async changeMap(id) {
    if (this.loading) return false;
    const layout = this.layouts[id];
    if (!layout) throw new Error('Unknown map: ' + id);
    const version=++this.loadVersion;
    this.loading = true;
    const balances = this.players.map(player => player.money ?? 1000);
    try {
      // Serialize scene loads so a canceled old roster cannot restore its map
      // after a replacement roster has requested the next scene.
      this.sceneLoad=this.sceneLoad.catch(()=>{}).then(()=>version===this.loadVersion?this.world.loadMap(layout):undefined);
      await this.sceneLoad;
      if (version!==this.loadVersion) return false;
      this.mapId = id; this.layout = layout; this.nodes = new Map(layout.nodes.map(node => [node.id, node]));
      this.runners = this.players.map((player,index) => this.makeRunner(player,index));
      await Promise.all(this.runners.map(runner => runner.changeMap(id)));
      if (version!==this.loadVersion) return false;
      this.players.forEach((player,index) => { player.money = balances[index]; });
      this.reset({ resetEconomy: false });
    } catch(error) {
      if (version!==this.loadVersion) return false;
      throw error;
    } finally { if(version===this.loadVersion)this.loading=false; }
    this.emit(); return true;
  }

  reset({ resetEconomy = true } = {}) {
    if (!this.layout) return;
    this.active = 0; this.turn = 0; this.clock = 0; this.dispatchClock = 0; this.lastDispatched = -1;
    this.globalHold = false; this.advanceFocus = false; this.pendingCollective=null; this.previewOrigins.clear(); this.manualQueue.clear();
    this.ledger = []; this.race = new RaceState(this.layout, this.players, this.lapTarget);
    this.runners.forEach((runner,index) => {
      runner.reset({ resetEconomy }); runner._ledgerCursor = 0;
      const player = this.players[index], node = this.nodes.get(this.race.course.finishNodeId);
      player.node = node.id; player.position.fromArray(node.position);
      player.heading.fromArray(this.nodes.get(node.next[0]).position).sub(player.position).setY(0).normalize();
      player.setClip('idle');
    });
    this.world.followHeading.copy(this.players[0].heading);
    this.emit();
  }

  async regenerate({ nextRound = false } = {}) {
    if (this.loading) return false;
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    this.layouts = createTownLayouts(seed);
    const ids = Object.keys(NEIGHBORHOODS);
    const id = nextRound ? ids[(ids.indexOf(this.mapId) + 1 + seed % (ids.length - 1)) % ids.length] : this.mapId;
    return this.changeMap(id);
  }

  setMode(mode) { this.mode = mode; this.emit(); }
  setPaused(value) { this.paused = !!value; this.emit(); }
  setHold(value) { this.globalHold = !!value; }
  beginCollective({index,runner,event,node}) {
    if (!this.race.over && this.onCollectiveLanding?.(index,event,node)) {
      runner.phase='community';runner.phaseTime=0;this.active=index;this.setHold(true);
    }
  }
  get phase() { return this.race?.over ? 'race-over' : this.runners[this.active]?.phase || 'overview'; }
  get remaining() { return this.runners[this.active]?.remaining || 0; }
  get roll() { return this.runners[this.active]?.roll || 0; }
  get phaseTime() { return this.runners[this.active]?.phaseTime || 0; }

  select(index) {
    if (this.loading || this.globalHold || !Number.isInteger(index) || index < 0 || index >= this.players.length) return false;
    this.active = index; this.world.followHeading.copy(this.players[index].heading); this.emit(); return true;
  }

  nextTurn() {
    if (this.loading || this.globalHold || this.race?.over) return false;
    const eligible = this.players.map((player,index) => ({player,index})).filter(({player})=>!player.finished).map(({index})=>index);
    const next = eligible.find(index=>index>this.active) ?? eligible[0] ?? this.active;
    return this.select(next);
  }

  requestRoll() {
    return this.requestRollFor(this.active);
  }

  requestRollFor(index) {
    if (!Number.isInteger(index) || index<0 || index>=this.players.length) return false;
    const runner = this.runners[index];
    if (this.loading || this.paused || this.globalHold || this.race?.over || !runner || runner.phase !== 'overview' || this.players[index].finished || this.manualQueue.has(index)) return false;
    this.manualQueue.add(index); this.emit(); return true;
  }

  dispatch() {
    const eligible = this.runners.map((runner,index)=>({runner,index})).filter(({runner,index})=>runner.phase==='overview'&&!this.players[index].finished&&!this.heldSeats.has(this.players[index].seat)&&(this.manualQueue.has(index)||runner.phaseTime>=this.autoRollSeconds)).map(({index})=>index);
    if (!eligible.length) return false;
    const chosen = this.chooseNextPlayer?.([...eligible], this.lastDispatched, this);
    const manual = [...this.manualQueue].find(index=>eligible.includes(index));
    const index = Number.isInteger(chosen) && eligible.includes(chosen) ? chosen : manual ?? eligible.find(index=>index>this.lastDispatched) ?? eligible[0];
    const runner = this.runners[index]; this.dispatching = index;
    let accepted;
    try { accepted = runner.requestRoll(); } finally { this.dispatching = null; }
    if (!accepted) return false;
    runner.rollSequence = ++this.rollSequence; runner.turn = ++this.turn;
    this.manualQueue.delete(index); this.lastDispatched = index; return true;
  }

  chooseFork(direction) { return this.chooseForkFor(this.active,direction); }
  chooseForkFor(index,direction) {
    if (this.loading || this.paused || this.globalHold || this.race?.over) return false;
    return this.runners[index]?.chooseFork(direction) || false;
  }
  voteFork(viewer,direction) {
    if (this.loading || this.paused || this.globalHold || this.race?.over) return false;
    return this.runners[this.active]?.voteFork(viewer,direction) || false;
  }
  chooseEvent(id) { return this.chooseEventFor(this.active,id); }
  chooseEventFor(index,id) {
    if (this.loading || this.paused || this.globalHold || this.race?.over) return false;
    return this.runners[index]?.chooseEvent(id) || false;
  }

  completeCollective(index = this.active, result = {}) {
    const runner = this.runners[index], player = this.players[index];
    if (!runner?.event || runner.event.result || !['community','event-choice'].includes(runner.phase) || !this.globalHold) return false;
    const before = Number.isInteger(result.before) ? result.before : player.money;
    const after = Number.isInteger(result.after) ? result.after : player.money;
    const delta = Number.isInteger(result.delta) ? result.delta : after - before;
    player.money = after;
    runner.event.result = { before, after, delta, reasonText: 'Chốt sự kiện chung',
      sfx: delta > 0 ? 'sfx_coin_up' : delta < 0 ? 'sfx_coin_down' : 'sfx_question',
      vfx: delta > 0 ? 'coin_burst' : delta < 0 ? 'coin_loss' : 'rest', ...result };
    runner.settledEvents.add(runner.event.sequence);
    runner.ledger.push({id:`event-${runner.event.sequence}`,eventId:runner.event.id,nodeId:player.node,turn:runner.turn,
      seat:player.seat,before,after,delta,reason:runner.event.title,collective:true});
    runner.phase = 'arrive'; runner.phaseTime = 0; player.setClip(delta > 0 ? 'happy' : 'idle');
    this.globalHold = false; this.collectLedger(runner); this.emit(); return true;
  }

  collectLedger(runner) {
    const added = runner.ledger.slice(runner._ledgerCursor);
    this.ledger.push(...added); runner._ledgerCursor = runner.ledger.length;
    if (this.ledger.length > 1000) this.ledger.splice(0,this.ledger.length-1000);
  }

  restorePreview(index) {
    const origin = this.previewOrigins.get(index);
    if (!origin) return;
    const player = this.players[index], runner = this.runners[index];
    player.node = origin.node; player.position.fromArray(this.nodes.get(origin.node).position);
    player.heading.copy(origin.heading); runner.segment = null;
    this.previewOrigins.delete(index);
  }

  beginPreview(index) {
    this.restorePreview(index);
    const player = this.players[index], runner = this.runners[index];
    runner.segment = null; player.position.fromArray(this.nodes.get(player.node).position);
    this.previewOrigins.set(index,{node:player.node,heading:player.heading.clone()});
  }

  previewEvent(category,cardId=null) {
    if (this.loading || this.globalHold || this.race?.over) return false;
    const runner=this.runners[this.active]; this.beginPreview(this.active);
    const accepted=runner.previewEvent(category,cardId);
    if (!accepted) this.restorePreview(this.active);
    this.collectLedger(runner); this.emit(); return accepted;
  }

  previewFork() {
    if (this.loading || this.paused || this.globalHold || this.race?.over) return false;
    const index=this.active, runner=this.runners[index];this.beginPreview(index);this.dispatching=index;
    let accepted;
    try {accepted=runner.previewFork();} finally {this.dispatching=null;}
    if (accepted) {runner.rollSequence=++this.rollSequence;runner.turn=++this.turn;}
    else this.restorePreview(index);
    this.emit();return accepted;
  }

  diceState() {
    const state=this.runners[this.active]?.diceState() || {elapsed:0,value:0,sequence:0,seat:this.players[this.active]?.seat};
    return {...state,phase:this.loading?'loading':this.phase,paused:this.paused||this.globalHold||!!this.race?.over};
  }

  edgeCompletion(index) {
    const runner=this.runners[index],player=this.players[index];
    if (runner.phase!=='moving') return null;
    let length,distance,target;
    if (runner.segment) {
      ({length}=runner.segment);target=runner.segment.to;
      distance=Math.max(0,1-runner.segment.progress)*length;
    } else {
      const node=this.nodes.get(player.node);
      if (node.next.length>1&&runner.interactiveChoices) return null;
      target=node.next.length===1?node.next[0]:node.next[runner.turn%2];
      const destination=this.nodes.get(target).position;
      length=Math.hypot(destination[0]-node.position[0],destination[1]-node.position[1],destination[2]-node.position[2]);
      distance=length;
    }
    const velocity=1.02*runner.speed;
    if (!(velocity>0)) return null;
    return {index,target,time:distance/velocity,completionMargin:Math.max(1e-9,length*2e-7/velocity)};
  }

  finishWindow(dt) {
    const approaching = new Map();
    for (const [index,runner] of this.runners.entries()) {
      const player=this.players[index];
      if (player.finished || this.previewOrigins.has(index) || player.raceSteps !== this.race.totalSteps-1 || runner.phase !== 'moving') continue;
      const edge=this.edgeCompletion(index);
      if (edge?.target===this.race.course.finishNodeId) approaching.set(index,edge);
    }
    const crossings=[...approaching.values()].filter(entry=>entry.time<=dt).sort((a,b)=>a.time-b.time||a.index-b.index);
    const places=this.race.finishLimit-this.race.finishers.length;
    const closes=crossings.length>=places;
    const selected=closes?crossings.slice(0,places):crossings;
    return {approaching,selected:new Set(selected.map(entry=>entry.index)),duration:closes?selected.at(-1).time:dt};
  }

  advanceSimulation(dt) {
    const focused=this.runners[this.active];
    const landing=this.onCollectiveLanding&&focused.remaining===1?this.edgeCompletion(this.active):null;
    // A focused landing may open escrow. Stop everybody at that boundary first,
    // then decide whether the collective event holds the rest of this frame.
    const budget=landing?Math.min(dt,landing.time):dt;
    const window=this.finishWindow(budget);
    const simulationDt=window.duration,frameStart=this.clock;
    this.clock += simulationDt;
    if (dt > 0) {
      this.dispatchClock += simulationDt;
      let dispatched=0;
      while (this.dispatchClock >= this.dispatchInterval && dispatched++ < this.players.length) {
        this.dispatchClock -= this.dispatchInterval;
        if (!this.dispatch()) { this.dispatchClock=0; break; }
      }
      const arrivals=[];
      this.pendingCollective=null;this.inSimulation=true;
      for (const [index,runner] of this.runners.entries()) {
        if (this.race.over) break;
        const player=this.players[index];
        if(this.heldSeats.has(player.seat))continue;
        if (player.finished) {
          runner.phaseTime += simulationDt;
          if (index===this.active && runner.phaseTime>=2.4) this.advanceFocus=true;
          continue;
        }
        if (index !== this.active && runner.phaseTime >= this.backgroundDecisionSeconds) {
          if (runner.phase === 'fork-choice') runner.chooseFork(runner.branch.default,'timeout');
          else if (runner.phase === 'event-choice') runner.chooseEvent(runner.event.defaultChoiceId || runner.event.choices[0].id);
        }
        const steps=runner.stepsCompleted;
        const finish=window.approaching.get(index);
        // The shared frame stops at third place. Exact ties use racer index;
        // excluded ties stay just short of the line instead of being snapped
        // across by CameraDemo's floating-point arrival tolerance.
        const actorDt=finish&&!window.selected.has(index)?Math.min(simulationDt,Math.max(0,finish.time-finish.completionMargin)):simulationDt;
        runner.update(actorDt);
        if (runner.stepsCompleted > steps && !this.previewOrigins.has(index)) {
          if (player.raceSteps===this.race.totalSteps-1) arrivals.push({index,runner,player,time:finish?.time??simulationDt});
          else this.race.recordEdge(player,player.node,runner.turn);
        }
        this.collectLedger(runner);
      }
      this.inSimulation=false;
      arrivals.sort((a,b)=>a.time-b.time||a.index-b.index);
      for (const {runner,player,time} of arrivals) {
        if (this.race.over) break;
        if (this.race.recordEdge(player,player.node,runner.turn)) {
          this.race.finishers.at(-1).crossingTime=frameStart+time;
          runner.remaining=0;runner.segment=null;runner.branch=null;runner.event=null;runner.eventCard=null;
          runner.phase='finished';runner.phaseTime=0;player.setClip('happy');
        }
      }
      if (this.pendingCollective&&!this.race.over) this.beginCollective(this.pendingCollective);
      this.pendingCollective=null;
      if (this.advanceFocus && !this.globalHold && !this.race.over) {this.advanceFocus=false;this.nextTurn();}
    }
    return simulationDt;
  }

  update(dt) {
    if (this.loading || !this.race || !this.players.length) return;
    const gameDt=this.paused||this.globalHold||this.race.over?0:dt*this.speed;
    let remaining=gameDt,simulationDt=0;
    for(let slices=0;remaining>1e-12&&!this.globalHold&&!this.race.over&&slices<8;slices++) {
      const advanced=this.advanceSimulation(remaining);
      simulationDt+=advanced;remaining=Math.max(0,remaining-advanced);
    }
    const focused=this.runners[this.active],actor=this.players[this.active];
    const fork=focused.phase==='fork-choice'?this.nodes.get(actor.node):null;
    this.cameraView=this.world.updateCamera(dt,actor,this.mode,focused.phase==='overview'||!!fork,fork);
    for (const [index,player] of this.players.entries()) {
      const moving=this.runners[index].phase==='moving'&&!player.finished;
      player.update(simulationDt,this.world.camera,moving,index===this.active,this.clock);
    }
    this.emitTime+=dt;
    if(this.emitTime>=.2){this.emitTime=0;this.emit();}
  }

  snapshot() {
    const runner=this.runners[this.active];
    if(!runner) return {map:this.mapId,seed:this.layout?.seed,active:0,loading:this.loading,phase:'waiting',players:[],crowd:[],race:this.race?.snapshot()??null,paused:this.paused,globalHold:this.globalHold,speed:this.speed,parallel:true};
    const focused=runner.snapshot();
    const players=this.players.map((player,index)=>({seat:player.seat,name:player.data.name,money:player.money,node:player.node,
      position:player.position.toArray(),heading:player.heading.toArray(),clip:player.clip,frame:player.frame,facing:player.facing,
      laps:player.laps||0,raceSteps:player.raceSteps||0,finished:!!player.finished,finishRank:player.finishRank??null,
      spawnOffset:player.spawnOffset?[...player.spawnOffset]:[0,0],phase:this.runners[index].phase}));
    return {...focused,active:this.active,phase:this.phase,paused:this.paused,globalHold:this.globalHold,speed:this.speed,
      loading:this.loading,mode:this.mode,cameraView:this.cameraView||'overview',turn:runner.turn,players,
      dice:this.diceState(),race:this.race.snapshot(this.previewOrigins.size>0),queuedRoll:this.manualQueue.has(this.active),
      ledger:this.ledger.slice(-200),randomizeRounds:false,parallel:true,
      crowd:players.map((player,index)=>({index,phase:player.phase,node:player.node,laps:player.laps,progress:player.raceSteps/this.race.totalSteps,finished:player.finished})),
      camera:{position:this.world.camera.position.toArray(),target:this.world.lookAt.toArray(),distanceToPlayer:this.world.camera.position.distanceTo(this.players[this.active].position)}};
  }

  emit(){if(this.runners.length)this.onChange?.(this.snapshot());}
}
