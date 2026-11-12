# Cờ Tý Phí — Web demo camera · Asset v2.3

Bản web 3D dọc 9:16 cho 10 nhân vật từ bộ sprite v2.3 trong Git. Camera tự chuyển từ nhìn toàn bàn sang góc thứ ba bám phía sau nhân vật, rồi lần lượt qua các ghế A–J.

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

File gốc được giữ nguyên. Manifest crop/pivot/animation được đọc từ gói; sprite chạy theo quãng đường và đổi S/E/N/W theo hướng nhìn camera. Hướng sau dùng artwork quay lưng, không phải góc nhìn thứ nhất.

## Mở qua GitHub Pages

Nhánh `gh-pages` chứa bản build sẵn. Nếu Pages chưa bật, vào Settings → Pages → Deploy from a branch → gh-pages → /(root), rồi Save. URL dự kiến: `https://vietcodebug.github.io/C-_t-_Ph-_Tiktok_Live/`. Trạng thái bật site chưa xác nhận được từ cloud hiện tại; xem [deployment receipt](web/docs/deployment.json).

## Kiểm tra

[Browser smoke report](web/docs/browser-smoke.json): 18 kiểm tra đạt, gồm chuyển động/animation thật, camera thứ ba phía sau, chọn ghế, đổi map, pause, responsive 9:16 và xuất ảnh. Thử cả đường dẫn con như GitHub Pages. Không có lỗi ứng dụng hoặc request lỗi trong lần kiểm tra.

[Kiểm tra xúc xắc](web/docs/dice-browser.json) và `cd web && npm test` kiểm tra thứ tự quay → hiện kết quả → đi đúng số ô, cả hai nhánh đường và các mặt 1–6. [Ảnh xúc xắc trên màn hình dọc](web/docs/dice-result-mobile.png).

Đây là demo hình ảnh/camera, chưa phải game TikTok LIVE hoàn chỉnh. Chưa có backend kinh tế, chat/quà hoặc benchmark phần cứng phát LIVE. Prototype thú 3D/Bến Mây cũ không được dùng cho nhân vật của bản web.
