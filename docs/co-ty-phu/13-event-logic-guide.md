# Luật ván chơi và logic sự kiện — Cờ Tý Phí V5

> Tài liệu này mô tả luật V5 và phần runtime LIVE hiện có. Bản offline tạo sẵn tài khoản; LIVE Studio dùng server giữ luật và chỉ nhận người từ nguồn thật. Xem [hướng dẫn LIVE Studio](14-live-studio.md) để chạy, cấu hình MC và kết nối. Chưa kết nối phòng TikTok thật trong lần bàn giao này.

Cập nhật: **13/11/2026** · Nhánh: `web/third-person-v23`.

Tài liệu này dành cho người vận hành livestream, người viết kịch bản MC và người tiếp tục phát triển game. Các luật ghi **hiện có** được đối chiếu với mã nguồn trong nhánh này. Phần **cần triển khai cho LIVE** là hướng tích hợp, chưa phải tính năng đã chạy với người xem thật.

MONEY là điểm nguyên trong game. Mỗi tài khoản có ví riêng; góp vốn, bán hàng và lì xì dưới đây đều là hoạt động mô phỏng của ván chơi.

## 1. Đọc nhanh: một ván hoạt động thế nào?

1. Mặc định có 100 tài khoản local: 20 người có quân trên map, 80 người làm khách chờ. Mỗi tài khoản bắt đầu với 1.000 MONEY.
2. Các quân chạy đồng thời. Camera theo một người; chọn camera không dừng hoặc xóa tiến độ của những quân khác.
3. Quân lắc xúc xắc 3D, đi đúng 1–6 cạnh. Gặp ngã rẽ thì chọn đường; đi hết số bước mới xử lý ô dừng.
4. Ô dừng có thể nhận tiền, mất tiền, mở lựa chọn cá nhân, thử thách hoặc sự kiện chung. Ô nghỉ không đổi ví và không mở thẻ dài.
5. Khách chờ vẫn góp vốn, đặt/tự hủy đơn, thả tim, nhận lì xì và bỏ phiếu rẽ đường. Họ được vẽ bằng đám đông chibi nhẹ ở sân chờ, không có thêm bộ điều khiển đua như 20 quân đang chơi.
6. Người thứ ba hoàn thành ba vòng đường khóa ván. Hiện bục 8 giây, rồi mở sảnh giữ ghế 15 giây.
7. Tối đa 12 người cũ đầu tiên đạt 30 tim mới giữ ghế. Các ghế còn lại lấy từ đầu hàng chờ; nếu đủ người thì ít nhất 8 khách chờ lên bàn.
8. Người cũ không giữ ghế nối cuối hàng. Sinh map/đích mới, reset toàn bộ ví về 1.000 rồi mở ván tiếp theo.

**Hai bảng hạng khác nhau:** top 3 trên bục theo thứ tự hoàn thành ba vòng, còn hạng MONEY dùng cho tài sản và chia lì xì. Nhiều tiền không tự làm quân về đích trước. Hiện chưa cộng thưởng MONEY theo thứ tự về đích.

## 2. Map, xúc xắc và ngã rẽ

Map runtime có 138 ô: 96 ô đường chính và 42 ô nhánh. Sáu ngã rẽ đều có hai tuyến đi 8 cạnh trước khi nhập đường; cả 64 tổ hợp tuyến đều cần 96 cạnh cho một vòng. Ba vòng tương ứng **288 cạnh thực sự đã đi**. Các nhánh có bố trí loại ô khác nhau, nên lựa chọn ảnh hưởng chuyện gặp trên đường. Bằng số cạnh không có nghĩa bằng chiều dài hình học: tuyến dài hơn có thể mất nhiều thời gian đi hơn.

Mỗi tuyến đủ một vòng có đúng **60/96 ô thường (62,5%)**; toàn bộ graph có **87/138 ô thường**. Mẫu ô được bốc lại theo seed trong tập thỏa ràng buộc: mọi ba ô liên tiếp trên mỗi tuyến đều có ít nhất một ô thường. Vì vậy không có chuỗi sự kiện kéo dài liên tục, đồng thời không phải cứ đổi seed là bốc độc lập toàn bộ ô. Gạch dùng tiếp tuyến đường để xoay đúng hướng, không xếp vuông cứng ở các khúc cong.

Tám sân chờ được đặt theo seed, mỗi sân có 25 vị trí nền và lối nối ra phố, tránh đường đua/công trình. Vị trí của khách còn chờ được giữ khi đầu hàng nhận ghế; đông hơn 200 khách thì dùng các lớp billboard nhỏ trong cùng sân. Đám đông dùng atlas/instancing chung, không sinh thêm runner hay xúc xắc; chỉ 20 quân đang chơi chạy luật đua.

Vạch đích được chọn theo seed ở phần dưới map, trên ô bắt buộc mọi tuyến đi qua. Mọi quân xuất phát cùng tiến độ ở vạch này. Vị trí lệch hình để tránh chồng quân không cộng hoặc trừ bước. Vạch giữ nguyên trong ván; chỉ ván mới sinh lại map và đích. Cùng seed tạo lại được bố cục và các lựa chọn sự kiện xác định theo seed; kết quả xúc xắc thật vẫn được sinh riêng.

Khi chạm đích đủ ba vòng, quân dừng ngay và bỏ các bước còn dư của lần lắc. Cuộc đua dừng tại thời điểm người thứ ba qua vạch, không cho những quân khác chạy tiếp đến cuối frame để lấy thêm hạng.

### Đồng hồ và tạm dừng

Các thời hạn đi quân, chọn đường/thẻ, bot 3 giây, khoảng giãn 45 giây và các pha startup/shop dùng thời gian mô phỏng nhân tốc độ xem. Main giới hạn bước mô phỏng tối đa 0,08 giây mỗi frame; khi máy lag, game không tự chạy bù toàn bộ thời gian thực đã trôi qua.

Hold sự kiện chung dừng quân, xúc xắc và đồng hồ chọn cá nhân, nhưng vẫn chạy đồng hồ góp vốn/chart/shop để sự kiện kết thúc được. Nút pause của người vận hành dừng cả hai. Riêng bục 8 giây và sảnh 15 giây dùng thời gian thực, cũng dừng khi người vận hành pause; đổi tốc độ xem không làm cửa giữ ghế ngắn đi.

### Cửa chọn đường

- Khi còn bước nhưng chuẩn bị rời một ô có hai đường, quân dừng trước ngã rẽ và hiện thanh TRÁI/PHẢI phía trên.
- Chủ quân chọn thì chốt ngay và tiếp tục phần bước còn lại của cùng lần lắc.
- Người được camera theo có cửa 10 giây. Nếu hết giờ: lấy đa số phiếu; hòa hoặc không có phiếu thì chọn đường mặc định.
- Mỗi ID có một phiếu; gửi lại đổi phiếu cũ. Tim và hoa hồng không tăng trọng số phiếu.
- Bình luận TRÁI/PHẢI của người đang có quân điều khiển ngã rẽ của chính quân đó. Bình luận của khách chờ bỏ phiếu cho quân đang được theo dõi.

