# Nguồn và tình trạng

> Cập nhật: đã đọc được XLSX/DOCX người dùng tải trực tiếp. Phần không đọc được Drive dưới đây là lịch sử kiểm tra mạng, không còn chặn việc đọc thiết kế. Nguồn và yêu cầu hiện tại ở [Master reconciliation](07-master-source-reconciliation.md). Bến Mây/thú 3D bên dưới là thử nghiệm cũ, không đạt Master.

## Phạm vi người dùng yêu cầu

Cờ tỷ phú dọc 9:16; map phong phú, mascot cute khác nhau về dáng, animation đồng bộ, model/asset/âm thanh và kế hoạch trong Git. Không triển khai mã gameplay ở đợt này. Cần nghiên cứu mức 1/10/20/100 người. Map v01 đã bị người dùng loại; v02 là concept sửa, **chưa được duyệt**.

## Nguồn chưa đọc được

- [Drive](https://drive.google.com/drive/folders/1haXTvr99puDifQ_SJB2Nz_4hfX40kApx)
- [Sheet, tab gid 1597173946](https://docs.google.com/spreadsheets/d/1kkBZj-1-9zhjwF1GFjglLgVG_wnjZswd/edit?gid=1597173946)

HTTP thực tế dừng tại proxy với `CONNECT tunnel failed, response 403`. Chưa đọc được tab hoặc hàng nào. Đây **không phải bằng chứng sheet không tồn tại hoặc thiếu quyền Google**. Chưa biết số ô, room size, tiền, giá đất, luật lượt, thắng/thua. Không có chi tiết thiết kế nào được tuyên bố lấy từ sheet.

Đã lưu draft bổ sung `drive.google.com`, `docs.google.com`, `drive.usercontent.google.com`; runtime gần nhất vẫn có custom allowlist rỗng. Lưu draft chưa áp dụng mạng. Cần lưu thay đổi trong cài đặt môi trường rồi thử kết nối mới.

## Công cụ thực tế

| Công cụ | Trạng thái | Việc đã làm |
|---|---|---|
| Game Development Studio | Đã đọc skill; executable `game-dev` không tìm thấy trong PATH/các thư mục ứng dụng đã kiểm tra | Kế hoạch workflow, chưa có canonical package/receipt |
| AutoSprite | Không có callable tool/skill trong phiên sau khi kiểm tra lại | Chưa tạo job hoặc nhận job ID |
| Software Notion | Không có callable tool/skill trong phiên | Chưa đọc/ghi trang nào |
| Drive connector | Không có callable tool trong phiên | HTTPS trực tiếp bị proxy 403 |
| ImageGen gốc | Có sẵn | Concept v01 và v02; chỉ v02 được bàn giao |
| Blender 4.3.2 | Có sẵn, chạy cục bộ | Model, rig, animation, sprite và preview render CPU |
| Python stdlib / FFmpeg 7.1.5 | Có sẵn | Tổng hợp âm thanh, đóng atlas/video và kiểm tra tệp |

Không cài gói có tên giống `game-dev` từ registry khi chưa xác định nguồn chính thức. Không có credential/cookie/token trong asset.

## Mở lại phần bị chặn

1. Cung cấp callable tools của AutoSprite và Software Notion cho chính phiên này. Hiện thấy thẻ plugin nhưng không có lệnh để gọi.
2. Cung cấp CLI từ nguồn chính thức; bắt đầu bằng các lệnh read-only `game-dev --version`, `game-dev capabilities --json`, `game-dev doctor --json`, `game-dev credentials status --json`.
3. Áp dụng mạng Google và đọc sheet, lập bảng truy vết từng yêu cầu tới tab/hàng.
4. Sau đó mới chuẩn hóa/đóng package, sản xuất sprite bằng AutoSprite và ghi kế hoạch Notion; lưu job ID, prompt, source hash và receipt theo công cụ thực trả về.
