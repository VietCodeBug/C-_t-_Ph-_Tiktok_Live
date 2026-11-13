import { EventEmitter } from 'node:events';
import { randomBytes } from 'node:crypto';
import * as THREE from 'three';
import { ParallelRace } from '../src/parallel-race.js';
import { createTownLayouts } from '../src/layouts.js';
import { CommunityController } from '../src/community-controller.js';
import { MatchmakingQueue } from '../src/matchmaking.js';
import { sanitizeWelcomeName } from '../src/live-speech-policy.js';

const clean = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g,'d').replace(/Đ/g,'D').trim().replace(/\s+/g,' ').toUpperCase();
const text = (value, limit=64) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,limit);
const seed32 = () => randomBytes(4).readUInt32LE();
const actorFor = member => ({ accountId:member.id,seat:member.seat,data:{id:`ch${String((member.order%20)+1).padStart(2,'0')}`,name:member.name},
  group:new THREE.Group(),position:new THREE.Vector3(),heading:new THREE.Vector3(),money:member.money??1000,images:new Map(),distance:0,
  setClip(clip){this.clip=clip;},loadClip(){},update(){},frame:0,facing:'S' });
const headlessWorld = () => ({playerGroup:new THREE.Group(),followHeading:new THREE.Vector3(),camera:new THREE.PerspectiveCamera(),lookAt:new THREE.Vector3(),
  renderer:{info:{render:{calls:0,triangles:0}}},async loadMap(){},updateCamera(){return'follow';} });

// One authoritative room. There are no synthetic accounts or hidden actors in
// live mode: only explicit source arrivals/CHƠI create enrolled participants.
export class LiveRoom extends EventEmitter {
  constructor(options={}) {
    super();
    this.mode=options.mode==='demo'?'demo':'live';this.options={maxPlayers:20,tickRate:20,startingMoney:1000,inactivitySeconds:300,autoRollSeconds:10,autoJoinOnEnter:true,...options};
    this.configure(this.options,false);
    this.seed=Number.isInteger(options.seed)?options.seed>>>0:seed32();this.layouts=createTownLayouts(this.seed);
    this.world=headlessWorld();this.demo=null;this.community=null;
    this.members=new Map();this.waitingSeats=[];this.admitted=new Set();this.sourceSeen=new Set();this.commandSeen=new Set();
    this.clock=0;this.revision=0;this.memberSequence=0;this.cueSequence=0;this.match=1;
    this.connection={status:'idle',host:null,roomId:null};this.sourcePaused=false;this.operatorPaused=false;
    this.spotlight=null;this.introQueue=[];this.pendingLeaves=new Set();this.announcements=[];this.gifts=[];
    this.matchmaking=new MatchmakingQueue([],{seats:this.options.maxPlayers,reserved:Math.floor(this.options.maxPlayers*.6)});
    this.phase='waiting';this.busy=false;this.timer=null;this.operations=Promise.resolve();this.lastPublishedAt=-1;
    this.seenBoardCues=new Set();this.waitingWelcome={count:0,names:[]};this.lastWaitingWelcome=-10;
  }

  async init(){return this;}
  get game(){return this.demo;}
  configure(settings={},publish=true) {
    const values={...(settings.gameplay??settings)};
    if(settings.autoJoinOnEnter!==undefined)values.autoJoinOnEnter=settings.autoJoinOnEnter;
    const previous=this.options??{};
    this.options={...previous,...values,maxPlayers:Math.max(1,Math.min(20,Math.floor(values.maxPlayers??previous.maxPlayers??20))),
      tickRate:Math.max(1,Math.min(60,Number(values.tickRate??previous.tickRate??20))),
      inactivitySeconds:Math.max(10,Number(values.inactivitySeconds??previous.inactivitySeconds??300)),
      autoRollSeconds:Math.max(0,Number(values.autoRollSeconds??previous.autoRollSeconds??10)),
      startingMoney:Math.max(0,Math.floor(values.startingMoney??previous.startingMoney??1000))};
    this.roseIds=new Set((settings.roseIds??settings.gifts?.roseIds??previous.roseIds??['5655']).map(String));
    if(this.demo){this.demo.autoRollSeconds=this.options.autoRollSeconds;this.demo.backgroundDecisionSeconds=10;}
    if(this.community)this.community.game.startingMoney=this.options.startingMoney;
    if(publish&&this.members)this.publish();return {...this.options,roseIds:[...this.roseIds]};
  }
  start(){if(this.timer)return this;let last=performance.now();this.timer=setInterval(()=>{const now=performance.now();this.tick(Math.min(.25,(now-last)/1000));last=now;},1000/this.options.tickRate);this.timer.unref?.();return this;}
  stop(){if(this.timer)clearInterval(this.timer);this.timer=null;return this;}
  dispose(){this.stop();this.removeAllListeners();}
  enqueue(operation){const next=this.operations.then(async()=>{this.busy=true;try{return await operation();}finally{this.busy=false;}});this.operations=next.catch(error=>{this.emit('room-error',error);});return next;}

