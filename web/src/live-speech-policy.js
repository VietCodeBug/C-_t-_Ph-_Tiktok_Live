// Shared by the local server and overlay. Only authored game MC reaches speech;
// viewer comments are commands, never a text-to-speech source.
export const AUDIO_TEST_TEXT = 'Bé Két đã sẵn sàng dẫn phố. Chúc cả nhà chơi vui!';
export const MAX_SPEECH_TEXT = 600;
const BLOCKED_WORDS = [
  'địt','đéo','lồn','cặc','buồi','đụ mẹ','đụ má','con đĩ',
  'dm','dmm','dcm','dkm','dit me','du ma','vai lon','cai lon','cai cac',
  'fuck','fucking','motherfucker','shit','bitch','asshole','nigger','nigga'
];
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const invisible = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g;
const folded = value => value.normalize('NFD').replace(/\p{M}/gu,'').replace(/đ/g,'d');
function matches(text, word) {
  const letters=[...word].map(ch=>/\s/u.test(ch)?'[^\\p{L}\\p{N}]+':escape(ch)).join('[^\\p{L}\\p{N}]*');
  return new RegExp('(^|[^\\p{L}\\p{N}])'+letters+'($|[^\\p{L}\\p{N}])','iu').test(text);
}
export function speechAllowed(value) {
  if(typeof value!=='string')return false;
  const raw=value.normalize('NFKC').replace(invisible,'').toLowerCase();
  const normalized=folded(raw).replace(/[013457$]/g,ch=>({'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','$':'s'})[ch]);
  return !BLOCKED_WORDS.some(word=>matches(raw,word)||(/^[\x00-\x7f]+$/.test(word)&&matches(normalized,word)));
}
export function cleanSpeechText(value) {
  return typeof value==='string'?value.normalize('NFKC').replace(invisible,' ').replace(/\s+/g,' ').trim():'';
}
export function sanitizeWelcomeName(value) {
  if(typeof value!=='string'||value.length>80||/[<>{}]|https?:|www\./iu.test(value)||!speechAllowed(value))return null;
  const name=cleanSpeechText(value).replace(/^@/,'').replace(/[^\p{L}\p{N} ._'’-]/gu,'').trim();
  return name&&name.length<=32&&/[\p{L}\p{N}]/u.test(name)?name:null;
}
export function buildWelcomeCue(users,{id='welcome',now=Date.now()}={}) {
  const unique=new Map();
  for(const user of users||[]){
    const key=String(user?.id||user?.userId||user?.displayName||user?.name||'').slice(0,100);
    if(key&&!unique.has(key))unique.set(key,sanitizeWelcomeName(user?.displayName||user?.name||user?.nickname));
  }
  if(!unique.size)return null;
  const names=[...unique.values()].filter(Boolean).slice(0,3),others=unique.size-names.length;
  const guests=names.length?names.join(', ')+(others?` và ${others} bạn mới`:''):'những bạn mới';
  return {id:String(id),eventId:'WELCOME',category:'welcome',text:`Chào mừng ${guests} đến khu phố! Gõ CHƠI để vào hàng ghế, trong lúc chờ vẫn cùng chơi sự kiện nhé.`,priority:1,createdAt:now,ttlMs:12000,cooldownKey:'welcome',cooldownMs:8000};
}
export function normalizeMCCue(cue,now=Date.now()) {
  if(!cue||typeof cue!=='object'||Array.isArray(cue)||cue.rawChat||[cue.category,cue.type,cue.kind].some(value=>/^(chat|comment|raw-comment)([.:]|$)/i.test(value||'')))return null;
  const id=String(cue.id||''),eventId=String(cue.eventId||'');
  if(!/^[\w.:-]{1,160}$/.test(id)||!/^[\w.:-]{1,100}$/.test(eventId)||/^(chat|comment)$/i.test(eventId))return null;
  const text=cleanSpeechText(cue.text??cue.line);
  if(!text||text.length>MAX_SPEECH_TEXT||!speechAllowed(text)||/https?:\/\//i.test(text))return null;
  const createdAt=Number.isFinite(cue.createdAt)&&cue.createdAt>1e12?cue.createdAt:now;
  const ttlMs=Math.max(1000,Math.min(30000,Number(cue.ttlMs)||15000));
  if(now-createdAt>=ttlMs||createdAt>now+30000)return null;
  return {...cue,id,eventId,text,createdAt,ttlMs,priority:Math.max(0,Math.min(3,Math.round(Number(cue.priority)||0)))};
}

export class SpeechCueQueue {
  constructor({now=Date.now,limit=5}={}){this.now=now;this.limit=limit;this.items=[];this.seen=new Map();this.texts=new Map();this.cooldowns=new Map();this.sequence=0;}
  add(value){
    const now=this.now(),cue=normalizeMCCue(value,now);if(!cue)return false;
    for(const [id,at] of this.seen)if(now-at>60000)this.seen.delete(id);
    for(const [text,at] of this.texts)if(now-at>12000)this.texts.delete(text);
    const cooldownKey=cue.cooldownKey||(cue.category==='welcome'||cue.eventId==='WELCOME'?'welcome':null);
    const cooldownMs=Math.max(0,Math.min(60000,Number(cue.cooldownMs)||(cooldownKey==='welcome'?8000:0)));
    if(this.seen.has(cue.id)||this.texts.has(cue.text)||(cooldownKey&&now-(this.cooldowns.get(cooldownKey)??-Infinity)<cooldownMs))return false;
    this.seen.set(cue.id,now);this.texts.set(cue.text,now);if(cooldownKey)this.cooldowns.set(cooldownKey,now);
    this.items=this.items.filter(item=>now-item.createdAt<item.ttlMs);
    this.items.push({...cue,_order:++this.sequence});this.items.sort((a,b)=>b.priority-a.priority||a._order-b._order);
    this.items.length=Math.min(this.limit,this.items.length);
    while(this.seen.size>512)this.seen.delete(this.seen.keys().next().value);
    return this.items.some(item=>item.id===cue.id);
  }
  take(){const now=this.now();while(this.items.length){const cue=this.items.shift();if(now-cue.createdAt<cue.ttlMs)return cue;}return null;}
  clear(){this.items.length=0;}
  forget(id,text){this.seen.delete(id);this.texts.delete(text);}
  get size(){return this.items.length;}
}
