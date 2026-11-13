import { EVENT_CARDS } from './events.js';

// Text and timing contract only. The separate MC repository owns speech/TTS.
// MONEY, chart outcomes, gifts and likes remain facts supplied by game state.
const OPENERS = {
  GA01: 'Ghé ga nhận lộc đầu đường! Đặt quân đầu ván thì chưa tính thưởng nhé.',
  REST01: 'Ôi, không có gì! Ví vẫn nguyên, đi tiếp thôi.',
  GAIN01: 'Tìm thấy chiếc ví của chính mình! Có tờ tiền quên từ sáng, vậy cũng là niềm vui.',
  GAIN02: 'Cô bán nước gọi lại trả tiền thừa. Khách quen được nhớ cả tiền lẫn mặt!',
  GAIN03: 'Giao hàng đúng hẹn, khách thưởng thêm. Cơm còn nóng mà ví cũng ấm.',
  GAIN04: 'Phụ dọn mấy chiếc ghế nhựa, nhận công ngay. Việc nhỏ, tiếng cười lớn.',
  GAIN05: 'Gom lon đổi điểm! Phố sạch hơn, ví xanh hơn.',
  GAIN06: 'Gọi đúng tên, mèo chịu xuống nóc tủ. Bác hàng xóm gửi chút cảm ơn.',
  GAIN07: 'Thông báo hoàn điểm về rồi! Lần này điện thoại reo là có tin vui.',
  GAIN08: 'Khách khen quầy dễ thương. Hôm nay nụ cười cũng biết tạo doanh thu.',
  LOSS01: 'Tuýt còi! Đậu xe ngay trước biển cấm. Nộp phí trong game rồi dắt xe đúng chỗ nhé.',
  LOSS02: 'Chó giữ chiếc dép như giữ kho báu. Chân vẫn ổn, nhưng quai dép xin nghỉ phép!',
  LOSS03: 'Mưa bất ngờ! Mua áo mưa đầu hẻm, giữ người khô rồi đi tiếp.',
  LOSS04: 'Cốc trà sữa đổi chủ khi nắp bật ra. Mình đền một cốc, lần sau cầm hai tay nhé.',
  LOSS05: 'Bánh xe gặp chiếc đinh có tham vọng. Vá bánh một nhịp rồi tiếp tục.',
  LOSS06: 'Quên vé gửi xe! Chú giữ xe tra sổ giúp, phí làm lại vé đã hiện trên bảng.',
  LOSS07: 'Đóng thùng rất đẹp, hàng vẫn trên bàn. Tốn thêm một lượt băng keo rồi!',
  LOSS08: 'Một cú chạm, thêm topping. Ly nước nhiều tham vọng hơn, ví thì mỏng hơn.',
  LIFE01: 'Chó ngậm dép ngồi chắn hẻm. Chọn cách thương lượng, bên kia đang giữ lợi thế một chiếc dép.',
  LIFE02: 'Chú công an hỏi nhà số mười hai. Chỉ đường hay phụ chuyển nước, phố đang chờ bạn.',
  LIFE03: 'Bảng giảm giá chuẩn bị bay! Giữ bảng hay xếp lại ghế cho cô chủ?',
  LIFE04: 'Hàng xóm nhờ tưới cây. Tưới bằng nước nhé, trà sữa để uống!',
  LIFE05: 'Ghế đã có khách lông xù nằm ngủ. Bạn đứng hóng gió hay thuê ghế bên cạnh?',
  LIFE06: 'Hội hẻm mở bàn liên hoan. Phụ dọn hay góp quỹ, chọn cách vui cùng phố.',
  LIFE07: 'Đơn cuối trước giờ ngủ. Nghỉ ngơi hay giao thêm một chuyến ngắn?',
  LIFE08: 'Loa khu phố gọi tên bạn! Đọc thông báo thôi, chưa phải thi hát nhé.',
  LIFE09: 'Thang máy bảo trì, đơn ở tầng ba. Chờ khách xuống hay đi bộ giao tận cửa?',
  LIFE10: 'Cô bán nước đi lấy đá. Trông quầy hay giúp bê thùng đá?',
  LIFE11: 'Sinh nhật mèo hàng xóm! Mèo chưa phát biểu, nhưng thiệp mời đã đến tay bạn.',
  LIFE12: 'Lạc một ngã, gặp quầy tuyển người phát menu. Đôi khi đi lạc cũng gặp việc.',
  INV01: 'Cơ hội góp vốn xe bánh mì. Xem mức tiền và rủi ro trên bảng trước khi chọn.',
  INV02: 'Quầy ô che nắng đang tìm người phụ. Nhận công chắc chắn hay thử góp vốn?',
  INV03: 'Vườn rau sân thượng mở cửa. Nhận công tưới hay góp một vụ rau thử?',
  INV04: 'Cả hẻm bàn chiếc máy ép mía chung. Phụ rửa cốc hay góp vốn máy?',
  INV05: 'Tủ sách đầu hẻm cần người chăm. Sắp xếp sách hay mở một quầy nhỏ?',
  INV06: 'Quầy hoa cuối tuần chuẩn bị nhập hàng. Bó hoa lấy công hay thử một lô hoa?',
  INV07: 'Điểm sạc xe đồ chơi cần người trực. Đây là MONEY trong game, chọn theo mức rủi ro đã báo nhé.',
  INV08: 'Rạp chiếu sân nhà tìm người góp sức. Xếp ghế hay góp màn chiếu?',
  TRADE01: 'Shop dép chạy deadline mở cửa. Nhận lương hay nhập lô hàng thử?',
  TRADE02: 'Xe trà tắc vừa dựng quầy. Phụ quầy hay thử bán một mẻ?',
  TRADE03: 'Bánh tráng trộn đã sẵn sàng. Đóng gói lấy công hay thử bán một mẻ?',
  TRADE04: 'Quầy áo mưa nhìn trời chờ khách. Phát menu lấy công hay nhập hàng?',
  TRADE05: 'Chợ đồ cũ vui vẻ! Lau quầy lấy công hay thu mua bán lại?',
  TRADE06: 'Cà phê giao tận cổng. Giao thuê hay mở một ca bán thử?',
  TRADE07: 'Giờ trưa tới rồi! Phụ đóng hộp hay nhập một mẻ cơm?',
  TRADE08: 'Quầy móc khóa mèo chào khách. Làm thuê hay mở quầy thử?',
  MINI01: 'Đóng gói thần tốc! Hộp trước, băng sau, tem cuối. Nhìn kỹ rồi chọn nhé.',
  MINI02: 'Khách gọi ít đá, không đường. Chọn phiếu đúng trước khi giao.',
  MINI03: 'Đơn ghi nhà mười hai, hẻm ba. Đừng tráo hai con số rồi trách con hẻm!',
  MINI04: 'Hóa đơn ba mươi lăm, khách đưa năm mươi. Trả bao nhiêu?'
};

