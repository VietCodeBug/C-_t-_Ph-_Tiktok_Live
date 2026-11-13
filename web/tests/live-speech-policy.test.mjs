import test from 'node:test';
import assert from 'node:assert/strict';
import {speechAllowed,sanitizeWelcomeName,buildWelcomeCue,normalizeMCCue,SpeechCueQueue} from '../src/live-speech-policy.js';

const cue=(id,text,priority=1,extras={})=>({id,eventId:'RACE',text,priority,...extras});
test('speech moderation rejects abusive aliases while preserving Vietnamese names and game instructions',()=>{
  for(const text of ['d.m','D C M','f.u.c.k','con đĩ'])assert.equal(speechAllowed(text),false,text);
  for(const text of ['Các bạn cùng đi tiếp nhé.','Đào Tóc Dài','Đàm Minh','Mai Tiến','Cả phố nhận 100 MONEY.'])assert.equal(speechAllowed(text),true,text);
  assert.equal(sanitizeWelcomeName('  @Đào Mai  '),'Đào Mai');
  for(const name of ['d.m','<voice>Xin chào</voice>','https://example.com','😀😀', 'a'.repeat(81)])assert.equal(sanitizeWelcomeName(name),null);
});
test('greeting batches deduplicate accounts, read at most three safe names and replace offensive names',()=>{
  const greeting=buildWelcomeCue([{id:'a',name:'Mai'},{id:'a',name:'Mai'},{id:'b',name:'Đào'},{id:'c',name:'Tiến'},{id:'d',name:'d.m'},{id:'e',name:'Nam'}],{id:'welcome-1',now:1000});
  assert.equal(greeting.eventId,'WELCOME');assert.match(greeting.text,/Mai, Đào, Tiến và 2 bạn mới/);assert.ok(!greeting.text.includes('d.m'));
  assert.match(buildWelcomeCue([{id:'bad',name:'d.m'}]).text,/những bạn mới/);
});
test('MC admission refuses raw comments, invalid templates and expired packets',()=>{
  const now=1_800_000_000_000;
  for(const value of ['raw chat',cue('comment-1','Xin chào',1,{eventId:'CHAT'}),cue('x','Xin chào',1,{category:'comment'}),cue('x','Xin chào',1,{category:'game',type:'chat.message'}),cue('x','Xin chào',1,{rawChat:true}),cue('x','https://example.com'),cue('x','Câu cũ',1,{createdAt:now-20000,ttlMs:10000})])assert.equal(normalizeMCCue(value,now),null);
  assert.equal(normalizeMCCue(cue('gain-1','  Nhận\n100 MONEY! ',3),now).text,'Nhận 100 MONEY!');
});
test('speech queue prioritizes results, caps backlog and drops duplicate or stale cues',()=>{
  let now=1_800_000_000_000;const queue=new SpeechCueQueue({now:()=>now,limit:2});
  assert.ok(queue.add(cue('greet','Chào Mai!',1)));
  assert.ok(queue.add(cue('guide','Gõ LẮC nhé.',0)));
  assert.ok(queue.add(cue('finish','Mai về đích!',3)));
  assert.equal(queue.size,2);assert.equal(queue.take().id,'finish');
  assert.equal(queue.add(cue('greet','Một câu khác.',1)),false);
  assert.equal(queue.add(cue('new-id','Chào Mai!',1)),false);
  now+=16000;assert.equal(queue.take(),null);
});
test('new greeting batches have a cooldown while committed money results remain eligible',()=>{
  let now=1_800_000_000_000;const queue=new SpeechCueQueue({now:()=>now});
  assert.ok(queue.add(buildWelcomeCue([{id:'a',name:'Mai'}],{id:'w1',now})));
  now+=1000;assert.equal(queue.add(buildWelcomeCue([{id:'b',name:'Đào'}],{id:'w2',now})),false);
  assert.ok(queue.add(cue('money-1','Đào nhận 100 MONEY.',3)));
  now+=8000;assert.ok(queue.add(buildWelcomeCue([{id:'b',name:'Đào'}],{id:'w3',now})));
});