  setConnection(value={}) {
    const previous=this.connection.status,wasPaused=this.sourcePaused;this.connection={...this.connection,...value};
    if(this.mode==='live') {
      if(['connected','mock','demo'].includes(value.status))this.sourcePaused=false;
      else if(['disconnected','reconnecting','ended','error','connecting'].includes(value.status)&&(previous!=='idle'||this.demo?.players.length))this.sourcePaused=true;
    }
    if(this.sourcePaused&&!wasPaused)this.sourcePausedAt=this.clock;
    if(!this.sourcePaused&&wasPaused){const since=this.sourcePausedAt??this.clock;for(const member of this.members.values())member.lastActiveAt+=Math.max(0,this.clock-Math.max(since,member.lastActiveAt));this.sourcePausedAt=null;}
    this.applyPause();this.publish();return this.snapshot();
  }
  applyPause(){this.demo?.setPaused(this.operatorPaused||this.sourcePaused);}
  announce(id,line,{priority=1,eventId=null,ttl=20}={}) {
    const sequence=++this.cueSequence;
    const cue={id:`${id}:${this.match}:${sequence}`,scriptId:id,text:line,eventId:eventId??`room:${this.match}:${sequence}`,priority,at:this.clock,expiresAt:this.clock+ttl,createdAt:Date.now(),ttlMs:ttl*1000};
    this.announcements.push(cue);if(this.announcements.length>30)this.announcements.shift();this.emit('mc',cue);return cue;
  }
  memberFor(user={}) {
    const id=text(user.id,128);if(!id)return null;
    let member=this.members.get(id);
    if(!member) {
      if(this.members.size>=1000)return null;
      const order=this.memberSequence++;
      member={id,userId:id,seat:`P${String(order+1).padStart(3,'0')}`,name:text(user.nickname||user.uniqueId||id),nickname:text(user.nickname||user.uniqueId||id),
        uniqueId:text(user.uniqueId,128),avatar:text(user.avatar,2048),order,money:this.options.startingMoney,present:false,enrolled:false,lastActiveAt:this.clock,joinedAt:this.clock,pendingLeave:false,giftCount:0,giftCoins:0};
      this.members.set(id,member);
    } else {
      if(user.nickname){member.name=text(user.nickname);member.nickname=member.name;}
      if(user.avatar)member.avatar=text(user.avatar,2048);
      if(user.uniqueId)member.uniqueId=text(user.uniqueId,128);
    }
    member.lastActiveAt=this.clock;return member;
  }
  bySeat(seat){return [...this.members.values()].find(member=>member.seat===seat);}
  activeSeats(){return this.demo?.players.map(player=>player.seat)??[];}
  recordGift(member,event,packet){
    const count=Number(event.count),giftId=String(event.giftId??'');
    if(event.finalized!==true||!Number.isSafeInteger(count)||count<1||count>1000000||!/^[A-Za-z0-9_:-]{1,80}$/.test(giftId))return false;
    const unitCoins=Number(event.diamondCount),coins=Number.isFinite(unitCoins)&&unitCoins>0?Math.floor(unitCoins)*count:0;
    const receipt={id:packet,eventId:packet,userId:member.id,seat:member.seat,name:member.name,giftId,giftName:text(event.giftName,80)||`Quà ${giftId}`,count,at:this.clock};
    if(Number.isSafeInteger(coins)&&coins>0)receipt.coins=coins;
    this.gifts.unshift(receipt);if(this.gifts.length>40)this.gifts.length=40;
    member.giftCount=Math.min(Number.MAX_SAFE_INTEGER,(member.giftCount??0)+count);
    member.giftCoins=Math.min(Number.MAX_SAFE_INTEGER,(member.giftCoins??0)+(receipt.coins??0));
    // This feed acknowledges received gifts. MONEY and gift benefits remain owned by the existing game rules.
    return true;
  }
  syncLobby(){
    const active=this.activeSeats();
    for(const member of this.members.values())if(member.enrolled&&member.present)this.matchmaking.register(member.seat);
    this.waitingSeats=this.waitingSeats.filter((seat,index,array)=>array.indexOf(seat)===index&&!active.includes(seat)&&this.bySeat(seat)?.enrolled&&this.bySeat(seat)?.present);
    this.matchmaking.activeIds=[...active];this.matchmaking.waitingIds=[...this.waitingSeats];
    if(this.matchmaking.phase==='ready')this.matchmaking.nextActiveIds=[...active];
  }
  registerWallet(member){
    if(this.community&&!this.community.game.accounts.has(member.seat))this.community.game.register(member.seat,{name:member.name,seat:member.seat,money:member.money});
  }
  async ensureEngine(member){
    if(this.demo)return;
    const actor=actorFor(member);
    this.demo=new ParallelRace(this.world,[actor],this.layouts,null,{backgroundDecisionSeconds:10,autoRollSeconds:this.options.autoRollSeconds});
    await this.demo.changeMap('CHO_VIA_HE');this.demo.race.finishLimit=1;
    const accounts=[...this.members.values()].filter(m=>m.enrolled).map(m=>({seat:m.seat,data:{name:m.name},money:m.money}));
    this.community=new CommunityController(this.demo,{accounts,onMC:cue=>this.announce(cue.id,cue.text,{eventId:`community:${this.match}:${cue.sequence}`,priority:2})});
    this.community.game.startingMoney=this.options.startingMoney;
    const openEnvelope=this.community.game.openRedEnvelope.bind(this.community.game);
    this.community.game.openRedEnvelope=(...args)=>{
      const eligible=[...this.members.values()].filter(member=>member.present&&member.enrolled&&!member.pendingLeave).map(member=>member.seat);
      if(!eligible.length)return null;
      const opened=openEnvelope(...args);if(!opened)return null;
      this.community.game.redEnvelope.eligibleIds=eligible;
      return this.community.game.redEnvelopeSnapshot();
    };
    this.community.matchmaking=this.matchmaking;
    const scheduler=this.demo.chooseNextPlayer;
    this.demo.chooseNextPlayer=(eligible,last,game)=>{
      const index=this.spotlight&&this.demo.players.findIndex(player=>player.seat===this.spotlight.seat);
      return Number.isInteger(index)&&eligible.includes(index)?index:scheduler(eligible,last,game);
    };
    this.applyPause();this.phase='race';
  }
  async enroll(member,{greet=true}={}) {
    if(member.enrolled&&member.present&&!member.pendingLeave)return false;
    member.present=true;member.enrolled=true;member.pendingLeave=false;this.pendingLeaves.delete(member.seat);
    this.registerWallet(member);this.matchmaking.register(member.seat);
    if(!this.activeSeats().includes(member.seat)&&!this.waitingSeats.includes(member.seat))this.waitingSeats.push(member.seat);
    await this.fillVacancies();
    if(!this.activeSeats().includes(member.seat)&&greet){
      this.waitingWelcome.count++;if(this.waitingWelcome.names.length<3)this.waitingWelcome.names.push(sanitizeWelcomeName(member.name)||'bạn mới');
      this.waitingSpotlight={seat:member.seat,userId:member.id,userName:member.name,avatar:member.avatar,kind:'waiting',queued:true,queuePosition:this.waitingSeats.indexOf(member.seat)+1,startedAt:this.clock,expiresAt:this.clock+4,until:this.clock+4};
    }
    this.publish();return true;
  }
  async fillVacancies(){
    if(this.demo?.globalHold||['podium','reserving'].includes(this.phase))return;
    let actors=this.demo?[...this.demo.players]:[];
    const seated=[];
    while(actors.length<this.options.maxPlayers&&this.waitingSeats.length){
      const seat=this.waitingSeats.shift(),member=this.bySeat(seat);
      if(!member?.present||!member.enrolled||member.pendingLeave)continue;
      this.registerWallet(member);
      if(!this.demo){await this.ensureEngine(member);actors=[...this.demo.players];}
      else actors.push(actorFor({...member,money:this.community.game.accounts.get(seat)?.money??member.money}));
      seated.push(member);this.admitted.add(seat);
    }
    if(this.demo&&(actors.length!==this.demo.players.length||actors.some((actor,index)=>actor!==this.demo.players[index])))await this.demo.updatePlayers(actors);
    if(this.needsNewMap&&actors.length){await this.demo.regenerate({nextRound:true});this.demo.reset();this.community.syncToRace();this.needsNewMap=false;this.match++;this.seed=this.demo.layout.seed;this.layouts=this.demo.layouts;}
    for(const member of seated){
      this.demo.holdPlayer(member.seat,true);
      if(!this.introQueue.includes(member.seat)&&this.spotlight?.seat!==member.seat)this.introQueue.push(member.seat);
    }
    if(this.demo?.players.length)this.phase='race';
    this.updateFinishLimit();this.syncLobby();
  }
  updateFinishLimit(){
    if(!this.demo?.race)return;
    const race=this.demo.race;
    const reachable=race.finishers.length+this.demo.players.filter(player=>!player.finished).length;
    race.finishLimit=Math.max(1,Math.min(3,this.admitted.size||1,reachable||1));
  }
  async leave(member,reason='left'){
    if(!member?.enrolled&&!member?.present)return false;
    member.present=false;member.pendingLeave=true;this.pendingLeaves.add(member.seat);
    if(this.demo?.globalHold){this.publish();return true;}
    await this.flushLeaves(reason);return true;
  }
  async flushLeaves(reason='left'){
    if(this.demo?.globalHold)return false;
    const seats=new Set(this.pendingLeaves);if(!seats.size)return false;
    this.community?.syncFromRace();
    if(this.demo){
      for(const player of this.demo.players)if(seats.has(player.seat)){const member=this.bySeat(player.seat);if(member)member.money=player.money;}
      await this.demo.updatePlayers(this.demo.players.filter(player=>!seats.has(player.seat)));
    }
    for(const seat of seats){
      const member=this.bySeat(seat);if(member){member.enrolled=false;member.pendingLeave=false;}
      this.pendingLeaves.delete(seat);this.matchmaking.accounts.delete(seat);this.matchmaking.hearts.delete(seat);
      this.matchmaking.reservations=this.matchmaking.reservations.filter(entry=>entry.id!==seat);
      this.matchmaking.qualified.delete(seat);this.demo?.holdPlayer(seat,false);
    }
    this.waitingSeats=this.waitingSeats.filter(seat=>!seats.has(seat));this.introQueue=this.introQueue.filter(seat=>!seats.has(seat));
    if(this.spotlight&&seats.has(this.spotlight.seat))this.spotlight=null;
    if(!this.demo?.players.length&&!this.demo?.race.finishers.length)this.phase='waiting';
    await this.fillVacancies();this.updateFinishLimit();this.syncLobby();this.publish();return true;
  }

