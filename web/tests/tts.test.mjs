import test from 'node:test';
import assert from 'node:assert/strict';
import {createTTSService,createOnlineSpeechProvider,splitSpeechText,validateTTS,escapeSpeechXml} from '../server/tts.mjs';

test('TTS validates text, Vietnamese voices, speed and moderation before any provider call',()=>{
  assert.deepEqual(validateTTS({text:'  Bé Két\nđã sẵn sàng. '}),{text:'Bé Két đã sẵn sàng.',voice:'vi-VN-HoaiMyNeural',rate:1.06});
  assert.equal(validateTTS({text:'Xin chào.',voice:'male',rate:1.1}).voice,'vi-VN-NamMinhNeural');
  for(const input of [null,[],{}, {text:''},{text:'a'.repeat(601)},{text:'Xin chào',voice:'en-US-GuyNeural'},{text:'Xin chào',voice:'constructor'},{text:'Xin chào',rate:9}])assert.throws(()=>validateTTS(input),error=>error.status===400);
  for(const text of ['d.m','https://example.com','con đĩ'])assert.throws(()=>validateTTS({text}),error=>error.status===422);
  assert.equal(escapeSpeechXml('<voice name="x">A&B</voice>'), '&lt;voice name=&quot;x&quot;&gt;A&amp;B&lt;/voice&gt;');
});

test('simultaneous identical cues share a provider request and subsequent calls use bounded cache',async()=>{
  let count=0,resolve;const service=createTTSService({provider:()=>{count++;return new Promise(done=>{resolve=done;});}});
  const a=service.synthesizeTTS({text:'Khu phố đã mở cửa.'}),b=service.synthesizeTTS({text:'Khu phố đã mở cửa.'});
  assert.equal(count,1);resolve(Buffer.from('audio-test'));
  const [one,two]=await Promise.all([a,b]);assert.deepEqual(one.buffer,two.buffer);
  const cached=await service.synthesizeTTS({text:'Khu phố đã mở cửa.'});assert.equal(cached.cacheHit,true);assert.equal(count,1);
});

test('aborting one HTTP waiter never cancels another waiter for the same canonical cue',async()=>{
  let resolve;const service=createTTSService({provider:()=>new Promise(done=>{resolve=done;})});
  const abort=new AbortController(),a=service.synthesizeTTS({text:'Bạn đã về đích.',signal:abort.signal}),b=service.synthesizeTTS({text:'Bạn đã về đích.'});
  const rejected=assert.rejects(a,error=>error.status===499);abort.abort();await rejected;
  resolve(Buffer.from('audio-test'));assert.equal((await b).buffer.length,10);
});

test('provider concurrency, waiting capacity and request rate stay bounded',async()=>{
  let active=0,peak=0;const release=[];
  const service=createTTSService({maxConcurrent:2,maxWaiting:1,provider:()=>{active++;peak=Math.max(peak,active);return new Promise(resolve=>release.push(()=>{active--;resolve(Buffer.from('audio'));}));}});
  const jobs=[1,2,3,4].map(i=>service.synthesizeTTS({text:`Ô số ${i}.`}));const all=Promise.allSettled(jobs);
  assert.equal(service.status().active,2);assert.equal(service.status().waiting,1);
  release.shift()();await new Promise(resolve=>setImmediate(resolve));while(release.length)release.shift()();
  const results=await all;assert.equal(peak,2);assert.equal(results.filter(row=>row.status==='fulfilled').length,3);
  assert.equal(results.find(row=>row.status==='rejected').reason.status,429);
  const limited=createTTSService({maxStarts:1,provider:async()=>Buffer.from('audio')});
  await limited.synthesizeTTS({text:'Câu đầu.'});
  await assert.rejects(limited.synthesizeTTS({text:'Câu kế.'}),error=>error.code==='TTS_RATE_LIMIT');
  assert.equal((await limited.synthesizeTTS({text:'Câu đầu.'})).cacheHit,true);
});

test('upstream failures and oversized audio are not cached or exposed as provider internals',async()=>{
  for(const provider of [async()=>{throw new Error('private upstream detail');},async()=>Buffer.alloc(1_000_001)]){
    const service=createTTSService({provider});
    await assert.rejects(service.synthesizeTTS({text:'Bé Két đang chờ.'}),error=>error.status===503&&!error.message.includes('private'));
    assert.equal(service.status().cacheEntries,0);
  }
});

test('offline Edge uses Vietnamese fallback, opens a120s circuit and retries Edge after cooldown',async()=>{
  let now=1000,edgeCalls=0,fallbackCalls=0,edgeOnline=false;
  const provider=createOnlineSpeechProvider({now:()=>now,edge:async()=>{edgeCalls++;if(!edgeOnline)throw new Error('offline');return Buffer.from('edge');},fallback:async()=>{fallbackCalls++;return Buffer.from('google');}});
  assert.equal((await provider({text:'Câu đầu.'})).provider,'google');assert.equal(edgeCalls,1);
  now+=1000;assert.equal((await provider({text:'Câu tiếp.'})).provider,'google');assert.equal(edgeCalls,1);assert.equal(fallbackCalls,2);
  now+=120000;edgeOnline=true;assert.equal((await provider({text:'Câu mới.'})).provider,'edge');assert.equal(edgeCalls,2);
  const text='Bé Két dẫn cả phố chơi vui. '.repeat(12).trim();
  const parts=splitSpeechText(text);assert.ok(parts.length>1);assert.ok(parts.every(part=>part.length<=175));assert.equal(parts.join(' '),text);
});
