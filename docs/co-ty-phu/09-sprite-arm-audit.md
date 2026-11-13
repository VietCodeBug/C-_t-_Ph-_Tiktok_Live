# Kiểm tra tay và dáng đi Sprite V2.3

Đã đối chiếu atlas `ch01` ở ba clip idle, walk và run, hướng quay lưng N, các frame 0/3/6/9. Ô frame 256×256, pivot chân `(128,218)` và crop trong manifest khớp ảnh gốc. Không thấy bằng chứng lỗi cắt frame hoặc đổi tỷ lệ riêng tay trong renderer.

Tay ngắn, viền tách khúc ở khuỷu/cổ tay và bàn tay gần hông đã được vẽ trong artwork. Clip run dùng locomotion revision 2.1, tay gập và khép sát thân. Clip walk revision 2.2 có tay thả thấp hơn, phù hợp nhịp di chuyển bình thường. Dùng walk ở tốc độ đi thường sẽ giúp dáng tự nhiên hơn mà không thay hình gốc.

Muốn chỉnh hình tay cần vẽ lại atlas nguồn: vai thấp hơn, khuỷu gập mềm, cổ tay nối liền cẳng tay, bàn tay nhỏ và rõ; khi chạy hai tay đối pha chân, không ép hai cánh tay song song sát hông. Giữ nguyên đầu, tóc, áo, bảng màu, ô frame, pivot chân và số frame. Cần duyệt một nhân vật đủ S/N/E cùng frame đầu/giữa/cuối trước khi nhân ra toàn bộ dàn nhân vật. Hướng W vẫn lấy từ E lật ngang.

Chưa chỉnh nét vẽ tay trong các atlas gốc. Không tự kéo giãn vùng tay bằng code vì có thể làm méo viền và hở thân giữa các frame. Các frame đối chiếu được trích nguyên ảnh để kiểm tra, không phải asset thay thế.
