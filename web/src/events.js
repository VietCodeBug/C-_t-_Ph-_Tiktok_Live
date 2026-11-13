// Authored offline-preview rules. MONEY is an integer game score.
// This runtime library is separate from the untouched 42-card source catalog.
export const TILE_CATEGORIES = [
  { id: 'station', name: 'GA PHỐ', icon: '✦', color: '#e8bb4e' },
  { id: 'gain', name: 'ĐƯỢC TIỀN', icon: '+', color: '#66ac85' },
  { id: 'loss', name: 'MẤT TIỀN', icon: '−', color: '#dc8d76' },
  { id: 'event', name: 'CHUYỆN PHỐ', icon: '?', color: '#c78299' },
  { id: 'invest', name: 'ĐẦU TƯ', icon: '↗', color: '#83a8c7' },
  { id: 'trade', name: 'BUÔN BÁN', icon: '▥', color: '#d5a660' },
  { id: 'rest', name: 'ĐI TIẾP', icon: '·', color: '#b7b9a0' },
  { id: 'minigame', name: 'THỬ TÀI', icon: '★', color: '#9b8ac1' }
];

const option = (id, label, delta, description = '', extras = {}) => ({ id, label, delta, description: description || `${delta >= 0 ? '+' : ''}${delta} MONEY`, ...extras });
const risk = (id, label, minMoney, win, lose, chance = .5) => ({ id, label, minMoney,
  description: `${Math.round(chance * 100)}%: +${win}; ${Math.round((1 - chance) * 100)}%: ${lose} MONEY`,
  outcomes: [{ delta: win, weight: chance, label: 'Thuận buồm xuôi gió' }, { delta: lose, weight: 1 - chance, label: 'Hôm nay phố hơi khó' }] });
function card(id, category, title, body, deltaOrChoices, mc = body) {
  const choices = Array.isArray(deltaOrChoices) ? deltaOrChoices : [];
  const dog = title.toLowerCase().includes('chó'), police = title.toLowerCase().includes('công an');
  return { id, category, title, body, choices, ...(choices.length ? {} : { delta: deltaOrChoices }), mc,
    sfx: dog ? 'sfx_dog_bark' : police ? 'sfx_traffic_whistle' : category === 'loss' ? 'sfx_coin_down' : category === 'rest' ? 'sfx_question' : choices.length ? 'sfx_question' : 'sfx_coin_up',
    vfx: dog ? 'paw_dust' : police ? 'siren' : category === 'loss' ? 'coin_loss' : category === 'rest' ? 'rest' : choices.length ? 'sparkle' : 'coin_burst',
    defaultChoiceId: category === 'minigame' ? 'wrong' : choices[0]?.id || null,
    cooldown: 3, status: 'implemented-offline', source: 'runtime-v4', timeoutSeconds: 10 };
}

