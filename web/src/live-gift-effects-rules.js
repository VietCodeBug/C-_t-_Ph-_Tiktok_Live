import {GIFT_CATALOG} from './gift-catalog.js';

const PARTICLES={priority:3,pulse:5,confetti:8,'red-envelope':10,trail:6,pet:3,spotlight:6};
const DURATION={priority:2.8,pulse:2.6,confetti:3,'red-envelope':4.5,trail:3.4,pet:3.6,spotlight:3.3};
const label=value=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,'').slice(0,48);

export function normalizeGiftEffect(value,clock,{freshSeconds=1}={}){
  const gift=GIFT_CATALOG.find(item=>item.key===value?.giftKey);
  const id=String(value?.id||value?.eventId||'');
  const at=Number(value?.at),expiresAt=Number(value?.expiresAt);
  if(!gift||!id||id.length>512||value.effect!==gift.effect||!Number.isFinite(clock)||!Number.isFinite(at)||!Number.isFinite(expiresAt))return null;
  if(clock-at>freshSeconds||clock-at<-.25||expiresAt<=clock)return null;
  const count=Number(value.count);
  if(!Number.isSafeInteger(count)||count<1)return null;
  const payout=gift.effect==='red-envelope';
  if(payout&&(!Number.isSafeInteger(value.pot)||value.pot<1||!Number.isSafeInteger(value.participants)||value.participants<1||value.totalPaid!==value.pot))return null;
  return{...value,id,giftKey:gift.key,effect:gift.effect,name:label(value.name||value.seat||'Khách ghé phố'),count,
    age:0,duration:Math.min(DURATION[gift.effect],expiresAt-clock),wantedParticles:PARTICLES[gift.effect],isPayout:payout};
}

// Renderer-only bookkeeping: never calculates a reward or changes a wallet.
export class GiftEffectState {
  constructor(){this.active=[];this.seen=new Set();this.ignored=0;this.received=0;this.lastPayout=null;}
  update(dt,state={}){
    state??={};
    const elapsed=Number.isFinite(dt)?Math.max(0,Math.min(.25,dt)):0,clock=Number(state.at);
    this.active=this.active.filter(effect=>{effect.age+=elapsed;return effect.age<effect.duration&&(!Number.isFinite(clock)||clock<effect.expiresAt);});
    const added=[];
    // The latest server entries take precedence during a burst; old unrendered
    // ones are remembered too, so another SSE snapshot cannot replay them.
    for(const value of Array.isArray(state.giftEffects)?[...state.giftEffects].reverse():[]){
      const id=String(value?.id||value?.eventId||'');if(!id||this.seen.has(id))continue;
      this.seen.add(id);while(this.seen.size>512)this.seen.delete(this.seen.values().next().value);
      const effect=normalizeGiftEffect(value,clock);if(!effect){this.ignored++;continue;}
      if(this.active.length>=4){
        const replace=this.active.findIndex(item=>!item.isPayout);
        if(replace<0){this.ignored++;continue;}
        this.active.splice(replace,1);
      }
      const used=this.active.reduce((sum,item)=>sum+item.particles,0);
      effect.particles=Math.min(effect.wantedParticles,Math.max(0,20-used));
      this.active.push(effect);added.push(effect);this.received++;
      if(effect.isPayout)this.lastPayout={id:effect.id,pot:effect.pot,participants:effect.participants,totalPaid:effect.totalPaid};
    }
    const activeIds=new Set(this.active.map(effect=>effect.id));
    return added.filter(effect=>activeIds.has(effect.id));
  }
  snapshot(){return{activeCount:this.active.length,particleCount:this.active.reduce((sum,effect)=>sum+effect.particles,0),seenCount:this.seen.size,
    received:this.received,ignored:this.ignored,lastPayout:this.lastPayout?{...this.lastPayout}:null,
    active:this.active.map(effect=>({id:effect.id,eventId:effect.eventId,giftKey:effect.giftKey,effect:effect.effect,seat:effect.seat,userId:effect.userId,name:effect.name,
      particles:effect.particles,remaining:Math.max(0,effect.duration-effect.age),isPayout:effect.isPayout,...(effect.isPayout?{pot:effect.pot,participants:effect.participants,totalPaid:effect.totalPaid}:{})}))};}
  clear(){this.active=[];}
}

export function giftDonorPosition(effect,{actors=[],waiting=[]}={}){
  const matches=person=>effect.seat&&person.seat===effect.seat||effect.userId&&String(person.userId||person.accountId||person.id||'')===String(effect.userId);
  const person=[...(Array.isArray(actors)?actors:[]),...(Array.isArray(waiting)?waiting:[])].find(matches);
  const position=person?.position;
  if(Array.isArray(position)&&position.length>=3&&position.slice(0,3).every(Number.isFinite))return position.slice(0,3);
  if(position?.isVector3)return[position.x,position.y,position.z];
  return null;
}