**Giới hạn local:** các quân không được theo dõi hiện là bot thử; sau 3 giây chúng tự chọn đường mặc định hoặc phương án sự kiện mặc định. Bản LIVE phải dùng cùng thời hạn cho người thật, độc lập với camera. Không dùng tốc độ tự chọn của bot làm luật chính thức cho khán giả.

Nguồn: [layouts.js](../../web/src/layouts.js), [race.js](../../web/src/race.js), [parallel-race.js](../../web/src/parallel-race.js), [demo.js](../../web/src/demo.js).

## 3. Ô nào có sự kiện? Chọn thẻ như thế nào?

Loại ô được gắn lúc tạo map; thẻ cụ thể được chọn khi quân dừng, không phải khi đi ngang qua.

| Loại ô | Xử lý khi dừng | Có cần chọn? |
| --- | --- | --- |
| `station` — ga | +100 MONEY khi dừng đúng ga | Không |
| `gain` — nhận tiền | Cộng khoản ghi trên thẻ | Không |
| `loss` — mất tiền | Trừ khoản ghi trên thẻ, tối đa số dư đang có | Không |
| `event` — chuyện phố | Hai cách xử lý, mỗi cách có kết quả riêng | Có |
| `invest` — đầu tư | Thẻ cá nhân hoặc phiên góp vốn chung nếu đủ điều kiện | Có |
| `trade` — buôn bán | Thẻ cá nhân; riêng TRADE01 có thể mở shop chung | Có |
| `rest` — ô thường/nghỉ | 0 MONEY, đi tiếp, không thẻ dài và MC im lặng | Không |
| `minigame` — thử tài | Câu hỏi hai phương án, đúng có thưởng | Có |

Đặt quân đầu ván hoặc đi qua ga không nhận thưởng ga. Chỉ điểm dừng cuối lần lắc mới chốt giao dịch. Chạm đích đủ ba vòng được xử lý như hoàn thành cuộc đua, không mở thêm sự kiện ô đích trước khi xếp bục.

### Tỷ trọng sinh loại ô

Mask ô thường được chọn theo seed từ các mẫu hợp lệ, bảo đảm 60/96 ô thường trên **mọi** tổ hợp rẽ và 87/138 ô thường trong graph. Hai ga được giữ, nhánh thay thế giữ cùng số ô thường với đoạn bị thay. Sau đó mới bốc loại cho các ô có hoạt động từ túi `[gain×3, loss×2, event×2, invest×1, trade×1, minigame×1]`, có bước bảo đảm các nhóm sự kiện đều xuất hiện. Trọng số túi này chỉ áp dụng cho ô có hoạt động; không dùng tỷ lệ ô nghỉ 3/13 của bản cũ.

### Chọn thẻ trong loại ô

1. Xác định loại từ ô dừng.
2. Lọc thư viện 50 thẻ runtime theo loại đó.
3. Ưu tiên thẻ chưa xuất hiện trong ba sự kiện gần nhất của quân đó. Nếu không còn ứng viên thì dùng lại toàn bộ nhóm.
4. Chọn bằng hàm xác định từ `seed + turn + ID quân + ID ô + nhãn card`. Trong chế độ đồng thời, `turn` là số thứ tự dispatch được gán khi quân bắt đầu lượt.
5. Nếu thẻ có kết quả rủi ro, dùng một phép bốc riêng từ `seed + turn + ID quân + ID thẻ + ID lựa chọn + nhãn outcome`.

`cooldown: 3` hiện là **số thẻ gần nhất cần tránh lặp**, không phải ba giây. Nhóm chỉ có một thẻ như ô nghỉ vẫn có thể lặp. Thư viện runtime 50 thẻ là dữ liệu bổ sung cho demo; bộ 42 thẻ thiết kế gốc vẫn được giữ riêng, chưa thể coi mọi hành vi của 42 thẻ gốc đã triển khai đầy đủ.

Nguồn: [events.js](../../web/src/events.js).

## 4. Sự kiện cá nhân và cách chốt MONEY

### Thẻ tự chốt

Ô nhận tiền, mất tiền, ga và nghỉ không chờ bình luận. Công thức:

```text
after = max(0, before + proposedDelta)
delta = after - before
```

Ví 20 gặp phí −60: số dư về 0, `delta = −20`, `proposedDelta = −60`. MC và số tiền nổi phải đọc **delta thực tế**, không nói đã trừ 60. Ví không âm, không có nợ hoặc loại người chơi vì hết tiền.

### Thẻ có lựa chọn

Cửa mặc định 10 giây. Lựa chọn đầu tiên là phương án mặc định của chuyện phố, đầu tư và buôn bán; thử thách hết giờ chọn `wrong`, nhận 0. Chọn khi đã chốt, chọn ID không tồn tại hoặc không đủ tiền tối thiểu đều bị từ chối. Mỗi lần sự kiện chỉ có một kết quả và một lần ghi sổ.

**Đầu tư cá nhân khác góp vốn chung:** `minMoney` trên một lựa chọn cá nhân chỉ là điều kiện được chọn. Không trừ vốn trước rồi trừ thêm khi thua. Các `outcomes[].delta` đã là thay đổi ròng của lần thử. Ví dụ một lựa chọn ghi đủ vốn 80, thắng +120 hoặc thua −80: thắng thì ví 1.000 → 1.120; thua thì 1.000 → 920. Không tính thành 1.040 khi thắng bằng cách trừ thêm 80.

Xác suất của thẻ nằm trong `outcomes[].weight`, được bốc một lần từ seed khi chốt. Gửi lại bình luận hoặc phát lại hoạt ảnh không được bốc kết quả mới.

### Chuyện chó/công an và thử thách

Ví dụ LOSS02 là chó giữ chiếc dép, phí −35; LOSS01 nhắc đỗ xe, phí −60. LIFE01 cho đợi cô chủ gọi hoặc mua bánh thưởng; LIFE02 có lựa chọn chỉ đường/phụ việc. Đây là tình huống vui trong khu phố; không có cơ chế bỏ tù, mất quân hoặc bị loại khỏi ván.

MINI01–04 hiện là câu hỏi hai phương án. Đóng Gói Thần Tốc và Trà Sữa Đúng Đơn chưa phải mini game thao tác hoàn chỉnh có màn điều khiển riêng.

Nguồn: [events.js](../../web/src/events.js), [demo.js](../../web/src/demo.js).

## 5. Góp vốn tập thể: chủ startup và cả phố cùng lời/lỗ

### Điều kiện mở

Khi quân đang được camera theo dừng vào ô đầu tư, controller có thể đổi thẻ cá nhân thành phiên góp vốn chung. Mỗi phiên dùng một trong bốn bối cảnh: GROUP01 xe bánh mì, GROUP02 hợp tác xã trà tắc, GROUP03 quỹ phiên chợ, GROUP04 sân khấu đầu hẻm. Hiện chúng cùng luật tiền, khác tiêu đề và lời MC.

