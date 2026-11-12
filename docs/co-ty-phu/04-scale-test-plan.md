# Kế hoạch 1 / 10 / 20 / 100 người

**Chưa chạy game benchmark.** Không có số đo FPS/p95/latency thực. Render offline và kiểm tra asset không chứng minh phòng 100 người chạy mượt.

## Tách hai mô hình

- Một phòng N người: ảnh hưởng chờ lượt, token chồng nhau và cập nhật trong một view.
- N người trên nhiều phòng: ảnh hưởng server/fan-out/kết nối; không buộc một màn vẽ đủ N token.

Ví dụ minh họa: nếu mỗi người chiếm 10 giây thì 100 lượt nối tiếp mất 1.000 giây (~16 phút 40 giây). Renderer nhanh không giải quyết thời gian chờ; cần đối chiếu luật, không tự đổi sang đồng thời.

| Bot | Một phòng | Nhiều phòng | Tình huống |
|---|---|---|---|
| 1 | Một bot, lượt mẫu theo luật | Không áp dụng | Đi toàn graph, mọi loại ô, reconnect |
| 10 | Nếu luật hỗ trợ; nếu không chỉ stress token | Ví dụ 2×5 | Di chuyển đồng thời/dồn cùng ô |
| 20 | Phải ghi rõ gameplay hợp lệ hay stress hình ảnh | Ví dụ 4×5 | Chồng ô, đổi focus, badge |
| 100 | Tách bài 100 token và bài 100 client mạng | Ví dụ 20×5 | Event burst, cùng ô, reconnect hàng loạt |

Các ví dụ phòng 5 người chỉ là phân bố tải tham chiếu, chưa phải room size từ sheet.

## Phép đo tái lập

Cùng build/engine, map/state/seed test, tick, camera, resolution, đồ họa và phần cứng. Warm-up 60 giây; đo 10 phút/kịch bản ×3 lần; sau khi đạt mới soak 30 phút. Ghi CPU/GPU/driver/RAM, power/thermal và foreground/background. Baseline cloud CPU/renderer phần mềm không thay điện thoại.

Bot headless phải xác nhận kết nối, nhận snapshot và hoàn thành hành động. 100 object trong vòng lặp không phải 100 client. Giữ command exit status, số bot completed/failed, seed, run ID, hash và thời điểm. Result file phải thuộc lần chạy hiện tại.

| Metric | Mục tiêu đề xuất, chưa chứng minh |
|---|---|
| Frame time p95 | ≤16,7 ms profile 60 fps; ≤33,3 ms profile máy yếu |
| Hitch | Không spike >100 ms trong steady state |
| CPU tick p95 | Trong tick budget server đã chốt |
| Action ACK p95 | ≤200 ms trong vùng triển khai xác định |
| Memory | Ghi MB/delta; không tăng vô hạn khi soak |
| Logic | Không mất lượt, giao dịch trùng hoặc state lệch; mọi bot hoàn thành |
| Network | Bytes/sec, messages/sec, reconnect/resync success theo topology |

Target phải điều chỉnh sau khi biết thiết bị và yêu cầu thật. Model hiện một primitive/material, 7 xương, tam giác ở roster; đây là thông số file, **không phải draw call hoặc thời gian runtime thực đo**.

Hướng tối ưu cần thử từng nhóm: culling token/bảng tên, sprite atlas phù hợp engine, giới hạn VFX/audio, pool object, batch delta. Giữ logic toàn bộ token dù chỉ vẽ subset. Bật/tắt từng nhóm để tìm bottleneck, không suy nguyên nhân từ một screenshot.

| Người | Logic | Network | Frame time | Trạng thái hiện tại |
|---|---|---|---|---|
| 1 | Chưa chạy | Chưa chạy | Chưa đo | Thiếu game/adapter |
| 10 | Chưa chạy | Chưa chạy | Chưa đo | Thiếu game/adapter |
| 20 | Chưa chạy | Chưa chạy | Chưa đo | Thiếu game/adapter |
| 100 | Chưa chạy | Chưa chạy | Chưa đo | Thiếu game/adapter |
