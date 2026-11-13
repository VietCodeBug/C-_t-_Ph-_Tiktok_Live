// IDs verified against the provider's gift catalog; coin labels are display
// metadata and never determine a gift's identity or its game rule.
export const GIFT_CATALOG = Object.freeze([
  { key:'rose',label:'Hoa hồng',name:'Rose',coins:1,giftIds:['5655'],aliases:['rose','hoa hong'],effect:'priority',description:'Ưu tiên lần lắc hợp lệ kế tiếp; tối đa hai lượt chờ.' },
  { key:'heart-me',label:'Heart Me',name:'Heart Me',coins:1,giftIds:['7934'],aliases:['heart me','heartme'],effect:'pulse',description:'Hiệu ứng trái tim, không đổi MONEY.' },
  { key:'donut',label:'Bánh Donut',name:'Doughnut',coins:30,giftIds:['5879'],aliases:['doughnut','donut','banh donut'],effect:'confetti',description:'Mưa giấy sắc màu, không đổi MONEY.' },
  { key:'hand-heart',label:'Tim bàn tay',name:'Hand Heart',coins:100,giftIds:['5660','5924'],aliases:['hand heart','handheart','tim ban tay'],effect:'red-envelope',description:'Lì xì MONEY cả phố; xếp hàng nếu bận, tối đa một quỹ mỗi 30 giây.' },
  { key:'hearts',label:'Hearts',name:'Hearts',coins:199,giftIds:['5586'],aliases:['hearts'],effect:'trail',description:'Dải tim quanh người tặng, không đổi MONEY.' },
  { key:'corgi',label:'Corgi',name:'Corgi',coins:299,giftIds:['6267'],aliases:['corgi'],effect:'pet',description:'Corgi ghé chào, không đổi MONEY.' },
  { key:'money-gun',label:'Súng tiền',name:'Money Gun',coins:500,giftIds:['7168'],aliases:['money gun','moneygun','sung tien'],effect:'spotlight',description:'Vệt sáng ăn mừng, không đổi MONEY.' },
].map(item=>Object.freeze({...item,ids:item.giftIds,icon:`/runtime/gifts/${item.key}.webp`,giftIds:Object.freeze(item.giftIds),aliases:Object.freeze(item.aliases)})));

export const normalizeGiftName = value => String(value??'').normalize('NFKD').replace(/\p{M}/gu,'').replace(/đ/gi,'d').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function resolveGift(input={}, {roseIds=[]}={}) {
  const id=String(input.giftId??input.id??''),name=normalizeGiftName(input.giftName??input.name);
  if(roseIds.map(String).includes(id))return GIFT_CATALOG[0];
  return GIFT_CATALOG.find(gift=>gift.giftIds.includes(id))
    ||GIFT_CATALOG.find(gift=>gift.aliases.some(alias=>normalizeGiftName(alias)===name))||null;
}