- Chủ có ít nhất 100 MONEY và tự góp 100 ngay khi mở.
- Không có cửa sự kiện chung khác đang hiển thị, ván chưa kết thúc và map đã tải xong.
- Giữa các lần mở tự động shop/startup cách ít nhất 45 giây đồng hồ mô phỏng. Nút thử thủ công dùng để duyệt cảnh nên có thể bỏ qua khoảng giãn này.
- Chỉ quân đang được theo dõi có thể kích hoạt phiên chung tự động. Các quân còn lại xử lý thẻ cá nhân. Đây là lựa chọn dựng demo, cần đánh giá lại khi làm LIVE để camera không quyết định cơ hội của người thật.
- Thanh lì xì đang gom tim được phép tồn tại song song; nó không khóa việc mở startup/shop.

### Các pha và tiền tạm giữ

```text
mở → joining 10s → khóa danh sách → chart 8s → settled 4s → đóng
```

Trong cửa góp, cả người có quân và khách chờ gõ `GÓP`/`THAM GIA`, hoặc `BỎ`/`KHÔNG THAM GIA`/`KHÔNG GÓP`. Có thể thêm mã chủ, ví dụ `GÓP P001`. Im lặng không tham gia.

Mỗi ID góp đúng 100, trừ ví và chuyển vào **escrow** — quỹ tạm giữ. Không trừ lần nữa khi khóa hoặc khi chart kết thúc. Người góp được đổi sang không tham gia trước khi khóa và nhận lại đúng 100; có thể góp lại bằng một lệnh mới. Chủ đã cam kết nên không tự rút trước giờ khóa. Sau khi khóa không thêm người, rút vốn hoặc đổi quyết định.

100 tài khoản cùng góp tạo escrow 10.000, gồm vốn chủ. Khách chờ chỉ thêm giao dịch ví, không thêm quân vào map.

### Chart và công thức hoàn tiền

Chart là kết quả mô phỏng đã được xác định theo seed phiên và bối cảnh; hình chỉ hé dần phần đã chạy. Tim, hoa hồng và số người góp không sửa hướng chart hoặc hệ số hoàn. Hai hướng có trọng số 50/50 theo hàm seed; đây không phải lời hứa sẽ có đúng nửa số ván thắng trong một buổi LIVE.

| Hướng | Hệ số hoàn cả vốn | Lãi/lỗ ròng trước làm tròn |
| --- | --- | --- |
| Xanh | 120–180% | +20–80% vốn |
| Đỏ | 15–70% | −85 đến −30% vốn |

Hệ số lưu bằng basis point: 10.000 tương ứng 100%.

```text
returned = floor(stake × multiplierBps / 10000)
net = returned - stake
ví cuối = ví sau khi góp + returned
```

Góp 100, nhận lại 150: lời 50, ví 1.000 → 900 → 1.050. Nhận lại 40: lỗ 60, ví 1.000 → 900 → 940. Chủ và mọi người góp dùng cùng hệ số và cùng công thức. Khoản `returned` đã gồm vốn, không cộng thêm 100 lần nữa. Nếu có lì xì xen giữa, ví còn có khoản lì xì riêng; nó không được gọi là lợi nhuận startup.

Nguồn: [community.js](../../web/src/community.js), [community-controller.js](../../web/src/community-controller.js).

## 6. SHOP01: khách chờ mua vui và tự hủy đơn

TRADE01 là thẻ buôn bán cá nhân. Khi đủ điều kiện phiên chung như mục 5, nó mở SHOP01; nếu không mở được thì vẫn dùng lựa chọn cá nhân của TRADE01. Hai luồng dùng công thức khác nhau, không chạy đồng thời cho cùng một lần dừng.

Chủ cần ít nhất **120 MONEY**, trả **80 nhập hàng ngay một lần**. Danh sách khách hợp lệ chốt từ hàng chờ khi mở; người đang có quân và chủ quầy không được chiếm ô đặt đơn.

```text
mở/trừ 80 → ordering 12s → returns 12s → settled 4s → đóng
```

| Pha | Khách được làm | Quy tắc |
| --- | --- | --- |
| Nhận đơn | `P001` hoặc `MUA P001` | Mỗi khách một đơn, tối đa 8; không trừ ví khách |
| Đổi ý | `BOM P001` hoặc `TRẢ P001` | Chỉ hủy đơn của chính mình, một lần; không nhận đơn mới |
| Chốt | Xem kết quả | Không đổi đơn; không bình luận thì giữ đơn đã đặt |

Gọi `good` là số đơn không hủy, `cancelled` là số đơn tự hủy:

```text
delta khi chốt = 30 × good - 5 × cancelled
net cả vụ = -80 + delta khi chốt
```

Ví dụ chủ 1.000, có 8 đơn và 6 người hủy: mở quầy còn 920; chốt nhận `2×30 − 6×5 = 30`; cuối cùng **950**, lỗ ròng 50. Không đơn nào: còn 920. Cả 8 đơn hủy: còn 880. Ví khách không đổi trong tất cả các trường hợp này. Mức ví tối thiểu 120 bảo đảm đủ phí mở và mức phạt tối đa; khoản phí bắt buộc vẫn dừng ở 0 nếu có luật khác làm giảm ví trong lúc mở quầy.

Đóng thủ công **trước khi chốt** hoàn 80 đúng một lần và bỏ đơn thử. Đóng sau khi đã chốt không hoàn lại kết quả. Nếu nút reset mở ván mới ngay sau đó, ví tất cả tài khoản tiếp tục reset về 1.000 theo luật ván mới; khoản hoàn trước reset phục vụ đối chiếu giao dịch cũ.

Nguồn: [shop.js](../../web/src/shop.js), [community-controller.js](../../web/src/community-controller.js).

## 7. Lì xì: thanh tim chung, hạng MONEY và tiền lẻ

Khi người dẫn đầu qua vòng 1 hoặc 2, controller thử mở thanh lì xì nếu chưa có cửa chung cản việc mở. Nếu đang vướng một cửa khác, nó thử lại sau. Có nút mở thủ công để thử cảnh. Mỗi thanh mặc định cần **1.000 tim mới**; tim đã nhận trước lúc mở không lấp thanh mới.

Danh sách người nhận khóa khi mở thanh, gồm người có quân và khách chờ đã đăng ký, kể cả người không thả tim. Đầy thanh thì chốt tiền một lần:

1. Sinh quỹ nguyên từ 1.000 đến 5.000 MONEY theo seed của thanh.
2. Xếp hạng ngay lúc trả: `tài sản = ví + vốn đang ở escrow`. Bằng tài sản thì ID đăng ký trước đứng trên.
3. Tính phần nền bằng nhau, rồi chia phần còn lại theo trọng số hạng giảm dần.
4. Cộng phần nhận vào từng ví, lưu đủ danh sách kết quả và hiện bảng 5 giây.

Với `n` người và quỹ `pot`:

```text
base = floor(pot / (2 × n))
remainder = pot - base × n
weightTotal = n × (n + 1) / 2
claim[hạng r] = remainder × (n - r + 1) / weightTotal
amount[r] = base + floor(claim[r])
```

Tiền lẻ còn lại phát theo phần thập phân của `claim` từ lớn xuống nhỏ, bằng nhau ưu tiên hạng tốt hơn. Vì phần nền làm tròn xuống, phần chia theo hạng có thể hơi lớn hơn nửa quỹ. Tổng trả luôn bằng đúng `pot`, không tự sinh thêm tiền để làm đẹp số.

