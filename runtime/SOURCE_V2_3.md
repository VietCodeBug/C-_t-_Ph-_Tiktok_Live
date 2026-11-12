# Cờ Tý Phí · Idle và di chuyển V2.3

Giải nén gói này đè vào thư mục đã có Sprite V2. Gói gồm 40 atlas đứng chờ và 67 atlas di chuyển từ V2.2.

## Idle

Clip `idle` có 8 frame, 8 FPS, lặp mỗi giây. Nhân vật người đứng hai chân cố định, vai gọn, tay thả và thân nhún nhẹ theo nhịp thở. Khi quân dừng, dùng góc nhìn cuối cùng. Dùng S nếu mở màn hoặc chưa có hướng trước đó. Idle chạy theo thời gian, quãng di chuyển của token trong một vòng bằng 0.

| Hướng | Hàng PNG, đếm từ 0 | Cách vẽ |
| --- | --- | --- |
| S · Chính diện | 0 | Giữ nguyên |
| E · Ngang phải | 2 | Giữ nguyên |
| W · Ngang trái | 2 | Lật ngang |
| N · Quay lưng | 4 | Giữ nguyên |

Mỗi ô PNG RGBA 256 × 256, pivot (128, 218). Hàng SE và NE dùng cùng hình với E để các trình đọc atlas năm hàng vẫn mở được. `Toa_Do_Idle_V2_3.csv` có tọa độ crop và điểm gắn từng frame.

## Tệp dùng khi tích hợp

- `catalog/idle_v2_3.json` hướng hiển thị, FPS và danh mục idle.
- `catalog/locomotion_v2_2.json` thông số đi/chạy và điểm chạm nền.
- `preview/Mit_Toc_Xu_V2_3_Idle_3_Huong.gif` xem góc chính diện và hai bên.