function cue(id, eventId, phase, line, sfx = null, extras = {}) {
  return { id, eventId, phase, line, variables: [...new Set([...line.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/g)].map(match => match[1]))],
    sfx, trigger: phase, ...extras };
}

export const EVENT_MC_CUES = EVENT_CARDS.flatMap(card => {
  const prefix = `event.${card.id}`;
  const open = card.id === 'REST01' ? OPENERS.REST01 : `Ghế {playerTag}, ${OPENERS[card.id] || card.mc}`;
  const cues = [cue(`${prefix}.open`,card.id,'event.open',open,card.category === 'rest' ? null : card.sfx,
    { category: card.category, oncePerEvent: true, priority: 2 })];
  if (card.choices.length) {
    const choices = card.choices.map((choice,index) => `gõ ${index+1} để ${choice.label.toLowerCase()}: ${choice.description}.`).join(' ');
    cues.push(cue(`${prefix}.choose`,card.id,'event.choose',`Ghế {playerTag}, ${choices} Còn {seconds} giây.`, 'sfx_question',
      { commandMap: Object.fromEntries(card.choices.map((choice,index)=>[String(index+1),choice.id])), oncePerEvent: true, priority: 2 }));
    cues.push(cue(`${prefix}.countdown`,card.id,'event.countdown','Còn {seconds} giây để chọn. Bé Két chờ câu trả lời của ghế {playerTag}.', null,
      { onlyAtSeconds: [5,3], priority: 0 }));
    const fallback = card.choices.find(choice=>choice.id===card.defaultChoiceId) || card.choices[0];
    cues.push(cue(`${prefix}.timeout`,card.id,'event.timeout',card.category === 'minigame'
      ? 'Hết giờ rồi! Câu này chưa có thưởng, mình giữ ví rồi đi tiếp.'
      : `Hết giờ, ghế {playerTag} dùng phương án mặc định: ${fallback.label}.`, 'sfx_timer_warn', { oncePerEvent: true, priority: 1 }));
  }
  cues.push(cue(`${prefix}.gain`,card.id,'event.result.gain','Ghế {playerTag} nhận {deltaAbs} MONEY. Ví mới {balance}. Ghi sổ xong, mình đi tiếp!', 'sfx_coin_up', { oncePerEvent: true, priority: 3 }));
  cues.push(cue(`${prefix}.loss`,card.id,'event.result.loss','Ghế {playerTag} mất {deltaAbs} MONEY. Ví còn {balance}. Phố giữ tiếng cười, mình giữ lượt sau!', 'sfx_coin_down', { oncePerEvent: true, priority: 3 }));
  cues.push(cue(`${prefix}.neutral`,card.id,'event.result.neutral',card.category === 'rest'
    ? 'Không có gì xảy ra. Ví vẫn {balance} MONEY, chân mình đi tiếp thôi.'
    : 'Chốt rồi, MONEY không đổi. Ghế {playerTag} còn {balance}.', null, { oncePerEvent: true, priority: 1 }));
  return cues;
});