Ví dụ 3 người, quỹ 100: phần nền mỗi người 16; phần còn lại 52; trọng số 3:2:1. Sau chia và xử lý tiền lẻ, lần lượt nhận **42, 33, 25**. Quỹ nhỏ hơn số người có thể khiến một số người nhận 0; cấu hình mặc định 100 tài khoản tránh trường hợp này.

### Lì xì đầy tim trong lúc startup/shop đang mở

Tiền lì xì được chốt và cộng ví ngay khi đủ tim. Cửa kết quả lì xì chờ startup/shop kết thúc rồi mới hiện; nó không ghi đè cửa đang mở. Hold được nối tiếp giữa hai bảng, không cho quân chạy chen vào. Trên kết quả startup/shop, `delta/net` chỉ tính vụ đó; bản tóm tắt hoàn thành có `openingBalance` để tra ví lúc mở. Riêng snapshot kết quả shop còn có `concurrentDelta` cho phần thu nhập xen giữa; startup chưa xuất trường này.

Nếu hết ván khi thanh chưa đầy: không phát quỹ chưa mở; giữ tiến độ tim, mục tiêu và danh sách đã góp tim sang thanh của ván tự động kế tiếp. Thanh được tạo lại với ID/seed mới và danh sách người nhận từ các tài khoản hiện tại, không giữ nguyên mọi dữ kiện của thanh cũ. Reset thủ công không giữ thanh này. Bộ đếm giữ ghế ở mục 8 là bộ đếm khác.

Nguồn: [community.js](../../web/src/community.js), [community-controller.js](../../web/src/community-controller.js).

## 8. Tim, hoa hồng và ghép trận

### Ưu tiên lắc

Chỉ xét những quân đang sẵn sàng lắc; không cắt ngang quân đang lắc, đang đi hoặc cửa sự kiện chung. Thứ tự xét trong tập hợp đủ điều kiện:

1. Có credit hoa hồng chưa dùng; giữa các credit ưu tiên theo thứ tự ghi nhận.
2. Điểm ưu tiên tim cao hơn; `likeBoost` tối đa 1.000.
3. Thứ tự đăng ký tài khoản.

Sau khi được chọn, tiêu thụ một credit nếu có và đặt điểm ưu tiên tim về 0. Tối đa giữ hai credit hoa hồng. Scheduler ghi những ID đã phục vụ; khi tất cả ID đang xét đều đã được phục vụ thì bắt đầu chu kỳ tiếp theo. Vì tập đủ điều kiện thay đổi khi quân di chuyển, đây là cơ chế chống chiếm lượt trong bộ chọn, không phải cam kết mọi người có đúng cùng số lượt trong một khoảng thời gian thực.

**Runtime LIVE:** hoa hồng được quyền vượt dấu “đã phục vụ” của chu kỳ cho lần lắc hợp lệ kế tiếp. Đợi xúc xắc đang hiển thị quay/hiện kết quả xong; khi quân người tặng thật sự sẵn sàng, server cho lắc và đưa camera tới quân đó. Chỉ tiêu thụ một credit khi dispatch thành công, không tiêu thụ lúc mới chọn ứng viên. Không cắt ngang quân đang đi, không lắc lại cùng lần và không khóa các lần lắc/chuyển động nền của 20 quân. Khách chưa có ghế giữ credit đến khi có quân; quà không cấp ghế.

Khách chờ nhận credit được giữ để dùng khi có quân hợp lệ sau này. Hoa hồng không cấp ghế, không thay mặt số xúc xắc, không sửa chart, không tăng trọng số phiếu rẽ. MC xác nhận ngắn khi cần; phần vui chơi, lựa chọn và hàng chờ không phụ thuộc gửi quà.

### Bảy quà có icon thật và luật hiện tại

Nhận diện theo ID đã xác minh hoặc alias tên chuẩn hóa khớp chính xác trong [gift-catalog.js](../../web/src/gift-catalog.js); ID khớp được ưu tiên hơn tên. Giá xu chỉ để hiển thị, không dùng để suy ra quà. Heart Me được xác minh là ID 7934, không gán một quà khác chỉ vì cùng mức 9 xu trong ảnh tham khảo.

| Quà | ID mặc định | Tác dụng |
| --- | --- | --- |
| Rose / Hoa hồng | 5655 | Credit lắc hợp lệ kế tiếp, tối đa hai credit chưa dùng |
| Heart Me | 7934 | Hiệu ứng tim |
| Doughnut | 5879 | Giấy màu |
| Hand Heart | 5660, 5924 | Lì xì MONEY cả phố |
| Hearts | 5586 | Dải tim |
| Corgi | 6267 | Corgi ghé chào |
| Money Gun | 7168 | Vệt sáng ăn mừng |

Các hiệu ứng ngoài Rose/Hand Heart không sửa ví, số xúc xắc, bước/vòng hay ghế. Icon lấy từ CDN TikTok đã xác minh, có bản local dự phòng và manifest nguồn. Combo xử lý delta đã chốt một lần; không cộng lại tổng combo ở từng gói. Feed giữ 40 biên nhận gần nhất, tổng quà của từng tài khoản giữ trong phiên server; hiệu ứng ngắn có giới hạn.

Hand Heart tạo **quỹ ảo riêng 1.000–5.000 MONEY**, chia theo công thức hạng ở mục 7 cho tất cả tài khoản đang hiện diện/đã vào ván, gồm khách chờ, tại lúc trả. Mỗi biên nhận combo chốt chỉ yêu cầu một quỹ, không nhân quỹ theo `count`. Nếu có modal, pause, bục hoặc chưa đủ khoảng giãn 30 giây, giữ tối đa một yêu cầu chờ và gộp các yêu cầu thêm. Quỹ không trừ tiền thật hoặc ví người tặng, không thay/đổ đầy/xóa thanh tim lì xì đang có; tổng trả bằng đúng quỹ, ghi ledger chống trùng. Quỹ chờ nhận danh sách người đủ điều kiện khi thực sự trả.

### Giữ ghế sau top 3

```text
race.over → podium 8 giây thực → reserving 15 giây thực → khóa roster → map mới
```

Trong sảnh, chỉ 20 ID vừa chơi tích bộ đếm giữ ghế. Bộ đếm bắt đầu 0 khi cửa 15 giây mở. Tim khi đang đua hoặc đang ở bục không tính sẵn; gói cũ phát lại không được tính thành tim mới.

12 ID đầu tiên đạt 30 tim giữ ghế. Còn bao nhiêu ghế thì lấy bấy nhiêu người đầu hàng chờ. Người cũ không giữ được ghế nối cuối hàng, kể cả người đạt 30 sau khi đã đủ 12 suất. Nếu thiếu khách chờ, hệ thống dùng tiếp các ID trong hàng vừa nối, không nhân bản người chơi.

| Người giữ ghế | Lấy từ hàng chờ | Tổng quân |
| --- | --- | --- |
| 12 | 8 | 20 |
| 4 | 16 | 20 |
| 0 | 20 | 20 |

