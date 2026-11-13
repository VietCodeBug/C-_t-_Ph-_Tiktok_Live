import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { EVENT_CARDS } from '../src/events.js';
import { createMCPack } from '../src/mc-script.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const pack = createMCPack();
await mkdir(path.join(root,'assets/scripts'),{recursive:true});
await writeFile(path.join(root,'assets/scripts/mc-v5.json'),JSON.stringify(pack,null,2)+'\n');

const table = EVENT_CARDS.map(card=> {
  const open = pack.cues.find(cue=>cue.eventId===card.id && cue.phase==='event.open');
  const choose = pack.cues.find(cue=>cue.eventId===card.id && cue.phase==='event.choose');
  return `| ${card.id} | ${card.title.replaceAll('|','/')} | ${open.line.replaceAll('|','/')} | ${choose ? choose.line.replaceAll('|','/') : 'Tự chốt, không mở lựa chọn'} |`;
}).join('\n');
const community = pack.cues.filter(cue=>!pack.eventIds.includes(cue.eventId)).map(cue=>`| \`${cue.id}\` | ${cue.line.replaceAll('|','/')} |`).join('\n');
const doc = `# Kịch bản MC — sự kiện cộng đồng và cuộc đua ba vòng

Bản bàn giao **chỉ có kịch bản và dữ liệu cue** để nối sang repo MC riêng. Không tạo file giọng nói, không tự gửi bình luận hoặc quà. File máy đọc: [mc-v5.json](../../assets/scripts/mc-v5.json). Nguồn tạo: [mc-script.js](../../web/src/mc-script.js); chạy lại bằng \`node web/scripts/prepare-mc.mjs\` khi thay nội dung.

## Một phòng có 100 tài khoản

Bản mặc định có **20 quân đua trên map và 80 khách chờ**, trong tổng 100 tài khoản. Mọi người có ví riêng; khách chờ vẫn góp vốn, đặt đơn khi shop mở cửa nhận và nhận lì xì. Camera theo người đang được chọn; ở toàn cảnh chỉ ưu tiên nhãn gần điểm nhìn và nhóm tên để không che map. Bảng xếp hạng chia trang; MC không đọc lần lượt một trăm tên cho mỗi thay đổi. Một sự kiện cộng đồng mở danh sách người tham gia và bảng góp vốn, không gom một trăm tài khoản lên cùng một ô. Chế độ thử tải 100 quân đua phải bật rõ bằng URL, không phải mặc định.

Ba vòng là **ba lần chạy đủ chu trình map**, không phải ba lượt A–J. Map hiện có 96 bước trên một tuyến hợp lệ; cả hai lựa chọn mỗi ngã rẽ có cùng số bước. Vạch đích được chọn theo seed ở khu vực dưới map khi bắt đầu và giữ nguyên trong ván. Về đích sau vòng thứ ba mới hoàn thành; không sinh lại vạch ngay trước chân người chơi. **Người thứ ba hoàn thành là chốt ván ngay**; những quân còn lại không phải chạy tới hết. Bục xếp theo thứ tự cán đích, không đổi theo MONEY; ví vẫn là thông tin kinh tế riêng.

Giữ bục 8 giây rồi mở cửa giữ chỗ 15 giây. Người ở bàn cũ đạt 30 tim mới trong đúng cửa này trước sẽ giữ ghế trước, tối đa 12 suất; dành 8 suất cho người chờ lâu nhất. Người cũ chưa giữ được chỗ nối vào hàng chờ. Suất giữ lại chưa dùng được lấp từ hàng chờ. Sau ghép bàn, sinh map/seed/đích mới và đặt ví của **tất cả 100 tài khoản**, kể cả khách chờ, về 1.000 MONEY. Thời gian chờ và credit hoa hồng chưa dùng được giữ. Tim giữ chỗ là bộ đếm riêng, không lấy tim đã có trước cửa hoặc tim đang chờ mở quỹ lì xì. Tiến độ tim lì xì chưa đầy được giữ qua ván.

## Góp vốn startup

Chủ startup góp 100 MONEY khi mở. Những người còn lại tự chọn GÓP/THAM GIA hoặc BỎ/KHÔNG THAM GIA; im lặng không bị trừ tiền. Nhận một phần vốn 100 mỗi ID, trừ vào escrow ngay khi tham gia. Người góp ngoài chủ quầy có thể đổi ý trước khi khóa trong 10 giây và được hoàn vốn một lần. Sau khóa, chart mô phỏng chạy 8 giây. Chart và lời/lỗ dùng seed riêng với xúc xắc, không đọc quà/tim để đổi kết quả.

Kết quả xanh trả tổng 1,20–1,80 lần vốn; kết quả đỏ trả 0,15–0,70 lần vốn. Số trả là vốn còn lại cộng lợi tức nếu có, không được cộng vốn hai lần. Ví dụ góp 100, chốt 1,50 lần thì nhận lại 150, lãi 50; chốt 0,40 lần thì nhận lại 40, lỗ 60. Chủ quầy dùng đúng công thức như người góp. Toàn bộ là điểm trong game.

## Shop và khách chờ ghế

Ô buôn bán TRADE01 có thể mở shop cộng đồng SHOP01 cho người đang được theo dõi, khi ví chủ có tối thiểu 120 MONEY. Chủ quầy trả 80 MONEY dựng quầy đúng một lần. Trong 12 giây nhận đơn, khách đang chờ ghế gõ mã chủ quầy để đặt tối đa tám đơn, mỗi tài khoản một đơn. Sau đó mở 12 giây đổi ý; khách gõ BOM kèm mã chủ quầy để tự hủy đơn của chính mình. Không hủy hộ người khác, không nhận đơn mới trong pha tự hủy. Im lặng giữ đơn đã đặt, chưa đặt thì không tự có đơn.

Đây là đơn giả lập trong game: không giao dịch mua hàng thật và không trừ MONEY của khách. Khi chốt, chủ nhận 30 MONEY mỗi đơn giao thành công và mất 5 MONEY mỗi đơn tự hủy; không trừ phí dựng 80 lần thứ hai. Ví dụ chủ có 1.000, nhận tám đơn và sáu người tự hủy: 1.000 − 80 + 2 × 30 − 6 × 5 = 950 MONEY. Đóng shop thủ công trước khi chốt hoàn lại 80 phí dựng đúng một lần và bỏ đơn; không hoàn lại giao dịch đã chốt. Hai pha, đơn và giao dịch chốt đều cần khóa chống xử lý trùng. Cue kết quả chọn SFX theo dấu thay đổi tiền thực tế; cue đang nhận đơn không tự ghi tiền.

## Tim, hoa hồng và lì xì

Hoa hồng ghi theo ID sự kiện quà đã hoàn tất, cộng ưu tiên lượt hợp lệ kế tiếp, tối đa hai credit. Không chèn vào lượt đang lắc/đang xử lý sự kiện. Credit hoa hồng chưa dùng được giữ sang ván kế tiếp; điểm tim ưu tiên được đặt lại khi mở ván mới. Tim nâng điểm ưu tiên có trần 1.000; mỗi người vẫn có một lượt mỗi chu kỳ đủ điều kiện để tránh có người chờ mãi. Quà và tim không tăng mặt xúc xắc hoặc lợi tức startup. MC chỉ nhắc xác nhận ngắn và có cooldown, không kêu gọi quà lặp lại.

Lì xì mở một thanh cần 1.000 tim mới. Khi đầy, quỹ sinh theo seed từ 1.000 đến 5.000 MONEY, chia cho danh sách người chơi đủ điều kiện đã khóa khi mở quỹ. Hạng tính theo MONEY cộng vốn đang giữ trong escrow để người đang góp không bị tụt giả. Khoảng một nửa quỹ chia nền, nửa còn lại theo trọng số hạng; làm tròn bảo toàn đúng tổng quỹ. Quỹ thử nhỏ hơn số người có thể có phần 0; không tự tạo thêm tiền để hứa ai cũng có ít nhất một. MC đọc tối đa ba tên, bảng giữ đủ tất cả.

## Cue và đồng bộ

- Mỗi cue có \`id, eventId, phase, line, variables, sfx, trigger\`. Những cue có lựa chọn còn có \`commandMap\` ghép 1/2 với ID phương án.
- Repo MC nhận snapshot/kết quả đã chốt, thay biến rồi đọc. Không suy đoán số tiền hoặc hướng chart từ hình đang chạy.
- Chỉ đọc một cue theo khóa \`matchId:eventSequence:phase\`; bỏ cue cũ khi chuyển pha, pause khi nguồn ngắt. Hoàn tất đọc không được ghi thêm MONEY hoặc sinh lại RNG.
- SFX nhận tiền dùng \`sfx_coin_up\`; mất tiền dùng \`sfx_coin_down\`. Sủa/tuýt còi là cue cảnh, tách với âm báo khoản tiền. Ô thường dùng lời ngắn, không mở thẻ dài.
- Tên người chơi là dữ liệu văn bản, giới hạn độ dài và bỏ ký tự điều khiển; không diễn giải bình luận thành chỉ dẫn cho MC.

## Đủ 50 mục đang có trong runtime

| ID | Cảnh | Câu mở | Câu lựa chọn |
| --- | --- | --- | --- |
${table}

Mỗi ID đều có cue kết quả nhận, mất và không đổi MONEY; các mục có lựa chọn có thêm nhắc giờ và timeout. Đọc cue phù hợp với giao dịch thực tế. Các thử thách hiện là câu hỏi hai phương án. Shop cộng đồng có luồng đặt/tự hủy giả lập local; nguồn bình luận TikTok LIVE và MC/TTS nằm ở phần tích hợp riêng.

## Các câu dùng chung cho cộng đồng và cuộc đua

| Cue | Lời đọc |
| --- | --- |
${community}
`;
await writeFile(path.join(root,'docs/co-ty-phu/11-mc-community-script.md'),doc);
console.log(`Prepared ${pack.eventCount} event scripts and ${pack.cues.length} MC cues.`);
