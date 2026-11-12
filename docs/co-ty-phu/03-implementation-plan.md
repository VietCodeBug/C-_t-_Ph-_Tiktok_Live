# Kế hoạch triển khai và bàn giao

Không viết mã game/server trong đợt asset này.

## P0 · Khóa yêu cầu

Đọc sheet, trích từng yêu cầu theo tab/hàng. Chốt số ô, graph, room size, giá đất/phí thuê, tiền đầu, cấp xây, thắng/thua, realtime hay lượt, timeout và reconnect. Nếu có liên hệ livestream/người xem thì phải có nguồn, không suy từ tên repo. Đầu ra: bảng truy vết và quyết định thay thế các giả định. **Hiện bị chặn bởi truy cập sheet.**

## P1 · Map và art

Chuyển Bến Mây thành map tách lớp theo graph P0. Tile có ID, loại/nhóm, next/previous, tọa độ logic và anchor. Owner/cấp xây là runtime state, không bake vào nền. Thử bố cục ở 360×640, 390×844, 1080×1920. Hoàn thiện sprite nhiều hướng và animation events. Khi AutoSprite có tool: lưu prompt, tham số, job ID và provenance mà công cụ trả về; chưa có job trong phiên này.

## P2 · Hợp đồng logic cho người triển khai

Đề xuất authority duy nhất giữ state; client gửi ý định, không tự quyết tiền/xúc xắc. State machine tham chiếu: `waiting → begin_turn → roll → move → resolve_tile → optional_action → end_turn`; luật cụ thể lấy từ P0.

| Event đề xuất | Dữ liệu tối thiểu |
|---|---|
| turn_started | game_id, turn_id, actor_id, deadline |
| dice_resolved | turn_id, result, target_tile_id, sequence |
| token_moved | actor_id, route_tile_ids, sequence |
| tile_resolved | tile_id, actor_id, outcome_id, authoritative balance delta |
| property_changed | tile_id, owner_id, build_level, revision |
| state_snapshot | revision, players, board, current turn |

Action ID chống xử lý trùng; revision tăng dần; reconnect nhận snapshot rồi delta; timeout không kẹt lượt. Seed cố định chỉ dùng replay/test; RNG sản phẩm theo quyết định riêng của dự án. Invariant: không mất/nhân đôi lượt, không giao dịch trùng, ownership không đổi vì token chồng ô, reconnect không đổi kết quả đã chốt.

## P3 · Bản chạy được

Chọn engine theo dự án thật sau khi có source. Không tự thêm game/framework để tạo một benchmark dễ đậu. Import asset và chạy một lượt hoàn chỉnh với loại ô/hành động theo P0. Tắt animation/audio vẫn phải cho cùng kết quả state.

## P4 · Đo và tối ưu

Cần adapter/kịch bản tái lập trước khi benchmark. Dùng ma trận 1/10/20/100 ở tài liệu kế tiếp. Có CLI Game Development Studio thì discovery capability trước, capture baseline có receipt, seal/verify bundle, chọn metric và path/iteration limit rồi mới tối ưu. Quyền chi provider, GPU capture và đo hardware không được ghi thành cờ cho phép vĩnh viễn.

## P5 · Git / Notion

Git giữ asset bytes, nguồn Blender, prompt, manifest và kết quả thực đo. Khi Software Notion có callable tool: tạo trang kế hoạch, asset database, mốc P0–P4, blocker và liên kết commit. **Chưa có thao tác ghi Notion**. Canonical package/vendoring chỉ sau kiểm tra CLI, license và receipt; không đổi nhãn asset thô thành package đã verify.
