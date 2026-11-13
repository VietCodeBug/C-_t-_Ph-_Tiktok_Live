const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = value => Math.round(value || 0).toLocaleString('vi-VN');

export class CommunityView {
  constructor(controller, portrait, controlsParent) {
    this.controller = controller; this.portrait = portrait;
    this.panel = document.createElement('section'); this.panel.className='community-panel'; this.panel.hidden=true; portrait.append(this.panel);
    this.hearts = document.createElement('div'); this.hearts.className='hearts-banner'; this.hearts.hidden=true; portrait.append(this.hearts);
    this.mc = document.createElement('div'); this.mc.className='mc-caption'; portrait.append(this.mc);
    this.podium = document.createElement('section'); this.podium.className='race-podium'; this.podium.hidden=true; portrait.append(this.podium);
    this.controls = document.createElement('details'); this.controls.className='community-controls'; this.controls.open=true;
    this.controls.innerHTML=`<summary>THỬ BÌNH LUẬN & SỰ KIỆN CHUNG</summary><p class='simulation-label'>Tài khoản và lệnh mô phỏng local</p><select aria-label='Người gửi lệnh' class='sender-select' data-testid='community-sender'>${[...controller.game.accounts.values()].map(p=>`<option value='${esc(p.id)}'>${esc(p.id)} · ${esc(p.name)}</option>`).join('')}</select><form class='comment-form'><input aria-label='Bình luận thử' placeholder='GÓP / MUA P001 / BOM P001 / LẮC'><button type='submit'>Gửi</button></form><div class='community-actions'><button data-community='like'>♥ +10 tim</button><button data-community='rose'>✿ Hoa hồng thử</button><button data-community='startup'>Mở startup</button><button data-community='envelope'>Mở lì xì</button></div><div class='batch-actions'><button data-community='join-all'>${controller.game.accounts.size} người góp</button><button data-community='hearts-all'>Cả phố thả tim</button></div><div class='shop-simulation-actions'><button data-community='shop' data-action='shop-open' data-testid='shop-open'>Mở quầy</button><button data-community='shop-orders' data-action='shop-eight-orders' data-testid='shop-eight-orders'>8 khách đặt đơn</button><button data-community='shop-cancels' data-action='shop-six-cancels' data-testid='shop-six-cancels'>6 khách tự hủy</button></div><small class='community-notice'></small><div class='priority-queue'></div>`;
    controlsParent.append(this.controls);
    this.controls.querySelector('.sender-select').onchange=e=>{controller.selectedId=e.target.value;};
    this.controls.querySelector('form').onsubmit=e=>{e.preventDefault();const input=e.target.querySelector('input');controller.comment(controller.selectedId,input.value);input.value='';};
    this.controls.onclick=e=>{
      const action=e.target.closest('[data-community]')?.dataset.community;if(!action)return;
      controller.demo.setPaused(false);
      if(action==='like')controller.like();
      if(action==='rose'){controller.rose();const index=controller.demo.players.findIndex(p=>p.seat===controller.selectedId);if(index>=0)controller.demo.select(index);}
      if(action==='startup')controller.openInvestment(controller.demo.active);
      if(action==='envelope')controller.openEnvelope();
      if(action==='join-all')controller.simulateJoins();
      if(action==='hearts-all')controller.simulateHearts();
      if(action==='shop')controller.openShop(controller.demo.active);
      if(action==='shop-orders')controller.simulateOrders(8);
      if(action==='shop-cancels')controller.simulateCancels(6);
    };
    this.panel.onclick=e=>{
      const action=e.target.closest('[data-invest]')?.dataset.invest;
      if(action)controller.comment(controller.selectedId,action==='join'?'GÓP':'KHÔNG THAM GIA');
      const shopAction=e.target.closest('[data-shop]')?.dataset.shop;
      if(shopAction&&this.shopHostId)controller.comment(controller.selectedId,`${shopAction==='order'?'MUA':'BOM'} ${this.shopHostId}`);
    };
  }

