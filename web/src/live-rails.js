// The broadcast rails only present verified room data. They never create
// players, gift rewards or local leaderboard balances.
export function leaderboardRows(state, limit = 5) {
  const source=Array.isArray(state?.leaderboard)?state.leaderboard:[...(state?.roster||[]),...(state?.waiting||[])];
  const seen=new Set();
  return source.filter(row=>{
    const id=String(row?.userId||row?.id||row?.seat||'');
    if(!id||seen.has(id)||row.present===false||row.enrolled===false)return false;
    seen.add(id);return true;
  }).map((row,index)=>({...row,name:String(row.name||row.nickname||row.seat||''),money:Math.max(0,Number(row.money)||0),order:index}))
    .sort((a,b)=>b.money-a.money||a.order-b.order)
    .slice(0,Math.max(0,limit)).map((row,index)=>({...row,rank:Number.isInteger(row.rank)&&row.rank>0?row.rank:index+1}));
}

export function giftRows(state,{limit=4,maxAgeSeconds=60,now=Date.now()}={}) {
  const seen=new Set();
  return (Array.isArray(state?.gifts)?state.gifts:[]).map((row,index)=>({...row,order:index})).filter(row=>{
    const id=String(row.eventId||row.id||'');
    const age=Number(row.at)>1e12?(now-Number(row.at))/1000:Number(state?.at||0)-Number(row.at||0);
    if(!id||seen.has(id)||!Number.isSafeInteger(row.count)||row.count<=0||age>maxAgeSeconds||age< -5)return false;
    seen.add(id);return true;
  }).sort((a,b)=>Number(b.at)-Number(a.at)||a.order-b.order).slice(0,Math.max(0,limit))
    .map(row=>({...row,key:String(row.eventId||row.id),name:String(row.name||row.seat||'Khách ghé phố'),giftName:String(row.giftName||'Quà tặng')}));
}
