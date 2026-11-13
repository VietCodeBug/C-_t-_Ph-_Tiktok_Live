# Cờ Tý Phí LIVE Theme (Alt Take)

Nhạc nền đúng của game là **Cờ Tý Phí LIVE Theme (Alt Take)**, lấy nguyên byte từ file Alt Take đã có trong `assets/co-ty-phu/audio/`. Bản dùng khi build được đặt tên ASCII `co-ty-phi-live-theme-alt-take.m4a` để tránh lỗi đường dẫn tiếng Việt trên Windows.

`playlist.json` giữ đường dẫn nguồn, dung lượng và SHA-256. `sourceCommit: null` nghĩa là bản nhạc lấy từ asset người dùng cung cấp trong workspace, không gán nhầm nguồn sang repo boss raid. File được giải mã kiểm tra, không chỉnh sửa nội dung nhạc.

`npm run prepare:assets` kiểm tra hash và chép bản này sang `runtime/music/`; game lặp đúng Alt Take. Hai bài từ dự án tham chiếu trước được thay khỏi playlist/source; prepare dọn bản copy runtime cũ. Nhạc có bật/tắt, âm lượng riêng và tự nhỏ xuống khi MC nói.