  async command(userId,value,eventId=`command:${this.match}:${++this.cueSequence}`){
    return this.enqueue(async()=>this._command(userId,value,eventId));
  }
  async _command(userId,value,eventId){
    if(!eventId||this.commandSeen.has(eventId))return false;
    this.commandSeen.add(eventId);if(this.commandSeen.size>100000)this.commandSeen.delete(this.commandSeen.values().next().value);
    const member=this.members.get(String(userId));if(!member)return false;
    member.lastActiveAt=this.clock;
    if(clean(value)==='CHOI')return this.enroll(member);
    if(['ROI','THOAT','NGHI'].includes(clean(value)))return this.leave(member,'command');
    if(!member.enrolled||!member.present||member.pendingLeave||!this.community||this.sourcePaused)return false;
    const index=this.demo.players.findIndex(player=>player.seat===member.seat),runner=this.demo.runners[index];
    const numeric=/^[12]$/.test(clean(value))?Number(clean(value))-1:null;
    const command=numeric!==null&&runner?.phase==='event-choice'?runner.event.choices[numeric]?.id:value;
    const accepted=this.community.comment(member.seat,command,eventId);this.publish();return accepted;
  }
  async handleSourceEvent(event={}){
    return this.enqueue(async()=>{
      const packet=text(event.eventId,256);if(!packet||this.sourceSeen.has(packet))return false;
      this.sourceSeen.add(packet);if(this.sourceSeen.size>100000)this.sourceSeen.delete(this.sourceSeen.values().next().value);
      if(event.type==='viewer-count'){this.viewerCount=event.count;this.publish();return true;}
      if(event.type==='presence-clear'){this.setConnection({status:event.reason==='stream-ended'?'ended':'disconnected'});return true;}
      const member=this.memberFor(event.user);if(!member)return false;
      if(event.type==='member'||event.type==='join'){
        const wasPresent=member.present;member.present=true;
        if(this.options.autoJoinOnEnter)return this.enroll(member,{greet:!wasPresent});
        if(!wasPresent)this.announce('member.arrive',`Chào ${sanitizeWelcomeName(member.name)||'bạn mới'}! Gõ CHƠI để cùng vào khu phố.`,{priority:0,ttl:12});
        this.publish();return true;
      }
      if(event.type==='leave')return this.leave(member,event.reason??'source');
      if(event.type==='comment')return this._command(member.id,event.text,packet);
      // Finalized combo deltas are already deduplicated above. Every gift can
      // appear in the feed; only the existing rose rule grants turn priority.
      if(event.type==='gift'){
        if(!this.recordGift(member,event,packet))return false;
        if(this.roseIds.has(String(event.giftId))&&member.enrolled&&this.community)this.community.game.receiveRose(member.seat,packet,event.count);
        this.publish();return true;
      }
      if(!member.present||!member.enrolled||member.pendingLeave||!this.community||this.sourcePaused)return false;
      let accepted=false;
      if(event.type==='likes')accepted=this.community.like(member.seat,event.count,packet);
      this.publish();return accepted;
    });
  }

