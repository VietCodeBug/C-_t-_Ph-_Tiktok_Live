# Cờ tỷ phú — Bến Mây · Asset & Design

Bộ prototype cho game cờ tỷ phú dọc **9:16**: map, mascot, animation, âm thanh và kế hoạch. Chưa có mã game/server.

![Bến Mây v02](assets/co-ty-phu/concepts/ben-may-v02.png)

![10 mascot prototype](assets/co-ty-phu/previews/mascot-roster.png)

## Bộ bàn giao

- [Nguồn, công cụ và các phần đang chặn](docs/co-ty-phu/00-sources-and-status.md)
- [Nghiên cứu và hướng sửa map](docs/co-ty-phu/01-map-study.md)
- [Quy cách nhân vật, animation, sprite và âm thanh](docs/co-ty-phu/02-asset-contract.md)
- [Kế hoạch logic / triển khai](docs/co-ty-phu/03-implementation-plan.md)
- [Kế hoạch 1 / 10 / 20 / 100 người](docs/co-ty-phu/04-scale-test-plan.md)
- [Báo cáo kiểm tra thực tế](docs/co-ty-phu/05-validation.json)
- [Danh sách model](assets/co-ty-phu/roster.json) · [Audio](assets/co-ty-phu/audio/manifest.json)
- [Preview walk từ GLB export/reimport](assets/co-ty-phu/previews/walk-preview.webm)

Có 10 model GLB + file Blender nguồn, 40 animation, 480 frame sprite RGBA và 10 spritesheet, 12 SFX WAV nguyên bản. Các model là prototype hình học có thể chỉnh sửa; chưa phải final art khớp hoàn toàn concept.

Concept v02 là ảnh gộp gần 9:16, chưa phải tilemap/collider hoặc graph đã kiểm chứng. V01 bị người dùng loại. Sheet thiết kế chưa đọc được do proxy 403; các đề xuất chưa được gán là yêu cầu từ sheet.

Đã dùng ImageGen gốc, Blender và công cụ cục bộ. **Chưa dùng được AutoSprite / Software Notion hoặc CLI Game Development Studio** vì phiên không cung cấp công cụ tương ứng. Chưa có đo hiệu năng game 100 người, engine import hoặc canonical package. Xem báo cáo để phân biệt việc đã chạy với kế hoạch.
