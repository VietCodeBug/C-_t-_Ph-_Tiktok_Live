import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {LiveMusic} from '../src/live-music.js';
import {LiveAudio} from '../src/live-audio.js';

const turn=()=>new Promise(resolve=>setImmediate(resolve));
class Media{constructor(){this.plays=0;this.pauses=0;this.volume=1;}play(){this.plays++;return Promise.resolve();}pause(){this.pauses++;}load(){this.loads=(this.loads||0)+1;}}
// Playback mechanics use an explicit synthetic playlist, independent of the
// real game's single Alt Take song and without reading/playing audio files.
const playlist=[{name:'Synthetic A',url:'music/test-loop-a.m4a'},{name:'Synthetic B',url:'music/test-loop-b.m4a'}];
class Channel{constructor(name){this.name=name;}postMessage(){}close(){}}

test('default music is the original single Alt Take, with unchanged bytes and single-track replay',async()=>{
  const manifest=JSON.parse(await fs.readFile(new URL('../../assets/audio/music/playlist.json',import.meta.url),'utf8'));
  assert.equal(manifest.tracks.length,1);
  const [track]=manifest.tracks;
  assert.equal(track.name,'Cờ Tý Phí LIVE Theme (Alt Take)');
  assert.equal(track.url,'music/co-ty-phi-live-theme-alt-take.m4a');
  assert.equal(track.source,'assets/co-ty-phu/audio/Cờ Tý Phí LIVE Theme (Alt Take).m4a');
  assert.equal(manifest.sourceKind,'user-supplied-game-audio');assert.equal(manifest.sourceCommit,null);
  const packaged=await fs.readFile(new URL('../../assets/audio/music/'+track.url.slice('music/'.length),import.meta.url));
  const digest=data=>createHash('sha256').update(data).digest('hex');
  // This verified source digest catches a wrong replacement without making a
  // fresh checkout depend on the ignored, duplicate Unicode-named source file.
  assert.equal(track.bytes,3455260);assert.equal(packaged.length,track.bytes);
  assert.equal(track.sha256,'958513f7c2698fd573abfe59447f32efefcb379b44e7a3b603d34bd98e39547f');
  assert.equal(digest(packaged),track.sha256);
  const media=new Media(),music=new LiveMusic({audio:media,env:{}});
  try{assert.equal(media.plays,0);assert.equal(music.status.trackCount,1);assert.equal(music.status.track,'/runtime/'+track.url);
    music.configure({playlist:manifest.tracks});assert.equal(music.status.trackName,track.name);
    await music.unlock();media.onended();await turn();
    assert.equal(music.status.index,0);assert.equal(music.status.playing,true);assert.equal(music.status.track,'/runtime/'+track.url);assert.equal(media.plays,2);
  }finally{music.dispose();}
});

