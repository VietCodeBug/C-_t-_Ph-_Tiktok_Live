# Cờ Tý Phí — TikTok LIVE · Khu phố 3D

**Lượt chơi LIVE/DEMO hiện tại là tuần tự:** một người lắc → đi đủ bước → chọn đường/xử lý sự kiện → kết thúc lượt, rồi người tiếp theo mới được lắc. Camera giữ người đang chơi hết lượt. Hoa hồng ưu tiên lượt kế tiếp sau toàn bộ lượt hiện tại. Các mô tả chạy đồng thời bên dưới thuộc bản offline/thử tải trước đây.

**Xem ngay:** [Demo 20 người tự chạy](http://127.0.0.1:5182/demo) · [Bản LIVE](http://127.0.0.1:5182/overlay) · [Quản lý](http://127.0.0.1:5182/admin). Demo dùng dữ liệu mô phỏng riêng; LIVE chỉ có người thật đã vào. Khung phát có top MONEY bên trái, bảy icon quà thật bên phải và một bài nền **Cờ Tý Phí LIVE Theme (Alt Take)** từ bộ audio của game.

Chạy `start-live.cmd`, bấm **Bật âm thanh** trong khung game để nghe MC và nhạc. [Hướng dẫn kết nối, MC, người mới và thay ghế](docs/co-ty-phu/14-live-studio.md). Server mặc định chưa kết nối TikTok; nhập username tại Admin khi phòng đã phát. Dừng bằng `stop-live.cmd` hoặc Ctrl+C.

Xem [ảnh map và sân khách chờ](web/docs/live-waiting-courtyards.png), [lì xì cả phố](web/docs/live-map-envelope.png) và [kết quả 226 kiểm tra luật + 44 kiểm tra trình duyệt](web/docs/live-map-upgrade-browser.json). Trong Admin → Phòng mô phỏng, dùng **+80 khách chờ** và **Tặng quà thử** để xem các tình huống này; thêm `?overview=1` vào địa chỉ Demo để xem toàn map.

**Tài liệu dùng để phát triển tiếp:** [Luật ván chơi và logic sự kiện V5](docs/co-ty-phu/13-event-logic-guide.md) — công thức tiền, lệnh, góp vốn/chart, shop, lì xì, ghép trận, MC và danh mục 50 thẻ.

**Luật ván:** tối đa **20 quân chạy đồng thời**; khách chờ có ví, được đặt/hủy đơn SHOP01 miễn phí, góp vốn và nhận lì xì. Khu phố có tám sân chờ, mỗi sân 25 vị trí ổn định; khách hiện bằng đám đông chibi nhẹ, không thêm bộ điều khiển đua. Mỗi tuyến một vòng luôn có **60/96 ô thường**, tổng map **87/138 ô thường**; loại ô đổi theo seed có ràng buộc, gạch xoay theo hướng đường. MC nói một câu ngắn, không đọc toàn bộ ví và im ở ô thường.

Ba vòng đường, người thứ ba về đích chốt ván; hiện bục 8 giây rồi mở 15 giây giữ ghế. Tối đa 12 người cũ đầu tiên đạt 30 tim mới giữ ghế; phần còn lại lấy FIFO. Hoa hồng ưu tiên lần lắc hợp lệ kế tiếp trên camera, không cắt xúc xắc đang hiện và không đóng băng các quân khác. Hand Heart mở lì xì MONEY cho cả bàn và khách chờ; khi bận thì xếp một quỹ chờ, giãn ít nhất 30 giây, không thay thanh tim. Quà được nhận diện bằng ID/tên đã xác minh, không bằng giá xu.

**Bản offline V5 để duyệt luật:** [hướng dẫn](web/LOCAL_PREVIEW.md) · [luật 20 quân và khách chờ](docs/co-ty-phu/12-community-and-100-racers.md) · [Excel V5](outputs/co-ty-phi-v5/Co_Ty_Phi_Su_Kien_V5.xlsx) · [MC JSON](assets/scripts/mc-v5.json). Bản này tạo sẵn 100 tài khoản gồm 20 quân và 80 khách; ván mới reset ví về 1.000 MONEY. Chạy `start-local.cmd` hoặc `cd web` → `npm ci` → `npm run dev`, mở [bản local](http://localhost:4173/?players=20&accounts=100). 100/200 quân chỉ là thử tải với `stress=1`. `/demo` của LIVE Studio mở riêng 20 người giả lập; `/overlay` không tự tạo người giả.

Bản web 3D dọc 9:16 dùng bộ sprite V2.3, camera từ toàn bàn tới góc thứ ba phía sau nhân vật. Các hình/report phía dưới giữ mốc demo camera ban đầu với 10 ghế A–J.

![Web demo — toàn bàn](web/docs/overview.png)

[Xem góc thứ ba trên điện thoại](web/docs/third-person-mobile.png)

## Chạy bản web

```bash
cd web
npm ci
npm run dev
```

`npm run build` xuất website tĩnh vào `web/dist`; `npm run preview` mở bản build. [Hướng dẫn và điều khiển](web/README.md).

- Chuyển tự động / toàn bàn / bám nhân vật.
- Xúc xắc 3D quay, chốt ngẫu nhiên 1–6 rồi nhân vật đi đúng số ô; có nút **Lắc** và âm thanh từ bộ asset.
- Chọn một ghế, chuyển lượt, tạm dừng và đổi tốc độ xem.
- Đổi Chợ Vỉa Hè / Phố Giao Hàng.
- Nút chụp bản đồ 1080×1920.

## Asset thật được dùng

- Sprite V2.3: [assets/co-ty-phi-tiktok-live-v2](assets/co-ty-phi-tiktok-live-v2/README_V2_3.md), nguồn commit `fb996c6`.
- Nhà, cây, quầy, cổng và đạo cụ: [bộ môi trường v1](assets/co-ty-phi-tiktok-live-v1/README.md).
- Map và graph dọc: [assets/map](assets/map/README.md).
- Nhạc nền gốc: [assets/co-ty-phu/audio](assets/co-ty-phu/audio), bản phát [co-ty-phi-live-theme-alt-take.m4a](assets/audio/music/co-ty-phi-live-theme-alt-take.m4a); chỉ một bài lặp, không dùng nhạc mượn từ boss raid.
- Bảy icon quà TikTok đã xác minh: [manifest nguồn](assets/ui/tiktok-gifts/manifest.json).

File gốc được giữ nguyên. Manifest crop/pivot/animation được đọc từ gói; sprite chạy theo quãng đường và đổi S/E/N/W theo hướng nhìn camera. Hướng sau dùng artwork quay lưng, không phải góc nhìn thứ nhất.

## Mở qua GitHub Pages

Nhánh `gh-pages` chứa bản build sẵn. Nếu Pages chưa bật, vào Settings → Pages → Deploy from a branch → gh-pages → /(root), rồi Save. URL dự kiến: `https://vietcodebug.github.io/C-_t-_Ph-_Tiktok_Live/`. Trạng thái bật site chưa xác nhận được từ cloud hiện tại; xem [deployment receipt](web/docs/deployment.json).

## Kiểm tra

[Browser smoke report](web/docs/browser-smoke.json): 18 kiểm tra đạt, gồm chuyển động/animation thật, camera thứ ba phía sau, chọn ghế, đổi map, pause, responsive 9:16 và xuất ảnh. Thử cả đường dẫn con như GitHub Pages. Không có lỗi ứng dụng hoặc request lỗi trong lần kiểm tra.

[Kiểm tra xúc xắc](web/docs/dice-browser.json) và `cd web && npm test` kiểm tra thứ tự quay → hiện kết quả → đi đúng số ô, cả hai nhánh đường và các mặt 1–6. [Ảnh xúc xắc trên màn hình dọc](web/docs/dice-result-mobile.png).

LIVE Studio đã có server giữ luật/ví trong bộ nhớ, adapter bình luận/tim/quà và MC tiếng Việt. Server khởi động chưa kết nối; phòng thật chưa được thử vì chưa mở LIVE. Chưa có SQLite/checkpoint phục hồi nguyên ván sau restart hoặc benchmark trên máy đang phát. MONEY là điểm game. Prototype thú 3D/Bến Mây cũ không được dùng cho nhân vật của bản web.