  updateSpotlight(dt=0){
    if(!this.demo||this.demo.paused||this.demo.globalHold||this.demo.race.over)return;
    if(this.spotlight){
      const current=this.spotlight,index=this.demo.players.findIndex(player=>player.seat===current.seat),runner=this.demo.runners[index];
      if(!runner){this.spotlight=null;return;}
      current.elapsed=(current.elapsed??0)+dt;
      if(current.kind==='welcome'&&current.elapsed>=1.2){
        this.demo.holdPlayer(current.seat,false);this.demo.requestRollFor(index);current.kind='roll';current.expiresAt=this.clock+15;current.until=current.expiresAt;
      }else if(current.kind==='roll'&&!['overview','roll','roll-result'].includes(runner.phase)){
        let next=this.demo.players.findIndex(player=>player.seat===current.returnSeat&&!player.finished);
        if(next<0||next===index)next=this.demo.players.findIndex((player,i)=>i!==index&&!player.finished);
        if(next>=0)this.demo.select(next);this.spotlight=null;
      }
      return;
    }
    let member;
    while(this.introQueue.length&&!member){const candidate=this.bySeat(this.introQueue.shift());if(candidate?.present&&candidate.enrolled&&!candidate.pendingLeave&&this.activeSeats().includes(candidate.seat))member=candidate;}
    if(!member)return;
    const index=this.demo.players.findIndex(player=>player.seat===member.seat),returnSeat=this.demo.players[this.demo.active]?.seat;
    this.demo.select(index);this.spotlight={seat:member.seat,userId:member.id,userName:member.name,avatar:member.avatar,kind:'welcome',startedAt:this.clock,elapsed:0,expiresAt:this.clock+16,until:this.clock+16,returnSeat,queued:this.introQueue.length};
    this.announce('member.seated',`Chào ${sanitizeWelcomeName(member.name)||'bạn mới'}, ghế ${member.seat}! Mời bạn lắc xúc xắc mở màn, rồi cả phố cùng đi ba vòng.`,{priority:2,ttl:15});
  }
  observeBoard(){
    // The collective controller owns narration while its modal is open. The
    // underlying individual card is retained only for settlement bookkeeping.
    if(this.community?.modal)return;
    const state=this.demo?.snapshot(),member=state&&this.bySeat(state.players[state.active]?.seat);
    if(!state||!member)return;
    const name=sanitizeWelcomeName(member.name)||member.seat;
    const once=(key,fn)=>{if(this.seenBoardCues.has(key))return;this.seenBoardCues.add(key);fn();};
    if(state.phase==='roll-result')once(`dice:${state.dice.sequence}`,()=>this.announce('race.roll-result',`${name} lắc được ${state.dice.value} bước!`,{ttl:8}));
    if(state.branch)once(`fork:${member.seat}:${state.turn}:${state.branch.nodeId}`,()=>this.announce('race.fork',`${name}, gõ TRÁI hoặc PHẢI trong mười giây để chọn đường.`,{priority:2,ttl:10}));
    const event=state.event;
    if(event&&!event.result?.community){
      if(!event.result)once(`event:${event.sequence}:open`,()=>this.announce(`event.${event.id}.open`,`${name}, ${event.mc||event.body}${event.choices.length?' '+event.choices.map((choice,index)=>`Gõ ${index+1}: ${choice.label}.`).join(' '):''}`,{priority:2,ttl:10}));
      if(event.result)once(`event:${event.sequence}:result`,()=>this.announce(`event.${event.id}.result`,event.category==='rest'?`${name} ghé ô bình yên, ví giữ nguyên.`:`${name}, ${event.choices.length?'':`${event.mc||event.body} `}${event.result.delta>0?'nhận':event.result.delta<0?'mất':'không đổi'} ${Math.abs(event.result.delta)} MONEY; ví hiện ${event.result.after}.`,{priority:1,ttl:10}));
    }
    for(const entry of state.race?.finishers??[])once(`finish:${entry.seat}`,()=>this.announce('race.finish',`${sanitizeWelcomeName(entry.name)||entry.seat} đã đi đủ ba vòng và về đích thứ ${entry.rank}!`,{priority:3,ttl:15}));
  }
  tick(dt){
    if(!Number.isFinite(dt)||dt<0)throw new RangeError('Room tick must be nonnegative seconds');
    if(this.busy)return false;
    let left=Math.min(dt,3600);
    while(left>1e-9){const step=Math.min(left,1/this.options.tickRate);left-=step;this.clock+=step;
      if(this.demo){
        this.updateSpotlight(step);this.demo.update(step);this.community.update(step);this.observeBoard();
        for(const player of this.demo.players){const member=this.bySeat(player.seat);if(member)member.money=player.money;}
        if(this.demo.race.over&&!['podium','reserving'].includes(this.phase)){
          this.spotlight=null;this.matchmaking.beginPodium(this.activeSeats(),{seats:this.options.maxPlayers,reserved:Math.floor(this.options.maxPlayers*.6)});this.phase='podium';
          this.announce('race.podium',`${this.demo.race.finishers.length} người đã về đích! Xem bục tám giây rồi mở sảnh giữ ghế.`,{priority:3});
        }else if(['podium','reserving'].includes(this.phase)&&!this.demo.paused){
          this.matchmaking.tick(step);this.phase=this.matchmaking.phase;
          if(this.phase==='ready'){this.busy=true;this.enqueue(()=>this.newMatch()).catch(()=>{});break;}
        }
      }
      if(this.waitingWelcome.count&&this.clock-this.lastWaitingWelcome>=2){
        const batch=this.waitingWelcome,others=Math.max(0,batch.count-batch.names.length);
        this.announce('member.waiting',`Chào ${batch.names.join(', ')}${others?` và ${others} bạn mới`:''}! Hàng ghế đang đầy; trong lúc chờ vẫn được góp vốn, mua hàng và nhận lì xì.`,{priority:0,ttl:12});
        this.waitingWelcome={count:0,names:[]};this.lastWaitingWelcome=this.clock;
      }
      if(!this.sourcePaused){
        for(const member of this.members.values())if(member.enrolled&&member.present&&this.clock-member.lastActiveAt>=this.options.inactivitySeconds){member.present=false;member.pendingLeave=true;this.pendingLeaves.add(member.seat);}
        if(this.pendingLeaves.size&&!this.demo?.globalHold){this.busy=true;this.enqueue(()=>this.flushLeaves('inactive')).catch(()=>{});break;}
        if(this.waitingSeats.length&&!this.demo?.globalHold&&!['podium','reserving'].includes(this.phase)&&this.activeSeats().length<this.options.maxPlayers){this.busy=true;this.enqueue(()=>this.fillVacancies()).catch(()=>{});break;}
      }
    }
    if(this.clock-this.lastPublishedAt>=.1){this.lastPublishedAt=this.clock;this.publish();}
    return true;
  }

