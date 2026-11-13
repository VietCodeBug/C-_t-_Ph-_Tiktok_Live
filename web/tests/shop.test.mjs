import test from 'node:test';
import assert from 'node:assert/strict';
import { CommunityGame } from '../src/community.js';
import { LocalShop, SHOP_MC } from '../src/shop.js';

function fixture() {
  const game = new CommunityGame();
  for(let i=1;i<=100;i++)game.register(`P${String(i).padStart(3,'0')}`,{name:`Người ${i}`,seat:`P${String(i).padStart(3,'0')}`});
  const customerIds=[...game.accounts.keys()].slice(20);
  return {game,shop:new LocalShop(game),customerIds};
}

test('eight free customer orders with six returns leave host1000→950 without charging customers or inventory twice',()=>{
  const {game,shop,customerIds}=fixture();
  assert.ok(shop.open('P001',{customerIds}));
  assert.equal(game.accounts.get('P001').money,920);
  for(let i=0;i<8;i++)assert.equal(shop.order(customerIds[i],`order-${i}`),true);
  shop.tick(12);
  assert.equal(shop.snapshot().phase,'returns');
  for(let i=0;i<6;i++)assert.equal(shop.cancel(customerIds[i],`cancel-${i}`),true);
  shop.tick(12);
  assert.equal(shop.snapshot().phase,'settled');
  assert.equal(shop.snapshot().result.net,-50);
  assert.equal(shop.snapshot().result.settlementDelta,30);
  assert.equal(game.accounts.get('P001').money,950);
  assert.ok(customerIds.every(id=>game.accounts.get(id).money===1000));
  const ledger=game.ledger.length;
  shop.tick(999);
  assert.equal(game.ledger.length,ledger);
  assert.equal(game.ledger.filter(row=>row.id.endsWith(':inventory')).length,1);
  assert.equal(game.ledger.filter(row=>row.id.endsWith(':settlement')).length,1);
  assert.equal(game.snapshot().totals.conserved,true);
});

test('an empty shop loses only80 inventory; all eight returns lose120 and balances never go negative',()=>{
  for(const mode of ['empty','all-returned']){
    const {game,shop,customerIds}=fixture();
    game.setBalance('P001',mode==='empty'?1000:120,'Khởi tạo thử',`seed-${mode}`);
    shop.open('P001',{customerIds});
    if(mode==='all-returned')for(let i=0;i<8;i++)shop.order(customerIds[i],`order-${i}`);
    shop.tick(12);
    if(mode==='all-returned')for(let i=0;i<8;i++)shop.cancel(customerIds[i],`cancel-${i}`);
    shop.tick(12);
    assert.equal(game.accounts.get('P001').money,mode==='empty'?920:0);
    assert.equal(shop.snapshot().result.net,mode==='empty'?-80:-120);
    assert.equal(game.snapshot().totals.conserved,true);
  }
});

test('only snapshotted waiting customers can order once; active racers, host, cap overflow and repeated cancellation are rejected',()=>{
  const {game,shop,customerIds}=fixture();
  game.setBalance('P001',119,'Thiếu vốn','poor-host');
  assert.equal(shop.open('P001',{customerIds}),null);
  game.setBalance('P001',1000,'Đủ vốn','fund-host');
  shop.open('P001',{customerIds});
  assert.equal(shop.order('P001','host-order'),false);
  assert.equal(shop.order('P002','active-order'),false);
  assert.equal(shop.order('unknown','unknown-order'),false);
  assert.equal(shop.order(customerIds[0],'same-order'),true);
  assert.equal(shop.order(customerIds[0],'same-order'),false);
  assert.equal(shop.order(customerIds[0],'another-order'),false);
  for(let i=1;i<8;i++)shop.order(customerIds[i],`order-${i}`);
  assert.equal(shop.order(customerIds[8],'too-many'),false);
  assert.equal(shop.cancel(customerIds[0],'early-return'),false);
  shop.tick(12);
  assert.equal(shop.cancel(customerIds[8],'not-your-order'),false);
  assert.equal(shop.cancel(customerIds[0],'early-return'),false,'a rejected packet cannot replay in the later phase');
  assert.equal(shop.cancel(customerIds[0],'valid-return'),true);
  assert.equal(shop.cancel(customerIds[0],'repeat-return'),false);
  assert.equal(shop.order(customerIds[8],'late-order'),false);
  assert.equal(shop.snapshot().cancelled,1);
});

test('two windows follow game time, tick0 freezes, and only a settled shop can close',()=>{
  const {shop,customerIds}=fixture();
  shop.open('P001',{customerIds});
  assert.equal(shop.close(),false);
  const before=shop.snapshot();
  shop.tick(0);
  assert.deepEqual(shop.snapshot(),before);
  shop.tick(11.9);
  assert.equal(shop.snapshot().phase,'ordering');
  shop.tick(.2);
  assert.equal(shop.snapshot().phase,'returns');
  assert.ok(shop.snapshot().remainingSeconds<12);
  shop.tick(12);
  assert.equal(shop.snapshot().phase,'settled');
  assert.equal(shop.close(),true);
  assert.equal(shop.close(),false);
  assert.equal(shop.snapshot().phase,'closed');
  assert.ok(shop.open('P001',{customerIds}));
  shop.tick(24);
  assert.equal(shop.snapshot().phase,'settled');
  assert.throws(()=>shop.tick(-1),/shop time/);
  for(const text of Object.values(SHOP_MC))assert.ok(text.length>10);
});

test('explicit manual abort refunds inventory exactly once and never changes customer wallets',()=>{
  const {game,shop,customerIds}=fixture();
  shop.open('P001',{customerIds});
  shop.order(customerIds[0],'one-order');
  assert.equal(shop.cancelOpen(),true);
  assert.equal(shop.snapshot().phase,'closed');
  assert.equal(shop.snapshot().result.cancelledByControl,true);
  assert.equal(game.accounts.get('P001').money,1000);
  assert.equal(shop.cancelOpen(),false);
  assert.ok(customerIds.every(id=>game.accounts.get(id).money===1000));
  assert.equal(game.snapshot().totals.conserved,true);
});
