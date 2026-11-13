import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {giftGuideHTML,giftIconFor,giftReceiptHTML,safeGiftIconURL,bindGiftImageFallback} from '../src/live-gift-guide.js';

test('seven imported icons retain the exact official CDN bytes and provenance',async()=>{
  const source=new URL('../../assets/ui/tiktok-gifts/',import.meta.url);
  const manifest=JSON.parse(await fs.readFile(new URL('manifest.json',source),'utf8'));
  assert.equal(manifest.gifts.length,7);assert.equal(new Set(manifest.gifts.map(gift=>gift.key)).size,7);
  for(const gift of manifest.gifts){
    const bytes=await fs.readFile(new URL(gift.file,source));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),gift.sha256,gift.key);assert.equal(bytes.length,gift.bytes);
    assert.ok(safeGiftIconURL(gift.sourceUrl));assert.equal(bytes.subarray(0,4).toString(),'RIFF');assert.equal(bytes.subarray(8,12).toString(),'WEBP');
  }
});
test('the guide shows seven named gift images and coin metadata without wallet or USD prompts',()=>{
  const html=giftGuideHTML();
  assert.equal((html.match(/class="gift-guide-row"/g)||[]).length,7);assert.equal((html.match(/class="gift-icon"/g)||[]).length,7);
  assert.ok(html.indexOf('data-gift-key="money-gun"')<html.indexOf('data-gift-key="rose"'));
  assert.match(html,/Heart Me/);assert.ok(!html.includes('Hear Me Out'));assert.ok(!html.includes('USD'));
  assert.match(html,/Lì xì cả map/);assert.match(html,/Ưu tiên lắc/);assert.ok(!html.includes('onerror='));
});
test('gift icons use exact identity, never sender names or coin price, and reject hostile image URLs',()=>{
  assert.equal(giftIconFor({giftId:'7168'}),'/runtime/gifts/money-gun.webp');
  assert.equal(giftIconFor({giftId:'unknown',giftName:'Not Money Gun',diamondCount:500,name:'Rose'}),'/runtime/gifts/unknown.svg');
  assert.equal(giftIconFor({giftId:'5655',giftName:'Corgi'}),'/runtime/gifts/rose.webp');
  const cdn='https://p16-webcast.tiktokcdn.com/img/a.webp';assert.equal(giftIconFor({giftId:'5655',giftIcon:cdn}),cdn);
  for(const bad of ['javascript:alert(1)','data:image/png;base64,xxx','http://p16-webcast.tiktokcdn.com/a.webp','https://tiktokcdn.com.evil.example/a.webp','https://user:pass@p16-webcast.tiktokcdn.com/a.webp']){
    assert.equal(safeGiftIconURL(bad),'');assert.equal(giftIconFor({giftId:'5655',giftIcon:bad}),'/runtime/gifts/rose.webp');
  }
});
test('receipt text stays escaped and image errors switch to local fallback only once',()=>{
  const html=giftReceiptHTML({giftId:'5655',giftName:'Rose',count:3,name:'<img src=x onerror=alert(1)>'});
  assert.match(html,/&lt;img/);assert.ok(!html.includes('<img src=x'));assert.match(html,/×3/);
  let listener,removed=false;const container={addEventListener(type,fn,capture){assert.equal(type,'error');assert.equal(capture,true);listener=fn;},removeEventListener(){removed=true;}};
  const dispose=bindGiftImageFallback(container),image={matches:()=>true,dataset:{giftFallback:'/runtime/gifts/rose.webp'},src:'https://p16-webcast.tiktokcdn.com/expired.webp'};
  listener({target:image});assert.equal(image.src,'/runtime/gifts/rose.webp');listener({target:image});assert.equal(image.hidden,true);dispose();assert.equal(removed,true);
});
