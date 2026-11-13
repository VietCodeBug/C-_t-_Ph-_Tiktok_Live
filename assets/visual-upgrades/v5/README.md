# Dáng chính diện ch07 V5

`ch07-front-idle.png` là bản chỉnh raster mới bằng **image_gen built-in**, giữ alpha trong suốt. PNG được chép nguyên từ kết quả công cụ, không chỉnh pixel bằng mã. `ch07-front-idle.json` chỉ ghi vùng alpha và cách đặt hình vào ô 256×256 với chân `(128,218)` khi render.

Đây là một dáng đứng chính diện, không phải atlas animation mới. Giữ nguyên atlas gốc cho di chuyển, biểu cảm, góc ngang và quay lưng. Ảnh gốc của Đào Tóc Dài được giữ nguyên.

Prompt lượt cuối:

> Use case: precise-object-edit. Image 1 is the edit target: the newly cleaned-up front idle sprite. Image 2 is ONLY the original game's style and chibi-proportion reference. Refine Image 1 to match the toy-town CHIBI proportions of Image 2: total full-body height approximately 2.6 heads, larger round head relative to shorter compact torso and legs, small childlike hands and rounded pink sneakers, bold clean dark-plum outer outlines and simplified readable game-sprite shading. Keep the corrected naturally connected shoulders/elbows/wrists; do not bring back capsule arm joints or detached round wrists. Keep the recognizable wavy auburn hair and mint/pink headband, pink tunic, plum leggings, gentle closed-mouth smile and friendly brown eyes. Front facing neutral relaxed idle pose, arms relaxed slightly away from body, hands naturally by thighs. Return exactly ONE centered full-body character with both shoes visible and generous transparent padding. Truly transparent background. No text, no floor, no shadow, no duplicate poses or characters, no grid, no props. Preserve the soft gentle face of Image 1 rather than the open-mouthed original.
