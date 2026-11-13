import {GIFT_CATALOG,resolveGift} from './gift-catalog.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const ORDER=['money-gun','corgi','hearts','hand-heart','donut','heart-me','rose'];
const ACTIONS={'money-gun':'Vệt sáng vui',corgi:'Corgi ghé phố',hearts:'Dải tim','hand-heart':'Lì xì cả map',donut:'Pháo giấy','heart-me':'Tim vui',rose:'Ưu tiên lắc'};
const local=(key,base='/runtime/')=>`${String(base).replace(/\/?$/,'/')}gifts/${key}.webp`;
export function safeGiftIconURL(value){
  try{
    const url=new URL(value),host=url.hostname.toLowerCase();
    if(url.protocol!=='https:'||url.username||url.password||url.port)return '';
    return ['tiktokcdn.com','tiktokcdn-us.com','tiktokcdn-eu.com','byteoversea.com','byteimg.com'].some(domain=>host===domain||host.endsWith('.'+domain))?url.href:'';
  }catch{return '';}
}
function knownGift(row={}){
  const key=row.giftKey||row.key;
  return GIFT_CATALOG.find(gift=>gift.key===key)||resolveGift({giftId:row.giftId,giftName:row.giftName})||null;
}
export function giftIconFor(row={}, {base='/runtime/'}={}){
  const remote=safeGiftIconURL(row.giftIcon||row.iconUrl||row.giftPictureUrl||row.imageUrl);
  const gift=knownGift(row);
  return remote||(gift?local(gift.key,base):`${String(base).replace(/\/?$/,'/')}gifts/unknown.svg`);
}
function iconHTML(row,{base='/runtime/',label=''}={}){
  const gift=knownGift(row),fallback=gift?local(gift.key,base):`${String(base).replace(/\/?$/,'/')}gifts/unknown.svg`;
  return `<img class="gift-icon" src="${esc(giftIconFor(row,{base}))}" data-gift-fallback="${esc(fallback)}" alt="${esc(label||gift?.name||'Quà TikTok')}" width="40" height="40" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
}
export function giftGuideHTML({catalog=GIFT_CATALOG,base='/runtime/'}={}){
  const rows=ORDER.map(key=>catalog.find(gift=>gift.key===key)||GIFT_CATALOG.find(gift=>gift.key===key));
  return `<section class="gift-guide" data-testid="gift-guide" aria-label="Quà và hiệu ứng khu phố"><h3>QUÀ & HIỆU ỨNG</h3><ol>${rows.map(gift=>`<li class="gift-guide-row" data-gift-key="${esc(gift.key)}" title="${esc(gift.description)}">${iconHTML(gift,{base,label:gift.name})}<div><strong>${esc(gift.name)}</strong><small>${esc(ACTIONS[gift.key])}</small></div><b class="gift-guide-coins"><i aria-hidden="true"></i>${Number.isFinite(gift.coins)?Math.max(0,Math.round(gift.coins)):'—'}</b></li>`).join('')}</ol><p class="gift-guide-note">Chơi miễn phí · quà tùy ý</p></section>`;
}
export function giftReceiptHTML(row,{base='/runtime/'}={}){
  const gift=knownGift(row),name=row.name||row.seat||'Khách ghé phố',giftName=row.giftName||gift?.name||'Quà TikTok';
  const count=Number.isSafeInteger(row.count)&&row.count>0?row.count:1;
  return `<li class="gift-receipt" data-gift="${esc(row.giftId||'')}" title="${esc(name)} · ${esc(giftName)} ×${count}">${iconHTML(row,{base,label:giftName})}<div><strong>${esc(name)}</strong><span>${esc(giftName)} <b>×${count}</b></span></div></li>`;
}
export function bindGiftImageFallback(container){
  const onError=event=>{
    const image=event.target;if(!image?.matches?.('img.gift-icon'))return;
    const fallback=image.dataset.giftFallback;
    if(fallback&&!image.dataset.giftFallbackUsed){image.dataset.giftFallbackUsed='true';image.src=fallback;}
    else image.hidden=true;
  };
  container.addEventListener('error',onError,true);return ()=>container.removeEventListener('error',onError,true);
}
