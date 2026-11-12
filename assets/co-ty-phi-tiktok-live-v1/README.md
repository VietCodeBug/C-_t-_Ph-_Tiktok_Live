# Cờ Tý Phí TikTok LIVE · Bộ asset v1

Bộ asset theo hai tài liệu dự án. Phong cách Phố Đồ Chơi dùng model low-poly pastel và sprite 2D chibi viền màu mận.

## Mở gói

- `preview/Co_Ty_Phi_Preview.jpg` xem hai map và 20 nhân vật. `preview/mit_toc_xu_walk.gif` xem chu kỳ bước ở 5 hướng.
- `Danh_muc_va_toa_do_asset.xlsx` tra danh mục, frame, socket và cue. Tọa độ socket trong bảng áp dụng cho rig của 20 nhân vật chơi được.
- `assets/characters/ch01/animations.json` là atlas mẫu. Các NPC và thú cưng dùng manifest riêng trong thư mục của từng nhân vật.
- `assets/map/layouts/` gồm hai cảnh GLB lắp sẵn. `assets/map/kit/` và `assets/props/` là các model rời. `assets/map/board_layouts.json` giữ tọa độ node và các nhánh từ bảng.
- `assets/fx/` chứa 67 atlas PNG RGBA. `catalog/vfx.json` giữ crop, FPS, cue và pivot.
- `assets/ui/` chứa 87 mục UI, 42 skin thẻ riêng và 10 bảng màu ghế. Nội dung thay đổi như tên, giá, MONEY và đồng hồ đặt trong vùng chữ của template.
- `assets/audio/` chứa 34 SFX, 3 bản nhạc và 42 câu MC tiếng Việt tổng hợp. `catalog/audio.json` lưu cả lời đã đọc và câu gốc.
- `catalog/event_cards.json` liên kết đủ 42 thẻ với clip, model, NPC, FX, camera và thoại. `catalog/minigames.json` liên kết ba mini game.

## Thông số

- Cell nhân vật 256 × 256, pivot chân (128, 218), thứ tự hàng S / SE / E / NE / N. Ba hướng SW / W / NW lấy từ SE / E / NE bằng cách lật ngang.
- Atlas giữ canvas đầy đủ. Crop và socket dùng gốc ở góc trái trên, X tăng sang phải, Y tăng xuống. Frame và hàng trong Excel đánh từ 1, còn vị trí crop tính bằng pixel từ 0.
- Cảnh GLB dùng +Y hướng lên, đường nằm trong XZ. Hai ga và hai ngã rẽ giữ đúng các ID của tài liệu. Màu loại ô trong cảnh lắp sẵn là bản minh họa, loại ô theo ván đọc từ cấu hình khi ghép vào game.
- Model rời dùng vật liệu màu phẳng sRGB / PBR, gốc ở đáy. `catalog/collider_guides.json` cung cấp kích thước và tâm hộp tham khảo.
- OGG/Vorbis, 48 kHz. BGM Phố Đồ Chơi dài 48 giây, soạn để lặp. Thoại tổng hợp khoảng 2–3,4 giây, có thể thay file cùng ID khi thu MC.
- `catalog/kiem_tra.json` ghi kiểm tra file. `catalog/sha256.json` ghi SHA-256. Mẫu hai map và đạo cụ đã render bằng Blender; va chạm, FPS và camera trong game vẫn cần kiểm tra khi tích hợp.

## Nguồn

Map, model, sprite, UI, hiệu ứng và nhạc được dựng mới theo tài liệu dự án. Các câu MC thu sẵn là phiên bản rút gọn dựa trên kịch bản và được tổng hợp bằng eSpeak NG giọng tiếng Việt. Font trong ảnh xem trước dùng DejaVu Sans. Tệp asset gốc không kèm font hoặc bộ tổng hợp giọng nói.
