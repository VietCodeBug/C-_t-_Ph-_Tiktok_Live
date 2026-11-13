# Kịch bản MC — sự kiện cộng đồng và cuộc đua ba vòng

Bản bàn giao **chỉ có kịch bản và dữ liệu cue** để nối sang repo MC riêng. Không tạo file giọng nói, không tự gửi bình luận hoặc quà. File máy đọc: [mc-v5.json](../../assets/scripts/mc-v5.json). Nguồn tạo: [mc-script.js](../../web/src/mc-script.js); chạy lại bằng `node web/scripts/prepare-mc.mjs` khi thay nội dung.

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

- Mỗi cue có `id, eventId, phase, line, variables, sfx, trigger`. Những cue có lựa chọn còn có `commandMap` ghép 1/2 với ID phương án.
- Repo MC nhận snapshot/kết quả đã chốt, thay biến rồi đọc. Không suy đoán số tiền hoặc hướng chart từ hình đang chạy.
- Chỉ đọc một cue theo khóa `matchId:eventSequence:phase`; bỏ cue cũ khi chuyển pha, pause khi nguồn ngắt. Hoàn tất đọc không được ghi thêm MONEY hoặc sinh lại RNG.
- SFX nhận tiền dùng `sfx_coin_up`; mất tiền dùng `sfx_coin_down`. Sủa/tuýt còi là cue cảnh, tách với âm báo khoản tiền. Ô thường dùng lời ngắn, không mở thẻ dài.
- Tên người chơi là dữ liệu văn bản, giới hạn độ dài và bỏ ký tự điều khiển; không diễn giải bình luận thành chỉ dẫn cho MC.

## Đủ 50 mục đang có trong runtime