test('music waits for a gesture, plays manifest tracks in order and wraps when the playlist ends',async()=>{
  const media=new Media(),music=new LiveMusic({playlist,audio:media,env:{}});
  try{assert.equal(media.plays,0);assert.equal(media.preload,'none');music.configure({volume:.2});assert.equal(media.plays,0);
    assert.equal(await music.unlock(),true);assert.equal(music.status.playing,true);assert.equal(music.status.index,0);
    media.onended();await turn();assert.equal(music.status.index,1);assert.match(media.src,/test-loop-b\.m4a$/);
    media.onended();await turn();assert.equal(music.status.index,0);assert.match(media.src,/test-loop-a\.m4a$/);
  }finally{music.dispose();}
});
test('ducking restores the configured volume and muted music can be primed without enabling it',async()=>{
  const media=new Media(),music=new LiveMusic({playlist,audio:media,env:{},enabled:false});
  try{await music.unlock();assert.equal(music.status.enabled,false);assert.equal(music.status.playing,false);
    music.configure({musicEnabled:true,musicVolume:.2});await turn();assert.equal(media.volume,.2);
    music.setDucking(true);assert.equal(media.volume,.05);music.configure({musicVolume:.4});assert.equal(media.volume,.1);
    music.setDucking(false);assert.equal(media.volume,.4);music.configure({musicEnabled:false});assert.equal(music.status.playing,false);assert.equal(media.volume,0);
  }finally{music.dispose();}
});
test('blocked autoplay is retried by a new gesture and missing tracks do not create an endless skip loop',async()=>{
  const media=new Media();let blocked=true;media.play=()=>{media.plays++;return blocked?Promise.reject(Object.assign(new Error('blocked'),{name:'NotAllowedError'})):Promise.resolve();};
  const music=new LiveMusic({playlist,audio:media,env:{}});
  try{assert.equal(await music.unlock(),false);assert.equal(music.status.blocked,true);assert.equal(music.status.unlocked,false);
    blocked=false;assert.equal(await music.unlock(),true);media.onerror();await turn();assert.equal(music.status.index,1);
    media.onerror();await turn();const attempts=media.plays;assert.equal(music.status.playing,false);assert.match(music.status.error,/nhạc nền/);
    await turn();assert.equal(media.plays,attempts);
  }finally{music.dispose();}
});
test('same-mode music owner cannot be silently reclaimed by configuration; DEMO uses a different channel',async()=>{
  const env={window:{},BroadcastChannel:Channel},music=new LiveMusic({mode:'live',playlist,audio:new Media(),env}),demo=new LiveMusic({mode:'demo',playlist,audio:new Media(),env});
  try{assert.notEqual(music.channel.name,demo.channel.name);await music.unlock();music.channel.onmessage({data:{owner:'other-tab'}});
    music.configure({musicEnabled:true,musicVolume:.14});await turn();assert.equal(music.status.playing,false);assert.equal(music.status.blockedByOtherTab,true);
    await music.unlock();assert.equal(music.status.playing,true);assert.equal(music.status.blockedByOtherTab,false);
  }finally{music.dispose();demo.dispose();}
});
test('MC master mute survives shared unlock and neither music nor MC mute changes the other media element',async()=>{
  const bg=new Media(),voice=new Media(),music=new LiveMusic({playlist,audio:bg,env:{}});let requests=0;
  const mc=new LiveAudio({audio:voice,env:{},gapMs:0,fetch:async()=>{requests++;return new Response(new Blob(['mp3'],{type:'audio/mpeg'}),{headers:{'Content-Type':'audio/mpeg'}});}});
  try{mc.configure({enabled:false});mc.enqueue({id:'mute-test',eventId:'SYSTEM',text:'Khu phố đã sẵn sàng.',priority:2});
    const first=mc.unlock(),second=music.unlock();await Promise.all([first,second]);await turn();assert.equal(requests,0);assert.equal(mc.status.enabled,false);assert.equal(music.status.playing,true);
    mc.configure({enabled:true});await turn();assert.equal(requests,1);assert.equal(mc.status.speaking,true);
    music.configure({musicEnabled:false});assert.equal(mc.status.speaking,true);assert.equal(music.status.playing,false);
    mc.configure({enabled:false});music.configure({musicEnabled:true});await turn();assert.equal(mc.status.speaking,false);assert.equal(music.status.playing,true);
  }finally{mc.dispose();music.dispose();}
});
test('enabling MC settings does not reclaim a tab muted by another owner',async()=>{
  const mc=new LiveAudio({audio:new Media(),env:{window:{},BroadcastChannel:Channel}});
  try{await mc.unlock();mc.channel.onmessage({data:{owner:'other-tab'}});mc.configure({enabled:true});assert.equal(mc.status.enabled,false);assert.equal(mc.status.blockedByOtherTab,true);
    await mc.unlock();assert.equal(mc.status.enabled,true);assert.equal(mc.status.blockedByOtherTab,false);assert.equal(mc.status.error,'');
  }finally{mc.dispose();}
});