  update(raceSnapshot, state, nextIn = 8, lobby = null) {
    const c=this.controller, invest=state.investment, envelope=state.redEnvelope, shop=state.shop;
    const showing=state.modal==='investment'&&invest || state.modal==='envelope'&&envelope || state.modal==='shop'&&shop&&shop.phase!=='closed';
    this.panel.hidden=!showing;
    this.panel.dataset.kind=state.modal||'';
    this.panel.dataset.testid=state.modal==='shop'?'shop-panel':'community-panel';
    this.portrait.dataset.community=String(!!showing);
    const me=state.accounts.find(a=>a.id===state.selectedId);
    const activeIds=new Set(state.activeIds), sender=this.controls.querySelector('.sender-select');
    const rosterKey=state.activeIds.join(',')+':'+state.accounts.length;
    if(this.rosterKey!==rosterKey){
      this.rosterKey=rosterKey;
      sender.innerHTML=state.accounts.map(a=>`<option value='${esc(a.id)}'>${esc(a.id)} · ${esc(a.name)} · ${activeIds.has(a.id)?'ĐANG ĐUA':'KHÁCH CHỜ'}</option>`).join('');
    }
    sender.value=state.selectedId;
    this.controls.querySelector('.simulation-label').textContent=`${state.activeIds.length} quân đang đua · ${state.accounts.length-state.activeIds.length} khách chờ · lệnh local`;
    this.controls.querySelector('.community-notice').textContent=state.notice;
    this.controls.querySelector('.priority-queue').textContent=`Lắc kế: ${state.scheduler.queue.slice(0,5).join(' · ') || 'Các quân đang di chuyển'} · Ưu tiên hoa hồng: ${state.scheduler.pendingRoses}`;
    this.mc.textContent=state.mcLine;
    this.mc.hidden=!!raceSnapshot.race?.over;
    this.controls.querySelector('[data-community=shop]').disabled=!!state.modal||!!raceSnapshot.race?.over;
    this.controls.querySelector('[data-community=shop-orders]').disabled=state.modal!=='shop'||shop?.phase!=='ordering'||shop.count>=shop.maxOrders;
    this.controls.querySelector('[data-community=shop-cancels]').disabled=state.modal!=='shop'||shop?.phase!=='returns'||!shop.fulfilled;
    if(state.modal==='shop'&&shop&&shop.phase!=='closed') {
      this.shopHostId=shop.hostId;
      const settled=shop.phase==='settled', returns=shop.phase==='returns';
      const key=`shop:${shop.id}:${shop.phase}`;
      if(this.panelKey!==key){
        this.panelKey=key;
        this.panel.innerHTML=`<div class='community-heading'><b>${esc(shop.hostId)} · QUẦY KHU PHỐ</b><span class='shop-timer' data-testid='shop-timer'></span></div><div class='shop-title-row'><h2>${settled?'Sổ quầy đã chốt':returns?'Đổi ý thì tự hủy':'Khách chờ, ghé quầy nhé!'}</h2><span class='shop-phase-label'></span></div><div class='shop-progress' role='progressbar' aria-label='Tiến độ cửa shop' aria-valuemin='0' aria-valuemax='100'><i></i></div><div class='shop-order-grid' data-testid='shop-orders' aria-label='Tám vị trí đơn hàng'></div><div class='shop-self' data-testid='shop-self'></div>${settled?`<div class='shop-result' data-testid='shop-result'><b class='shop-result-net'></b><span class='shop-result-wallet'></span><small class='shop-result-detail'></small></div>`:`<div class='shop-customer-actions'><button data-shop='order' data-action='shop-order' data-testid='shop-order-selected'>ĐẶT MỘT ĐƠN</button><button data-shop='cancel' data-action='shop-cancel' data-testid='shop-cancel-selected'>TỰ HỦY ĐƠN</button></div><p class='shop-rule'>Ví khách giữ nguyên · Phí mở ${fmt(shop.cost)} một lần<br>Chủ: +30 mỗi đơn tốt · −5 mỗi đơn tự hủy</p>`}`;
      }
      this.panel.dataset.shopPhase=shop.phase;
      const own=shop.orders.find(order=>order.customerId===state.selectedId);
      const eligible=shop.eligibleCustomerIds.includes(state.selectedId);
      const duration=returns?shop.returnSec:shop.orderSec;
      const progress=settled?100:Math.max(0,Math.min(100,(1-shop.remainingSeconds/duration)*100));
      const settledSeconds=Math.max(0,Math.ceil(shop.settledRemainingSeconds??4));
      this.panel.querySelector('.shop-timer').textContent=settled?`ĐÃ CHỐT · ${settledSeconds}s`:`${Math.ceil(shop.remainingSeconds)}s`;
      this.panel.querySelector('.shop-phase-label').textContent=settled?'KẾT QUẢ':returns?'TỰ HỦY':'NHẬN ĐƠN';
      this.panel.querySelector('.shop-progress').setAttribute('aria-valuenow',String(Math.round(progress)));
      this.panel.querySelector('.shop-progress i').style.width=`${progress}%`;
      this.panel.querySelector('.shop-order-grid').innerHTML=Array.from({length:shop.maxOrders},(_,index)=>{
        const order=shop.orders[index], cancelled=!!order?.cancelled;
        const status=!order?'TRỐNG':cancelled?'ĐÃ TỰ HỦY':settled?'ĐÃ GIAO':returns?'GIỮ ĐƠN':'ĐÃ ĐẶT';
        return `<div class='shop-order-cell ${!order?'empty':cancelled?'cancelled':'confirmed'}${order?.customerId===state.selectedId?' mine':''}' data-testid='shop-order-cell' data-order-slot='${index+1}' data-order-customer='${esc(order?.customerId||'')}' data-order-status='${!order?'empty':cancelled?'cancelled':settled?'fulfilled':'ordered'}' title='${esc(order?.name||`Vị trí ${index+1}`)}'><b>${esc(order?.customerId||`#${index+1}`)}</b><span>${status}</span></div>`;
      }).join('');
      this.panel.querySelector('.shop-self').textContent=`${state.selectedId} · ${eligible?'KHÁCH CHỜ':activeIds.has(state.selectedId)?'ĐANG ĐUA':'KHÔNG Ở PHIÊN NÀY'} · ${own?own.cancelled?'ĐÃ TỰ HỦY':'ĐÃ CÓ ĐƠN':eligible?'CHƯA ĐẶT':'THEO DÕI QUẦY'} · Ví ${fmt(me?.money)}`;
      if(settled){
        const result=shop.result, net=result?.net||0;
        this.panel.querySelector('.shop-result').dataset.direction=net>0?'up':net<0?'down':'even';
        this.panel.querySelector('.shop-result-net').textContent=`${net>0?'LỜI':net<0?'LỖ':'HÒA VỐN'} ${net>0?'+':''}${fmt(net)} MONEY`;
        this.panel.querySelector('.shop-result-wallet').textContent=`Ví chủ ${fmt(result?.after)} MONEY`;
        this.panel.querySelector('.shop-result-detail').textContent=`${result?.fulfilled||0} đơn tốt · ${result?.cancelled||0} đơn hủy · đã gồm ${fmt(shop.cost)} phí mở · trở lại phố sau ${settledSeconds}s`;
      }else{
        this.panel.querySelector('[data-shop=order]').disabled=!eligible||!!own||returns||shop.count>=shop.maxOrders||raceSnapshot.paused;
        this.panel.querySelector('[data-shop=cancel]').disabled=!eligible||!own||own.cancelled||!returns||raceSnapshot.paused;
      }
    } else if(state.modal==='investment'&&invest) {
      const joined=invest.contributions.some(row=>row.id===state.selectedId);
      const settled=invest.phase==='settled', chart=invest.phase!=='joining';
      const points=invest.chart.points;
      const d=points.map((point,i)=>`${i?'L':'M'}${(point.x*300).toFixed(1)},${(120-point.y*55).toFixed(1)}`).join(' ');
      const last=points.at(-1), up=(last?.y??1)>=1;
      const mine=invest.result?.results.find(row=>row.id===state.selectedId);
      const net=invest.result?.net||0;
      const key=`${invest.id}:${invest.phase}`;
      if(this.panelKey!==key) {
        this.panelKey=key;
        this.panel.innerHTML=`<div class='community-heading'><b>${esc(invest.hostId)} · GÓP VỐN CẢ PHỐ</b><span class='collective-timer'></span></div><h2>${esc(invest.title)}</h2><p>${esc(invest.body)}</p><div class='investment-stats'><span>Người góp<b class='invest-count'></b></span><span>Tạm giữ<b class='invest-total'></b></span><span>Mỗi người<b>${fmt(invest.stake)}</b></span></div>${chart?`<div class='chart-label'><span>CHART MÔ PHỎNG</span><b class='chart-value'></b></div><svg class='investment-chart' viewBox='0 0 300 130' role='img' aria-label='Chart kết quả mô phỏng'><path class='chart-grid' d='M0 10H300 M0 65H300 M0 120H300'/><path class='chart-area'/><path class='chart-line'/><circle class='chart-dot' r='4'/></svg>`:`<div class='investment-rules'>Góp 100 MONEY. Lời: +20–80%; lỗ: −30–85% vốn. Chủ quầy chịu cùng kết quả. Có thể đổi ý trước giờ khóa.</div><div class='collective-person'><span class='invest-self'></span><span class='invest-wallet'></span></div><div class='invest-buttons'><button data-invest='join'>THAM GIA −100</button><button data-invest='pass'>KHÔNG THAM GIA</button></div>`}<div class='invest-result'></div><div class='contributor-chips'></div>`;
      }
      this.panel.dataset.direction=up?'up':'down';
      this.panel.querySelector('.collective-timer').textContent=settled?'ĐÃ CHỐT':`${Math.ceil(invest.remainingSeconds)}s`;
      this.panel.querySelector('.invest-count').textContent=`${invest.participants}/${state.accounts.length}`;
      this.panel.querySelector('.invest-total').textContent=fmt(invest.totalCommitted);
      this.panel.querySelector('.contributor-chips').innerHTML=invest.contributions.slice(0,9).map(row=>`<span>${esc(row.id)}</span>`).join('')+(invest.participants>9?`<span>+${invest.participants-9}</span>`:'');
      if(chart){
        this.panel.querySelector('.chart-value').textContent=`${up?'+':''}${(((last?.y??1)-1)*100).toFixed(0)}%`;
        this.panel.querySelector('.chart-line').setAttribute('d',d);
        this.panel.querySelector('.chart-area').setAttribute('d',d?`${d} L${((last?.x||0)*300).toFixed(1)},130 L0,130 Z`:'');
        this.panel.querySelector('.chart-dot').setAttribute('cx',((last?.x||0)*300).toFixed(1));
        this.panel.querySelector('.chart-dot').setAttribute('cy',(120-(last?.y??1)*55).toFixed(1));
      }else{
        this.panel.querySelector('.invest-self').textContent=`Bạn: ${state.selectedId} · ${joined?'ĐÃ GÓP':'CHƯA GÓP'}`;
        this.panel.querySelector('.invest-wallet').textContent=`Ví ${fmt(me?.money)}`;
        this.panel.querySelector('[data-invest=join]').disabled=joined || (me?.money||0)<100 || raceSnapshot.paused;
        this.panel.querySelector('[data-invest=pass]').disabled=state.selectedId===invest.hostId || raceSnapshot.paused;
      }
      this.panel.querySelector('.invest-result').innerHTML=settled?`<b>${net>=0?'CẢ NHÓM LỜI':'CẢ NHÓM LỖ'} ${fmt(Math.abs(net))} MONEY</b><span>Hoàn ${fmt(invest.result.totalReturned)} / vốn ${fmt(invest.result.totalInvested)}</span><small>${mine?`${state.selectedId}: nhận lại ${fmt(mine.returned)}, ${mine.net>=0?'lời':'lỗ'} ${fmt(Math.abs(mine.net))} MONEY`:'Bạn không góp vốn, ví giữ nguyên.'}</small>`:'';
    } else if(state.modal==='envelope'&&envelope?.result) {
      const key=`${envelope.id}:settled`;
      if(this.panelKey!==key){this.panelKey=key;this.panel.innerHTML=`<div class='community-heading'><b>♥ LÌ XÌ HỘI PHỐ</b><span>ĐỦ TIM</span></div><h2>${fmt(envelope.result.pot)} MONEY</h2><p>Chia cho ${envelope.participants} người: một phần đều nhau, phần còn lại theo hạng MONEY tại lúc mở quỹ.</p><div class='envelope-winners'>${envelope.result.payouts.slice(0,5).map(row=>`<div><span>#${row.rank} ${esc(row.id)}</span><b>+${fmt(row.amount)}</b></div>`).join('')}</div><div class='envelope-my-share'></div>`;}
      const mine=envelope.result.payouts.find(row=>row.id===state.selectedId);
      this.panel.querySelector('.envelope-my-share').textContent=mine?`${state.selectedId}: +${fmt(mine.amount)} MONEY · hạng ${mine.rank}`:'';
    } else this.panelKey=null;
    this.hearts.hidden=!envelope || envelope.phase!=='collecting';
    if(envelope?.phase==='collecting'){
      this.hearts.innerHTML=`<div><b>♥ LÌ XÌ CẢ PHỐ</b><span>${fmt(envelope.hearts)} / ${fmt(envelope.target)}</span></div><div class='hearts-track'><i style='width:${Math.min(100,envelope.progress*100)}%'></i></div><small>Đầy tim → chia quỹ MONEY cho ${envelope.participants} người theo hạng</small>`;
    }
    const over=!!raceSnapshot.race?.over;
    this.podium.hidden=!over;
    if(over){
      const winners=raceSnapshot.race.finalStandings || [];
      this.podium.innerHTML=`<span class='podium-eyebrow'>BA NGƯỜI ĐÃ ĐỦ BA VÒNG</span><h2>Phố có quán quân!</h2><div class='podium-places'>${winners.slice(0,3).map((row,i)=>`<div class='podium-place p${i+1}'><b>${['🥇','🥈','🥉'][i]}</b><strong>${esc(row.seat)}</strong><span>${esc(row.name)}</span><small>${fmt(row.money)} MONEY</small></div>`).join('')}</div><p>Mở cửa giữ ghế sau ${Math.ceil(nextIn)}s</p>`;
      if(lobby?.phase==='reserving') {
        const mine=lobby.hearts.find(row=>row.id===state.selectedId),waiting=lobby.waitingIds.indexOf(state.selectedId);
        this.podium.innerHTML=`<span class='podium-eyebrow'>SẢNH GIỮ GHẾ · ${Math.ceil(lobby.timeleft)} GIÂY</span><h2>Thả tim giữ chỗ!</h2><p>Đủ ${lobby.settings.threshold} tim mới trong cửa này.<br>${lobby.settings.reserved} suất giữ ghế, ${lobby.settings.seats-lobby.settings.reserved} ghế ưu tiên hàng chờ.</p><div class='reservation-count'>${lobby.reservations.length} / ${lobby.settings.reserved} ghế đã giữ</div><div class='reservation-self'>${mine?`${esc(state.selectedId)} · ${mine.count}/${mine.threshold} tim · ${mine.reserved?'ĐÃ GIỮ GHẾ':mine.count>=mine.threshold?'HẾT SUẤT, VÀO HÀNG CHỜ':'ĐANG TÍCH TIM'}`:`${esc(state.selectedId)} · Khách chờ #${waiting+1}`}</div><div class='hearts-track'><i style='width:${mine?Math.min(100,mine.count/mine.threshold*100):0}%'></i></div><div class='contributor-chips'>${lobby.reservations.map(row=>`<span>${esc(row.id)}</span>`).join('')}</div><p>Khách chờ vẫn tham gia sự kiện. Khóa sảnh rồi ghép đủ ${lobby.settings.seats} quân.</p>`;
      }
    }
  }
}