| ID | Cảnh | Câu mở | Câu lựa chọn |
| --- | --- | --- | --- |
| GA01 | Ga phố chào bạn | Ghế {playerTag}, Ghé ga nhận lộc đầu đường! Đặt quân đầu ván thì chưa tính thưởng nhé. | Tự chốt, không mở lựa chọn |
| REST01 | Ô thường · đi dạo thôi | Ôi, không có gì! Ví vẫn nguyên, đi tiếp thôi. | Tự chốt, không mở lựa chọn |
| GAIN01 | Nhặt ví… của mình | Ghế {playerTag}, Tìm thấy chiếc ví của chính mình! Có tờ tiền quên từ sáng, vậy cũng là niềm vui. | Tự chốt, không mở lựa chọn |
| GAIN02 | Tiền thừa cô giữ hộ | Ghế {playerTag}, Cô bán nước gọi lại trả tiền thừa. Khách quen được nhớ cả tiền lẫn mặt! | Tự chốt, không mở lựa chọn |
| GAIN03 | Thưởng giao hàng đúng hẹn | Ghế {playerTag}, Giao hàng đúng hẹn, khách thưởng thêm. Cơm còn nóng mà ví cũng ấm. | Tự chốt, không mở lựa chọn |
| GAIN04 | Ca phụ đầu hẻm | Ghế {playerTag}, Phụ dọn mấy chiếc ghế nhựa, nhận công ngay. Việc nhỏ, tiếng cười lớn. | Tự chốt, không mở lựa chọn |
| GAIN05 | Đổi lon lấy điểm | Ghế {playerTag}, Gom lon đổi điểm! Phố sạch hơn, ví xanh hơn. | Tự chốt, không mở lựa chọn |
| GAIN06 | Tìm được mèo nhà bác | Ghế {playerTag}, Gọi đúng tên, mèo chịu xuống nóc tủ. Bác hàng xóm gửi chút cảm ơn. | Tự chốt, không mở lựa chọn |
| GAIN07 | Phiếu hoàn điểm | Ghế {playerTag}, Thông báo hoàn điểm về rồi! Lần này điện thoại reo là có tin vui. | Tự chốt, không mở lựa chọn |
| GAIN08 | Khách khen quán dễ thương | Ghế {playerTag}, Khách khen quầy dễ thương. Hôm nay nụ cười cũng biết tạo doanh thu. | Tự chốt, không mở lựa chọn |
| LOSS01 | Chú công an nhắc đỗ xe | Ghế {playerTag}, Tuýt còi! Đậu xe ngay trước biển cấm. Nộp phí trong game rồi dắt xe đúng chỗ nhé. | Tự chốt, không mở lựa chọn |
| LOSS02 | Chó giữ chiếc dép | Ghế {playerTag}, Chó giữ chiếc dép như giữ kho báu. Chân vẫn ổn, nhưng quai dép xin nghỉ phép! | Tự chốt, không mở lựa chọn |
| LOSS03 | Mưa bất ngờ | Ghế {playerTag}, Mưa bất ngờ! Mua áo mưa đầu hẻm, giữ người khô rồi đi tiếp. | Tự chốt, không mở lựa chọn |
| LOSS04 | Trà sữa đổi chủ | Ghế {playerTag}, Cốc trà sữa đổi chủ khi nắp bật ra. Mình đền một cốc, lần sau cầm hai tay nhé. | Tự chốt, không mở lựa chọn |
| LOSS05 | Xe xẹp bánh | Ghế {playerTag}, Bánh xe gặp chiếc đinh có tham vọng. Vá bánh một nhịp rồi tiếp tục. | Tự chốt, không mở lựa chọn |
| LOSS06 | Gửi xe quên lấy vé | Ghế {playerTag}, Quên vé gửi xe! Chú giữ xe tra sổ giúp, phí làm lại vé đã hiện trên bảng. | Tự chốt, không mở lựa chọn |
| LOSS07 | Đóng nhầm thùng trống | Ghế {playerTag}, Đóng thùng rất đẹp, hàng vẫn trên bàn. Tốn thêm một lượt băng keo rồi! | Tự chốt, không mở lựa chọn |
| LOSS08 | Điện thoại chạm nhầm | Ghế {playerTag}, Một cú chạm, thêm topping. Ly nước nhiều tham vọng hơn, ví thì mỏng hơn. | Tự chốt, không mở lựa chọn |
| LIFE01 | Chó chắn đường đòi chơi | Ghế {playerTag}, Chó ngậm dép ngồi chắn hẻm. Chọn cách thương lượng, bên kia đang giữ lợi thế một chiếc dép. | Ghế {playerTag}, gõ 1 để đợi cô chủ gọi: +0 MONEY. gõ 2 để mua bánh thưởng: -15 MONEY. Còn {seconds} giây. |
| LIFE02 | Công an hỏi đường | Ghế {playerTag}, Chú công an hỏi nhà số mười hai. Chỉ đường hay phụ chuyển nước, phố đang chờ bạn. | Ghế {playerTag}, gõ 1 để chỉ đường: +20 MONEY. gõ 2 để phụ chuyển nước: +35 MONEY. Còn {seconds} giây. |
| LIFE03 | Cứu quầy khỏi gió | Ghế {playerTag}, Bảng giảm giá chuẩn bị bay! Giữ bảng hay xếp lại ghế cho cô chủ? | Ghế {playerTag}, gõ 1 để giữ tấm bảng: +25 MONEY. gõ 2 để xếp lại ghế: +30 MONEY. Còn {seconds} giây. |
| LIFE04 | Hàng xóm nhờ tưới cây | Ghế {playerTag}, Hàng xóm nhờ tưới cây. Tưới bằng nước nhé, trà sữa để uống! | Ghế {playerTag}, gõ 1 để tưới ba chậu: +25 MONEY. gõ 2 để chăm cả sân: +45 MONEY. Còn {seconds} giây. |
| LIFE05 | Mèo chiếm ghế | Ghế {playerTag}, Ghế đã có khách lông xù nằm ngủ. Bạn đứng hóng gió hay thuê ghế bên cạnh? | Ghế {playerTag}, gõ 1 để đứng hóng gió: +0 MONEY. gõ 2 để thuê ghế bên cạnh: -10 MONEY. Còn {seconds} giây. |
| LIFE06 | Bạn rủ ăn liên hoan | Ghế {playerTag}, Hội hẻm mở bàn liên hoan. Phụ dọn hay góp quỹ, chọn cách vui cùng phố. | Ghế {playerTag}, gõ 1 để phụ dọn bàn: +15 MONEY. gõ 2 để góp quỹ chung: -25 MONEY. Còn {seconds} giây. |
| LIFE07 | Đơn cuối trước giờ ngủ | Ghế {playerTag}, Đơn cuối trước giờ ngủ. Nghỉ ngơi hay giao thêm một chuyến ngắn? | Ghế {playerTag}, gõ 1 để nghỉ thôi: +0 MONEY. gõ 2 để giao thêm phần: +40 MONEY. Còn {seconds} giây. |
| LIFE08 | Chiếc loa gọi tên bạn | Ghế {playerTag}, Loa khu phố gọi tên bạn! Đọc thông báo thôi, chưa phải thi hát nhé. | Ghế {playerTag}, gõ 1 để đọc thông báo: +30 MONEY. gõ 2 để soát lại nội dung: +20 MONEY. Còn {seconds} giây. |
| LIFE09 | Thang máy đang bảo trì | Ghế {playerTag}, Thang máy bảo trì, đơn ở tầng ba. Chờ khách xuống hay đi bộ giao tận cửa? | Ghế {playerTag}, gõ 1 để khách xuống nhận: +10 MONEY. gõ 2 để đi bộ giao tận cửa: +35 MONEY. Còn {seconds} giây. |
| LIFE10 | Nhờ trông quán một nhịp | Ghế {playerTag}, Cô bán nước đi lấy đá. Trông quầy hay giúp bê thùng đá? | Ghế {playerTag}, gõ 1 để trông quầy: +25 MONEY. gõ 2 để bê thùng đá: +40 MONEY. Còn {seconds} giây. |
| LIFE11 | Thư mời sinh nhật mèo | Ghế {playerTag}, Sinh nhật mèo hàng xóm! Mèo chưa phát biểu, nhưng thiệp mời đã đến tay bạn. | Ghế {playerTag}, gõ 1 để vỗ tay chúc mừng: +0 MONEY. gõ 2 để tặng món đồ chơi: -20 MONEY. Còn {seconds} giây. |
| LIFE12 | Lạc đúng quầy khuyến mãi | Ghế {playerTag}, Lạc một ngã, gặp quầy tuyển người phát menu. Đôi khi đi lạc cũng gặp việc. | Ghế {playerTag}, gõ 1 để hỏi đường rồi đi: +0 MONEY. gõ 2 để phụ phát menu: +30 MONEY. Còn {seconds} giây. |
| INV01 | Góp vốn xe bánh mì | Ghế {playerTag}, Cơ hội góp vốn xe bánh mì. Xem mức tiền và rủi ro trên bảng trước khi chọn. | Ghế {playerTag}, gõ 1 để giữ vốn: +10 MONEY. gõ 2 để góp mẻ bánh: 60%: +100; 40%: -70 MONEY. Còn {seconds} giây. |
| INV02 | Quầy ô che nắng | Ghế {playerTag}, Quầy ô che nắng đang tìm người phụ. Nhận công chắc chắn hay thử góp vốn? | Ghế {playerTag}, gõ 1 để nhận lương trực quầy: +25 MONEY. gõ 2 để thuê thêm ô: 60%: +85; 40%: -60 MONEY. Còn {seconds} giây. |
| INV03 | Vườn rau sân thượng | Ghế {playerTag}, Vườn rau sân thượng mở cửa. Nhận công tưới hay góp một vụ rau thử? | Ghế {playerTag}, gõ 1 để nhận công tưới: +30 MONEY. gõ 2 để góp giống rau: 65%: +80; 35%: -50 MONEY. Còn {seconds} giây. |
| INV04 | Máy ép mía chung | Ghế {playerTag}, Cả hẻm bàn chiếc máy ép mía chung. Phụ rửa cốc hay góp vốn máy? | Ghế {playerTag}, gõ 1 để phụ rửa cốc: +35 MONEY. gõ 2 để góp vốn máy: 55%: +125; 45%: -90 MONEY. Còn {seconds} giây. |
| INV05 | Tủ đổi sách đầu hẻm | Ghế {playerTag}, Tủ sách đầu hẻm cần người chăm. Sắp xếp sách hay mở một quầy nhỏ? | Ghế {playerTag}, gõ 1 để sắp xếp sách: +20 MONEY. gõ 2 để mở quầy sách cũ: 65%: +65; 35%: -40 MONEY. Còn {seconds} giây. |
| INV06 | Quầy hoa cuối tuần | Ghế {playerTag}, Quầy hoa cuối tuần chuẩn bị nhập hàng. Bó hoa lấy công hay thử một lô hoa? | Ghế {playerTag}, gõ 1 để nhận công bó hoa: +30 MONEY. gõ 2 để nhập lô hoa: 60%: +110; 40%: -80 MONEY. Còn {seconds} giây. |
| INV07 | Điểm sạc xe đồ chơi | Ghế {playerTag}, Điểm sạc xe đồ chơi cần người trực. Đây là MONEY trong game, chọn theo mức rủi ro đã báo nhé. | Ghế {playerTag}, gõ 1 để trực điểm sạc: +25 MONEY. gõ 2 để thuê một trạm: 60%: +105; 40%: -75 MONEY. Còn {seconds} giây. |
| INV08 | Rạp chiếu sân nhà | Ghế {playerTag}, Rạp chiếu sân nhà tìm người góp sức. Xếp ghế hay góp màn chiếu? | Ghế {playerTag}, gõ 1 để xếp ghế lấy công: +30 MONEY. gõ 2 để góp màn chiếu: 55%: +95; 45%: -65 MONEY. Còn {seconds} giây. |
| TRADE01 | Shop dép chạy deadline | Ghế {playerTag}, Shop dép chạy deadline mở cửa. Nhận lương hay nhập lô hàng thử? | Ghế {playerTag}, gõ 1 để nhận lương: +40 MONEY. gõ 2 để nhập một lô dép: 60%: +120; 40%: -80 MONEY. Còn {seconds} giây. |
| TRADE02 | Xe trà tắc đầu hẻm | Ghế {playerTag}, Xe trà tắc vừa dựng quầy. Phụ quầy hay thử bán một mẻ? | Ghế {playerTag}, gõ 1 để phụ quầy: +30 MONEY. gõ 2 để bán một mẻ: 65%: +80; 35%: -50 MONEY. Còn {seconds} giây. |
| TRADE03 | Mẻ bánh tráng trộn | Ghế {playerTag}, Bánh tráng trộn đã sẵn sàng. Đóng gói lấy công hay thử bán một mẻ? | Ghế {playerTag}, gõ 1 để nhận công đóng gói: +35 MONEY. gõ 2 để bán mẻ bánh: 60%: +95; 40%: -60 MONEY. Còn {seconds} giây. |
| TRADE04 | Quầy áo mưa lưu động | Ghế {playerTag}, Quầy áo mưa nhìn trời chờ khách. Phát menu lấy công hay nhập hàng? | Ghế {playerTag}, gõ 1 để phát menu: +25 MONEY. gõ 2 để nhập áo mưa: 55%: +110; 45%: -70 MONEY. Còn {seconds} giây. |
| TRADE05 | Chợ đồ cũ vui vẻ | Ghế {playerTag}, Chợ đồ cũ vui vẻ! Lau quầy lấy công hay thu mua bán lại? | Ghế {playerTag}, gõ 1 để lau quầy lấy công: +25 MONEY. gõ 2 để thu mua bán lại: 65%: +75; 35%: -45 MONEY. Còn {seconds} giây. |
| TRADE06 | Cà phê giao tận cổng | Ghế {playerTag}, Cà phê giao tận cổng. Giao thuê hay mở một ca bán thử? | Ghế {playerTag}, gõ 1 để giao thuê: +40 MONEY. gõ 2 để mở ca cà phê: 60%: +115; 40%: -75 MONEY. Còn {seconds} giây. |
| TRADE07 | Hộp cơm văn phòng | Ghế {playerTag}, Giờ trưa tới rồi! Phụ đóng hộp hay nhập một mẻ cơm? | Ghế {playerTag}, gõ 1 để phụ đóng hộp: +35 MONEY. gõ 2 để nhập mẻ cơm: 60%: +130; 40%: -85 MONEY. Còn {seconds} giây. |
| TRADE08 | Quầy móc khóa mèo | Ghế {playerTag}, Quầy móc khóa mèo chào khách. Làm thuê hay mở quầy thử? | Ghế {playerTag}, gõ 1 để làm thuê: +30 MONEY. gõ 2 để mở quầy thử: 60%: +90; 40%: -55 MONEY. Còn {seconds} giây. |
| MINI01 | Đóng gói thần tốc | Ghế {playerTag}, Đóng gói thần tốc! Hộp trước, băng sau, tem cuối. Nhìn kỹ rồi chọn nhé. | Ghế {playerTag}, gõ 1 để hộp → băng → tem: Đúng thứ tự: +70 MONEY. gõ 2 để tem → hộp → băng: Sai thứ tự: 0 MONEY. Còn {seconds} giây. |
| MINI02 | Trà sữa đúng đơn | Ghế {playerTag}, Khách gọi ít đá, không đường. Chọn phiếu đúng trước khi giao. | Ghế {playerTag}, gõ 1 để ít đá · không đường: Khớp đơn: +65 MONEY. gõ 2 để nhiều đá · thêm đường: Sai đơn: 0 MONEY. Còn {seconds} giây. |
| MINI03 | Địa chỉ không đánh đố | Ghế {playerTag}, Đơn ghi nhà mười hai, hẻm ba. Đừng tráo hai con số rồi trách con hẻm! | Ghế {playerTag}, gõ 1 để nhà 12 · hẻm 3: Giao đúng: +55 MONEY. gõ 2 để nhà 3 · hẻm 12: Giao nhầm: 0 MONEY. Còn {seconds} giây. |
| MINI04 | Tính tiền quán nước | Ghế {playerTag}, Hóa đơn ba mươi lăm, khách đưa năm mươi. Trả bao nhiêu? | Ghế {playerTag}, gõ 1 để trả 15: Đúng phép tính: +60 MONEY. gõ 2 để trả 25: Sai phép tính: 0 MONEY. Còn {seconds} giây. |

