# Chưa hoàn thành full asset

> PHẠM VI ĐÃ THAY ĐỔI: người dùng chỉ yêu cầu dựng map và tự làm asset. Checklist full asset dưới đây là lịch sử, không phải công việc hiện tại. Xem assets/map/README.md và tài liệu 07 cho bàn giao map 10 ghế dọc 9:16.

**Trạng thái bàn giao: PROTOTYPE / INCOMPLETE.** Không phải bộ asset cuối theo sheet. Không được dùng việc có model, ảnh concept hoặc tệp giải mã được để đánh dấu toàn dự án đã hoàn tất.

> Đã nhận và đọc hai tệp tải lên. Checklist chính xác theo Master ở [07-master-source-reconciliation.md](07-master-source-reconciliation.md) và `design/master-v1/coverage.json`. Prototype cũ không được tính đạt các yêu cầu đó.

## Phần đã có và giới hạn

| Hạng mục | Hiện có | Còn thiếu trước bàn giao cuối |
|---|---|---|
| Thiết kế theo sheet | Đã đọc 22 tab XLSX và DOCX tải lên, giữ hàng nguồn | Review khác biệt số frame/cue giữa hai nguồn trước xuất hàng loạt |
| Map | Concept và blockout 3D, graph 40 ô minh họa | Bố cục theo sheet, mỹ thuật hoàn thiện, sửa che khuất/tương phản, nghiệm thu 9:16 |
| Môi trường | Hình khối nằm trong scene map | Bộ module tái sử dụng riêng: ô/đất/nhà/landmark/cầu/trang trí theo danh mục đã chốt |
| Nhân vật | 10 model prototype, nguồn Blender | Hoàn thiện hình dáng/chất liệu theo art direction được duyệt; kiểm tra scale/rig trong engine |
| Animation/sprite | 4 clip/model; sprite chỉ một góc 3/4 | Đủ hướng và trạng thái theo thiết kế; chuyển trạng thái, chân/anchor, atlas chuẩn engine |
| Âm thanh | 12 SFX tổng hợp | Đối chiếu cue với sheet; nghe thử, mix, loop và mức âm trong bản chạy |
| Tích hợp | Kiểm tra tệp và render offline | Import engine, binding, collider/anchor, preview tương tác và nghiệm thu hình ảnh |
| Quy mô | Ảnh bố trí tĩnh 1/10/20/100 token | Kịch bản game thực, animation đồng thời, client mạng, FPS/latency/soak |
| Công cụ yêu cầu | Đọc skill Game Development Studio | Callable AutoSprite/Software Notion; CLI chính thức game-dev; job/receipt và Notion thật |

UI, icon, VFX, nhạc nền và các trạng thái bổ sung cần **đọc sheet để chốt**. Không tự coi danh mục hoặc số lượng do agent nghĩ ra là bộ đầy đủ của dự án.

## Điều kiện được gọi là “full asset”

1. Có bảng truy vết yêu cầu từ sheet sang từng asset ID, không còn mục bắt buộc chưa biết.
2. Từng hạng mục bắt buộc có asset hoàn thiện, nguồn chỉnh sửa, thông số import và provenance; không thay asset còn thiếu bằng ảnh concept.
3. Hoàn thành pipeline công cụ người dùng yêu cầu hoặc ghi rõ phương án thay thế đã được thống nhất; không giả receipt/job ID.
4. Asset chạy đúng trong bản tích hợp, được kiểm tra hình ảnh/animation/âm thanh theo tiêu chí đã chốt.
5. Báo cáo tải tách rõ render bố trí, token animation và client mạng; chỉ ghi các kết quả đã đo.

Hiện **chưa đạt** các điều kiện trên. Các blocker công cụ/kết nối được ghi tại `00-sources-and-status.md`; quyền thao tác người dùng đã cấp, không cần hỏi lại quyền cho công việc trong phạm vi này.
