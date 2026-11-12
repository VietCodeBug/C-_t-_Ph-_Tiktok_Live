# Nghiên cứu bố cục map 9:16

Phân tích thiết kế nội bộ; chưa đối chiếu sheet hoặc nguồn web ngoài.

## Vì sao v01 bị loại

Đường đi chỉ là viền chữ nhật, các ô trống gần giống nhau, tòa nhà giữa và sân chiếm chỗ bàn chơi. Thiếu nhịp khám phá, nhận diện khu, anchor token và phương án khi nhiều người cùng ô. Phần trống dưới ảnh không phục vụ map.

## Chọn hướng phát triển

| Bố cục | Điểm mạnh | Hạn chế | Quyết định |
|---|---|---|---|
| Viền chữ nhật | Dễ theo đường | Phẳng, lặp, bị người dùng loại | Dừng |
| Quần đảo nhiều cụm như v02 | Khu phố có cá tính, cầu/thác/độ cao, nhiều điểm nhìn | Ảnh sinh có vòng nhỏ; không bảo đảm topology hay số ô | Dùng làm hướng mỹ thuật |
| Một tuyến liên tục uốn qua các khu | Giữ thành phố sống và kiểm chứng được đường đi | Cần tile/đất/cầu riêng và luật chính xác | Đề xuất bản sản xuất |

## Bến Mây

Thành phố mô hình trên đảo nổi; đường đi xuyên qua cảnh, không chỉ bao quanh cảnh.

| Khu đề xuất | Hình dáng/nhận diện | Chuyển động nền dự kiến |
|---|---|---|
| Chợ Đèn | Mái ngói đỏ, quầy gốm, phố đèn | Đèn lay, hơi bếp |
| Bến Sen | Bến cong, mái ngọc, lá sen | Gợn nước, thuyền chậm |
| Phố Bánh | Cối xay, lò bánh, mái đào | Cánh quạt, hơi bánh |
| Vườn Trúc | Vòm tre, cầu đá, vườn tầng | Lá tre, thác tiết chế |
| Đồi Sao | Vòm thiên văn, khí cầu | Sao nhỏ, khí cầu nhấp nhô |

Tên/chức năng khu là đề xuất, không phải nội dung sheet. Không tự gắn thưởng/phạt cho landmark.

## Hợp đồng layout sản xuất

- Khung đích dự kiến 1080×1920. Concept gốc thực tế **941×1672**, gần 9:16; chưa phải export đúng kích thước đích.
- Tách nền, địa hình, đường, đất xây, nhà, cầu, trang trí trước/sau, token, VFX và UI. Ảnh concept gộp không phải tilemap có collider.
- Chốt graph/node trước khi dựng cảnh. Nếu luật là chu trình: mỗi node có một next/previous; duyệt đủ toàn bộ rồi quay về start. **Số ô chưa chốt**, phải lấy từ sheet. Cầu chồng hình không tự thành giao điểm logic.
- Landmark không che mặt ô; camera đủ cao. Nhóm đất dùng cả icon/hình viền, không chỉ màu.
- Tổng thể phải đọc được đường đi ở 360×640. Khi chọn ô, focus/zoom để vùng chạm tối thiểu 44 CSS px; không giả định mọi ô đều đủ chạm khi thu toàn map.
- Safe area/UI phải thử trên màn nhỏ và màn dài; không bake nút vào nền.

## Đông người

Tách số kết nối, số token logic và số token vẽ chi tiết. Token cùng ô dùng slot quanh anchor, vượt sức chứa thì badge số lượng và danh sách mở rộng. Ưu tiên token đang có lượt/focus. Không vẽ 100 bảng tên và 100 VFX cùng lúc. Đây là culling hiển thị, không được xóa token hoặc gộp state tiền/lượt.

## Nghiệm thu còn phải chạy

1. Node liên thông đúng luật, không thiếu/nhảy ô hoặc nhầm tầng cầu.
2. Ảnh toàn cảnh và thu nhỏ đọc được đường, nhóm đất và token.
3. Dồn 1/10/20/100 token cùng ô; chọn/focus vẫn đúng người.
4. Token đi sau nhà/qua cầu có thứ tự vẽ đúng; UI không che ô quan trọng.

Các điều kiện này chưa kiểm chứng trong game. V02 mới chứng minh hướng hình ảnh; các đường nối trong ảnh chưa phải đường logic được duyệt.