export const COMMUNITY_MC_CUES = [
  cue('match.open','MATCH','match.open','Khu phố mở cửa! Mỗi tài khoản có {startingMoney} MONEY. Gõ CHƠI để vào danh sách ghép bàn; trong lúc chờ vẫn góp vốn, ghé quầy và nhận lì xì được nhé.',null,{priority:2}),
  cue('match.full100','MATCH','match.population','Phòng có {accountCount} tài khoản, map hiện có {playerCount} người đua. Những bạn chờ ghế vẫn tham gia chuyện phố cùng cả bàn.',null),
  cue('race.rules','RACE','race.ready','Ván này chạy đủ {lapTarget} vòng đường. Vạch đích mới ở {finishName}; qua đó sau vòng cuối mới hoàn thành cuộc đua.',null,{oncePerMatch:true,priority:2}),
  cue('race.turn','RACE','turn.open','Đến {playerName}, mã {playerTag}. Gõ LẮC, mình xem phố đưa bạn tới đâu.',null,{priority:1}),
  cue('race.roll','RACE','dice.result','{roll} bước! Đi đúng số ô rồi mới xử lý chuyện ở ô cuối.',null),
  cue('race.autoRoll','RACE','dice.timeout','{playerName} đang bận một nhịp. Bé Két lắc hộ, vẫn chỉ một kết quả nhé.',null),
  cue('race.fork','RACE','fork.open','{playerName}, gõ TRÁI hoặc PHẢI. Nhìn loại ô trên mỗi đường; cả phố cũng được góp ý!', 'sfx_question'),
  cue('race.forkOwner','RACE','fork.owner','Chốt {direction}! Chủ lượt đã chọn, cả phố cùng theo chân nào.',null),
  cue('race.forkVotes','RACE','fork.votes','Khán giả chọn {direction}, {winningVotes} phiếu. Ghế {playerTag} đi nhé!',null),
  cue('race.forkDefault','RACE','fork.default','Phiếu hòa hoặc phố đang im lặng. Đi {direction} theo mặc định đã hiện trên bảng.',null),
  cue('race.lap','RACE','race.lap','{playerName} đã xong vòng {lap}/{lapTarget}! Ví còn {balance}, tiếp tục chuyến phố nào.', 'sfx_correct'),
  cue('race.finalLap','RACE','race.finalLap','Vòng cuối của {playerName}! Vạch đích đang chờ, cả phố có thể cổ vũ bằng tim.',null),
  cue('race.finish','RACE','race.finish','{playerName} về đích thứ {finishRank}! Hoàn thành đủ {lapTarget} vòng, ví hiện {balance} MONEY.', 'sfx_victory',{priority:3}),
  cue('race.end','RACE','match.end','Đủ ba người về đích, chốt ván! Nhất {firstName}, nhì {secondName}, ba {thirdName}. Bục theo thứ tự cán đích; MONEY vẫn hiện riêng cho mọi người.', 'sfx_victory',{priority:3}),
  cue('race.resultHold','RACE','race.resultHold','Giữ bục {seconds} giây để cả phố chúc mừng. Sau đó mở cửa tim giữ chỗ và ghép bàn kế tiếp.',null,{oncePerMatch:true}),
  cue('race.nextMatch','RACE','match.next','Bàn mới đã chọn xong {playerCount} người! Mọi tài khoản, kể cả khách chờ, nhận lại {startingMoney} MONEY. Map đổi cảnh, vạch đích đổi chỗ, mình chạy ba vòng mới nào!',null,{oncePerMatch:true,priority:2}),
  cue('reserve.open','MATCHMAKING','reserve.open','Cửa giữ chỗ mở {reserveSeconds} giây! Người ở bàn cũ đạt {heartTarget} tim mới trước sẽ giữ ghế trước. Tối đa {retainedSeats} ghế cũ, dành {waitingSeats} ghế cho hàng chờ.',null,{oncePerMatch:true,priority:2}),
  cue('reserve.progress','MATCHMAKING','reserve.progress','{playerName} có {hearts}/{heartTarget} tim giữ chỗ. Chỉ tính tim mới trong cửa này, tim từ trước không cộng lại nhé.',null,{onlyAtHeartCount:[10,20,30],cooldownSeconds:5,priority:0}),
  cue('reserve.retained','MATCHMAKING','reserve.retained','Đã giữ ghế cho {playerName}. Danh sách ghép bàn xác nhận trên màn hình, không cần gửi thêm tim cho suất này.',null,{onlyToPlayer:true,cooldownSeconds:3,priority:1}),
  cue('reserve.full','MATCHMAKING','reserve.full','Nhóm giữ chỗ đã đủ {retainedSeats} ghế cũ. Các ghế còn lại dành cho người chờ lâu nhất, mình chốt danh sách theo đồng hồ.',null,{oncePerMatch:true,priority:1}),
  cue('reserve.timeout','MATCHMAKING','reserve.timeout','Hết cửa giữ chỗ! Bạn chưa có ghế sẽ vào hàng chờ; mọi người vẫn được góp vốn, mua ở quầy đang mở và cùng đổ tim lì xì.',null,{oncePerMatch:true,priority:2}),
  cue('matchmaking.start','MATCHMAKING','matchmaking.start','Bắt đầu ghép bàn mới. Ưu tiên suất giữ chỗ hợp lệ và tám bạn chờ lâu nhất; ghế còn trống tiếp tục lấy từ hàng chờ.',null,{oncePerMatch:true}),
  cue('matchmaking.selected','MATCHMAKING','matchmaking.selected','Đã ghép {playerCount} người vào map. Những tên được chọn hiện trên bảng; mọi người chuẩn bị lượt đua mới!',null,{oncePerMatch:true,priority:2}),
  cue('matchmaking.waiting','MATCHMAKING','matchmaking.waiting','{playerName} đang ở vị trí {queuePosition} của hàng chờ. Thời gian chờ được giữ qua ván để lần sau tới lượt công bằng.',null,{onlyToPlayer:true,cooldownSeconds:10,priority:0}),
  cue('matchmaking.customer','MATCHMAKING','matchmaking.customer','Chưa có ghế đua vẫn là khách của khu phố! Bạn có thể góp vốn, đặt đơn khi shop mở và nhận lì xì cùng mọi người.',null,{cooldownSeconds:45,priority:0}),
  cue('queue.rose','QUEUE','queue.rose','Đã ghi nhận hoa hồng của {playerName}. Bạn được ưu tiên ở lượt hợp lệ kế tiếp; số xúc xắc và kết quả sự kiện vẫn giữ luật chung.',null,{cooldownSeconds:12,priority:0}),
  cue('queue.likes','QUEUE','queue.likes','Tim đang giúp {playerName} nhích lên hàng lượt. Mỗi chu kỳ mọi người vẫn được đi một lần, không ai bị bỏ lại.',null,{cooldownSeconds:30,priority:0}),
  cue('queue.free','QUEUE','queue.explain','Không cần quà vẫn được vào chơi và đi đủ lượt. Hoa hồng chỉ đổi vị trí lượt sắp tới, không đổi số lắc hay lợi nhuận.',null,{onlyOnRequest:true,priority:0}),
  cue('queue.carry','QUEUE','queue.carry','Quyền ưu tiên chưa đến lượt đã được giữ sang ván mới. Không mất lượt ưu tiên chỉ vì ván trước vừa chốt.',null,{onlyOnRequest:true,priority:0}),
  cue('startup.open','STARTUP','startup.open','Ghế {hostTag} mở {startupName}! Chủ quầy đã góp {stake} MONEY. Ai muốn góp cùng gõ GÓP {hostTag}; không tham gia gõ BỎ {hostTag}. Đây là chart mô phỏng trong game.', 'sfx_question',{priority:2}),
  cue('startup.rules','STARTUP','startup.rules','Mỗi người góp {stake} MONEY, trừ ngay khi nhận tham gia. Trong {joinSeconds} giây mở cửa có thể đổi ý để hoàn vốn; khóa cửa rồi cùng chờ kết quả.',null,{oncePerEvent:true}),
  cue('startup.join','STARTUP','startup.join','Đã có {participantCount} người góp, tổng vốn {escrowTotal} MONEY. Mỗi tài khoản một phần vốn thôi nhé.', 'sfx_order',{cooldownSeconds:4}),
  cue('startup.reject','STARTUP','startup.reject','Ví {playerName} chưa đủ {stake} MONEY. Bạn vẫn xem chart và cổ vũ cùng phố được nhé.',null,{onlyToPlayer:true,priority:0}),
  cue('startup.leave','STARTUP','startup.leave','{playerName} chọn không tham gia trước giờ khóa. Hoàn lại {refund} MONEY, không trừ thêm phí.', 'sfx_return',{cooldownSeconds:3}),
  cue('startup.countdown','STARTUP','startup.countdown','Còn {seconds} giây nhận vốn. GÓP hoặc BỎ, không trả lời thì không tự trừ tiền.',null,{onlyAtSeconds:[5,3],priority:0}),
  cue('startup.lock','STARTUP','startup.lock','Khóa danh sách! {participantCount} người, tổng vốn {escrowTotal} MONEY. Chart chạy {chartSeconds} giây, kết quả chưa chốt trước tiếng chuông.', 'sfx_chat_ping',{priority:2}),
  cue('startup.chart','STARTUP','startup.chart','Chart đang chạy! Lên xuống là hình mô phỏng; chờ điểm cuối mới chốt tiền cho cả nhóm.',null,{oncePerEvent:true}),
  cue('startup.up','STARTUP','startup.result.up','Chart chốt xanh! Mỗi phần vốn {stake} nhận lại {returnPerShare} MONEY, gồm vốn và lời {profitPerShare}. Chủ quầy cũng dùng đúng mức này.', 'sfx_coin_up',{priority:3,secondarySfx:'sfx_victory'}),
  cue('startup.down','STARTUP','startup.result.down','Chart chốt đỏ! Mỗi phần vốn {stake} còn nhận lại {returnPerShare} MONEY, lỗ {lossPerShare}. Chủ quầy cũng chịu lỗ, không có người đứng ngoài luật.', 'sfx_coin_down',{priority:3}),
  cue('startup.neutral','STARTUP','startup.result.neutral','Khóa sổ startup. Mỗi phần vốn nhận lại {returnPerShare} MONEY; số dư riêng hiện trên bảng của từng người.',null),
  cue('startup.close','STARTUP','startup.close','Đã ghi trả vốn và kết quả cho {participantCount} người. Không góp thì ví không đổi. Camera về người đang lượt!',null,{priority:1}),
  cue('startup.flavor.foodtruck','STARTUP','startup.flavor','Xe bánh mì góp vốn mở cửa! Hàng bán chạy hay cả phố ăn no rồi, cùng chờ một mẻ nhé.',null),
  cue('startup.flavor.garden','STARTUP','startup.flavor','Vườn rau hợp tác tìm bạn cùng góp. Rau trong game lớn nhanh, nhưng lời lỗ vẫn phải chờ chốt.',null),
  cue('startup.flavor.music','STARTUP','startup.flavor','Sân khấu cuối phố chuẩn bị mở đèn. Ai góp vốn cùng chủ sân thì xem phần tiền trên bảng trước nhé.',null),
  cue('startup.flavor.nightmarket','STARTUP','startup.flavor','Chợ đêm lên đèn! Một phần vốn, một kết quả chung, mỗi người tự chọn có tham gia không.',null),
  cue('envelope.open','LIXI','envelope.open','Lì xì khu phố bắt đầu! Cùng thả tim để đầy thanh {heartTarget} tim. Mọi người có tên khi mở quỹ đều nằm trong danh sách nhận.', 'sfx_birthday',{priority:2}),
  cue('envelope.progress','LIXI','envelope.progress','Thanh tim đã đạt {heartPercent} phần trăm. Cả phố cùng góp nhịp, không cần quà để mở lì xì.',null,{onlyAtPercent:[25,50,75],priority:0}),
  cue('envelope.full','LIXI','envelope.full','Đầy tim rồi! Quỹ {pot} MONEY mở ra cho {recipientCount} người. Một phần chia nền cho cả nhóm, phần còn lại theo hạng MONEY lúc chốt.', 'sfx_coin_up',{priority:3,secondarySfx:'sfx_birthday'}),
  cue('envelope.rank','LIXI','envelope.rank','Hạng {rank}: {playerName} nhận {reward} MONEY. Bảng chia giữ đủ tên mọi người, camera chỉ đọc một vài người đầu để ván không bị dài.',null,{maxSpokenRecipients:3}),
  cue('envelope.close','LIXI','envelope.close','Đã chia đúng {pot} MONEY, không sót hoặc nhân đôi giao dịch. Bạn xem phần của mình trên bảng nhé!',null,{priority:1}),
  cue('envelope.timeout','LIXI','envelope.timeout','Thanh tim chưa đầy thì quỹ vẫn chờ. Mình tiếp tục chơi, không trừ MONEY để ép mở quỹ.',null,{onlyOnRequest:true}),
  cue('connection.pause','SYSTEM','source.paused','Nguồn bình luận đang nối lại. Đồng hồ nhập lệnh tạm dừng, tiền đã chốt giữ nguyên.',null,{priority:3}),
  cue('connection.resume','SYSTEM','source.resumed','Bình luận đã trở lại. Tiếp tục đúng cửa đang mở, không lắc lại hay tính tiền lần hai.',null,{priority:2})
];

