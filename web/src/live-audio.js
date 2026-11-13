import {AUDIO_TEST_TEXT,SpeechCueQueue} from './live-speech-policy.js';

const clamp=(value,fallback)=>Number.isFinite(Number(value))?Math.max(0,Math.min(1,Number(value))):fallback;
const voiceName=value=>value==='male'||value==='vi-VN-NamMinhNeural'?'male':'female';
const speechRate=value=>Number.isFinite(Number(value))?Math.max(.8,Math.min(1.25,Number(value))):1.06;
const safeCall=(callback,...args)=>{try{callback?.(...args);}catch{/* A UI callback never owns speech or game state. */}};
function silentWav(){
  const bytes=new Uint8Array(124),view=new DataView(bytes.buffer);
  const text=(offset,value)=>[...value].forEach((ch,i)=>view.setUint8(offset+i,ch.charCodeAt(0)));
  text(0,'RIFF');view.setUint32(4,116,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);
  view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,8000,true);view.setUint32(28,8000,true);
  view.setUint16(32,1,true);view.setUint16(34,8,true);text(36,'data');view.setUint32(40,80,true);bytes.fill(128,44);
  return new Blob([bytes],{type:'audio/wav'});
}

// Output only. This class never reads a microphone or mutates a game/ledger.
// Feed it canonical server MC packets, never chat/comment payloads.
export class LiveAudio {
  constructor({mode='live',ttsUrl='/api/tts',onCaption,onState,onDuck,onError,browserFallback=true,
    volume=.85,voice='female',rate=1.06,env=globalThis,audio,fetch:fetcher,now=Date.now,gapMs=650}={}){
    this.env=env;this.mode=mode;this.ttsUrl=ttsUrl;this.onCaption=onCaption;this.onState=onState;this.onDuck=onDuck;this.onError=onError;
    this.browserFallback=browserFallback;this.volume=clamp(volume,.85);this.voice=voiceName(voice);this.rate=speechRate(rate);
    this.audio=audio||new env.Audio();this.audio.preload='auto';this.fetcher=fetcher||env.fetch?.bind(env);this.now=now;this.gapMs=gapMs;
    this.queue=new SpeechCueQueue({now});this.enabled=false;this.unlocked=false;this.speaking=false;this.error='';this.provider='captions';
    this.lastEnded=-Infinity;this.generation=0;this.current=null;this.disposed=false;
    this.owner=env.crypto?.randomUUID?.()||`mc-${Math.random().toString(36).slice(2)}`;
    if(env.window&&typeof env.BroadcastChannel==='function'){
      this.channel=new env.BroadcastChannel(`co-ty-phi-mc-audio-owner-v1-${this.mode}`);
      this.channel.onmessage=event=>{if(event.data?.owner&&event.data.owner!==this.owner&&this.enabled){this.setEnabled(false);this.error='MC đang phát ở tab game khác.';this._emit();}};
    }
    this._emit();
  }
  get status(){return {enabled:this.enabled,unlocked:this.unlocked,speaking:this.speaking,queued:this.queue.size,error:this.error,provider:this.provider,volume:this.volume,voice:this.voice,currentId:this.current?.cue.id||null};}
  snapshot(){return this.status;}
  _emit(){safeCall(this.onState,this.status);}
  _error(message){this.error=message;safeCall(this.onError,message);this._emit();}
  async unlock(){
    if(this.disposed)return false;
    if(this.unlocked){this.enabled=true;this.channel?.postMessage({owner:this.owner});this._emit();this._pump();return true;}
    this.enabled=true;this.error='';
    // Prime the SAME media element inside the original click handler. iOS and
    // embedded LIVE browsers may grant autoplay only to this element.
    const url=URL.createObjectURL(silentWav());this.audio.src=url;this.audio.volume=0;
    let playback;
    try{playback=this.audio.play();}catch(error){playback=Promise.reject(error);}
    try{
      const Context=this.env.AudioContext||this.env.webkitAudioContext;
      if(Context&&!this.context)this.context=new Context();
      const resume=this.context?.resume().catch(()=>{});
      await Promise.all([playback,resume]);this.audio.pause();this.audio.volume=this.volume;
      this.unlocked=true;this.channel?.postMessage({owner:this.owner});this._emit();this._pump();return true;
    }catch{
      this.unlocked=false;this._error('Bấm Bật MC ngay trong tab hoặc nguồn game để cấp quyền âm thanh.');return false;
    }finally{URL.revokeObjectURL(url);}
  }
  setEnabled(value){
    this.enabled=!!value;
    if(!this.enabled)this.stop();else this._pump();this._emit();return this.enabled;
  }
  setVolume(value){this.volume=clamp(value,.85);this.audio.volume=this.volume;if(this.utterance)this.utterance.volume=this.volume;this._emit();}
  setVoice(value){this.voice=voiceName(value);this._emit();}
  setRate(value){this.rate=speechRate(value);this._emit();}
  configure(value={}){if(value.volume!==undefined)this.setVolume(value.volume);if(value.voice!==undefined)this.setVoice(value.voice);if(value.rate!==undefined)this.setRate(value.rate);if(value.browserFallback!==undefined)this.browserFallback=!!value.browserFallback;return this.status;}
  enqueue(cue){
    if(this.disposed)return false;
    const accepted=this.queue.add(cue);if(!accepted)return false;
    if(!this.enabled||!this.unlocked){const queued=this.queue.items.find(item=>item.id===cue.id);safeCall(this.onCaption,queued.text,queued);}
    if(this.current&&Number(cue.priority)>=3&&this.current.cue.priority<2)this._finish(this.current);
    this._emit();this._pump();return true;
  }
  speak(cue){return this.enqueue(cue);}
  async test(){
    if(!await this.unlock())return false;
    this.stop({clearQueue:false});this.queue.forget('audio-test',AUDIO_TEST_TEXT);
    return this.enqueue({id:'audio-test',eventId:'SYSTEM',text:AUDIO_TEST_TEXT,priority:3});
  }
  _pump(){
    clearTimeout(this.gapTimer);
    if(this.disposed||!this.enabled||!this.unlocked||this.current)return;
    const gap=this.gapMs-(this.now()-this.lastEnded);
    if(gap>0){this.gapTimer=setTimeout(()=>this._pump(),gap);return;}
    const cue=this.queue.take();if(!cue){this._emit();return;}
    const ticket={cue,generation:++this.generation,abort:new AbortController()};this.current=ticket;this.speaking=true;
    this.error='';safeCall(this.onCaption,cue.text,cue);safeCall(this.onDuck,.35);this._emit();
    this.watchdog=setTimeout(()=>{if(this.current===ticket){this._error('MC đã bỏ một câu quá thời gian để theo kịp ván.');this._finish(ticket);}},45000);
    void this._play(ticket).catch(()=>{if(this.current===ticket){this._error('Không phát được giọng MC. Kịch bản vẫn hiện trên màn hình.');this._finish(ticket);}});
  }
  async _play(ticket){
    let response;
    try{
      if(!this.fetcher)throw new Error('No speech transport');
      this.fetchTimer=setTimeout(()=>ticket.abort.abort(),16000);
      response=await this.fetcher(this.ttsUrl,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({mode:this.mode,id:ticket.cue.id,eventId:ticket.cue.eventId,text:ticket.cue.text,voice:this.voice,rate:this.rate}),signal:ticket.abort.signal});
      if(this.current!==ticket)return;
      if([400,401,403,404,422].includes(response.status)){
        this._error(response.status===422?'MC đã bỏ nội dung không phù hợp.':'Câu MC chưa được server xác nhận.');this._finish(ticket);return;
      }
      if(!response.ok||!response.headers.get('content-type')?.startsWith('audio/'))throw new Error('Speech unavailable');
      const blob=await response.blob();if(!blob.size||blob.size>1_000_000)throw new Error('Invalid audio');
      if(this.current!==ticket)return;clearTimeout(this.fetchTimer);
      this.voiceUrl=URL.createObjectURL(blob);this.audio.src=this.voiceUrl;this.audio.volume=this.volume;
      this.audio.onended=()=>this._finish(ticket);
      this.audio.onerror=()=>{if(this.current===ticket&&!this._browserSpeak(ticket)){this._error('Không giải mã được giọng MC.');this._finish(ticket);}};
      this.provider=response.headers.get('x-tts-provider')||'online';await this.audio.play();if(this.current===ticket)this._emit();
    }catch(error){
      if(this.current!==ticket)return;clearTimeout(this.fetchTimer);
      if(error?.name==='NotAllowedError'){
        this.unlocked=false;this._error('Trình duyệt chặn tiếng MC. Bấm Bật MC trong nguồn game.');this._finish(ticket);return;
      }
      if(!this._browserSpeak(ticket)){this.provider='captions';this._error('Giọng trực tuyến chưa sẵn sàng; trình duyệt chưa có giọng tiếng Việt. Kịch bản vẫn hiện.');this._finish(ticket);}
    }
  }
  _browserSpeak(ticket){
    if(!this.browserFallback||this.current!==ticket)return false;
    const synth=this.env.speechSynthesis,Utterance=this.env.SpeechSynthesisUtterance;
    const voice=synth?.getVoices().find(value=>/^vi(?:[-_]|$)/i.test(value.lang||''));
    if(!voice||!Utterance)return false;
    this.audio.onended=this.audio.onerror=null;this.audio.pause();
    const speech=new Utterance(ticket.cue.text);this.utterance=speech;speech.voice=voice;speech.lang='vi-VN';speech.rate=this.rate;speech.volume=this.volume;
    speech.onend=()=>this._finish(ticket);speech.onerror=()=>{if(this.current===ticket){this._error('Giọng tiếng Việt của trình duyệt không phát được.');this._finish(ticket);}};
    this.provider='browser';this.error='';this._emit();synth.speak(speech);return true;
  }
  _finish(ticket){
    if(this.current!==ticket)return;
    clearTimeout(this.watchdog);clearTimeout(this.fetchTimer);ticket.abort.abort();
    this.audio.onended=this.audio.onerror=null;this.audio.pause();
    if(this.voiceUrl)URL.revokeObjectURL(this.voiceUrl);this.voiceUrl=null;
    if(this.utterance){this.utterance.onend=this.utterance.onerror=null;this.env.speechSynthesis?.cancel();this.utterance=null;}
    this.current=null;this.speaking=false;this.lastEnded=this.now();safeCall(this.onDuck,1);this._emit();this._pump();
  }
  stop({clearQueue=true}={}){clearTimeout(this.gapTimer);if(clearQueue)this.queue.clear();if(this.current)this._finish(this.current);this._emit();}
  dispose(){this.disposed=true;this.stop();this.channel?.close();void this.context?.close();}
}
