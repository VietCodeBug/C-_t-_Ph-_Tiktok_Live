# Quy cách asset

> SUPERSEDED: quy cách dưới đây chỉ mô tả prototype thú 3D trước khi nhận tài liệu. Master yêu cầu nhân vật người 2D, frame 256×256, 5 hướng, pivot (128,218). Không dùng thông số cũ để sản xuất; xem [Master](07-master-source-reconciliation.md).

10 species khác silhouette: thỏ, capybara, cú, gấu trúc đỏ, rùa, cáo, ếch, nhím, chim cánh cụt, kỳ giông. Có tai/mai/gai/đuôi/mang/cánh và trang phục hình học riêng, không chỉ đổi màu. Số tam giác và ID ổn định ở `assets/co-ty-phu/roster.json`.

Mỗi nhân vật có GLB skin 7 xương, một mesh primitive/material, vertex color; file `.blend` nguồn; 4 animation; 48 PNG RGBA 128×128. Spritesheet 1536×512 gồm 12 cột × 4 hàng theo thứ tự dưới đây.

| Hàng | Clip | GLB, rig 24 fps | Sprite playback | Loop |
|---|---|---|---|---|
| 0 | Idle | 2 giây | 12 frame / 6 fps | Có |
| 1 | Walk | 1 giây | 12 frame / 12 fps | Có, in-place |
| 2 | Celebrate | 2 giây | 12 frame / 6 fps | Có thể lặp, game chọn thời điểm thoát |
| 3 | React | 1 giây | 12 frame / 12 fps | Không, trở về idle |

Blender dùng +Z lên, mặt nhìn -Y; GLB xuất chuẩn glTF **+Y lên, mặt trước +Z** qua đổi trục exporter. Gốc ở chân, không có root motion tiến trên map. Game điều khiển vị trí dọc graph. Không gắn gameplay vào thứ tự object.

Sprite dùng chung camera/khung, **chỉ một góc 3/4**, chưa đủ 4/8 hướng. Anchor chân chuẩn hóa và frame size ở `sprite-camera.json`, tọa độ PNG y xuống. Không trim riêng từng frame. Atlas hiện chưa có padding/extrusion; bước tích hợp cần cấu hình sampling hoặc đóng lại theo engine.

Nhịp bước chân dự kiến 0 và 0,5 giây trong Walk là hợp đồng integration, chưa gắn event engine. Runtime nên phân pha idle nhẹ để nhiều token không chuyển động như một khối.

## Audio

12 WAV PCM mono 16-bit 48 kHz; ID, thời lượng và peak/RMS đo trong `audio/manifest.json`. Tổng hợp cục bộ nguyên bản, không dùng sample ngoài. Chưa nghe thử trên loa điện thoại/chưa mix trong game. Peak không clip không đồng nghĩa âm lượng trong mix đã đúng.

Đề xuất tối đa 8 voice SFX, rate-limit step/coin, ưu tiên lượt hiện tại; không phát 100 tiếng bước chân cùng lúc. Gain cuối phải nghe và đo lại trên thiết bị đích.

## Mức hoàn thiện

Model/sprite là prototype có thể chỉnh sửa; không phải bản final khớp hoàn toàn key art và không do AutoSprite tạo. Sprite render Cycles CPU; preview không phải FPS game. Chưa có engine import, collider, binding logic hoặc canonical package của Game Development Studio. Phải đối chiếu sheet, hoàn thiện góc/animation và tối ưu trong engine trước khi gọi là production-ready.
