# Cờ Tý Phí TikTok LIVE — kịch bản chơi bằng bình luận

Phiên bản đề xuất cho demo offline và LIVE sau này. Ưu tiên hiện tại: nâng chất lượng map, đạo cụ và camera; tài liệu này xác định nhịp chơi để việc dựng cảnh có mục đích.

Cập nhật bản local: map đã mở rộng thành 138 ô, 96 bước/vòng đường, sáu ngã rẽ và 64 tổ hợp tuyến. Có thanh lựa chọn, 50 mục runtime riêng, ví và sổ MONEY trong bộ nhớ. [Excel sự kiện](../../outputs/co-ty-phi-v4/Co_Ty_Phi_Su_Kien.xlsx) ghi đúng các mục này; 42 thẻ nguồn và kịch bản LIVE bên dưới vẫn là mục tiêu triển khai đầy đủ. Shop local mô phỏng kết quả ngay, thử thách local là câu hỏi hai lựa chọn; chưa nhận đơn/bình luận LIVE hoặc chốt bục sau hai vòng.

## Hiểu đúng sản phẩm và phần đã có

Đây là game cờ bàn khu phố Việt dùng một màn hình chung dọc 9:16. Môi trường, nhà cửa, quầy và xúc xắc là 3D; nhân vật, NPC và bạn đồng hành là sprite chibi 2D đặt trong không gian 3D. Người xem điều khiển bằng bình luận. MONEY chỉ là điểm trong game, không có quy đổi hoặc phần thưởng tiền mặt trong phạm vi này.