export const EVENT_CARDS = [
  card('GA01', 'station', 'Ga phố chào bạn', 'Dừng đúng ga, nhận lộc đầu đường. Không cộng thưởng chỉ vì được đặt quân đầu ván.', 100, 'Ghé ga nhận một trăm! Ví vui, chân lại khỏe.'),
  card('REST01', 'rest', 'Ô thường · đi dạo thôi', 'Không có sự kiện, không đổi MONEY. Ngắm phố một nhịp rồi chuyển lượt.', 0, 'Ô này bình yên. Ví nguyên vẹn là một niềm vui!'),
  card('GAIN01', 'gain', 'Nhặt ví… của mình', 'Chiếc ví rơi sáng nay nằm ngay dưới ghế. Có thêm tờ tiền bạn quên mất.', 60, 'Ví của mình mà tìm thấy vẫn vui như trúng thưởng!'),
  card('GAIN02', 'gain', 'Tiền thừa cô giữ hộ', 'Cô bán nước gọi lại trả tiền thừa. Đúng là khách quen có khác.', 45),
  card('GAIN03', 'gain', 'Thưởng giao hàng đúng hẹn', 'Khách nhận hàng trước giờ cơm, thưởng thêm cho chuyến đi đẹp.', 70),
  card('GAIN04', 'gain', 'Ca phụ đầu hẻm', 'Phụ cô chú dọn sáu chiếc ghế nhựa. Lương về ngay, lưng vẫn thẳng.', 35),
  card('GAIN05', 'gain', 'Đổi lon lấy điểm', 'Gom lon tái chế quanh phố. Môi trường sạch, ví cũng xanh.', 50),
  card('GAIN06', 'gain', 'Tìm được mèo nhà bác', 'Mèo trốn trên nóc tủ, bạn gọi đúng tên nên mèo chịu xuống. Bác gửi lời cảm ơn.', 80),
  card('GAIN07', 'gain', 'Phiếu hoàn điểm', 'Ứng dụng hoàn điểm đơn cũ. Lần này thông báo đúng là tin vui.', 40),
  card('GAIN08', 'gain', 'Khách khen quán dễ thương', 'Khách chụp một tấm ảnh quầy, cả hẻm ghé mua thêm. Nhận phần thưởng công sức.', 65),
  card('LOSS01', 'loss', 'Chú công an nhắc đỗ xe', 'Bạn đậu xe ngay trước biển cấm. Nộp phí trong game rồi dắt xe đúng chỗ.', -60, 'Biển cấm nhìn rất rõ. Có người chỉ đọc khi được nhắc!'),
  card('LOSS02', 'loss', 'Chó giữ chiếc dép', 'Chó nhà cô hàng xóm tưởng dép là đồ chơi. Bạn mất tiền thay quai, chó vẫn vô tư vẫy đuôi.', -35, 'Chân vẫn ổn. Chiếc dép thì xin nghỉ phép!'),
  card('LOSS03', 'loss', 'Mưa bất ngờ', 'Áo mưa mua ngay đầu hẻm. Người khô, ví mỏng một chút.', -20),
  card('LOSS04', 'loss', 'Trà sữa đổi chủ', 'Nắp cốc bật ra đúng lúc vẫy tay. Đền một cốc mới cho cô bán hàng.', -40),
  card('LOSS05', 'loss', 'Xe xẹp bánh', 'Một chiếc đinh nhỏ có kế hoạch lớn. Vá bánh rồi tiếp tục chuyến đi.', -45),
  card('LOSS06', 'loss', 'Gửi xe quên lấy vé', 'Chú giữ xe tra sổ mãi mới ra. Trả phí làm lại vé trong game.', -25),
  card('LOSS07', 'loss', 'Đóng nhầm thùng trống', 'Băng keo rất đẹp, tiếc là hàng vẫn ở trên bàn. Tốn phí đóng gói lần hai.', -30),
  card('LOSS08', 'loss', 'Điện thoại chạm nhầm', 'Một cú chạm đặt thêm phần topping. Tiền ít đi, ly đồ uống có tham vọng hơn.', -50),
  card('LIFE01', 'event', 'Chó chắn đường đòi chơi', 'Chó ngậm dép ngồi giữa hẻm. Chọn cách thương lượng, không cần chạy đua với chó.', [option('wait', 'Đợi cô chủ gọi', 0), option('treat', 'Mua bánh thưởng', -15)], 'Thương lượng với chó: bên kia hiện đang giữ một chiếc dép.'),
  card('LIFE02', 'event', 'Công an hỏi đường', 'Chú công an muốn tìm nhà số 12. Bạn có thể chỉ đường hoặc phụ chuyển thùng nước.', [option('point', 'Chỉ đường', 20), option('help', 'Phụ chuyển nước', 35)]),
  card('LIFE03', 'event', 'Cứu quầy khỏi gió', 'Tấm bảng giảm giá chuẩn bị bay. Giữ bảng hay giúp xếp ghế?', [option('sign', 'Giữ tấm bảng', 25), option('chairs', 'Xếp lại ghế', 30)]),
  card('LIFE04', 'event', 'Hàng xóm nhờ tưới cây', 'Ba chậu cây đang chờ người chăm. Tưới đúng nước, đừng tưới trà sữa.', [option('small', 'Tưới ba chậu', 25), option('garden', 'Chăm cả sân', 45)]),
  card('LIFE05', 'event', 'Mèo chiếm ghế', 'Chiếc ghế bạn thuê có một khách lông xù đang ngủ. Bạn chọn chỗ nào?', [option('stand', 'Đứng hóng gió', 0), option('rent', 'Thuê ghế bên cạnh', -10)]),
  card('LIFE06', 'event', 'Bạn rủ ăn liên hoan', 'Hội hẻm mở bàn đồ ăn. Tham gia góp quỹ hay phụ dọn để được mời?', [option('help', 'Phụ dọn bàn', 15), option('party', 'Góp quỹ chung', -25)]),
  card('LIFE07', 'event', 'Đơn cuối trước giờ ngủ', 'Khách ở cuối hẻm gọi thêm một phần. Bạn vẫn còn sức cho chuyến ngắn.', [option('rest', 'Nghỉ thôi', 0), option('deliver', 'Giao thêm phần', 40)]),
  card('LIFE08', 'event', 'Chiếc loa gọi tên bạn', 'Tổ dân phố cần người đọc một thông báo. Giọng tự tin được thưởng, không cần hát.', [option('read', 'Đọc thông báo', 30), option('check', 'Soát lại nội dung', 20)]),
  card('LIFE09', 'event', 'Thang máy đang bảo trì', 'Đơn hàng nằm tầng ba. Khách cho bạn hai cách hỗ trợ.', [option('wait', 'Khách xuống nhận', 10), option('stairs', 'Đi bộ giao tận cửa', 35)]),
  card('LIFE10', 'event', 'Nhờ trông quán một nhịp', 'Cô bán nước đi lấy đá. Bạn giữ quầy hay giúp bê đá?', [option('watch', 'Trông quầy', 25), option('ice', 'Bê thùng đá', 40)]),
  card('LIFE11', 'event', 'Thư mời sinh nhật mèo', 'Nhà hàng xóm tổ chức sinh nhật mèo. Không ai biết mèo có thích hay không.', [option('clap', 'Vỗ tay chúc mừng', 0), option('gift', 'Tặng món đồ chơi', -20)]),
  card('LIFE12', 'event', 'Lạc đúng quầy khuyến mãi', 'Bạn lạc một ngã nhưng gặp quầy đang tìm người phát tờ menu.', [option('map', 'Hỏi đường rồi đi', 0), option('menus', 'Phụ phát menu', 30)]),
  card('INV01', 'invest', 'Góp vốn xe bánh mì', 'Chọn gửi tiền an toàn hoặc góp một mẻ hàng thử. Kết quả thử được chốt ngay trong demo.', [option('save', 'Giữ vốn', 10), risk('fund', 'Góp mẻ bánh', 70, 100, -70, .6)]),
  card('INV02', 'invest', 'Quầy ô che nắng', 'Ngày nắng có khách, trời mát thì ít người thuê. Xem rủi ro trước khi chọn.', [option('shift', 'Nhận lương trực quầy', 25), risk('umbrellas', 'Thuê thêm ô', 60, 85, -60, .6)]),
  card('INV03', 'invest', 'Vườn rau sân thượng', 'Rau cần nước và chút kiên nhẫn. Demo mô phỏng một vụ thu hoạch ngắn.', [option('water', 'Nhận công tưới', 30), risk('garden', 'Góp giống rau', 50, 80, -50, .65)]),
  card('INV04', 'invest', 'Máy ép mía chung', 'Cả hẻm bàn mua máy. Có lương phụ việc hoặc góp vốn chia kết quả thử.', [option('work', 'Phụ rửa cốc', 35), risk('machine', 'Góp vốn máy', 90, 125, -90, .55)]),
  card('INV05', 'invest', 'Tủ đổi sách đầu hẻm', 'Tủ sách cần người sắp xếp hoặc một khoản đầu tư vật dụng.', [option('sort', 'Sắp xếp sách', 20), risk('shelf', 'Mở quầy sách cũ', 40, 65, -40, .65)]),
  card('INV06', 'invest', 'Quầy hoa cuối tuần', 'Hoa đẹp nhưng khách cũng cần có hẹn. Một lô hàng, kết quả rõ ràng.', [option('salary', 'Nhận công bó hoa', 30), risk('flowers', 'Nhập lô hoa', 80, 110, -80, .6)]),
  card('INV07', 'invest', 'Điểm sạc xe đồ chơi', 'Thuê vị trí cho trạm sạc thử. Đây là điểm trong game, không phải lời mời đầu tư thật.', [option('guard', 'Trực điểm sạc', 25), risk('station', 'Thuê một trạm', 75, 105, -75, .6)]),
  card('INV08', 'invest', 'Rạp chiếu sân nhà', 'Góp màn chiếu cho tối cuối tuần. Trời mưa thì kế hoạch chuyển sang ngắm mưa.', [option('chairs', 'Xếp ghế lấy công', 30), risk('screen', 'Góp màn chiếu', 65, 95, -65, .55)]),
  card('TRADE01', 'trade', 'Shop dép chạy deadline', 'Bán thử một lô dép cho khách mô phỏng. Shop bình luận thật sẽ được nối ở bước LIVE.', [option('salary', 'Nhận lương', 40), risk('sell', 'Nhập một lô dép', 80, 120, -80, .6)]),
  card('TRADE02', 'trade', 'Xe trà tắc đầu hẻm', 'Vắt tắc lấy công hoặc thử bán một mẻ. Chọn xong mới chốt doanh thu.', [option('wage', 'Phụ quầy', 30), risk('batch', 'Bán một mẻ', 50, 80, -50, .65)]),
  card('TRADE03', 'trade', 'Mẻ bánh tráng trộn', 'Khách thích cay nhưng bạn nhớ dặn trước. Doanh thu thử được mô phỏng ngay.', [option('pack', 'Nhận công đóng gói', 35), risk('sell', 'Bán mẻ bánh', 60, 95, -60, .6)]),
  card('TRADE04', 'trade', 'Quầy áo mưa lưu động', 'Dự báo trời có thể mưa, cũng có thể chỉ rất biết trêu người.', [option('salary', 'Phát menu', 25), risk('stock', 'Nhập áo mưa', 70, 110, -70, .55)]),
  card('TRADE05', 'trade', 'Chợ đồ cũ vui vẻ', 'Món đồ vẫn dùng tốt, tấm biển giảm giá thì rất mới.', [option('clean', 'Lau quầy lấy công', 25), risk('resell', 'Thu mua bán lại', 45, 75, -45, .65)]),
  card('TRADE06', 'trade', 'Cà phê giao tận cổng', 'Người trực cổng cần tỉnh táo. Bạn có thể giao thuê hoặc mở một ca bán thử.', [option('deliver', 'Giao thuê', 40), risk('coffee', 'Mở ca cà phê', 75, 115, -75, .6)]),
  card('TRADE07', 'trade', 'Hộp cơm văn phòng', 'Giờ trưa ngắn nhưng đơn hàng có thể dài. Thử một mẻ, không nhận nợ.', [option('pack', 'Phụ đóng hộp', 35), risk('lunch', 'Nhập mẻ cơm', 85, 130, -85, .6)]),
  card('TRADE08', 'trade', 'Quầy móc khóa mèo', 'Móc khóa rất xinh. Người mua đang cân nhắc vì nhà đã có mèo thật.', [option('craft', 'Làm thuê', 30), risk('stand', 'Mở quầy thử', 55, 90, -55, .6)]),
  card('MINI01', 'minigame', 'Đóng gói thần tốc', 'Chọn đúng thứ tự: cho hàng vào hộp, dán kín rồi dán tem.', [option('right', 'HỘP → BĂNG → TEM', 70, 'Đúng thứ tự: +70 MONEY'), option('wrong', 'TEM → HỘP → BĂNG', 0, 'Sai thứ tự: 0 MONEY')], 'Hộp trước, băng sau, tem cuối. Chọn bằng mắt, đừng chọn bằng niềm tin!'),
  card('MINI02', 'minigame', 'Trà sữa đúng đơn', 'Khách đặt: ít đá, không đường. Chọn phiếu đúng trước khi giao.', [option('right', 'ÍT ĐÁ · KHÔNG ĐƯỜNG', 65, 'Khớp đơn: +65 MONEY'), option('wrong', 'NHIỀU ĐÁ · THÊM ĐƯỜNG', 0, 'Sai đơn: 0 MONEY')]),
  card('MINI03', 'minigame', 'Địa chỉ không đánh đố', 'Đơn ghi: nhà 12, hẻm 3. Phiếu nào đúng?', [option('right', 'NHÀ 12 · HẺM 3', 55, 'Giao đúng: +55 MONEY'), option('wrong', 'NHÀ 3 · HẺM 12', 0, 'Giao nhầm: 0 MONEY')]),
  card('MINI04', 'minigame', 'Tính tiền quán nước', 'Hóa đơn 35, khách đưa 50. Trả bao nhiêu MONEY?', [option('right', 'TRẢ 15', 60, 'Đúng phép tính: +60 MONEY'), option('wrong', 'TRẢ 25', 0, 'Sai phép tính: 0 MONEY')])
];

