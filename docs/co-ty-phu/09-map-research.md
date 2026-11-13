# Tham khảo map và hướng áp dụng

Đợt nâng cấp này nghiên cứu nguồn chính thức để học cách tổ chức bàn chơi; bố cục, nhân vật và cảnh của dự án được dựng riêng.

| Nguồn | Điều quan sát được | Đề xuất áp dụng cho Cờ Tý Phí |
| --- | --- | --- |
| [Nintendo: Super Mario Party Jamboree](https://www.nintendo.com/en-za/Games/Nintendo-Switch-games/Super-Mario-Party-Jamboree-2591147.html) | Các bàn có chủ đề và cơ chế riêng: trung tâm mua sắm có ưu đãi, đầm nước đổi tuyến theo thủy triều, nhân vật lớn thay đổi đường đi. | Chợ, phố kho, bến sông có tên và mốc nhận diện. Trước khi rẽ, hiện tên tuyến cùng loại ô sắp gặp; đổi cảnh giữa vòng đã chốt, giữ vị trí logic và ví. |
| [Ubisoft: Monopoly Madness](https://news.ubisoft.com/en-au/article/72jKIG137tXf4kEUjVtDYk/this-week-at-ubisoft-monopoly-madness-gets-jurassic-ubisoft-will-support-stadia-players-when-platform-shutters) | Thành phố có nhiều môi trường và khu vực; phiên bản này dùng đường phố di chuyển tự do, các ván ngắn. | Học cách chia cụm phố và dùng công trình làm điểm nhìn. Game của mình vẫn di chuyển theo ô và lượt, để người xem chung màn hình theo dõi được. |
| [Hasbro: luật Monopoly](https://www.hasbro.com/common/documents/dad288661c4311ddbd0b0800200c9a66/B341FDEC5056900B1096BAB11C79CE18.pdf) | Mua đất, thuê đất của người khác, tài sản theo nhóm và các thẻ tạo thay đổi kinh tế. | Tách rõ tiền nhận, phí, lựa chọn đầu tư và buôn bán. Phép tính hiện trước/sau, có sổ giao dịch; không trừ tiền hai lần khi phát lại hiệu ứng. |

Những quyết định sau là thiết kế của dự án, không phải luật được sao từ các game trên:

- Map rộng 138 ô với 96 bước trên một chu trình đã chọn, sáu ngã rẽ. Mỗi nhánh có cùng số bước để lựa chọn tập trung vào trải nghiệm và cơ hội, không chỉ đường ngắn.
- Tám loại ô: ga, nhận tiền, mất tiền, chuyện phố, đầu tư, buôn bán, nghỉ và thử thách. Ô nghỉ có thay đổi 0 MONEY; không mở một câu chuyện dài ở mọi lần dừng.
- Thanh lựa chọn gọn ở phía trên, có đồng hồ, hai hướng và mô tả; chủ ghế ưu tiên, im lặng dùng phiếu duy nhất theo ID, hòa đi mặc định đã công bố.
- Cảnh có đoạn hẻm uốn, bờ sông và khu cuối phố làm mốc. Camera tới gần khi cần đọc ô hoặc quyết định, toàn cảnh dùng để định hướng.
- Xúc xắc nổi trực tiếp trên cảnh, kết quả ngắn bên dưới; bỏ tấm nền trắng lớn.
- Tình huống chó đuổi, dép bị tha, đậu xe sai chỗ, giao nhầm hàng và mở quầy dùng diễn xuất hài hước, hiệu ứng nhẹ. MONEY là điểm trong game.

Tỷ lệ ô và giá trị kinh tế phải cân lại bằng log ván thử. Bản offline xử lý lựa chọn và sổ tiền ở trình duyệt; kết nối bình luận, xác thực tài khoản và sổ server vẫn là bước tiếp theo.
