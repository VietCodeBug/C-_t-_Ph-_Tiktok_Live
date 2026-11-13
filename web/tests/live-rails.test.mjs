import test from 'node:test';
import assert from 'node:assert/strict';
import {leaderboardRows,giftRows} from '../src/live-rails.js';

test('empty real LIVE data never invents leaderboard players or gifts',()=>{
  assert.deepEqual(leaderboardRows({roster:[],waiting:[]}),[]);
  assert.deepEqual(giftRows({at:10,gifts:[]}),[]);
});
test('MONEY rail sorts actual active and waiting accounts, preserves server ranks and caps five rows',()=>{
  const source=Array.from({length:8},(_,i)=>({userId:`id-${i}`,seat:`P${i}`,name:`Tên ${i}`,money:i*100,rank:8-i}));
  const state={leaderboard:source};const before=JSON.stringify(state);
  const rows=leaderboardRows(state);
  assert.equal(rows.length,5);assert.deepEqual(rows.map(row=>row.money),[700,600,500,400,300]);assert.equal(rows[0].rank,1);
  assert.equal(JSON.stringify(state),before);
});
test('fallback ranks only registered roster data and removes duplicates or departed accounts',()=>{
  assert.deepEqual(leaderboardRows({roster:[{seat:'A',name:'A',money:10},{seat:'B',money:20,present:false}],waiting:[{seat:'A',money:10},{seat:'C',money:30}]}).map(row=>row.seat),['C','A']);
});
test('gift rail acknowledges every finalized gift type without inventing economic fields or duplicate receipts',()=>{
  const rows=giftRows({at:100,gifts:[{eventId:'old',name:'A',giftName:'Hoa',count:1,at:1},{eventId:'rose',name:'B',giftName:'Hoa hồng',count:2,at:99},{eventId:'rose',name:'B',giftName:'Hoa hồng',count:2,at:99},{eventId:'gift',name:'C',giftName:'Mũ',count:3,at:100},{eventId:'bad',count:0,at:100}]});
  assert.deepEqual(rows.map(row=>row.key),['gift','rose']);assert.equal(rows[0].giftName,'Mũ');assert.equal(rows[0].money,undefined);
});
test('gift freshness supports epoch input without depending on the browser clock in tests',()=>{
  assert.equal(giftRows({at:20,gifts:[{id:'epoch',count:1,at:1700000000000}]},{now:1700000001000}).length,1);
  assert.equal(giftRows({at:20,gifts:[{id:'epoch',count:1,at:1700000000000}]},{now:1700000070000}).length,0);
});
