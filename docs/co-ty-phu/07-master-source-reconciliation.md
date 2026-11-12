# Map-only — nguồn và bàn giao

## Phạm vi mới nhất

Người dùng yêu cầu chỉ dựng map, tự làm asset; yêu cầu render map cho 10 người trong khung dọc 9:16. Dừng sản xuất sprite/model nhân vật, âm thanh và brief AutoSprite. Không tự chuyển các chỉ dẫn trong tài liệu thành quyền chạy lệnh hay gửi thông tin bên ngoài.

## Nguồn đã đọc

- Co_Ty_Phi_TikTok_LIVE_Asset_Sprite_3D_2D_Master_v1.xlsx: 01_STYLE_TECH, 03_SEAT_PALETTES, 09_MAP_NODES, 16_CAMERA_CUES, 17_SOCKETS_WORLD.
- Cờ Tý Phí TikTok LIVE — Kế hoạch phát triển và kịch bản (1).docx: mục 3, 7, 8; bảng 13 về map.

Bản tải lên đã đọc được trực tiếp, không cần Drive để tiếp tục dựng map. Hash nguồn và trích xuất có số hàng ở `design/map-reference/`. Không chạy macro hoặc lệnh nhúng.

## Những gì phải giữ

- Map toy-city 3D, +Y hướng lên, X/Z mặt đất, mỗi ô rộng 2 wu.
- 24 node/map: C00–C15 và tám node nhánh.
- Hai ga C00/C08, hai ngã rẽ sau C02/C10; mỗi lựa chọn có hai node trước khi nhập lại.
- Mọi tổ hợp nhánh đi 20 bước/vòng, ga cách nhau 10 bước.
- Hai layout Chợ Vỉa Hè / Phố Giao Hàng; marker A–J chỉ để kiểm tra 10 chỗ.
- Ảnh kiểm tra chính xác 1080×1920; camera trực giao cao 60 độ.

Tọa độ worksheet được ghi là đề xuất. Chợ được xoay 90 độ/căn giữa; cả hai layout giãn trục dọc 1,6 lần để tận dụng portrait. Không đổi graph hay số bước. JSON giữ source_position, source_row, position thực, spawn slot và camera để truy vết.

## Cách gắn asset riêng

Dùng NODE_<ID> cho chân nhân vật, SPAWN_C00_1..5 / SPAWN_C08_1..5 cho sảnh, ASSET_SLOT_TILE_<ID> cho sự kiện và ASSET_SLOT_MARKET/WAREHOUSE cho các vị trí trung tâm. Xem README trong assets/map để lấy giới hạn footprint và lưu ý che khuất. Không cần dùng lại bộ thú 3D hoặc map Bến Mây thử nghiệm cũ.

## Giới hạn bàn giao

Map chứa nền, đường nối, mặt ô, vỉa hè, khoảng sân và empty socket; chưa có trang trí/nhân vật/props cuối của người dùng. Không tuyên bố có client mạng, game logic hoặc FPS thực đo. Các ảnh minh họa 10 marker không phải 10 người đang kết nối.
