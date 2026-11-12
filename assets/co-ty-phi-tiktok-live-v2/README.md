# Cờ Tý Phí TikTok LIVE · Sprite V2.3

Bộ sprite tích hợp cho 40 nhân vật, NPC và thú cưng, với 1.108 atlas PNG RGBA và 62.670 frame. Mỗi nhân vật có `animations.json` bên cạnh các atlas. Gồm 40 atlas idle V2.3 và 67 atlas di chuyển đã cập nhật tới V2.2.

## Tệp sử dụng

- [Dàn nhân vật](preview/Co_Ty_Phi_V2_Roster.jpg)
- [GIF idle chính diện, trái và phải](preview/Mit_Toc_Xu_V2_3_Idle_3_Huong.gif)
- [GIF đi bộ bốn hướng](preview/Mit_Toc_Xu_V2_2_Di_Bo_4_Huong.gif)
- [Danh mục và tọa độ các clip V2](Toa_Do_Sprite_V2.xlsx)
- [Tọa độ đã cập nhật cho di chuyển](Toa_Do_Di_Chuyen_V2_2.csv) và [idle](Toa_Do_Idle_V2_3.csv)
- [Map 3D, đạo cụ, UI, VFX và âm thanh](../co-ty-phi-tiktok-live-v1/README.md)

Các atlas có ô 256 × 256 và pivot (128, 218). Với idle và di chuyển, S là chính diện, N là quay lưng, E là ngang phải và W lật ngang E. Dùng hướng cuối cùng khi nhân vật dừng. Các hàng SE và NE của các clip này lưu hình E để tương thích với atlas năm hàng.

Dùng [manifest idle](catalog/idle_v2_3.json) cho clip đứng chờ và [manifest di chuyển](catalog/locomotion_v2_2.json) để đồng bộ quãng bước. Dùng dữ liệu hướng trong manifest từng nhân vật cho các clip khác. Hai tệp CSV ở trên là tọa độ mới nhất của các clip được cập nhật. Xem [kết quả kiểm tra gói tích hợp](catalog/qa_v2_3_integrated.json).