Tim trong đúng cửa có thể hỗ trợ cả thanh lì xì đang có và bộ đếm giữ ghế; mỗi bộ đếm chỉ xử lý gói đó một lần. Khách chờ thả tim vẫn hỗ trợ hoạt động chung, nhưng không lấy suất giữ ghế dành cho người vừa chơi.

**Qua ván tự động mới:** giữ ID tài khoản, thứ tự chờ, credit hoa hồng chưa dùng, ID gói đã xử lý và thanh lì xì chưa đầy; reset tất cả ví về 1.000, điểm tim ưu tiên, trạng thái đã đi/đã về đích và sổ giao dịch của ván. Lưu trữ lâu dài phải được bổ sung trước khi cần xem lại ván cũ.

Nút **Chạy lại/Phố mới** là thao tác điều khiển thử cảnh: hủy cửa đang mở theo luật hoàn tiền và giữ roster hiện tại. Nó không mô phỏng việc khách chờ thắng ghế; muốn kiểm tra luân phiên hãy để ván chốt top 3 và đi hết sảnh.

Nguồn: [matchmaking.js](../../web/src/matchmaking.js), [community.js](../../web/src/community.js), [main.js](../../web/src/main.js).

## 9. Lệnh bình luận và giới hạn hiện tại

Game chuẩn hóa dấu tiếng Việt, khoảng trắng và chữ hoa/thường; ví dụ `lắc`, `LẮC`, `LAC` cùng một lệnh. Mã tài khoản trong local là `P001…P100`, không phải nickname có thể đổi.

| Đầu vào | Ai dùng được? | Kết quả hiện tại |
| --- | --- | --- |
| `LẮC` | Người có quân đang sẵn sàng | Xếp yêu cầu lắc cho quân mình |
| `TRÁI`, `PHẢI` | Người có quân | Chọn cho quân mình khi cửa ngã rẽ mở |
| `TRÁI`, `PHẢI` | Khách chờ | Bỏ phiếu cho quân đang được theo dõi |
| ID hoặc nguyên nhãn phương án | Chủ quân của thẻ cá nhân | Chốt phương án đang mở; ví dụ `wait`, `right` |
| `GÓP`, `THAM GIA`, có thể thêm mã chủ | Tài khoản có đủ 100 | Tham gia startup đang nhận vốn |
| `BỎ`, `KHÔNG GÓP`, `KHÔNG THAM GIA` | Người góp, trừ chủ | Không tham gia hoặc rút vốn trước khi khóa |
| `P001`, `MUA P001` | Khách chờ đã được chốt danh sách shop | Đặt một đơn ở quầy P001 |
| `BOM P001`, `TRẢ P001` | Chính khách đã đặt | Tự hủy trong pha trả đơn |
| Tim/hoa hồng | Gói sự kiện riêng từ nguồn nhập | Không đọc chuỗi chat “tim”/“hoa hồng” thành quà thật |
| `CHƠI` | Người xem mới | LIVE đăng ký ghế/hàng chờ; bản offline tạo sẵn tài khoản |
| `1`, `2` | Chủ quân đang có lựa chọn | LIVE room ánh xạ sang phương án của đúng quân người gửi; controller offline dùng ID/nhãn lựa chọn |

Lệnh phải khớp chủ và pha đang mở; lệnh cá nhân khi đang pause/đã kết thúc ván bị từ chối. Tim giữ ghế được nhận trong sảnh đang mở. **Giới hạn:** controller hiện chưa bắt buộc `matchId/eventInstanceId` từ nguồn nhập. Một gói cũ chưa từng nhận, đến trễ đúng lúc cùng chủ mở cửa mới, vẫn có thể bị nhận; adapter LIVE phải kiểm tra cửa và thời điểm, không chỉ ID gói trùng.

Demo có nút chọn người gửi, +10 tim, hoa hồng thử, cả phố góp, cả phố thả tim, 8 khách đặt đơn và 6 khách tự hủy để duyệt luồng.

## 10. Sổ tiền: một giao dịch chỉ ghi một lần

Ba số cần phân biệt:

- `wallets`: tổng MONEY có thể dùng trong các ví.
- `escrow`: tổng vốn đang tạm giữ trong startup chưa chốt.
- `bank`: tài khoản đối ứng ảo của hệ thống; có thể âm khi hệ thống phát thưởng.

Bất biến đối chiếu:

```text
sum(wallets) + escrow + bank = initialMoney
```

Thu phí/nhập hàng làm ví giảm và bank tăng; thưởng/lì xì làm ví tăng và bank giảm. Góp vốn chỉ chuyển ví sang escrow. Khi hoàn vốn và lời/lỗ, escrow về 0 và bank nhận phần chênh lệch. Bank không phải quỹ tim, không phải tiền người xem nạp.

`CommunityGame` chống trùng bằng ID gói nhập và ID nghiệp vụ. Shop còn chặn mỗi ID một đơn/một lần hủy; sự kiện cá nhân khóa theo sequence. Controller đồng bộ số dư giữa quân và tài khoản, không cộng lại delta từ sổ runner. Màn hình, SFX và MC chỉ đọc kết quả, không được ghi tiền lần nữa.

Ví dụ khóa nghiệp vụ: `investment-…:join:P021:revision`, `investment-…:settle:P021`, `shop-…:inventory`, `shop-…:settlement`, `envelope-…:payout:P021`. Mỗi lệnh gửi lại từ mạng phải giữ nguyên ID gói gốc. Một hành động đổi ý thật sự cần ID mới; không tạo ID mới cho mỗi lần retry của cùng gói.

**Hiện trạng:** bản offline giữ ví/ledger trong trình duyệt; LIVE Studio giữ chúng trong bộ nhớ server Node, overlay chỉ đọc snapshot. Reset ván xóa ledger của ván nhưng giữ ID gói đã thấy. Reload overlay không reset ván; restart server hiện mở phòng mới, chưa phục hồi toàn bộ ví/roster/tiến độ. Cấu hình và biên nhận chống trùng của adapter được ghi nguyên tử vào `web/runtime/`; chưa có SQLite/checkpoint bền vững cho cả ván. Mất nguồn TikTok tạm thời pause và giữ người/ví, không coi là mọi người rời. Không lấy ví do client gửi làm số dư đáng tin cậy.

Luồng kết thúc ván bình thường được hold bảo vệ. API nội bộ `resetForMatch({manual:false})` chưa phải rào chặn tuyệt đối: nếu cưỡng bức gọi khi startup còn mở và đồng thời có thanh lì xì đang gom, nhánh chuyển tiếp thanh có thể cho phép hủy/hoàn startup. Không gọi trực tiếp nhánh reset nội bộ khi còn cửa chưa chốt; thao tác hủy phải qua điều khiển rõ ràng và luật hoàn tiền.

Nguồn: [community.js](../../web/src/community.js), [community-controller.js](../../web/src/community-controller.js), [shop.js](../../web/src/shop.js).

## 11. MC, SFX và VFX đọc dữ kiện từ đâu?

[mc-v5.json](../../assets/scripts/mc-v5.json) là bộ **358 cue, 50 ID thẻ nền**, giữ kịch bản/thông số để biên tập. [Kịch bản dễ đọc](11-mc-community-script.md) là bản tham khảo dài. LIVE Studio hiện đã có TTS tiếng Việt, dùng lời runtime ngắn; không đọc toàn bộ pack dài hay chat người xem vào mỗi lượt.

