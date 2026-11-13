# Cờ Tý Phí — 20 quân và khách chờ cùng chơi

Xem [Luật ván chơi và logic sự kiện V5](../docs/co-ty-phu/13-event-logic-guide.md) để tra công thức tiền, các pha sự kiện, lệnh bình luận và cách bổ sung nội dung.

Bản thử local dọc 9:16 trên nhánh `web/third-person-v23` mặc định có **20 quân trên map và 100 tài khoản, gồm 80 khách chờ**. Chỉ người đang trong bàn được tạo sprite và chạy đua; khách chờ vẫn có ví, hàng chờ và quyền tham gia hoạt động cộng đồng.

## Chạy local

Node 22.12+ (đã chạy với Node 22.20.0), npm:

```powershell
cd web
npm ci
npm run dev
```

Mở [bản mặc định 20 quân / 100 tài khoản](http://localhost:4173/?players=20&accounts=100). `start-local.cmd` ở gốc repo mở server trên Windows; `npm run build` xuất bản tĩnh tại `web/dist`, `npm run preview` phục vụ bản build.

100 hoặc 200 quân **không phải cấu hình mặc định**. Chỉ bật để thử tải bằng [100 quân](http://localhost:4173/?stress=1&players=100&accounts=100) hoặc [200 quân](http://localhost:4173/?stress=1&players=200&accounts=200). Phải có `stress=1`; riêng `players=100` không vượt giới hạn 20 của chế độ thường. Đây là mô phỏng local, chưa chứng minh FPS khi vừa phát LIVE hoặc tải nhiều kết nối mạng.

## Ván đua và sảnh kế tiếp

- Map theo seed có 138 ô, 96 bước trên một chu trình đã chọn và sáu ngã rẽ. Cả 64 tổ hợp tuyến đều dài 96 bước; mỗi quân cần ba vòng đường thật = 288 cạnh. Hai GLB/graph 24 ô gốc được giữ để truy vết.
- Vạch đích sinh theo seed ở phần dưới map, trên ô bắt buộc mọi tuyến đi qua. Đích giữ nguyên trong ván. Tất cả quân bắt đầu cùng tiến độ; lệch hình hiển thị không cộng bước.
- **Người thứ ba về đích khóa ván**. Bục theo thứ tự chạm đích, không theo MONEY; MONEY vẫn dùng cho ví và xếp hạng lì xì. Người chạm đích trong cùng frame được so thời điểm đi hết đoạn còn lại; bằng nhau hoàn toàn dùng thứ tự quân ổn định.
- Hiện bục **8 giây**, rồi mở cửa giữ ghế **15 giây**. Bộ đếm giữ ghế bắt đầu từ 0; chỉ gói tim mới nhận trong cửa này được tính.
- Trong 20 người vừa chơi, **12 người đầu tiên đạt 30 tim trong cửa giữ ghế** giữ được ghế ván kế. Đủ tim sau khi hết 12 suất vẫn vào hàng chờ.
- Ít nhất **8 khách chờ lâu nhất** lên bàn khi hàng chờ có đủ người. Nếu dưới 12 người giữ ghế, các suất còn dư cũng lấy từ đầu hàng chờ. Người cũ không giữ được ghế được nối cuối hàng, sau những khách đã chờ.
- Khóa danh sách rồi tự sinh map/seed/đích mới. Giữ ID tài khoản, thứ tự chờ và quyền hoa hồng chưa dùng; **đặt lại ví của toàn bộ 100 tài khoản về 1.000 MONEY**, kể cả khách chờ. Lượt thích giữ ghế không được tích sẵn từ ván trước.

`Phố mới` là điều khiển mở ván mới bằng tay; không phải lựa chọn trong một ván LIVE. Khi đổi bàn, sprite cũ được gỡ và giải phóng, chỉ tạo actor cho roster mới. Xem [luật sảnh và hoạt động chung](../docs/co-ty-phu/12-community-and-100-racers.md).

## Map, nhân vật và ô đích

Ba khu phố Chợ Vỉa Hè, Phố Giao Hàng, Bến Sông dùng đường uốn, sân nhà, quầy, cây, kênh, cầu và Đồi Hội Phố có tháp đồng hồ 3D. Nhà/đạo cụ tái sử dụng từ kho GLB; cảnh bổ sung dựng bằng geometry.

Xúc xắc là khối bo góc với 21 chấm hình học trên sáu mặt, đèn và bóng, nổi trên cảnh không có nền trắng. Lắc 1,8 giây, giữ số 0,95 giây rồi quân đi đúng số cạnh. SVG chỉ là icon HUD nhỏ.

Sprite giữ ô 256×256, pivot chân `(128,218)`, hướng S/E/N và W lật từ E. Đi thường dùng walk, camera theo sau dùng artwork quay lưng. Ch07 Đào Tóc Dài có một pose idle chính diện mới; các hướng và animation còn lại giữ atlas gốc.

Tám nhóm ô gồm ga, nhận tiền, mất tiền, chuyện phố, đầu tư, buôn bán, nghỉ và thử thách. Chỉ ô đích chốt giao dịch. **Ô thường không mở thẻ và không đổi MONEY**; MC có câu ngắn “Ôi, không có gì”. Có 50 mục runtime riêng với 42 thẻ nguồn. Cảnh chó/công an dùng NPC 2D gốc, động tác bark/police_stop, cùng SFX/VFX; nhận và mất tiền có âm thanh riêng.

Các quân đang trong bàn chạy độc lập; camera chỉ theo một người. Chọn tên hoặc **Theo quân kế** đổi camera, không hủy bước của các quân khác. Người chung ô được sắp/nhóm hình với ×N, ưu tiên người đang theo dõi và top 3. Khách chờ không được tạo sprite trên map.

## Khách chờ và sự kiện cộng đồng

- **SHOP01 — đặt/hủy đơn miễn phí:** khi quầy mở, khách chờ tại thời điểm mở gõ mã chủ quầy để đặt một đơn. Tối đa tám đơn trong 12 giây; sau đó có 12 giây gõ `BOM <mã chủ>` để hủy đúng đơn của mình. Ví khách không bị trừ. Chủ quầy trả 80 MONEY nhập hàng một lần, nhận +30 mỗi đơn thành công và mất 5 mỗi đơn bị hủy. Từ 1.000, tám đơn/sáu hủy còn 950. Chủ cần tối thiểu 120 để mở quầy.
- **Góp vốn:** người trong bàn và khách chờ đều có thể chọn GÓP/THAM GIA hoặc KHÔNG THAM GIA. Chủ startup góp 100; nhận thêm vốn trong 10 giây, khóa danh sách rồi chart mô phỏng 8 giây. Tiền trả đã gồm vốn, chủ và người góp dùng cùng kết quả; lệnh trùng không trừ lần hai. Không trả lời thì không tự góp.
- **Lì xì:** đủ 1.000 tim chung thì mở quỹ mô phỏng 1.000–5.000 MONEY cho danh sách tài khoản đủ điều kiện, gồm cả khách chờ và người không thả tim. Chia theo hạng MONEY và bảo toàn tổng quỹ.
- **Hoa hồng/tim:** hoa hồng ưu tiên một lần lắc hợp lệ khi tài khoản có quân đang sẵn sàng; tim tăng ưu tiên có giới hạn. Không sửa số xúc xắc hoặc chart. Khách chờ không vượt cửa giữ ghế hay FIFO chỉ bằng hoa hồng.

Bảng **Thử bình luận & sự kiện chung** dưới khung chơi nhận ID tài khoản, lệnh, tim và hoa hồng giả lập. Chọn `P001…P100` để thử tài khoản; 20 ID đang trong bàn có quyền LẮC/TRÁI/PHẢI của quân mình, khách chờ dùng lệnh mua/hủy đơn hoặc góp vốn. Chưa có adapter TikTok; các nút không gửi quà, mua hàng hoặc trừ tiền thật.

## Điều khiển và phạm vi

**Toàn bàn** cho kéo xoay và cuộn zoom; **Bám nhân vật** theo người được chọn. `Space` tạm dừng, `V` đổi góc máy; trái/phải chốt nhánh khi thanh mở. Có fullscreen và chụp map 1080×1920. **Ghé thử một ô** và **Thử ngã rẽ** dùng để duyệt cảnh, không cộng bước vòng đua.

Ví và ledger hiện nằm trong bộ nhớ, không phục hồi sau reload và chưa lưu SQLite. Các quân không đang theo dõi là bot thử cục bộ, tự chọn sau 3 giây; bản người thật cần lệnh theo ID và cùng thời hạn cho mọi người, không phụ thuộc camera. Bốn thử thách hiện là câu hỏi hai lựa chọn; ga thưởng khi dừng đúng ô, chưa có thưởng đi qua.

MC bàn giao bằng [JSON cue](../assets/scripts/mc-v5.json) và [kịch bản](../docs/co-ty-phu/11-mc-community-script.md) cho repo MC riêng; không tạo giọng nói. Tài liệu 08/09 giữ làm lịch sử thiết kế; luật hai vòng lượt ở tài liệu cũ đã được thay bằng ba vòng đường và sảnh luân phiên.

## Nguồn và kiểm tra

Asset V1/V2.3 gốc từ commit `fb996c6c23433f14b465849510ba797ab6818bbe` được giữ nguyên; phần art mới nằm riêng. `scripts/prepare-assets.mjs` chép asset sử dụng và ghi hash/provenance. Three.js ghim 0.180.0 để tương thích metadata pivot của GLB. Không gọi CDN hoặc font ngoài khi chơi.

```powershell
cd web
npm test
npm run build
cd ..
python web/tests/browser-smoke.py
python web/tests/dice-browser.py
python web/tests/gameplay-browser.py
python web/tests/community-browser.py
```

Python tests cần Playwright/Chromium. Dùng `CHROMIUM_PATH` hoặc `WEB_PREVIEW_URL` để chọn browser/URL; báo cáo và ảnh mới ở `web/artifacts/`. Các kiểm tra camera cũ dùng `?mode=classic`; kiểm tra mặc định phải dùng 20 quân/100 tài khoản. Chế độ stress là phép thử riêng, không đại diện cấu hình phát LIVE.

[Excel V5](../outputs/co-ty-phi-v5/Co_Ty_Phi_Su_Kien_V5.xlsx) · [Nghiên cứu map](../docs/co-ty-phu/09-map-research.md) · [Kiểm tra tay sprite](../docs/co-ty-phu/09-sprite-arm-audit.md).
