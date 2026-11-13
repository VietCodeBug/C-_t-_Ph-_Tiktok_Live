# Bản thử 20 quân, khách chờ và hoạt động cộng đồng

## Cấu hình mặc định

Mở [bản local 20 quân / 100 tài khoản](http://localhost:4173/?players=20&accounts=100). Có **20 người đang trong bàn và 80 khách chờ**. Cả 100 tài khoản có ID, ví MONEY và trạng thái tham gia; chỉ 20 người đang trong bàn có sprite chạy trên map. Khách chờ tham gia shop, góp vốn và lì xì bằng bình luận mô phỏng, không sinh thêm quân 3D/2D trên cảnh.

`players=100` đơn lẻ không bật 100 quân ở chế độ thường. Thử tải lớn phải dùng `?stress=1&players=100&accounts=100` hoặc `?stress=1&players=200&accounts=200`. Những cấu hình này chỉ dành cho thử tải local; chưa có benchmark phát LIVE hoặc nhiều kết nối mạng thật.

## Ba vòng đường và bục top 3

Mỗi quân đi đủ ba chu trình graph: hiện là 3×96 = 288 cạnh, kể cả rẽ nhánh. Vạch đích chọn theo seed ở phần dưới map, tại ô mọi tuyến đều phải qua, và giữ cố định trong ván. Mọi quân xuất phát cùng tiến độ; vị trí lệch để nhìn rõ không tạo lợi thế. Nhân vật đi các cạnh thật, không cộng vòng bằng dịch chuyển về đích.

**Người thứ ba hoàn thành ba vòng khóa ván.** Bục theo thứ tự chạm vạch, không theo MONEY, và không chờ những quân còn lại. Với nhiều người tới trong một frame, hệ thống so thời điểm đi hết phần đường còn lại; hòa tuyệt đối dùng thứ tự quân trong bàn. MONEY có bảng hạng riêng cho ví, thống kê và chia lì xì. Không tự cộng tiền thưởng theo thứ tự về đích.

Camera theo một người trong khi các quân khác tiếp tục chạy. Góc rộng ưu tiên tên người đang theo dõi và top 3. Quân chung ô có cách sắp/nhóm hình kèm ×N; khách chờ được theo dõi ở danh sách tài khoản, không phải các sprite bị ẩn trong map.

## Sau bục: 15 giây giữ ghế và luân phiên hàng chờ

1. Giữ bục top 3 **8 giây**. Tim trong lúc đang đua hoặc đang hiện bục không được tích sẵn để giữ ghế.
2. Mở cửa **15 giây**, đặt bộ đếm giữ ghế của 20 người vừa chơi về 0.
3. Trong cửa này, **12 người cũ đầu tiên đạt 30 tim mới** giữ ghế ván kế. Thứ tự là lúc hệ thống nhận đủ tim; một ID chỉ giữ một ghế. Người đạt sau khi hết 12 suất vẫn vào hàng chờ.
4. Lấy người chờ lâu nhất vào các ghế còn lại. Nếu hàng chờ đủ người, luôn có ít nhất tám khách chờ lên bàn; suất giữ ghế không dùng hết cũng chuyển sang FIFO.
5. Người cũ không giữ được ghế nối cuối hàng, sau những người đã chờ. Khóa roster 20 người rồi sinh map, seed và vạch đích mới.

| Người cũ giữ ghế | Người lấy từ đầu hàng chờ | Tổng quân ván mới |
| --- | --- | --- |
| 12 | 8 | 20 |
| 4 | 16 | 20 |
| 0 | 20 | 20 |

Các con số trên là cấu hình mặc định. Khi không đủ khách chờ, hệ thống lấy tiếp các ID còn lại theo hàng đã nối, không nhân bản tài khoản để lấp ghế.

Chỉ gói tim nhận đúng cửa giữ ghế mới tăng bộ đếm 30; ID gói trùng hoặc gói cũ phát lại không chiếm ghế. Khách đang chờ thả tim vẫn hỗ trợ hoạt động chung, nhưng không lấy suất giữ ghế dành cho người vừa chơi. Hoa hồng không bỏ qua quy tắc giữ ghế/FIFO.

Giữ tài khoản và thứ tự chờ qua ván mới; **reset toàn bộ 100 ví về 1.000 MONEY**, gồm cả người trong bàn và khách chờ. Quyền hoa hồng chưa dùng còn giữ. Giữ lại danh sách ID gói đã xử lý để chặn phát lại gói cũ thành giao dịch mới. Chuyển roster tháo sprite/controller cũ rồi tạo actor cho 20 người mới; các ví khách chờ vẫn là bản ghi dữ liệu nhẹ.

## SHOP01: khách chờ đặt và tự hủy đơn miễn phí

Quầy do một người đang trong bàn mở. Chủ cần ít nhất 120 MONEY và trả **80 MONEY nhập hàng đúng một lần**. Danh sách khách hợp lệ chốt từ những tài khoản đang chờ khi quầy mở, không gồm chủ quầy.

- Pha nhận đơn **12 giây**: khách gõ mã chủ quầy, ví dụ `P001`. Mỗi ID một đơn; tối đa tám đơn.
- Pha đổi ý **12 giây**: khách đã đặt gõ `BOM P001` để hủy đơn của chính mình. Không hủy hộ, không hủy lặp và không nhận đơn mới trong pha này.
- Đặt hoặc hủy đơn **không trừ ví khách**. Chủ nhận +30 MONEY mỗi đơn hoàn tất và chịu −5 mỗi đơn bị hủy.
- Lãi/lỗ ròng: `30 × đơn hoàn tất − 5 × đơn hủy − 80`. Phí 80 đã trừ lúc mở, khi chốt không trừ lần nữa.

Ví dụ tám đơn, sáu hủy: hai đơn hoàn tất, tổng ròng `60 − 30 − 80 = −50`; chủ từ 1.000 còn **950**. Đây là tương tác trong game, không mua bán hay hoàn tiền hàng thật.

## Startup chung

Ô đầu tư của người đang được camera theo có thể mở phiên chung, giãn tối thiểu 45 giây mô phỏng giữa các phiên và chỉ một cửa chung tại một thời điểm. Những ô đầu tư còn lại dùng thẻ cá nhân. Có xe bánh mì, hợp tác xã trà tắc, phiên chợ và sân khấu hội phố.

Chủ startup cam kết **100 MONEY**. Trong **10 giây**, người đang trong bàn và khách chờ chọn `GÓP`/`THAM GIA` hoặc `BỎ`/`KHÔNG THAM GIA`. Không trả lời thì không tham gia. Tiền góp trừ vào quỹ tạm giữ; người góp có thể rút trước giờ khóa và được hoàn đúng vốn. Chủ không rút cam kết. Mỗi ID một phần vốn, lệnh trùng không trừ thêm.

Khóa danh sách rồi chạy chart mô phỏng **8 giây**. Chart độc lập với xúc xắc, tim và quà. Xanh trả 120–180% vốn, đỏ trả 15–70% vốn; chủ và người góp cùng công thức. Góp 100, nhận 150 là lời 50, ví 1.050; nhận 40 là lỗ 60, ví 940. Khoản trả đã gồm vốn. Nếu cả 100 tài khoản góp, quỹ tạm giữ là 10.000; không tạo thêm 80 quân vì khách chờ cùng góp.

Sổ ghi ID, vốn, khoản hoàn, lãi/lỗ và số dư. MONEY và quỹ hệ thống là điểm/tài khoản đối ứng ảo trong game; không có rút tiền hoặc thị trường tài chính.

## Tim, hoa hồng và lì xì

Hoa hồng được đầu vào xác nhận cho một quyền ưu tiên lắc hợp lệ kế tiếp; không cắt lượt đang lắc hoặc sửa mặt số. Tim tăng ưu tiên có giới hạn. Scheduler chỉ chọn trong những quân đang sẵn sàng, có cơ chế tránh một ID giữ mọi lượt. Khách chờ có quyền hoa hồng chưa dùng sẽ dùng được khi trở thành quân hợp lệ; quyền này không tự đưa họ vượt hàng giữ ghế.

Lì xì có thanh **1.000 tim chung**. Đầy thanh thì mở quỹ mô phỏng **1.000–5.000 MONEY** cho các tài khoản đã có trong danh sách lúc mở cửa, gồm khách chờ và người không thả tim. Một phần chia đều, phần còn lại theo hạng MONEY; vốn đang tạm giữ vẫn tính vào tài sản. Chia tiền lẻ sao cho tổng trả bằng đúng quỹ. Quỹ nhỏ hơn số người có thể tạo khoản nhận 0; quỹ mặc định tránh điều đó ở 100 tài khoản.

Nếu top 3 chốt ván khi thanh chưa đầy, tiến độ tim chuyển sang đợt lì xì ván kế tự động; không trả quỹ chưa mở. Tim giữ ghế là bộ đếm riêng chỉ chạy trong cửa 15 giây. Một gói tim mới đúng thời điểm có thể hỗ trợ cả hoạt động chung và điều kiện giữ ghế, nhưng không được phát lại để đếm hai lần trong cùng bộ đếm.

## MC, dữ liệu và phạm vi local

[MC JSON](../../assets/scripts/mc-v5.json) và [kịch bản đọc](11-mc-community-script.md) bàn giao text/cue cho repo MC riêng, không tạo giọng nói. Có cue cho thẻ nền, shop khách chờ, góp vốn, lì xì, bục và sảnh giữ ghế. Khi nhiều ô tiền cùng lúc, MC có thể gộp bản tin thay vì đọc mọi tên.

`CommunityGame.ledger` là sổ đối chiếu ví trong bộ nhớ. Thu nhập/chi phí ô đồng bộ một lần vào sổ chung; không cộng ledger từng runner thêm lần nữa. Ván mới reset 1.000 cho tất cả tài khoản. Chưa lưu SQLite hoặc phục hồi sau reload.

Trình local nhận ID `P001…P100`, bình luận, tim/hoa hồng giả lập và các nút mô phỏng. Các quân không đang theo dõi hiện là bot thử tự chọn sau 3 giây. Bản người thật cần adapter xác thực ID và gói bình luận/tim/quà, cùng thời hạn cho mọi tài khoản, server chốt luật, khử trùng và lưu sổ. **Chưa nối TikTok thật**; nút thử không gửi quà hoặc trừ tiền thật.

`?mode=classic` giữ chế độ camera/ô cờ cũ để kiểm tra. `?debug=1` mở bộ tiến thời gian; vẫn chạy cạnh, timer và giao dịch của mô phỏng, chỉ bỏ vẽ frame trung gian. Không dùng debug/client làm nơi chốt luật LIVE.
