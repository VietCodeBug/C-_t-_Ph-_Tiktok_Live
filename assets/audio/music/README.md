# Nhạc nền Phố Đồ Chơi

Hai tệp M4A được chép nguyên byte theo yêu cầu từ playlist trong `content/media.json` của [repo TikTok LIVE nguồn](https://github.com/VietCodeBug/tiktok-live-boss-raid/tree/e0fc25472e896759cba8ce11c19bad15149e5b7c/content/media). Tên trong dự án cờ được đổi thành `pho-do-choi-01.m4a` và `pho-do-choi-02.m4a`; đây là tên hiển thị nội bộ, không phải tên nghệ sĩ/tác phẩm được xác minh.

`playlist.json` giữ đường dẫn nguồn, commit, dung lượng và SHA-256. `npm run prepare:assets` chép hai bài sang `web/public/runtime/music/` và manifest sang `runtime/music.json`; không cần repo nguồn nằm cạnh dự án khi cài lại.

Game phát nối tiếp rồi lặp playlist, có bật/tắt và âm lượng nhạc riêng. Nút bật âm thanh trong khung game cấp quyền phát; lúc MC nói, nhạc được hạ xuống rồi trả về âm lượng đã chọn. Không nhập video quà, nhạc MVP hoặc âm thanh chiến đấu của dự án nguồn.