Lời tự động chỉ một câu gọn: `Minh ra 4, đi 4 ô.`, `Minh: Chó giữ chiếc dép. -35.`, hoặc `Minh: 1 Đợi cô chủ, 2 Mua bánh.` Kết quả giữ tiêu đề nguyên nhân ngắn (tối đa tám từ) và delta thực tế, không đọc lại phần nội dung thẻ hoặc toàn bộ số dư. Ô thường/nghỉ không phát cue. Góp vốn/shop đọc lệnh ngắn khi mở, đổi pha và net khi chốt; lì xì đọc quỹ/số người, không đọc danh sách 100 tên. Hàng giọng bỏ cue hết hạn, tên không phù hợp dùng lời chào chung.

Nhạc hiện chỉ có **Cờ Tý Phí LIVE Theme (Alt Take)**, nguồn [assets/co-ty-phu/audio](../../assets/co-ty-phu/audio), bản phát [assets/audio/music/co-ty-phi-live-theme-alt-take.m4a](../../assets/audio/music/co-ty-phi-live-theme-alt-take.m4a). Một bài lặp, âm lượng riêng và hạ khi MC nói; không dùng playlist nhạc boss raid.

Mỗi cue có `id`, `eventId`, `phase`, `line`, `variables`, `sfx`, `trigger`; một số có `commandMap`, độ ưu tiên, cooldown hoặc chỉ đọc ở giây cụ thể. Dùng `renderMCLine(id, values, {strict:true})` để phát hiện thiếu biến trước khi gửi TTS. Thay dữ kiện từ snapshot/giao dịch đã chốt, không nhìn chart rồi tự đoán lời/lỗ.

```js
renderMCLine('shop.settle', {
  hostTag: 'P001', goodOrders: 2, cancelledOrders: 6,
  salesDelta: 30, goodReward: 30, cancelPenalty: 5,
  setupCost: 80, balance: 950
}, { strict: true });
```

Ở ví dụ này `salesDelta=30` là khoản cộng khi chốt, còn **net cả vụ = −50** vì đã trả 80 lúc mở. Khi đọc tổng lời/lỗ phải dùng đúng trường, không gọi +30 là lời ròng. `renderMCLine` hiện chọn SFX của `shop.settle` theo `salesDelta`, trong khi controller chọn theo net cả vụ. Adapter cho bản tin cuối phải lấy net/SFX đã chốt của runtime, hoặc ghi đè SFX theo `result.net`; nếu chỉ dùng nguyên kết quả render ở ví dụ trên sẽ phát âm tăng tiền dù cả vụ đang lỗ.

### Runtime cue và thư viện kịch bản tham khảo

`CommunityController.mcCues` phát text ngắn cùng các ID phiên như `investment-….chart`, `shop-….returns`. LIVE room phát ID duy nhất cho từng lần, nối thẻ cá nhân và gửi cue chuẩn qua SSE; server TTS chỉ nhận lại đúng cue đã phát. Các ID phiên không trùng toàn bộ ID cố định của MC pack. Nếu tích hợp repo MC riêng, ánh xạ pha/dữ kiện theo bảng dưới; không bật lại toàn bộ câu dài của pack trong runtime ngắn.

| Nguồn runtime | Cue thư viện / hướng ánh xạ |
| --- | --- |
| Thẻ cá nhân ID GAIN01 mở | `event.GAIN01.open`, sau đó cue kết quả đúng dấu delta |
| `shop.mcCue.id = shop.return` | `shop.cancel` |
| `shop.mcCue.id = shop.settled-profit/loss/even` | `shop.settle`, truyền số liệu đã chốt |
| `shop.mcCue.id = shop.cancelled` | `shop.abort`, `refund=80` khi hủy trước chốt |
| Startup `joining/chart/settled` | Cue cộng đồng đúng GROUP01–04 và pha tương ứng |
| Lì xì đầy tim | Cue kết quả lì xì từ danh sách payout đã chốt |

Biến runtime cũng cần đổi tên khi đưa vào pack: `host → hostTag`, `cost → setupCost`, `returnSec → returnSeconds`, `fulfilled → goodOrders`, `cancelled → cancelledOrders`; `salesDelta` lấy `settlementDelta`, không lấy `net`.

Chống đọc lặp bằng khóa `matchId:eventInstanceId:phase:cueId`; cue xác nhận đơn có thể thêm ID đơn. Bỏ lời đếm giờ của cửa đã đóng. Khi nhiều người nhận/mất tiền cùng lúc, chọn người đang được camera theo và gộp bản tin; không xếp 100 câu khiến MC chậm hơn game. MC xác nhận lựa chọn/tim/quà vừa đủ, không lặp lời kêu gọi quà.

SFX tiền thông thường: `sfx_coin_up` khi tăng, `sfx_coin_down` khi giảm. Các thẻ chó/công an có override `sfx_dog_bark`/`sfx_traffic_whistle`; khi nối âm cần phân biệt âm diễn cảnh và âm báo giao dịch. VFX thường theo delta: `coin_burst`, `coin_loss`, hoặc nghỉ; chó/công an dùng dấu chân/bụi hoặc còi. Hai NPC là sprite 2D gốc, còn phố/đạo cụ và xúc xắc là 3D.

Tên người xem chỉ là dữ liệu văn bản để chèn vào lời đọc. Lọc ký tự điều khiển/giới hạn độ dài; không diễn giải bình luận của họ thành chỉ dẫn thay luật hoặc chỉ dẫn cho MC.

Nguồn: [mc-script.js](../../web/src/mc-script.js), [prepare-mc.mjs](../../web/scripts/prepare-mc.mjs), [effects.js](../../web/src/effects.js), [event-cameos.js](../../web/src/event-cameos.js).

## 12. Thêm một sự kiện mới mà không làm sai tiền

1. Chọn phạm vi: thẻ cá nhân hay sự kiện chung có nhiều người. Chọn một nơi chịu trách nhiệm ghi tiền; UI/MC không được cùng ghi.
2. Cấp ID mới duy nhất. Giữ ID đã phát hành để log và kịch bản cũ còn tra lại được.
3. Với thẻ cá nhân, thêm vào `EVENT_CARDS` trong `events.js`: loại, tiêu đề, nội dung, lựa chọn hoặc delta, điều kiện tiền, xác suất, SFX/VFX, lời MC và mặc định hết giờ. Các `outcomes[].delta` là số ròng; xác suất phải cộng thành 1.
4. Với phiên chung, định nghĩa rõ: ai mở, ai đủ điều kiện, thời điểm chốt danh sách, trừ/giữ tiền ở pha nào, hoàn ở pha nào, timeout, hủy và trường hợp reset. Tạo khóa chống chốt hai lần cho từng ví.
5. Nối controller và renderer: hiện đồng hồ/quy tắc trước khi nhận lệnh. Nếu dùng hold, đảm bảo chuyển qua cửa đang chờ mà không thả quân chạy giữa hai kết quả.
6. Thêm cue MC, ánh xạ ID lệnh sang lựa chọn, rồi chạy `node web/scripts/prepare-mc.mjs`. Script tái tạo JSON và tài liệu MC; không sửa file sinh ra rồi quên nguồn `mc-script.js`.
7. Cập nhật sheet V5 và chạy `node web/scripts/prepare-event-guide.mjs` để làm mới bảng danh mục cuối tài liệu này từ source. Sheet để biên tập/cân bằng; runtime hiện **không tự nhập Excel**. Đổi một ô Excel chưa đổi được luật đang chạy. `npm run build` cũng không tự xuất lại workbook.
8. Kiểm tra các ca có ý nghĩa: đủ/thiếu vốn, chọn/hết giờ, lời/lỗ, gói lặp, rút trước/sau khóa, ví gần 0, khách chờ, đầy tim xen một cửa khác, reset và tổng tiền đối chiếu.