  async newMatch({manual=false}={}){
    if(!this.demo)return false;
    if(!this.community.resetForMatch({manual}))return false;
    const previousActive=this.activeSeats();
    let seats=manual?previousActive.slice(0,this.options.maxPlayers):this.matchmaking.nextActiveIds;
    seats=seats.filter(seat=>{const member=this.bySeat(seat);return member?.present&&member.enrolled&&!member.pendingLeave;});
    if(!seats.length){this.phase='waiting';this.needsNewMap=true;this.demo.race.finishers=[];this.demo.race.finishLimit=1;this.admitted.clear();return false;}
    this.waitingSeats=manual?[...new Set([...this.waitingSeats,...previousActive.filter(seat=>!seats.includes(seat))])]:this.matchmaking.waitingIds.filter(seat=>this.bySeat(seat)?.present&&this.bySeat(seat)?.enrolled);
    const actors=seats.map(seat=>actorFor({...this.bySeat(seat),money:this.options.startingMoney}));
    await this.demo.updatePlayers(actors);await this.demo.regenerate({nextRound:true});this.demo.reset();this.community.syncToRace();
    this.seed=this.demo.layout.seed;this.layouts=this.demo.layouts;this.admitted=new Set(seats);this.match++;
    this.introQueue=[];this.spotlight=null;this.demo.heldSeats.clear();this.phase='race';this.applyPause();
    this.seenBoardCues.clear();
    for(const member of this.members.values())if(this.community.game.accounts.has(member.seat))member.money=this.community.game.accounts.get(member.seat).money;
    this.updateFinishLimit();this.syncLobby();this.announce('race.start',`Ván mới bắt đầu, ${actors.length} người cùng đi ba vòng!`,{priority:2});this.publish();return true;
  }
  async control(action,payload={}){
    return this.enqueue(async()=>{
      if(action==='settings'){this.configure(payload);await this.fillVacancies();return true;}
      if(action==='pause'||action==='resume'){this.operatorPaused=action==='pause'?payload.value!==false:false;this.applyPause();this.publish();return true;}
      if(action==='next-camera'){this.demo?.nextTurn();this.publish();return true;}
      if(action==='focus'){const index=this.demo?.players.findIndex(player=>player.seat===payload.seat);const ok=index>=0&&this.demo.select(index);this.publish();return !!ok;}
      if(action==='remove-player'){const member=this.members.get(String(payload.userId));return member?this.leave(member,'operator'):false;}
      if(action==='new-match')return this.newMatch({manual:true});
      if(action==='try-event'){if(this.mode!=='demo')return false;return this.demo?.previewEvent(payload.category,payload.id)??false;}
      if(this.mode!=='demo'||!action.startsWith('demo-'))return false;
      if(action==='demo-start'&&(this.activeSeats().length||[...this.members.values()].some(member=>member.enrolled)))return true;
      if(action==='demo-join'||action==='demo-start'){
        const requested=Number(payload.count??(action==='demo-start'?20:1));
        const count=Math.max(1,Math.min(action==='demo-start'?this.options.maxPlayers:100,Number.isFinite(requested)?Math.floor(requested):(action==='demo-start'?20:1)));
        for(let i=0;i<count;i++){const member=this.memberFor({id:`demo-${this.memberSequence+1}`,nickname:`Khách thử ${this.memberSequence+1}`});if(member)await this.enroll(member);}
        return true;
      }
      const member=this.members.get(String(payload.userId));if(!member)return false;
      member.lastActiveAt=this.clock;
      if(action==='demo-comment')return this._command(member.id,payload.text,`demo:${++this.cueSequence}`);
      if(action==='demo-leave')return this.leave(member,'demo');
      if(action==='demo-like')return this.community?.like(member.seat,payload.count??10,`demo:${++this.cueSequence}`)??false;
      if(action==='demo-gift'){
        const packet=`demo:gift:${++this.cueSequence}`,giftId=String(payload.giftId??'5655');
        const event={finalized:true,giftId,giftName:payload.giftName??(giftId==='5655'?'Hoa hồng':`Quà ${giftId}`),diamondCount:payload.diamondCount,count:payload.count??1};
        if(!this.recordGift(member,event,packet))return false;
        if(this.roseIds.has(giftId)&&member.enrolled&&this.community)this.community.game.receiveRose(member.seat,packet,event.count);
        this.publish();return true;
      }
      return false;
    });
  }
  snapshot(){
    const active=this.activeSeats(),row=member=>({id:member.id,userId:member.id,seat:member.seat,name:member.name,nickname:member.nickname,uniqueId:member.uniqueId,avatar:member.avatar,
      actorIndex:member.order%20,gameIndex:active.indexOf(member.seat),money:this.community?.game.accounts.get(member.seat)?.money??member.money,present:member.present,enrolled:member.enrolled,
      lastActiveAt:member.lastActiveAt,joinedAt:member.joinedAt,pendingLeave:member.pendingLeave,giftCount:member.giftCount??0,giftCoins:member.giftCoins??0,characterId:`ch${String((member.order%20)+1).padStart(2,'0')}`});
    const waiting=new Set(this.waitingSeats),leaderboard=[...this.members.values()].filter(member=>member.present&&member.enrolled&&!member.pendingLeave&&(active.includes(member.seat)||waiting.has(member.seat)))
      .sort((a,b)=>(this.community?.game.accounts.get(b.seat)?.money??b.money)-(this.community?.game.accounts.get(a.seat)?.money??a.money)||a.order-b.order)
      .map((member,index)=>({rank:index+1,seat:member.seat,userId:member.id,name:member.name,money:this.community?.game.accounts.get(member.seat)?.money??member.money,active:active.includes(member.seat),waiting:waiting.has(member.seat),giftCount:member.giftCount??0,giftCoins:member.giftCoins??0}));
    return {revision:this.revision,mode:this.mode,phase:this.phase,at:this.clock,matchId:this.match,seed:this.demo?.layout?.seed??this.seed,connection:{...this.connection},
      paused:this.operatorPaused||this.sourcePaused,operatorPaused:this.operatorPaused,sourcePaused:this.sourcePaused,viewerCount:this.viewerCount??null,
      game:this.demo?.players.length?this.demo.snapshot():null,community:this.community?.snapshot()??null,lobby:this.matchmaking.snapshot(),
      roster:active.map(seat=>this.bySeat(seat)).filter(Boolean).map(row),waiting:this.waitingSeats.map(seat=>this.bySeat(seat)).filter(Boolean).map(row),
      gifts:this.gifts.map(gift=>({...gift})),leaderboard,
      spotlight:this.spotlight?{...this.spotlight,queued:false,queuedCount:this.introQueue.length}:this.waitingSpotlight?.expiresAt>this.clock?{...this.waitingSpotlight}:null,announcements:this.announcements.filter(cue=>cue.expiresAt>this.clock).map(cue=>({...cue})),
      settings:{maxPlayers:this.options.maxPlayers,inactivitySeconds:this.options.inactivitySeconds,autoRollSeconds:this.options.autoRollSeconds,autoJoinOnEnter:this.options.autoJoinOnEnter},
      inactivityPolicy:'explicit-leave-or-activity-timeout',realTikTokConnected:this.mode==='live'&&this.connection.status==='connected'};
  }
  getSnapshot(){return this.snapshot();}
  publish(){this.revision++;const value=this.snapshot();this.emit('change',value);this.emit('state',value);return value;}
}

export { LiveRoom as Room };