export const SHOP_MC_CUES = [
  cue('shop.open','SHOP01','shop.open','Quầy {hostTag} của {hostName} mở cửa! Chủ quầy đã trả {setupCost} MONEY dựng quầy một lần. Khách đang chờ ghế gõ {hostTag} để đặt đơn giả lập trong {orderSeconds} giây, tối đa {maxOrders} đơn.', 'sfx_shop_open',{oncePerEvent:true,priority:2}),
  cue('shop.rules','SHOP01','shop.rules','Đây là đơn trong game, không mua hàng thật và không trừ ví khách. Mỗi tài khoản chờ một đơn. Đơn giao thành công cộng {goodReward} MONEY cho chủ; đơn tự hủy làm chủ mất {cancelPenalty} MONEY.',null,{oncePerEvent:true}),
  cue('shop.order','SHOP01','shop.order','Quầy {hostTag} đã nhận {orderCount}/{maxOrders} đơn. {customerName} có tên trên sổ, ví khách giữ nguyên.', 'sfx_order',{cooldownSeconds:4,priority:0}),
  cue('shop.full','SHOP01','shop.full','Quầy {hostTag} đủ {maxOrders} đơn rồi! Không nhận thêm để chủ quầy kịp đóng hàng.',null,{oncePerEvent:true,priority:1}),
  cue('shop.returns','SHOP01','shop.returns','Khóa đơn quầy {hostTag}! Mở {returnSeconds} giây đổi ý: ai đã đặt muốn tự hủy thì gõ BOM {hostTag}. Chỉ hủy đơn của chính mình; không bình luận thì giữ đơn.', 'sfx_timer_warn',{oncePerEvent:true,priority:2}),
  cue('shop.cancel','SHOP01','shop.cancel','{customerName} đã tự hủy đơn quầy {hostTag}. Mỗi đơn chỉ ghi hủy một lần, không tác động đơn của người khác.', 'sfx_return',{cooldownSeconds:4,priority:0}),
  cue('shop.countdown','SHOP01','shop.countdown','Quầy {hostTag} còn {seconds} giây. Xem pha nhận đơn hoặc tự hủy đang hiện trên bảng rồi chọn nhé.',null,{onlyAtSeconds:[5,3],priority:0}),
  cue('shop.settle','SHOP01','shop.settled','Chốt quầy {hostTag}: {goodOrders} đơn giao thành công, {cancelledOrders} đơn tự hủy. Tiền hàng chốt {salesDelta} MONEY, gồm cộng {goodReward} mỗi đơn tốt và trừ {cancelPenalty} mỗi đơn hủy. Phí dựng {setupCost} đã trả lúc mở, không trừ lại. Ví chủ còn {balance}; ví khách không đổi.',null,{oncePerEvent:true,priority:3,resultSfxByDelta:{positive:'sfx_coin_up',negative:'sfx_coin_down',zero:null}}),
  cue('shop.abort','SHOP01','shop.cancelled','Quầy {hostTag} đóng trước khi chốt. Hoàn lại đúng {refund} MONEY dựng quầy cho chủ, bỏ các đơn giả lập và giữ nguyên ví khách. Giao dịch đã chốt trước đó không được hoàn lại lần nữa.', 'sfx_coin_up',{oncePerEvent:true,priority:2})
];

