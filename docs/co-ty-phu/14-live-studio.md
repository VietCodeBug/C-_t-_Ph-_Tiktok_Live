# Cờ Tý Phí — TikTok LIVE, MC và khung phát 9:16

**Cập nhật lượt chơi:** LIVE và Demo dùng lượt tuần tự: lắc, đi đủ bước, chốt lựa chọn/sự kiện rồi mới chuyển người. Chào người mới và ưu tiên hoa hồng không cắt ngang lượt đang xử lý. Chỉ một quân được thực hiện lượt tại một thời điểm; giới hạn bàn vẫn là 20 người.

Phần LIVE này được đưa vào nhánh `web/third-person-v23` sau bản V5 offline. Luật sự kiện, tiền và chart vẫn xem tại [tài liệu logic V5](13-event-logic-guide.md); tài liệu này giải thích cách nhận người thật, chào/lắc, thay ghế, đọc MC và vận hành livestream.

## 1. Chạy trên Windows

1. Cài Node.js **22.12 trở lên**. Mở đầy đủ repo, không chỉ thư mục `web/dist`.
2. Nhấp **`start-live.cmd`** ở gốc. Lần đầu cần Internet để cài thư viện; script dựng asset và build hai màn game.
3. Giữ cửa sổ terminal mở trong buổi phát.
4. Mở [bảng quản lý](http://127.0.0.1:5182/admin).

| Trang | Mục đích |
| --- | --- |
| `http://127.0.0.1:5182/admin` | Kết nối TikTok, cài MC, xem ghế/hàng chờ, pause và điều khiển |
| `http://127.0.0.1:5182/overlay` | Khung phát 9:16, chỉ dữ liệu LIVE |
| `http://127.0.0.1:5182/demo` | Tự mở 20 người mô phỏng để xem ngay; tách dữ liệu LIVE |

Server chỉ nghe trên localhost. Đây là tool trên máy phát, không phải website công khai để người xem đăng nhập. Khi cần đổi cổng, đặt biến môi trường `COTYPHI_PORT`; các địa chỉ trong tài liệu dùng cổng mặc định 5182.

Dừng bằng **Ctrl+C một lần** ở terminal hoặc `stop-live.cmd`. Server ngắt TikTok, dừng nhận lệnh và lưu cấu hình/biên nhận chống trùng trước khi đóng. Nếu có lỗi ghi hoặc chưa dừng được, đọc thông báo terminal; không đóng cưỡng bức giữa lúc đang chốt sự kiện.

Chạy bằng lệnh tương đương:

```powershell
cd web
npm ci
npm run build
npm run live
```

`start-local.cmd` vẫn mở bản offline cũ ở port 4173 để duyệt asset; nó không phải server TikTok LIVE. Mở thêm overlay không tạo thêm bộ luật: server Node giữ ván và ví, các trang chỉ vẽ snapshot.

## 2. Thử trước khi mở LIVE thật

Mở trực tiếp `/demo`: khi phòng demo còn trống, server tạo 20 người mô phỏng một lần rồi chạy. Mở lại hoặc mở hai tab không tự nhân thành 40 người. Trong Admin, chọn **Phòng mô phỏng** để xem bàn đó; bấm **Một người mới vào**, **20 người vào** hoặc **+80 khách chờ** khi muốn thử sân chờ. Chọn một trong bảy quà ở danh sách rồi bấm **Tặng quà thử** để xem đúng hiệu ứng. Hand Heart đang chờ lúc pause sẽ chia quỹ sau khi tiếp tục. Dùng `/demo?overview=1` khi muốn xem toàn cảnh map và các sân chờ; `/demo` giữ camera tự động.

Các link **Mở Demo**, **Mở LIVE**, **Quản lý** nằm ngoài khung 9:16 khi xem bình thường, kể cả trên màn hình dọc. Dùng `?capture=1` hoặc fragment `#tiktok.studio` để ẩn dải điều hướng khi lấy hình phát. Trên bản LIVE không còn nhãn TikTok LIVE/trạng thái kết nối ở góc trên; trạng thái nguồn xem tại Admin. Bản demo vẫn có nhãn nhỏ MÔ PHỎNG.

Trong khung phát, **bên trái là top MONEY** của người trong bàn và khách chờ; **bên phải là bảy icon quà TikTok thật và quà vừa nhận**. Feed chỉ hiện combo đã chốt, chống lặp; bản thân biên nhận không cộng MONEY. Hoa hồng cấp ưu tiên lắc; Hand Heart có luật lì xì ảo cả phố; các quà còn lại chỉ có hiệu ứng như mô tả ở mục 6.

Kiểm tra lần lượt:

- Người mới có tên, quân và lời chào; camera tới lượt lắc chào rồi trả về lượt đang chơi tiếp.
- Khi đủ 20 ghế, người tiếp theo vào hàng chờ, hiện trong sân bằng đám đông nhẹ; không sinh thêm runner đua.
- Chọn một người, gửi `LẮC`, `TRÁI`, `PHẢI` hoặc `1`/`2` ở cửa thích hợp.
- Cho một người rời; đầu hàng chờ được nhận ghế, bắt đầu tiến độ đua của chính mình. Những quân khác giữ nguyên vị trí và tiền.
- Thử các ô nhận tiền, mất tiền, góp vốn, shop, nghỉ và thử tài.
- Bật âm thanh trong **chính khung game** đang được lấy vào Studio; nghe thử MC và kiểm tra mixer.

Nút giả lập bị giới hạn ở phòng demo. LIVE trống sẽ hiện khu phố chờ người, không tự tạo 20/100 người giả. Số người xem TikTok, số quân đang chơi và số khách chờ là ba con số khác nhau.

## 3. Kết nối TikTok và đưa vào LIVE Studio

1. Mở LIVE bằng TikTok LIVE Studio hoặc ứng dụng TikTok như bình thường. Tool này đọc sự kiện; nó không tự bắt đầu buổi livestream.
2. Admin → **TikTok LIVE** → nhập username của chủ phòng, có thể có hoặc không có `@` → **Kết nối LIVE**.
3. Chờ trạng thái đã kết nối. Thử một bình luận từ tài khoản khác để kiểm tra tên và lệnh thực nhận.
4. Trong LIVE Studio, thêm nguồn **Link/Liên kết** tới `http://127.0.0.1:5182/overlay#tiktok.studio`, đặt **1080 × 1920**.
5. Bật âm thanh nguồn và cấp quyền bằng nút **Bật âm thanh MC** trong đúng trang game. Fragment `#tiktok.studio` không tự cấp quyền autoplay.
6. Nếu Studio không nhận localhost hoặc không cho thao tác bật tiếng, mở overlay trong Chrome rồi dùng **nguồn cửa sổ** và âm thanh cửa sổ đó. Chỉ giữ một đường thu tiếng game để tránh vang.

Username mặc định để trống và server không tự kết nối khi khởi động. Chưa cần mở LIVE để chạy thử phần game/MC bằng phòng demo. Kết nối thật vẫn phụ thuộc TikTok, connector và dịch vụ ký; bản bàn giao được thử bằng payload mô phỏng, không đại diện cho việc đã kết nối phòng thật của bạn.

Đầu nối dùng `tiktok-live-connector@2.5.0`, cùng bản đã dùng trong repo nguồn. Nếu dịch vụ ký yêu cầu khóa, cấp `SIGN_API_KEY` qua biến môi trường trên máy chạy; không đưa khóa vào source hoặc Git. Lỗi kết nối có báo tại Admin, có reconnect/backoff; khi phòng đã kết thúc có thể cần bấm kết nối lại cho buổi mới.

## 4. Người mới, lượt lắc chào và camera

Mỗi người có một ID TikTok ổn định và mã ghế game dạng `P001`. Nickname chỉ dùng hiển thị/đọc; đổi tên không tạo ví mới. Khung 20 quân dùng 20 mẫu nhân vật sẵn có. Khách chờ có dữ liệu ví/hàng và hình chibi nhẹ trong sân, không có bộ điều khiển đua riêng.

### Map và sân chờ

Map có 138 node, mỗi tuyến một vòng đi 96 cạnh; ba vòng là 288 cạnh thật. **60/96 ô trên mọi tuyến là ô thường (62,5%)**, tổng graph **87/138 ô thường**. Seed chọn lại mẫu loại ô trong các ràng buộc này; mọi ba ô liên tiếp đều gặp ít nhất một ô thường. Gạch xoay theo tiếp tuyến của đường cong. Ô thường không mở sự kiện tiền và MC không đọc câu nghỉ.

Tám sân chờ có **25 vị trí nền mỗi sân**, đường vào riêng và khoảng tránh công trình/đường đua. Khách giữ vị trí khi người đầu hàng lên ghế; đông hơn 200 thì bố trí các lớp billboard nhỏ trong cùng sân. Các hình dùng atlas/instancing chung, không biến khách chờ thành hàng trăm nhân vật đua đầy đủ. Khi nhận ghế mới có runner và tiến độ ba vòng của riêng mình.

Mặc định **tự xếp ghế khi nhận sự kiện người vào**. Nếu còn ghế, người đó được tạo quân; nếu đầy, nối cuối hàng chờ. Có thể tắt trong Admin để chỉ đăng ký khi người xem gõ `CHƠI`.

Khi một người thật sự nhận ghế:

1. Đưa họ vào hàng chào có giới hạn, không chặn toàn bộ ván vì hàng trăm người vào cùng lúc.
2. Hiện tên, camera theo quân mới và mở một lần lắc chào.
3. Giữ góc trong pha quay xúc xắc và hiện kết quả; sau đó trả camera về lượt đang tiếp tục. Những quân khác vẫn chạy đồng thời.
4. Lệnh hoặc gói vào phòng bị gửi lặp không được tạo thêm quân hay thêm một lượt chào cho cùng lần vào.

Khách chờ được thông báo tên/vị trí và lời chào gộp khi đông; chưa có ghế thì chưa chạy quân hoặc dùng xúc xắc để cộng tiến độ. Lúc được thăng từ hàng chờ mới nhận quân/lượt chào.

Một người mới vào giữa ván bắt đầu từ vạch xuất phát với tiến độ riêng. Họ không thừa hưởng vòng, bước hoặc vị trí của người rời; ví của tài khoản được dùng theo luật đang có. Hạn chọn đường/sự kiện của người thật đều 10 giây, không dùng mẹo bot ngoài camera tự chọn sau 3 giây của bản offline.

## 5. Người rời phòng và nhường ghế

Các cách game biết cần giải phóng ghế:

- Tín hiệu rời rõ ràng nếu nguồn thực sự phát ra.
- Chính người chơi gõ `RỜI`/alias rời được hỗ trợ.
- Người vận hành chọn **Cho rời bàn / hàng chờ**.
- Hết hạn không có hoạt động mới; mặc định 300 giây và chỉnh được trong Admin.

**TikTok connector không bảo đảm có sự kiện rời của từng người.** Không suy ra người nào rời từ `member.action`, hoặc vì tổng người xem giảm. Hạn 5 phút là quy tắc nhường ghế khi vắng hoạt động, có thể áp dụng cả người vẫn xem nhưng không tương tác; hãy chọn thời gian phù hợp với phòng.

Khi một người rời, lấy người đầu hàng chờ còn hợp lệ. Không reset tiến độ/tiền của cả bàn. Nếu đang có sự kiện chung chưa chốt, việc rời được giữ lại đến ranh giới an toàn để không mất vốn hoặc chốt hai lần. Người vừa rời không tự được điền lại vào chính ghế trống đó.

Mất mạng nguồn khác với người xem chủ động rời: server pause ván, giữ danh sách/ví và cho khoảng vắng nguồn không làm hết hạn hoạt động hàng loạt. Khi kết nối trở lại, tiếp tục ván; không tự cho người chờ chiếm hết ghế chỉ vì mạng bị ngắt.

## 6. Lệnh, tim và quà

| Đầu vào | Tác dụng |
| --- | --- |
| `CHƠI` | Đăng ký ghế/hàng chờ nếu chưa có |
| `LẮC` | Yêu cầu lắc cho quân mình đang sẵn sàng; hết thời hạn chờ có thể tự lắc |
| `TRÁI` / `PHẢI` | Chủ quân chọn đường; khách chờ bỏ phiếu cho quân đang được theo dõi |
| `1` / `2` | Chọn phương án trên thẻ của chính người gửi |
| `GÓP`, `THAM GIA` | Góp 100 vào startup đang mở; có thể thêm mã chủ |
| `KHÔNG THAM GIA`, `BỎ` | Không góp/rút đúng vốn trước khi khóa; chủ không tự rút |
| `MUA P001` hoặc `P001` | Khách chờ đặt một đơn shop đang nhận đơn |
| `BOM P001`, `TRẢ P001` | Tự hủy đúng đơn trong pha đổi ý |
| `RỜI` | Xin rời bàn/hàng chờ |
| Gói tim thật | Ưu tiên lắc có trần, thanh lì xì và bộ đếm giữ ghế đúng cửa |
| Hoa hồng đã chốt | Tối đa hai credit; lần lắc hợp lệ kế tiếp được đưa lên camera sau khi xúc xắc đang hiển thị kết thúc |
| Hand Heart đã chốt | Quỹ MONEY ảo cả phố gồm khách chờ; có hàng chờ/giãn quỹ khi bận |

Sự kiện bình luận/tim/quà dùng ID gói để chống trùng. Combo quà xử lý phần đã chốt, không tính lại tổng combo ở mỗi lần cập nhật; gói chốt trùng và gói cũ từ phòng khác được lọc. Gói quà đã mua vẫn được ghi nhận ưu tiên trong lúc nguồn đang pause; nó không tự unpause ván.

Mã hoa hồng mặc định là `5655`. Có thể cấu hình `gifts.roseIds` qua settings API nếu khu vực dùng mã khác. Nhận diện dùng ID hoặc alias tên chuẩn hóa khớp chính xác; ID đã biết thắng tên nếu hai trường mâu thuẫn. Không suy ra quà từ mức xu. Icon nguồn thật và metadata nằm trong [manifest](../../assets/ui/tiktok-gifts/manifest.json), luật trong [gift-catalog.js](../../web/src/gift-catalog.js).

| Quà | ID đã xác minh | Luật |
| --- | --- | --- |
| Rose / Hoa hồng | 5655 | Ưu tiên lắc hợp lệ kế tiếp, tối đa hai credit chờ |
| Heart Me | 7934 | Hiệu ứng trái tim |
| Doughnut | 5879 | Giấy màu |
| Hand Heart | 5660, 5924 | Lì xì MONEY cả phố |
| Hearts | 5586 | Dải tim |
| Corgi | 6267 | Corgi ghé chào |
| Money Gun | 7168 | Vệt sáng ăn mừng |

Heart Me được xác minh theo tên/ID, không gán nhầm một quà “Hear Me Out” theo con số 9 trong ảnh tham khảo. Icon của biên nhận có thể dùng URL HTTPS CDN TikTok đã lọc; luôn có bản icon local dự phòng.

Hoa hồng **không ngắt xúc xắc đang được camera chiếu**. Khi hết pha quay/kết quả, người tặng có quân sẵn sàng được lắc và theo camera, kể cả đã phục vụ trong chu kỳ trước; chỉ mất một credit khi dispatch thật sự thành công. Quân đang đi không bị lắc lại. Người chờ giữ credit đến khi có ghế, quà không cấp ghế. Các lần lắc/chuyển động nền của 20 quân vẫn đồng thời.

Hand Heart yêu cầu một quỹ ảo **1.000–5.000 MONEY**, chia cho mọi tài khoản đang hiện diện/đã vào ván, gồm người chờ, theo hạng ví cộng vốn đang giữ. Tổng phần trả bằng đúng quỹ; không trừ ví người tặng. Nếu có modal, đang pause, ở bục hoặc chưa qua 30 giây từ quỹ quà trước, giữ tối đa một yêu cầu và gộp các yêu cầu thêm. Mỗi biên nhận combo chốt yêu cầu một quỹ, không nhân theo số lượng combo. Danh sách nhận được xét lúc trả; quỹ quà riêng không thay, tự lấp hay xóa thanh tim đang gom. Các quà hiệu ứng khác không đổi MONEY, bước/vòng hoặc mặt xúc xắc.

## 7. MC và microphone của người dẫn

Logic lấy từ repo nguồn là **giọng MC/TTS đầu ra**, không phải nhận dạng tiếng nói hoặc thu microphone. Mic thật của streamer chọn trực tiếp trong LIVE Studio; game không tự mở mic, không ghi âm và không thêm vòng monitor mic.

MC chỉ đọc lời game tạo ra bằng **một câu ngắn**: `Minh ra 4, đi 4 ô.`, `Minh: Chó giữ chiếc dép. -35.`, `Minh: 1 Đợi cô chủ, 2 Mua bánh.` Kết quả giữ tiêu đề nguyên nhân tối đa tám từ và số tiền ròng; không đọc lại phần nội dung thẻ hoặc toàn bộ số dư. Ô thường/nghỉ im lặng. Startup/shop chỉ đọc lệnh, đổi pha và net kết quả; lì xì đọc quỹ/số người, không đọc 100 tên. Không đọc nguyên văn chat. Tên được làm sạch; tên không phù hợp được chào chung. Chào đông được gộp, có cooldown, hàng đọc giới hạn và bỏ câu cũ để giọng không trễ hơn game.

- Giọng chính: Edge TTS, tiếng Việt Hoài My/Nam Minh. Không có khóa TTS bắt buộc trong thư viện này, nhưng cần Internet và dịch vụ hoạt động.
- Có giọng trực tuyến dự phòng từ logic repo nguồn và fallback tiếng Việt cài trong trình duyệt. Giọng dự phòng có thể không giữ đúng giới tính/tốc độ đã chọn; lỗi có thông báo, caption vẫn hiện.
- Câu MC được server xác nhận trước khi phát TTS; không thể dùng API này để đọc tùy ý một bình luận thô.
- Phát MC không sửa ví, bốc lại RNG hoặc chốt sự kiện. Nhiều cửa sổ xem dùng cùng một ván; bật âm thanh ở một cửa sổ cho mỗi chế độ để tránh đọc lặp.
- Game hạ âm lượng SFX khi MC đang nói, sau đó trả lại. Nút nghe thử trong Admin chỉ để kiểm tra giọng tại đó; khi phát thật dùng tiếng của overlay.

Cần bấm mở âm thanh sau khi tạo lại nguồn/trình duyệt nếu autoplay bị chặn. Nếu không nghe tiếng, kiểm tra nguồn âm Studio, mixer, quyền autoplay, Internet và thông báo trên nút MC; không chỉ nhìn việc caption đã xuất hiện.

### Nhạc nền

Chỉ phát một bài gốc **Cờ Tý Phí LIVE Theme (Alt Take)**, lấy từ [assets/co-ty-phu/audio](../../assets/co-ty-phu/audio), chép nguyên byte thành [assets/audio/music/co-ty-phi-live-theme-alt-take.m4a](../../assets/audio/music/co-ty-phi-live-theme-alt-take.m4a). Bản build phục vụ ở `/runtime/music/co-ty-phi-live-theme-alt-take.m4a` và lặp lại bài này. Manifest ghi nguồn/hash để kiểm tra bản chép; không dùng hai bài nhạc mượn từ repo boss raid.

Bấm **Bật âm thanh** để mở cả nhạc và MC trong cùng thao tác. Có nút nhạc riêng trên khung phát; Admin có **Bật nhạc nền** và thanh âm lượng độc lập. Nhạc mặc định 14%; khi MC đang đọc, nhạc tạm còn 25% mức đã chọn rồi trở lại. Tắt MC không tắt nhạc, và tắt nhạc không tắt MC. Trong cùng một chế độ, tab vừa được bật âm thanh sẽ giữ quyền phát để tránh hai bản nhạc chồng nhau.

Trình duyệt có thể chặn tự phát trước khi bấm mở tiếng. Mỗi bản thu LIVE chỉ nên bật một đường âm thanh game. Với kiểm tra thủ công phòng demo trống, dùng `/demo?empty=1` để bỏ bước tự mở 20 người.

## 8. Kết thúc ván và phòng ít người

Phòng bình thường từ ba người: **ba người đầu hoàn thành ba vòng** chốt ván, giống V5. Nếu chỉ có một hoặc hai người thật, số người cần về đích được giảm tương ứng để phòng ít không mắc kẹt mãi; tăng lên tối đa ba khi có thêm người hợp lệ trước khi ván kết thúc. Người đã về đích được giữ kết quả dù rời bàn sau đó; snapshot bục không phụ thuộc sprite còn trong phòng.

Bục 8 giây → cửa giữ ghế 15 giây → ván mới. Mặc định 20 ghế: 12 người cũ đầu tiên đủ 30 tim mới giữ ghế; các ghế còn lại lấy FIFO. Cửa giữ ghế chỉ xét người cũ còn hiện diện/hợp lệ, không tạo quân thay thế bằng bot để đủ số lượng.

## 9. Dữ liệu lưu và giới hạn bàn giao

`web/runtime/` lưu cấu hình và biên nhận chống trùng TikTok bằng ghi file nguyên tử. Thư mục này bị ignore và không đưa lên Git. Không có mật khẩu/cookie TikTok đi kèm bản bàn giao.

**Hiện chưa lưu phục hồi toàn bộ ván giữa chừng:** restart server bắt đầu phòng mới; cấu hình và biên nhận đã lưu vẫn còn, nhưng ví/roster/tiến độ đang chơi không phải checkpoint bền vững. Reload riêng overlay thì không reset ván vì server vẫn giữ luật. Muốn khôi phục nguyên ván sau mất điện cần bổ sung lưu trạng thái luật/SQLite và kiểm thử phục hồi.

Nguồn sự kiện là connector, không phải API cam kết hiện diện chính xác từng giây. Lệnh đến trễ, lượng người vào lớn, dịch vụ ký và mạng thực tế cần thử trên phòng LIVE của bạn trước khi phát chính thức. Không ghi trong báo cáo rằng đã nhận comment thật khi chỉ chạy mô phỏng.

## 10. Phần lấy từ repo boss raid và phần giữ trong game cờ

Nguồn tham chiếu: [tiktok-live-boss-raid](https://github.com/VietCodeBug/tiktok-live-boss-raid), commit `e0fc25472e896759cba8ce11c19bad15149e5b7c`.

Các phần được đọc/điều chỉnh: `server/tiktok.js`, `server/webcast.js`, adapter nền trong `reference/threejs-base`, `server/tts.js`, `server/state-writer.js`, `src/raid-audio.js` và `src/speech-policy.js`. Chúng được viết lại thành các module độc lập của Cờ Tý Phí, bỏ phụ thuộc engine boss.

Nhạc phát hiện tại là bài gốc của **Cờ Tý Phí** nêu trên; không dùng nhạc boss raid. Không nhập boss, lính/súng, sát thương, kỹ năng, HP, video quà hoặc submodule nghiên cứu của boss raid. Nhà/map/sprite/thẻ của game cờ được giữ để tiếp tục phát triển.

| File | Trách nhiệm |
| --- | --- |
| [server/index.mjs](../../web/server/index.mjs) | HTTP, trang Admin, khung phát, SSE, routing và shutdown |
| [server/tiktok.mjs](../../web/server/tiktok.mjs) | Connector, chuẩn hóa sự kiện, phòng, reconnect và combo/khử trùng |
| [server/room.mjs](../../web/server/room.mjs) | Luật ván server, hiện diện, ghế/hàng chờ, lượt chào và camera |
| [server/config.mjs](../../web/server/config.mjs) | Cấu hình allowlist, username và đường dẫn runtime |
| [server/state-writer.mjs](../../web/server/state-writer.mjs) | Ghi cấu hình/biên nhận nguyên tử |
| [server/tts.mjs](../../web/server/tts.mjs) | Giọng tiếng Việt, giới hạn tải và cache |
| [src/live-main.js](../../web/src/live-main.js) | Vẽ snapshot, HUD và hiệu ứng; không chạy một bộ luật thứ hai |
| [src/live-audio.js](../../web/src/live-audio.js), [live-speech-policy.js](../../web/src/live-speech-policy.js) | Hàng đọc, chào gộp, quyền âm thanh và lọc lời |
| [src/live-music.js](../../web/src/live-music.js) | Nhạc nền, playlist, bật tiếng, âm lượng và duck khi MC đọc |
| [src/live-rails.js](../../web/src/live-rails.js) | Chuẩn hóa top MONEY và quà gần nhất cho hai cột khung phát |
| [src/gift-catalog.js](../../web/src/gift-catalog.js) | ID/alias quà, icon thật và luật ưu tiên/hiệu ứng/lì xì |
| [src/waiting-areas.js](../../web/src/waiting-areas.js), [waiting-crowd.js](../../web/src/waiting-crowd.js) | Tám sân/25 vị trí nền, giữ chỗ và đám đông chờ nhẹ |
| [server/admin.html](../../web/server/admin.html) | Giao diện điều khiển và phòng mô phỏng |

## 11. Kiểm tra khi phát triển tiếp

```powershell
cd web
npm test
npm run test:live
npm run build
```

Nếu có Python + Playwright/Chromium, chạy `python tests/live-browser.py` trong `web`. Test tự mở fixture riêng ở port 5180/5181, dùng nguồn giả lập và âm thanh test, không kết nối TikTok hoặc thay dữ liệu phòng đang phát.

Tests kiểm tra chuẩn hóa sự kiện, ID, combo, reconnect, không coi tổng người xem giảm là rời cụ thể, giữ ghế lúc mất nguồn, FIFO, giữ tiến độ quân còn lại, ví/escrow, MC/TTS, cách ly LIVE/DEMO và API. Browser test kiểm tra thêm trang Admin, khung 9:16, lên hình/lắc chào, hàng chờ/thay ghế và hiển thị sự kiện. Test provider giọng dùng một câu mẫu không có dữ liệu người xem; không thay cho kiểm tra kết nối TikTok thật.

Các kiểm thử mới bao gồm 60 ô thường trên mọi tuyến, hướng tiếp tuyến gạch, sân/vị trí chờ, nhận diện quà không dựa giá, credit hoa hồng chỉ tiêu thụ khi lắc thành công và 20 quân vẫn lắc nền đồng thời, quỹ quà bảo toàn tiền/cách ly thanh tim, MC ngắn/ô thường im lặng. Khi chạy browser, kiểm tra bài **Alt Take duy nhất**, autoplay, giảm nhạc lúc MC nói, Demo tự có 20 người và cách ly LIVE. Báo cáo cũ có hai M4A là mốc lịch sử, không mô tả playlist hiện tại. Edge và giọng dự phòng từng tạo MP3 tiếng Việt và đã được giải mã kiểm tra; LIVE thật vẫn chưa được kết nối vì chủ phòng chưa mở buổi phát.
