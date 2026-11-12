# 🎬 TikTok Live Cutter & Recorder (Cắt Video TikTok Live)

<div align="center">

![GitHub repo size](https://img.shields.io/github/repo-size/VietCodeBug/C-_t-_Ph-_Tiktok_Live?style=for-the-badge)
![GitHub stars](https://img.shields.io/github/stars/VietCodeBug/C-_t-_Ph-_Tiktok_Live?style=for-the-badge)
![Python Version](https://img.shields.io/badge/python-3.9+-blue.svg?style=for-the-badge&logo=python)
![FFmpeg](https://img.shields.io/badge/FFmpeg-Supported-green.svg?style=for-the-badge&logo=ffmpeg)
![License](https://img.shields.io/badge/license-MIT-orange.svg?style=for-the-badge)

**Công cụ tự động ghi hình, tải và cắt phân đoạn livestream TikTok chất lượng cao phục vụ sáng tạo nội dung (Reels, TikTok, Shorts).**

[Tính Năng](#-tính-năng-chính) • [Cài Đặt](#-cài-đặt) • [Cách Sử Dụng](#-hướng-dẫn-sử-dụng) • [Cấu Trúc](#-cấu-trúc-dự-án) • [Đóng Góp](#-đóng-góp)

</div>

---

## 📌 Giới thiệu

**TikTok Live Cutter** là giải pháp dành cho các Content Creator, Streamer và Editor giúp tự động hóa quá trình bắt link livestream TikTok đang phát sóng, ghi hình liên tục và cắt nhỏ thành các clip highlight ngắn theo mốc thời gian hoặc khoảng thời gian tùy chỉnh.

Dự án tối ưu hóa tốc độ xuất video bằng việc tận dụng **FFmpeg Stream Copy**, giúp quá trình cắt ghép diễn ra gần như tức thì mà không cần re-encode làm giảm chất lượng gốc.

---

## ✨ Tính năng chính

- 🔴 **Tự động bắt link & Ghi hình Livestream:**
  - Nhập URL kênh TikTok hoặc Room ID để tự động theo dõi và ghi lại stream ngay khi phát sóng.
  - Hỗ trợ ghi video ở độ phân giải gốc cao nhất (1080p, 720p 60fps).
- ✂️ **Cắt & Phân đoạn Video (Clipping & Segmentation):**
  - Cắt video tự động theo khoảng thời gian cố định (ví dụ: mỗi 60s, 3 phút, 5 phút).
  - Cắt thủ công theo timestamp `start_time` và `end_time` (hh:mm:ss).
- ⚡ **Siêu tốc với FFmpeg (Lossless Clipping):**
  - Cắt ghép trực tiếp trên stream bitstream (`-c copy`), không tốn CPU/GPU render lại, bảo toàn chất lượng hình ảnh và âm thanh 100%.
- 📐 **Tối ưu định dạng cho Shorts / Reels / TikTok:**
  - Hỗ trợ xuất chuẩn khung hình 9:16 dọc hoặc 16:9 ngang.
  - Tách luồng âm thanh thành định dạng MP3/AAC nếu cần.
- 📁 **Quản lý file thông minh:**
  - Tự động đặt tên file theo tên idol/streamer, ngày giờ phát sóng và thứ tự phân đoạn clip.

---

## 🛠️ Yêu cầu hệ thống

Trước khi bắt đầu, hãy đảm bảo hệ thống của bạn đã cài đặt:

1. **Python 3.9+** (hoặc môi trường runtime tương ứng).
2. **FFmpeg**: Đã được cài đặt và thêm vào biến môi trường hệ thống (`PATH`).
   - Kiểm tra bằng lệnh:
     ```bash
     ffmpeg -version
     ```

---

## 🚀 Cài đặt

1. **Clone repository về máy:**
   ```bash
   git clone https://github.com/VietCodeBug/C-_t-_Ph-_Tiktok_Live.git
   cd C-_t-_Ph-_Tiktok_Live
   ```

2. **Tạo và kích hoạt môi trường ảo (khuyến nghị):**
   ```bash
   # Windows
   python -m venv venv
   .\venv\Scripts\activate

   # Linux / macOS
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Cài đặt các thư viện cần thiết:**
   ```bash
   pip install -r requirements.txt
   ```

---

## 📖 Hướng dẫn sử dụng

### 1. Cấu hình cơ bản
Tạo hoặc chỉnh sửa file cấu hình `config.json` (hoặc `.env`):
```json
{
  "streamer_url": "https://www.tiktok.com/@username/live",
  "output_dir": "./output",
  "segment_duration": 180,
  "quality": "best"
}
```

### 2. Ghi hình trực tiếp (Live Recording)
Chạy script để bắt đầu ghi luồng livestream:
```bash
python recorder.py --url https://www.tiktok.com/@username/live
```

### 3. Cắt video đã tải / ghi hình
Cắt một đoạn highlight cụ thể từ video:
```bash
python cutter.py --input output/live_stream.mp4 --start 00:05:30 --end 00:08:45 --out highlights/clip1.mp4
```

Tự động chia nhỏ video thành các đoạn 60 giây:
```bash
python cutter.py --input output/live_stream.mp4 --split 60 --out highlights/
```

---

## 📂 Cấu trúc dự án

```text
C-_t-_Ph-_Tiktok_Live/
├── output/              # Thư mục lưu trữ video live tải về
├── highlights/          # Thư mục lưu trữ các đoạn clip sau khi cắt
├── src/
│   ├── recorder.py      # Module bắt link và stream video từ TikTok Live
│   ├── cutter.py        # Module xử lý cắt ghép video bằng FFmpeg
│   └── utils.py         # Tiện ích bổ trợ (format time, check link, ...)
├── config.json.example  # File cấu hình mẫu
├── requirements.txt     # Danh sách thư viện Python
├── .gitignore           # Bỏ qua các file rác và video nặng
└── README.md            # Tài liệu dự án
```

---

## 🗺️ Lộ trình phát triển (Roadmap)

- [x] Khởi tạo dự án & cấu trúc lưu trữ
- [ ] Tích hợp phát hiện livestream tự động chạy ngầm (Daemon mode)
- [ ] Cắt video tự động nhận diện khoảnh khắc cao trào / âm thanh lớn (Audio Peak Detection)
- [ ] Tự động tạo phụ đề AI (Whisper Auto-Subtitle)
- [ ] Giao diện người dùng Web UI / Desktop UI trực quan

---

## ⚠️ Tuyên bố miễn trừ trách nhiệm (Disclaimer)

Dự án này được phát triển với mục đích học tập và nghiên cứu công nghệ xử lý đa phương tiện. Người sử dụng cần tôn trọng bản quyền nội dung của các nhà sáng tạo trên TikTok và tuân thủ [Điều khoản Dịch vụ của TikTok](https://www.tiktok.com/legal/terms-of-service).

---

## 👤 Tác giả

- **VietCodeBug** - [@VietCodeBug](https://github.com/VietCodeBug)
- Email: [phamvietanh19218@gmail.com](mailto:phamvietanh19218@gmail.com)

---

⭐ **Hãy để lại 1 Star nếu dự án hữu ích với bạn!**
