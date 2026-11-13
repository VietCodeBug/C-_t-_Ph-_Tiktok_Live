import test from 'node:test';
import assert from 'node:assert/strict';
import {LiveAudio} from '../src/live-audio.js';

const turn=()=>new Promise(resolve=>setImmediate(resolve));
class FakeAudio {constructor(){this.plays=0;this.volume=1;}play(){this.plays++;return Promise.resolve();}pause(){this.paused=true;}}
const cue={id:'match-1-result-1',eventId:'GAIN01',text:'Mai nhận 100 MONEY.',priority:3};

test('MC waits for a user unlock, sends only a canonical cue and restores ducking after playback',async()=>{
  const packets=[],ducks=[],captions=[],media=new FakeAudio();
  const audio=new LiveAudio({env:{},audio:media,gapMs:0,onDuck:gain=>ducks.push(gain),onCaption:text=>captions.push(text),fetch:async(url,options)=>{
    packets.push(JSON.parse(options.body));return new Response(new Blob(['mp3'],{type:'audio/mpeg'}),{headers:{'Content-Type':'audio/mpeg'}});
  }});
  try{
    assert.equal(audio.enqueue({...cue,eventId:'CHAT'}),false);assert.equal(audio.enqueue(cue),true);assert.equal(packets.length,0);assert.equal(captions.at(-1),cue.text);
    await audio.unlock();await turn();assert.equal(packets.length,1);assert.equal(packets[0].id,cue.id);assert.equal(packets[0].mode,'live');
    assert.equal(audio.status.speaking,true);assert.equal(ducks.at(-1),.35);
    media.onended();assert.equal(audio.status.speaking,false);assert.equal(ducks.at(-1),1);
    assert.equal(audio.enqueue(cue),false);
  }finally{audio.dispose();}
});

test('moderation denial never falls back to browser speech, while service failure may use installed Vietnamese voice',async()=>{
  for(const status of [422,503]){
    let spoken=0;const media=new FakeAudio();const synth={getVoices:()=>[{lang:'vi-VN'}],speak:()=>{spoken++;},cancel(){}};
    const audio=new LiveAudio({audio:media,gapMs:0,env:{speechSynthesis:synth,SpeechSynthesisUtterance:class{constructor(text){this.text=text;}}},fetch:async()=>new Response('',{status})});
    try{await audio.unlock();audio.enqueue({...cue,id:`cue-${status}`});await turn();assert.equal(spoken,status===503?1:0);if(status===503)assert.equal(audio.status.provider,'browser');}
    finally{audio.dispose();}
  }
});

test('DEMO and LIVE have separate audio ownership and configured voice rates stay within server bounds',()=>{
  const names=[];class Channel{constructor(name){names.push(name);}close(){}}
  const env={window:{},BroadcastChannel:Channel};
  const live=new LiveAudio({mode:'live',env,audio:new FakeAudio()}),demo=new LiveAudio({mode:'demo',env,audio:new FakeAudio()});
  try{assert.notEqual(names[0],names[1]);assert.match(names[0],/-live$/);assert.match(names[1],/-demo$/);
    live.configure({voice:'vi-VN-NamMinhNeural',rate:9,volume:.4});assert.equal(live.voice,'male');assert.equal(live.rate,1.25);assert.equal(live.volume,.4);
    live.setRate(.1);assert.equal(live.rate,.8);
  }finally{live.dispose();demo.dispose();}
});