Mỗi ID đều có cue kết quả nhận, mất và không đổi MONEY; các mục có lựa chọn có thêm nhắc giờ và timeout. Đọc cue phù hợp với giao dịch thực tế. Các thử thách hiện là câu hỏi hai phương án. Shop cộng đồng có luồng đặt/tự hủy giả lập local; nguồn bình luận TikTok LIVE và MC/TTS nằm ở phần tích hợp riêng.

## Các câu dùng chung cho cộng đồng và cuộc đua

| Cue | Lời đọc |
| --- | --- |
| `match.open` | Khu phố mở cửa! Mỗi tài khoản có {startingMoney} MONEY. Gõ CHƠI để vào danh sách ghép bàn; trong lúc chờ vẫn góp vốn, ghé quầy và nhận lì xì được nhé. |
| `match.full100` | Phòng có {accountCount} tài khoản, map hiện có {playerCount} người đua. Những bạn chờ ghế vẫn tham gia chuyện phố cùng cả bàn. |
| `race.rules` | Ván này chạy đủ {lapTarget} vòng đường. Vạch đích mới ở {finishName}; qua đó sau vòng cuối mới hoàn thành cuộc đua. |
| `race.turn` | Đến {playerName}, mã {playerTag}. Gõ LẮC, mình xem phố đưa bạn tới đâu. |
| `race.roll` | {roll} bước! Đi đúng số ô rồi mới xử lý chuyện ở ô cuối. |
| `race.autoRoll` | {playerName} đang bận một nhịp. Bé Két lắc hộ, vẫn chỉ một kết quả nhé. |
| `race.fork` | {playerName}, gõ TRÁI hoặc PHẢI. Nhìn loại ô trên mỗi đường; cả phố cũng được góp ý! |
| `race.forkOwner` | Chốt {direction}! Chủ lượt đã chọn, cả phố cùng theo chân nào. |
| `race.forkVotes` | Khán giả chọn {direction}, {winningVotes} phiếu. Ghế {playerTag} đi nhé! |
| `race.forkDefault` | Phiếu hòa hoặc phố đang im lặng. Đi {direction} theo mặc định đã hiện trên bảng. |
| `race.lap` | {playerName} đã xong vòng {lap}/{lapTarget}! Ví còn {balance}, tiếp tục chuyến phố nào. |
| `race.finalLap` | Vòng cuối của {playerName}! Vạch đích đang chờ, cả phố có thể cổ vũ bằng tim. |
| `race.finish` | {playerName} về đích thứ {finishRank}! Hoàn thành đủ {lapTarget} vòng, ví hiện {balance} MONEY. |
| `race.end` | Đủ ba người về đích, chốt ván! Nhất {firstName}, nhì {secondName}, ba {thirdName}. Bục theo thứ tự cán đích; MONEY vẫn hiện riêng cho mọi người. |
| `race.resultHold` | Giữ bục {seconds} giây để cả phố chúc mừng. Sau đó mở cửa tim giữ chỗ và ghép bàn kế tiếp. |
| `race.nextMatch` | Bàn mới đã chọn xong {playerCount} người! Mọi tài khoản, kể cả khách chờ, nhận lại {startingMoney} MONEY. Map đổi cảnh, vạch đích đổi chỗ, mình chạy ba vòng mới nào! |
| `reserve.open` | Cửa giữ chỗ mở {reserveSeconds} giây! Người ở bàn cũ đạt {heartTarget} tim mới trước sẽ giữ ghế trước. Tối đa {retainedSeats} ghế cũ, dành {waitingSeats} ghế cho hàng chờ. |
| `reserve.progress` | {playerName} có {hearts}/{heartTarget} tim giữ chỗ. Chỉ tính tim mới trong cửa này, tim từ trước không cộng lại nhé. |
| `reserve.retained` | Đã giữ ghế cho {playerName}. Danh sách ghép bàn xác nhận trên màn hình, không cần gửi thêm tim cho suất này. |
| `reserve.full` | Nhóm giữ chỗ đã đủ {retainedSeats} ghế cũ. Các ghế còn lại dành cho người chờ lâu nhất, mình chốt danh sách theo đồng hồ. |
| `reserve.timeout` | Hết cửa giữ chỗ! Bạn chưa có ghế sẽ vào hàng chờ; mọi người vẫn được góp vốn, mua ở quầy đang mở và cùng đổ tim lì xì. |
| `matchmaking.start` | Bắt đầu ghép bàn mới. Ưu tiên suất giữ chỗ hợp lệ và tám bạn chờ lâu nhất; ghế còn trống tiếp tục lấy từ hàng chờ. |
| `matchmaking.selected` | Đã ghép {playerCount} người vào map. Những tên được chọn hiện trên bảng; mọi người chuẩn bị lượt đua mới! |
| `matchmaking.waiting` | {playerName} đang ở vị trí {queuePosition} của hàng chờ. Thời gian chờ được giữ qua ván để lần sau tới lượt công bằng. |
| `matchmaking.customer` | Chưa có ghế đua vẫn là khách của khu phố! Bạn có thể góp vốn, đặt đơn khi shop mở và nhận lì xì cùng mọi người. |
| `queue.rose` | Đã ghi nhận hoa hồng của {playerName}. Bạn được ưu tiên ở lượt hợp lệ kế tiếp; số xúc xắc và kết quả sự kiện vẫn giữ luật chung. |
| `queue.likes` | Tim đang giúp {playerName} nhích lên hàng lượt. Mỗi chu kỳ mọi người vẫn được đi một lần, không ai bị bỏ lại. |
| `queue.free` | Không cần quà vẫn được vào chơi và đi đủ lượt. Hoa hồng chỉ đổi vị trí lượt sắp tới, không đổi số lắc hay lợi nhuận. |
| `queue.carry` | Quyền ưu tiên chưa đến lượt đã được giữ sang ván mới. Không mất lượt ưu tiên chỉ vì ván trước vừa chốt. |
| `startup.open` | Ghế {hostTag} mở {startupName}! Chủ quầy đã góp {stake} MONEY. Ai muốn góp cùng gõ GÓP {hostTag}; không tham gia gõ BỎ {hostTag}. Đây là chart mô phỏng trong game. |
| `startup.rules` | Mỗi người góp {stake} MONEY, trừ ngay khi nhận tham gia. Trong {joinSeconds} giây mở cửa có thể đổi ý để hoàn vốn; khóa cửa rồi cùng chờ kết quả. |
| `startup.join` | Đã có {participantCount} người góp, tổng vốn {escrowTotal} MONEY. Mỗi tài khoản một phần vốn thôi nhé. |
| `startup.reject` | Ví {playerName} chưa đủ {stake} MONEY. Bạn vẫn xem chart và cổ vũ cùng phố được nhé. |
| `startup.leave` | {playerName} chọn không tham gia trước giờ khóa. Hoàn lại {refund} MONEY, không trừ thêm phí. |
| `startup.countdown` | Còn {seconds} giây nhận vốn. GÓP hoặc BỎ, không trả lời thì không tự trừ tiền. |
| `startup.lock` | Khóa danh sách! {participantCount} người, tổng vốn {escrowTotal} MONEY. Chart chạy {chartSeconds} giây, kết quả chưa chốt trước tiếng chuông. |
| `startup.chart` | Chart đang chạy! Lên xuống là hình mô phỏng; chờ điểm cuối mới chốt tiền cho cả nhóm. |
| `startup.up` | Chart chốt xanh! Mỗi phần vốn {stake} nhận lại {returnPerShare} MONEY, gồm vốn và lời {profitPerShare}. Chủ quầy cũng dùng đúng mức này. |
| `startup.down` | Chart chốt đỏ! Mỗi phần vốn {stake} còn nhận lại {returnPerShare} MONEY, lỗ {lossPerShare}. Chủ quầy cũng chịu lỗ, không có người đứng ngoài luật. |
| `startup.neutral` | Khóa sổ startup. Mỗi phần vốn nhận lại {returnPerShare} MONEY; số dư riêng hiện trên bảng của từng người. |
| `startup.close` | Đã ghi trả vốn và kết quả cho {participantCount} người. Không góp thì ví không đổi. Camera về người đang lượt! |
| `startup.flavor.foodtruck` | Xe bánh mì góp vốn mở cửa! Hàng bán chạy hay cả phố ăn no rồi, cùng chờ một mẻ nhé. |
| `startup.flavor.garden` | Vườn rau hợp tác tìm bạn cùng góp. Rau trong game lớn nhanh, nhưng lời lỗ vẫn phải chờ chốt. |
| `startup.flavor.music` | Sân khấu cuối phố chuẩn bị mở đèn. Ai góp vốn cùng chủ sân thì xem phần tiền trên bảng trước nhé. |
| `startup.flavor.nightmarket` | Chợ đêm lên đèn! Một phần vốn, một kết quả chung, mỗi người tự chọn có tham gia không. |
| `envelope.open` | Lì xì khu phố bắt đầu! Cùng thả tim để đầy thanh {heartTarget} tim. Mọi người có tên khi mở quỹ đều nằm trong danh sách nhận. |
| `envelope.progress` | Thanh tim đã đạt {heartPercent} phần trăm. Cả phố cùng góp nhịp, không cần quà để mở lì xì. |
| `envelope.full` | Đầy tim rồi! Quỹ {pot} MONEY mở ra cho {recipientCount} người. Một phần chia nền cho cả nhóm, phần còn lại theo hạng MONEY lúc chốt. |
| `envelope.rank` | Hạng {rank}: {playerName} nhận {reward} MONEY. Bảng chia giữ đủ tên mọi người, camera chỉ đọc một vài người đầu để ván không bị dài. |
| `envelope.close` | Đã chia đúng {pot} MONEY, không sót hoặc nhân đôi giao dịch. Bạn xem phần của mình trên bảng nhé! |
| `envelope.timeout` | Thanh tim chưa đầy thì quỹ vẫn chờ. Mình tiếp tục chơi, không trừ MONEY để ép mở quỹ. |
| `connection.pause` | Nguồn bình luận đang nối lại. Đồng hồ nhập lệnh tạm dừng, tiền đã chốt giữ nguyên. |
| `connection.resume` | Bình luận đã trở lại. Tiếp tục đúng cửa đang mở, không lắc lại hay tính tiền lần hai. |
| `shop.open` | Quầy {hostTag} của {hostName} mở cửa! Chủ quầy đã trả {setupCost} MONEY dựng quầy một lần. Khách đang chờ ghế gõ {hostTag} để đặt đơn giả lập trong {orderSeconds} giây, tối đa {maxOrders} đơn. |
| `shop.rules` | Đây là đơn trong game, không mua hàng thật và không trừ ví khách. Mỗi tài khoản chờ một đơn. Đơn giao thành công cộng {goodReward} MONEY cho chủ; đơn tự hủy làm chủ mất {cancelPenalty} MONEY. |
| `shop.order` | Quầy {hostTag} đã nhận {orderCount}/{maxOrders} đơn. {customerName} có tên trên sổ, ví khách giữ nguyên. |
| `shop.full` | Quầy {hostTag} đủ {maxOrders} đơn rồi! Không nhận thêm để chủ quầy kịp đóng hàng. |
| `shop.returns` | Khóa đơn quầy {hostTag}! Mở {returnSeconds} giây đổi ý: ai đã đặt muốn tự hủy thì gõ BOM {hostTag}. Chỉ hủy đơn của chính mình; không bình luận thì giữ đơn. |
| `shop.cancel` | {customerName} đã tự hủy đơn quầy {hostTag}. Mỗi đơn chỉ ghi hủy một lần, không tác động đơn của người khác. |
| `shop.countdown` | Quầy {hostTag} còn {seconds} giây. Xem pha nhận đơn hoặc tự hủy đang hiện trên bảng rồi chọn nhé. |
| `shop.settle` | Chốt quầy {hostTag}: {goodOrders} đơn giao thành công, {cancelledOrders} đơn tự hủy. Tiền hàng chốt {salesDelta} MONEY, gồm cộng {goodReward} mỗi đơn tốt và trừ {cancelPenalty} mỗi đơn hủy. Phí dựng {setupCost} đã trả lúc mở, không trừ lại. Ví chủ còn {balance}; ví khách không đổi. |
| `shop.abort` | Quầy {hostTag} đóng trước khi chốt. Hoàn lại đúng {refund} MONEY dựng quầy cho chủ, bỏ các đơn giả lập và giữ nguyên ví khách. Giao dịch đã chốt trước đó không được hoàn lại lần nữa. |
