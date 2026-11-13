# Icon quà TikTok dùng trong khung game

Bảy ảnh WebP được tải **nguyên byte** từ CDN webcast chính thức của TikTok. Không vẽ lại, không dùng emoji thay ảnh và không chỉnh pixel. `manifest.json` ghi URL gốc, SHA-256, số byte, ID và ngày lấy dữ liệu.

Nguồn tra cứu: [catalog công khai của Euler Stream](https://www.eulerstream.com/docs/tiktok-gifts-list), nhà cung cấp SDK TikTok LIVE. Catalog trả tên, ID và URL ảnh CDN. Chỉ tải đúng bảy ảnh cần dùng; bản catalog tra cứu tạm nằm trong thư mục QA bị ignore.

Các tên đã đối chiếu: Money Gun `7168`, Corgi `6267`, Hearts `5586`, Hand Heart `5660`/`5924`, Doughnut `5879`, Heart Me `7934`, Rose `5655`. Heart Me là tên đã xác minh, thay cho suy đoán ban đầu “Hear Me Out”. Catalog tại lúc lấy ghi Heart Me giá 1; con số 9 trong ảnh tham chiếu chưa được xác minh là giá quà.

Giá hiển thị là metadata theo catalog/cấu hình, có thể khác theo khu vực/thời điểm. Nhận diện quà dùng ID hoặc tên chính xác, không dùng giá. Ảnh từ sự kiện LIVE hợp lệ được ưu tiên để phản ánh biến thể khu vực; ảnh local là dự phòng ổn định.

Icon và nhãn quà thuộc TikTok/ByteDance. `unknown.svg` là hình hộp quà vector do dự án tự viết, chỉ dùng khi quà khác chưa có ảnh, không phải icon chính thức.

Xuất runtime: `node web/scripts/prepare-gift-icons.mjs` hoặc gọi hàm `prepareGiftIcons()`. Đích `/runtime/gifts/catalog.json` và các ảnh cùng thư mục. File nguồn vẫn giữ trong `assets/ui/tiktok-gifts/`.