Không sửa trực tiếp asset V1/V2.3 gốc để thêm hiệu ứng. Đặt art nâng cấp trong thư mục riêng rồi nối qua bước prepare để giữ nguồn gốc và có thể quay lại bản trước.

## 13. Chạy thử, bàn giao và phần cần làm cho LIVE

Chạy `start-local.cmd` ở gốc repo hoặc:

```powershell
cd web
npm ci
npm run dev
```

Mở [20 quân + 80 khách chờ](http://localhost:4173/?players=20&accounts=100). `?seed=42` giúp so cùng một map; `?debug=1` bật tiến thời gian để kiểm tra luật, không phải chế độ phát LIVE. `?mode=classic` dành cho kiểm tra demo camera cũ. 100/200 quân trên map chỉ bật với `stress=1`; khách chờ thông thường không cần chế độ đó.

Các nút startup/shop/lì xì là đường tắt duyệt cảnh. Muốn kiểm tra kích hoạt tự nhiên, để quân đang theo dõi dừng đúng loại ô, đủ ví và hết khoảng giãn sự kiện. Khi thử chọn người gửi, chọn P021 trở đi để dùng khách chờ của ván đầu; sau ghép trận hãy xem nhãn hiện tại vì roster đã đổi.

```powershell
cd web
npm test
npm run build
```

Browser test dùng Python + Playwright và một server phục vụ bản build ở port 4174: `python tests/community-browser.py`. Có thể đặt `WEB_PREVIEW_URL` để dùng địa chỉ khác. Bộ này kiểm tra đủ ba vòng/top 3, 12+8 ghép trận, khách chờ, shop, chart, lì xì xen shop, chống lệnh trùng và xuất ảnh. Tại mốc bàn giao: 124 kiểm tra Node và 37 kiểm tra browser đạt; đây là kiểm tra mô phỏng, chưa phải benchmark vừa game vừa phát LIVE.

### Phần đã có và phần còn cần xác minh trước LIVE thật

- Đã có adapter TikTok chuẩn hóa ID ổn định, bình luận/tim/quà chốt, chống trùng và reconnect; LIVE room đăng ký qua sự kiện vào hoặc `CHƠI`. Chưa xác minh trên phòng TikTok thật của chủ dự án; connector không bảo đảm tín hiệu rời riêng từng người.
- Server đã chốt luật và thời gian; hạn nhập người thật 10 giây, không phụ thuộc camera. Cần thử nguồn thật trên máy phát; không dùng nút demo như bằng chứng đã nhận người thật.
- SQLite hoặc kho dữ liệu lưu ván, tài khoản, ledger, lệnh đã xử lý và checkpoint. Quy định rõ lúc mất nguồn thì pause cửa đang mở, nối lại ra sao và xử lý ván đã chốt.
- Đã có cầu nối MC/TTS, xác thực cue, hàng giọng giới hạn và bỏ câu cũ. Vẫn cần kiểm tra Internet, autoplay và đường âm thanh trong LIVE Studio.
- Thử tải luồng bình luận/tim thật trên máy phát; đo FPS và thời gian xử lý. Khách chờ dùng đám đông atlas/instancing nhẹ ở tám sân; không tạo thêm runner như 20 quân đang chơi.
- Nếu cần mini game thao tác, xây màn tương tác riêng; hiện MINI01–04 là câu hỏi. Chưa có thanh lý tài sản sở hữu lâu dài, sổ SQLite hoặc cân bằng mùa giải.

### Bản đồ mã nguồn để làm tiếp

| File | Trách nhiệm |
| --- | --- |
| [events.js](../../web/src/events.js) | 50 thẻ cá nhân, chọn thẻ, tính kết quả |
| [demo.js](../../web/src/demo.js) | Một quân: lắc, đi, rẽ, thẻ, khóa kết quả |
| [parallel-race.js](../../web/src/parallel-race.js) | Các quân đồng thời, hold chung, camera, hoàn thành theo thời điểm |
| [layouts.js](../../web/src/layouts.js), [race.js](../../web/src/race.js) | Map/nhánh, vòng đường, đích và top 3 |
| [community.js](../../web/src/community.js) | Tài khoản, escrow/bank, góp vốn, tim/quà, lì xì, sổ chống trùng |
| [gift-catalog.js](../../web/src/gift-catalog.js), [server/room.mjs](../../web/server/room.mjs) | Danh tính quà, ưu tiên lắc/camera và quỹ quà cả phố |
| [shop.js](../../web/src/shop.js) | Shop nhận/tự hủy đơn và chốt tiền chủ |
| [community-controller.js](../../web/src/community-controller.js) | Lệnh, đồng bộ ví, cửa chung và hàng đợi kết quả |
| [matchmaking.js](../../web/src/matchmaking.js) | Tim giữ ghế, FIFO, roster ván kế |
| [community-view.js](../../web/src/community-view.js) | Bảng chung, thanh tim, bục và sảnh |
| [mc-script.js](../../web/src/mc-script.js) | Thư viện cue/biến và bộ sinh MC pack |
| [main.js](../../web/src/main.js) | Ghép các phần, đổi roster, đồng hồ sảnh, nút chạy thử |

## 14. Danh mục thẻ cá nhân hiện có

Bảng này trích từ `EVENT_CARDS` khi bàn giao. Số dương/âm là thay đổi MONEY ròng; “cần” là số dư tối thiểu để chọn, không phải một khoản thu thêm. Nếu thẻ đủ điều kiện mở phiên chung thì áp dụng mục 5/6 thay cho lựa chọn cá nhân trong bảng.

<!-- EVENT_CATALOG_START -->
| ID | Loại | Tên sự kiện | Lựa chọn và MONEY |
| --- | --- | --- | --- |
| GA01 | station | Ga phố chào bạn | +100 |
| REST01 | rest | Ô thường · đi dạo thôi | 0 |
| GAIN01 | gain | Nhặt ví… của mình | +60 |
| GAIN02 | gain | Tiền thừa cô giữ hộ | +45 |
| GAIN03 | gain | Thưởng giao hàng đúng hẹn | +70 |
| GAIN04 | gain | Ca phụ đầu hẻm | +35 |
| GAIN05 | gain | Đổi lon lấy điểm | +50 |
| GAIN06 | gain | Tìm được mèo nhà bác | +80 |
| GAIN07 | gain | Phiếu hoàn điểm | +40 |
| GAIN08 | gain | Khách khen quán dễ thương | +65 |
| LOSS01 | loss | Chú công an nhắc đỗ xe | -60 |
| LOSS02 | loss | Chó giữ chiếc dép | -35 |
| LOSS03 | loss | Mưa bất ngờ | -20 |
| LOSS04 | loss | Trà sữa đổi chủ | -40 |
| LOSS05 | loss | Xe xẹp bánh | -45 |
| LOSS06 | loss | Gửi xe quên lấy vé | -25 |
| LOSS07 | loss | Đóng nhầm thùng trống | -30 |
| LOSS08 | loss | Điện thoại chạm nhầm | -50 |
| LIFE01 | event | Chó chắn đường đòi chơi | wait: Đợi cô chủ gọi → 0 / treat: Mua bánh thưởng → -15 |
| LIFE02 | event | Công an hỏi đường | point: Chỉ đường → +20 / help: Phụ chuyển nước → +35 |
| LIFE03 | event | Cứu quầy khỏi gió | sign: Giữ tấm bảng → +25 / chairs: Xếp lại ghế → +30 |
| LIFE04 | event | Hàng xóm nhờ tưới cây | small: Tưới ba chậu → +25 / garden: Chăm cả sân → +45 |
| LIFE05 | event | Mèo chiếm ghế | stand: Đứng hóng gió → 0 / rent: Thuê ghế bên cạnh → -10 |
| LIFE06 | event | Bạn rủ ăn liên hoan | help: Phụ dọn bàn → +15 / party: Góp quỹ chung → -25 |
| LIFE07 | event | Đơn cuối trước giờ ngủ | rest: Nghỉ thôi → 0 / deliver: Giao thêm phần → +40 |
| LIFE08 | event | Chiếc loa gọi tên bạn | read: Đọc thông báo → +30 / check: Soát lại nội dung → +20 |
| LIFE09 | event | Thang máy đang bảo trì | wait: Khách xuống nhận → +10 / stairs: Đi bộ giao tận cửa → +35 |
| LIFE10 | event | Nhờ trông quán một nhịp | watch: Trông quầy → +25 / ice: Bê thùng đá → +40 |
| LIFE11 | event | Thư mời sinh nhật mèo | clap: Vỗ tay chúc mừng → 0 / gift: Tặng món đồ chơi → -20 |
| LIFE12 | event | Lạc đúng quầy khuyến mãi | map: Hỏi đường rồi đi → 0 / menus: Phụ phát menu → +30 |
| INV01 | invest | Góp vốn xe bánh mì | save: Giữ vốn → +10 / fund: Góp mẻ bánh → 60%: +100; 40%: -70 (cần 70) |
| INV02 | invest | Quầy ô che nắng | shift: Nhận lương trực quầy → +25 / umbrellas: Thuê thêm ô → 60%: +85; 40%: -60 (cần 60) |
| INV03 | invest | Vườn rau sân thượng | water: Nhận công tưới → +30 / garden: Góp giống rau → 65%: +80; 35%: -50 (cần 50) |
| INV04 | invest | Máy ép mía chung | work: Phụ rửa cốc → +35 / machine: Góp vốn máy → 55%: +125; 45%: -90 (cần 90) |
| INV05 | invest | Tủ đổi sách đầu hẻm | sort: Sắp xếp sách → +20 / shelf: Mở quầy sách cũ → 65%: +65; 35%: -40 (cần 40) |
| INV06 | invest | Quầy hoa cuối tuần | salary: Nhận công bó hoa → +30 / flowers: Nhập lô hoa → 60%: +110; 40%: -80 (cần 80) |
| INV07 | invest | Điểm sạc xe đồ chơi | guard: Trực điểm sạc → +25 / station: Thuê một trạm → 60%: +105; 40%: -75 (cần 75) |
| INV08 | invest | Rạp chiếu sân nhà | chairs: Xếp ghế lấy công → +30 / screen: Góp màn chiếu → 55%: +95; 45%: -65 (cần 65) |
| TRADE01 | trade | Shop dép chạy deadline | salary: Nhận lương → +40 / sell: Nhập một lô dép → 60%: +120; 40%: -80 (cần 80) |
| TRADE02 | trade | Xe trà tắc đầu hẻm | wage: Phụ quầy → +30 / batch: Bán một mẻ → 65%: +80; 35%: -50 (cần 50) |
| TRADE03 | trade | Mẻ bánh tráng trộn | pack: Nhận công đóng gói → +35 / sell: Bán mẻ bánh → 60%: +95; 40%: -60 (cần 60) |
| TRADE04 | trade | Quầy áo mưa lưu động | salary: Phát menu → +25 / stock: Nhập áo mưa → 55%: +110; 45%: -70 (cần 70) |
| TRADE05 | trade | Chợ đồ cũ vui vẻ | clean: Lau quầy lấy công → +25 / resell: Thu mua bán lại → 65%: +75; 35%: -45 (cần 45) |
| TRADE06 | trade | Cà phê giao tận cổng | deliver: Giao thuê → +40 / coffee: Mở ca cà phê → 60%: +115; 40%: -75 (cần 75) |
| TRADE07 | trade | Hộp cơm văn phòng | pack: Phụ đóng hộp → +35 / lunch: Nhập mẻ cơm → 60%: +130; 40%: -85 (cần 85) |
| TRADE08 | trade | Quầy móc khóa mèo | craft: Làm thuê → +30 / stand: Mở quầy thử → 60%: +90; 40%: -55 (cần 55) |
| MINI01 | minigame | Đóng gói thần tốc | right: HỘP → BĂNG → TEM → +70 / wrong: TEM → HỘP → BĂNG → 0 |
| MINI02 | minigame | Trà sữa đúng đơn | right: ÍT ĐÁ · KHÔNG ĐƯỜNG → +65 / wrong: NHIỀU ĐÁ · THÊM ĐƯỜNG → 0 |
| MINI03 | minigame | Địa chỉ không đánh đố | right: NHÀ 12 · HẺM 3 → +55 / wrong: NHÀ 3 · HẺM 12 → 0 |
| MINI04 | minigame | Tính tiền quán nước | right: TRẢ 15 → +60 / wrong: TRẢ 25 → 0 |
<!-- EVENT_CATALOG_END -->

Ngoài 50 thẻ trên, các phiên chung là GROUP01–04, SHOP01 và LIXI. Dữ liệu/câu MC/balance được bàn giao trong [sheet V5](../../outputs/co-ty-phi-v5/Co_Ty_Phi_Su_Kien_V5.xlsx); [sheet V4](../../outputs/co-ty-phi-v4/Co_Ty_Phi_Su_Kien.xlsx) giữ để tra lịch sử. Khi có khác biệt, đối chiếu mã nguồn ở đúng commit đang chạy trước khi sửa số liệu.

Tám tab V5: `Su_kien` (50 thẻ), `Su_kien_chung` (sáu phiên chung), `MC_Cues` (358 cue), `Luat_van`, `Can_bang`, `Ty_le_o`, `Tham_khao_map`, `Huong_dan`.