Đã đọc README của `origin/assets/co-ty-phu-prototype`, README V1/V2.3, tài liệu đối chiếu nguồn và hai catalog `event_cards.json` / `minigames.json`. Phần thời gian và shop dưới đây còn đối chiếu với [Kế hoạch phát triển và kịch bản trên Drive](https://docs.google.com/document/d/1lwyM4vyUKwMQ4M7-tzeiqFNDp2cW_OhhjEb2P8jgHwo/edit) mà phiên làm việc đã truy cập được. Kiểm đếm trong repo:

| Thành phần | Đã có trên đĩa | Việc cần làm trong game |
| --- | --- | --- |
| Môi trường V1 | Hai cảnh map GLB; 59 model kit và 125 đạo cụ, tổng 184 model rời | Ghép thành khu phố rộng, bố trí tự nhiên, không che đường và nhân vật |
| Sprite V2.3 | 20 người chơi, 16 NPC, 4 bạn đồng hành; 1.108 atlas PNG, ngoài ra có 40 portrait | Dùng đúng frame, pivot chân và hướng nhìn; chỉ tải clip cần thiết |
| Quy cách sprite | Ô 256×256, pivot `(128,218)`; S/E/N và W lật từ E | Nhân vật quay lưng thật khi camera đi phía sau; idle không trượt chân |
| Nội dung | 42 thẻ sự kiện, ba mini game trong catalog | Lọc theo trạng thái và lượt còn lại; thực thi luật, đồng hồ, kết quả |
| Âm thanh và UI | Nhạc, SFX, giọng MC tổng hợp, giao diện và hiệu ứng V1 | Trộn âm, nghe thử, đồng bộ cảnh; thu MC mới nếu muốn giọng tự nhiên hơn |
| Bản web trên nhánh `web/third-person-v23` trước đợt nâng cấp | Xem map 3D, 10 sprite, chuyển camera, lắc số và đi đúng số cạnh graph | Chưa có ván kinh tế hoàn chỉnh, tài khoản người xem, kết nối TikTok hoặc sổ MONEY |

Các bản thú 3D và Bến Mây trong prototype cũ không thay thế dàn sprite người V2.3. Map gốc 24 node được giữ để truy vết. Biến thể rộng có 138 node, mỗi đường đi đủ một vòng qua 96 ô và sáu ngã rẽ có các nhánh bằng số bước. Chưa có cơ sở để gọi bản xem trước là game nhiều người đã kết nối hoặc công bố FPS khi phát LIVE.

## Một ván: hai vòng, tổng 20 lượt

10 ghế A–J, mỗi ghế bắt đầu 1.000 MONEY và có hai lượt. Vòng 1 đi lần lượt A–J; vòng 2 cũng A–J. “Vòng” ở đây là một lượt của toàn bộ ghế, không phải đi một vòng hết bản đồ. Một lần lắc chỉ đi 1–6 ô; map rộng tạo bối cảnh và lựa chọn, không bắt người chơi phải chạy hết phố.

Người chưa có ghế vẫn đặt đơn, hỗ trợ sự kiện và bỏ phiếu. Không cần quà, không cần spam. Lượt và kết quả không bị thay đổi bởi quà tặng.

| Đoạn | Màn hình và hành động | Bé Két MC |
| --- | --- | --- |
| Mở bàn, 40 giây | Camera lướt qua chợ, con hẻm, bến nước; hiện `CHƠI` và số ghế trống | “Phố mở cửa rồi! Gõ CHƠI để nhận một ghế. Ai cũng có 1.000 MONEY, mỗi người hai lượt nha!” |
| Chốt bàn, khoảng 8 giây | Khóa danh sách đã đăng ký rồi xáo ngẫu nhiên ghế A–J và giới thiệu người chơi | “Đủ bạn thì xuất phát. Chưa có ghế vẫn giúp bán hàng, chọn đường cùng cả phố được nhé!” |
| Gọi một lượt | Camera tiến tới nhân vật; tên, ghế, ví và lượt còn lại hiện rõ | “Đến A! Gõ LẮC. Chúng ta xem hôm nay phố có gì.” |
| Lắc và đi | Xúc xắc 3D xoay, chốt mặt rồi nhân vật mới đi; đếm ô còn lại | “Được bốn! Qua quán nước, rẽ đầu hẻm… còn hai ô.” |
| Gặp ngã rẽ | Dừng ở đầu nhánh, hai mũi tên gắn nhãn TRÁI/PHẢI | “A chọn TRÁI hay PHẢI? Bên trái ghé chợ, bên phải sang bến. Cả phố có thể góp ý!” |
| Dừng ô | Mở một cảnh sự kiện có đạo cụ/NPC phù hợp, một yêu cầu chính và đồng hồ | “A vừa mở shop. Cả phố gõ A để đặt một đơn; đổi ý thì BOM A hủy đơn của mình nha.” |
| Chốt lượt | Hiện phép tính, MONEY trước/sau, dấu đã ghi sổ; chuyển người | “Bốn đơn xong, một đơn hủy. A lãi 35 MONEY. Ví mới 1.035; đến B!” |
| Hết vòng 1 | Hiện bảng xếp hạng tạm, đổi cảnh giữa vòng | “Nửa buổi rồi! Phố thay áo, ví và tài sản của mọi người vẫn giữ nguyên. Vòng hai bắt đầu!” |
| Hết vòng 2 | Chốt sự kiện còn treo theo luật; thanh lý; tổng kết | “Khóa sổ nhé! Nhà và quầy thanh lý theo giá đã báo. Chúng ta xem ai quản phố khéo nhất.” |
| Trao bục | Top 3, bảng xếp hạng đầy đủ và một khoảnh khắc vui | “Chúc mừng quán quân! Cảm ơn cả phố đã chọn đường, gói hàng và cứu những đơn suýt bom.” |

Mục tiêu theo tài liệu nguồn: 8–12 phút cho một ván đủ 10 ghế; đo thực tế rồi điều chỉnh độ dài camera và cảnh kết quả để đạt nhịp này. Không kéo dài lượt để đợi quà. Theo tài liệu kịch bản, hết sảnh 40 giây có từ hai người thì bắt đầu, từ hai đến chín người vẫn chơi; dưới hai người thì tiếp tục chờ. Ghế mẫu chỉ dùng trong chế độ thử và phải có nhãn.

## Lệnh và cách chốt công bằng

Các mốc sảnh 40 giây, lắc/lựa chọn 10 giây và shop 12+12 giây lấy từ tài liệu kịch bản. Những chi tiết được ghi “đề xuất” cần khóa khi triển khai. UI luôn hiển thị cửa nào đang mở, ai được quyền chọn và đồng hồ còn bao nhiêu.

| Cửa | Đề xuất xử lý |
| --- | --- |
| `CHƠI` | Một tài khoản chỉ có một đăng ký. Thứ tự lệnh hợp lệ dùng để nhận đăng ký và xếp danh sách chờ; khi khóa bàn mới xáo ngẫu nhiên ghế A–J. Đủ 10 thì vào danh sách chờ cho ván sau; đầu sảnh kế tiếp dành 10 giây ưu tiên danh sách chờ. Không tự thay người đang chơi giữa ván. |
| `LẮC` | Chủ ghế có 10 giây; hết giờ hệ thống tự lắc đúng một lần. Khóa lệnh trùng ngay khi nhận; không cho lắc lại sau khi thấy kết quả. |
| `TRÁI` / `PHẢI` | Chủ ghế được ưu tiên trong 10 giây. Đồng thời nhận phiếu khán giả; nếu chủ ghế im lặng thì dùng phiếu. Hòa hoặc không có phiếu thì đi nhánh mặc định đã hiện trước. |
| Phiếu khán giả | Mỗi ID tính một phiếu cho mỗi quyết định; đề xuất lấy phiếu hợp lệ cuối cùng trước hạn. Không đếm số lần spam. Chỉ dùng khi cửa đó mở. |
| `A` đặt đơn | Shop mở cửa nhận đơn 12 giây, tối đa tám đơn; người ngoài bàn mới được đặt và một ID có một đơn. Lệnh lặp không thêm đơn. ID và mã cửa hàng gắn với một sự kiện cụ thể. |
| `BOM A` | Cửa trả đơn 12 giây; chỉ hủy đơn của chính ID gửi lệnh trong shop hiện tại. Không hủy đơn người khác; lệnh hủy lặp không trừ thêm. Quy tắc hủy ngay trong cửa nhận đơn cần xác minh nếu muốn hỗ trợ. |
| Lệnh sự kiện | Ưu tiên đúng người được chỉ định; hết giờ chọn phương án mặc định đã báo hoặc kết quả timeout riêng của thẻ. Không tự dùng cùng một mặc định cho mọi thẻ. |

Lệnh được chuẩn hóa khoảng trắng và chữ hoa/thường; có thể hỗ trợ bản không dấu như `CHOI`, `LAC`, `TRAI`, `PHAI`, nhưng phải hiển thị đúng các alias được hỗ trợ. Chốt theo thời gian server nhận, có ID sự kiện để khử trùng lặp và lưu cả lệnh bị từ chối. Độ trễ bình luận TikTok cần đo để đặt thời gian hợp lý.

## Ba cảnh mẫu có thể làm ngay sau khi duyệt map

### 1. Shop online của A — BIZ02

Màn hình mở quầy, bảng đơn và hai nút/lệnh `BÁN` / `LƯƠNG`. Cần có ít nhất 120 MONEY mới được chọn BÁN. Nếu chọn BÁN, nhập hàng −80 MONEY; người ngoài bàn gõ `A` để đặt, `BOM A` để hủy đơn của chính mình trong cửa trả đơn. Phương án LƯƠNG nhận +40 và kết thúc cảnh. Theo tài liệu gốc, shop nhận tối đa tám đơn trong 12 giây rồi mở 12 giây trả đơn. Catalog quy định:

`lãi ròng = 30 × đơn giao thành công − 5 × đơn trả − 80`.

Ví dụ bốn đơn giao, một đơn trả: `120 − 5 − 80 = +35`; ví từ 1.000 thành 1.035. Ví dụ tám đơn nhận nhưng sáu đơn trả, còn hai đơn giao: `60 − 30 − 80 = −50`, ví thành 950. Đây là tổng chênh lệch; không trừ 80 lần nữa khi chốt nếu đã ghi giao dịch nhập hàng. UI nên cho thấy từng dòng để người xem hiểu.

Bé Két: “Quầy A khai trương! Mỗi người một đơn thôi, để cô chủ còn kịp gói. Muốn đổi ý thì BOM A, hủy đúng đơn của mình nhé.” Khi kết thúc: “Chốt cửa! Những đơn sau tiếng chuông để quầy sau phục vụ.”

Catalog tham chiếu mục 4 của tài liệu gốc cho chi tiết shop; các con số được bổ sung ở trên từ bản Drive. Cần xác minh khả năng hủy ngay khi cửa nhận đơn chưa đóng; bản tối thiểu chỉ nhận lệnh hủy trong cửa trả đơn riêng. Người trong bàn không đặt/hủy đơn của nhau để tránh tác động lợi ích giữa các ghế.

### 2. Đóng Gói Thần Tốc — MINI01

Bàn gói hàng 3D xuất hiện cạnh quầy; hiện chuỗi biểu tượng HỘP → BĂNG → TEM theo mẫu biến thể. Theo catalog: hai lần thử trong 12 giây, đúng +70; đủ ba người giúp thì thêm +20. Lệnh khán giả hỗ trợ là `GÓI A`.

Bé Két: “Hộp trước, băng sau, tem cuối! A có hai lần thử. Ai phụ thì gõ GÓI A, mỗi người một tay nhé.”

Cần chốt cú pháp trả lời chuỗi của chủ ghế; catalog mới cho ví dụ, chưa xác định parser. Đề xuất người ngoài ghế hỗ trợ bằng ID duy nhất, không dùng tốc độ spam làm lợi thế.

### 3. Trà Sữa Đúng Đơn — MINI02

Quầy 3D hiện ba ly có số 1/2/3; bảng đơn dùng hình rõ trên điện thoại: mức đá và topping. Theo catalog: 12 giây, chọn đúng +65. Khán giả dùng 1/2/3.

Bé Két: “Một ly ít đá, đúng topping! Nhìn kỹ ba ly rồi chọn 1, 2 hoặc 3 giúp quầy nhé.”

Cần xác minh chủ ghế chốt đáp án hay kết quả dùng đa số khán giả. Đề xuất bản offline dùng chủ ghế chốt, phiếu chỉ gợi ý; phải ghi rõ trên UI trước khi mở cửa.

## Map rộng, thay đổi giữa vòng và vẫn đọc được trên 9:16

Chia khu phố thành các địa điểm nhận ra được: chợ mái bạt, hẻm dân cư, sân giao hàng, vườn ven nước và quảng trường cuối ván. Đường chính đủ thoáng cho sprite; mái hiên, cây và quầy có khoảng lùi. Biến thể xoay nhẹ, chiều cao cây, cụm cây và màu mái làm phố tự nhiên hơn nhưng không làm mờ ô chơi.

Map rộng không đồng nghĩa nhiều chi tiết cùng chen vào một khung. Toàn cảnh giúp hiểu vị trí; camera bám người và góc sự kiện cho thấy chi tiết. Dùng đường đi, biển khu, ánh sáng và bờ sông để định hướng. Các công trình ở phía trước camera cần mờ hoặc có góc máy tránh che nhân vật.

Tài liệu nguồn đặt đổi map theo ván. Yêu cầu mới của người dùng mở rộng thành đổi cảnh sau mỗi vòng A–J; bản xem trước hiện áp dụng thay đổi này và giữ node logic của từng nhân vật. Đề xuất hai cấp ngẫu nhiên cho game hoàn chỉnh:

1. **Bản đầu:** sinh cảnh theo seed khi mở bàn và giữa hai vòng; giữ ID node, liên kết, vị trí logic và quyền sở hữu. Thay mảng cảnh, chủ đề, màu vật liệu, cụm cây, đạo cụ và bộ sự kiện hợp lệ. Chỉ chuyển sau khi J xong lượt, không còn bước di chuyển hay cửa nhận lệnh.
2. **Bản sau:** có nhiều graph được kiểm tra trước hoặc graph sinh theo seed với đường quay về, ngã rẽ hợp lệ và khoảng trống đủ rộng. Nếu thay graph giữa vòng phải có ánh xạ node/điểm đến minh bạch, không đổi vị trí hoặc tài sản của một ghế một cách tùy tiện. An toàn hơn là chỉ đổi graph đầy đủ ở đầu ván mới.

Seed cảnh và chuỗi random luật nên tách riêng; việc dựng lại cây hoặc đổi chất lượng hình ảnh không làm đổi xúc xắc, thẻ hay kết quả. Lưu seed và phiên bản luật vào log. Giữ đường mặc định hợp lệ và mọi nhánh đi được; kiểm tra cạnh, node, đường về, vùng spawn và camera trước khi hiển thị cảnh.

## Kết ván và sổ MONEY

Sau lượt thứ hai của J: đóng toàn bộ cửa lệnh, giải quyết các nghĩa vụ đã hẹn, thanh lý tài sản theo đúng luật và ghi sổ từng giao dịch một lần. Ví dụ theo catalog, HOME01 mua nhà −140, HOME02 thuê +75, thanh lý nhà +100: toàn chuỗi +35. Không bán hai lần và không ghi lại thu nhập đã chốt.

Thẻ có kết quả ở lượt sau chỉ mở nếu còn lượt phù hợp. HOME01 và EDU01 có điều kiện này trong catalog; riêng FAM03/FAM04 cho phép chốt ngay ở lượt cuối. Cần áp dụng điều kiện riêng từng thẻ, không gom tất cả vào một quy tắc chung.

Xếp hạng theo MONEY cuối cùng. Nếu bằng nhau, đề xuất đồng hạng; không lấy quà hoặc lượt like để phá hòa. Bục có thể xoay lần lượt người đồng hạng. Giá thanh lý quầy, số dư có được âm không và cách xử lý không đủ MONEY cần chốt theo tài liệu gốc trước khi khóa luật.

## Bước tiếp theo để có demo chơi trọn ván

1. Duyệt bản local: môi trường rộng, đường rõ, sprite tự nhiên, xúc xắc 3D và đổi cảnh theo seed. Giữ đây là chế độ xem trước hình ảnh.
2. Tạo bộ luật TypeScript dùng chung, state machine ván và bộ nhập bình luận giả lập. Làm đủ vào bàn → hai vòng → lắc → nhánh → sự kiện → MONEY → thanh lý → xếp hạng. Đảm bảo chơi được từ đầu đến cuối khi không có mạng.
3. Làm hai mini game MVP và nhóm thẻ chọn lọc; ràng buộc số lượt còn lại, quyền gửi lệnh, timeout và các phép tính sổ. Đưa Bé Két vào đúng cửa lệnh, tránh nói đè lên nhau.
4. Tách Node.js làm nguồn trạng thái đáng tin cậy; SQLite lưu ván, lệnh, giao dịch và snapshot. Có thể phát lại log để đối chiếu kết quả; mất kết nối không tạo lượt hoặc khoản tiền trùng.
5. Nối bình luận TikTok bằng phương thức truy cập được xác minh. Thử độ trễ, reconnect, chống trùng sự kiện và người xem vào giữa ván. Sau đó mới đo OBS, CPU/GPU, âm thanh và khả năng đọc trên màn hình điện thoại.

Các thông tin cần xác minh: quyền và phương thức lấy bình luận TikTok; chi tiết cửa hủy shop nêu trên; cú pháp hai mini game; phí quầy và thanh lý đầy đủ; các mặc định timeout theo từng thẻ; cách xử lý tài sản sau đổi map; máy phát LIVE mục tiêu và giới hạn hiệu năng. Đây là các điểm cần khóa khi triển khai luật, không chặn việc nâng cấp asset/map hiện tại.

## Nguồn trong repo

- [README nhánh asset trên GitHub](https://github.com/VietCodeBug/C-_t-_Ph-_Tiktok_Live/tree/assets/co-ty-phu-prototype)
- [Kế hoạch phát triển và kịch bản trên Drive](https://docs.google.com/document/d/1lwyM4vyUKwMQ4M7-tzeiqFNDp2cW_OhhjEb2P8jgHwo/edit)
- [Bộ V1](../../assets/co-ty-phi-tiktok-live-v1/README.md)
- [Sprite V2.3](../../assets/co-ty-phi-tiktok-live-v2/README_V2_3.md)
- [Catalog 42 thẻ](../../assets/co-ty-phi-tiktok-live-v1/catalog/event_cards.json)
- [Catalog mini game](../../assets/co-ty-phi-tiktok-live-v1/catalog/minigames.json)
- [Đối chiếu yêu cầu map gốc](07-master-source-reconciliation.md)
- [Bản web và giới hạn trước đợt nâng cấp](../../web/README.md)