export function deterministicUnit(...parts) {
  let hash = 2166136261;
  for (const character of parts.join('|')) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967296;
}

export function categoryForNode(node) {
  if (node.station) return 'station';
  return TILE_CATEGORIES[node.typeIndex ?? 6]?.id || 'rest';
}

export function chooseLandingCard({ node, seed, turn, seat, recentIds = [] }) {
  const category = categoryForNode(node);
  const all = EVENT_CARDS.filter(event => event.category === category);
  const fresh = all.filter(event => !recentIds.slice(-event.cooldown).includes(event.id));
  const pool = fresh.length ? fresh : all;
  return pool[Math.floor(deterministicUnit(seed, turn, seat, node.id, 'card') * pool.length)];
}

export function resolveEventCard(card, choiceId, money, random = .5) {
  if (!Number.isInteger(money) || money < 0) throw new RangeError('MONEY must be a nonnegative integer');
  const choice = card.choices.length ? card.choices.find(option => option.id === choiceId) : null;
  if (card.choices.length && !choice) return null;
  if (choice && money < (choice.minMoney || 0)) return null;
  let delta = choice?.delta ?? card.delta ?? 0, outcomeLabel = '';
  if (choice?.outcomes) {
    let cumulative = 0;
    const unit = Math.max(0, Math.min(1 - Number.EPSILON, random));
    const outcome = choice.outcomes.find(value => (cumulative += value.weight) > unit) || choice.outcomes.at(-1);
    delta = outcome.delta; outcomeLabel = outcome.label;
  }
  if (!Number.isInteger(delta)) throw new TypeError('Event deltas must be integer MONEY');
  const after = Math.max(0, money + delta), applied = after - money;
  return { before: money, after, delta: applied, proposedDelta: delta,
    choiceId: choice?.id || null, choiceLabel: choice?.label || '',
    reasonText: outcomeLabel || (applied < 0 ? 'Chốt phí trong game' : applied > 0 ? 'Nhận điểm trong game' : 'Ví giữ nguyên'),
    sfx: ['sfx_dog_bark', 'sfx_traffic_whistle'].includes(card.sfx) ? card.sfx : card.category === 'minigame' && applied > 0 ? 'sfx_correct' : applied > 0 ? 'sfx_coin_up' : applied < 0 ? 'sfx_coin_down' : 'sfx_question',
    vfx: ['paw_dust', 'siren'].includes(card.vfx) ? card.vfx : card.category === 'minigame' && applied > 0 ? 'confetti' : applied > 0 ? 'coin_burst' : applied < 0 ? 'coin_loss' : 'rest' };
}