export const MC_CUES = [...EVENT_MC_CUES, ...COMMUNITY_MC_CUES, ...SHOP_MC_CUES];

export function renderMCLine(cueId, values = {}, { strict = false } = {}) {
  const selected = MC_CUES.find(value => value.id === cueId);
  if (!selected) throw new RangeError(`Unknown MC cue: ${cueId}`);
  const missingVariables = selected.variables.filter(name => values[name] === undefined || values[name] === null);
  if (strict && missingVariables.length) throw new TypeError(`Missing MC variables: ${missingVariables.join(', ')}`);
  const line = selected.line.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (placeholder,name) => values[name] === undefined || values[name] === null
    ? placeholder : String(values[name]).replace(/[\r\n\t\u0000-\u001f{}]/g,' ').slice(0,120));
  const delta=Number(values.salesDelta);
  const sfx=selected.resultSfxByDelta && Number.isFinite(delta)
    ? selected.resultSfxByDelta[delta>0?'positive':delta<0?'negative':'zero'] : selected.sfx;
  return { id: selected.id, eventId: selected.eventId, phase: selected.phase, line, missingVariables, sfx };
}

export function createMCPack() {
  return { schemaVersion: 1, locale: 'vi-VN', revision: 'community-v5', purpose: 'scripts-only-no-generated-voice',
    eventIds: EVENT_CARDS.map(card=>card.id), eventCount: EVENT_CARDS.length,
    gameFacts: { money: 'integer in-game score only', totalAccounts:100,actualRacers:20,waitingCustomers:80,stressModeRacers:100,targetLaps:3,
      finishersToEndMatch:3,podiumOrder:'finish arrival order, not MONEY',resultHoldSeconds:8,nextMatch:'matchmake active seats, new seed/map/finish, all registered wallets reset to1000',
      matchmaking:{reserveSeconds:15,heartTarget:30,retainedSeats:12,waitingSeats:8,reserveCountsOnlyNewWindowHearts:true,retainedOrder:'first to threshold',oldUnretainedJoinWaitingQueue:true,unfilledRetainedSeatsUseWaitingQueue:true,preserveWaitingAge:true,customersCanJoinEvents:true},
      finish: 'seeded bottom-of-map node, stable throughout a match',
      investment: { stake:100,joinSeconds:10,chartSeconds:8,upReturnBps:[12000,18000],downReturnBps:[1500,7000],hostParticipates:true },
      redEnvelope: { heartTarget:1000,potMin:1000,potMax:5000,ranking:'wallet plus held escrow',distribution:'half base plus half rank weighted, exact integer remainders',preserveUnfilledHeartsAcrossMatches:true },
      shop: { eventId:'SHOP01',hostMinimumWallet:120,setupCost:80,orderSeconds:12,returnSeconds:12,maxOrders:8,goodReward:30,cancelPenalty:5,customerWalletCharge:0,waitingCustomersOnly:true,oneOrderPerAccount:true,cancelOwnOrderOnly:true,chargeSetupOnce:true,realPurchase:false,preSettlementAbortRefund:80,refundAfterSettlement:false },
      queue: { roseCreditCap:2,likeScoreCap:1000,everyEligibleOncePerCycle:true,preserveUnusedRosePriorityAcrossMatches:true,giftsChangeDice:false,giftsChangeChart:false } },
    commandAliases: { join:['GÓP {hostTag}','THAM GIA {hostTag}'],pass:['BỎ {hostTag}','KHÔNG THAM GIA {hostTag}'],play:['CHƠI'],roll:['LẮC'],left:['TRÁI'],right:['PHẢI'],shopOrder:['{hostTag}'],shopCancel:['BOM {hostTag}'] },
    playback: { readChoicesOnce:true,countdownAtSeconds:[5,3],maxQueueAnnouncementsPerSeconds:12,
      maxEnvelopeSpokenRecipients:3,restUseShortLine:true,resultFromCommittedLedgerOnly:true,
      discardStaleCueKeys:true,cueKey:'matchId:eventSequence:phase',
      comment:'The MC repository owns TTS. A caption/voice completion callback never changes money or RNG.' },
    cues: MC_CUES };
}
