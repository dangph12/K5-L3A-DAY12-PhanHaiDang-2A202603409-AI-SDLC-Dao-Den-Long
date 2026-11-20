# Nhật ký lab Đảo Đèn Lồng

## CP0 · Chuẩn bị

- **Giả định** — Dùng Codex, JavaScript và V8 qua Node.js cho bản thử headless. Quyết định về phần hiển thị sẽ dựa trên PRD-0.
- **Nhật ký AI** — Codex đối chiếu tên remote với quy tắc nộp bài và tạo chương trình thử.
- **Cách kiểm chứng** — Từ thư mục gốc, chạy `node hello.mjs`. Kết quả mong đợi là `Hello, Đảo Đèn Lồng!`.
- **Chờ xác nhận** — Quyền xem repo khi chưa đăng nhập, phản hồi của trợ giảng ở tab Phase 1 và giờ nộp theo Coach.
- **Bằng chứng** — Node.js v24.22.1 in đúng lời chào khi chạy `node --preserve-symlinks-main hello.mjs` trong workspace. Cờ này xử lý lỗi EPERM khi Node truy cập thư mục cha. Lệnh thông thường cũng chạy thành công từ bản clone của repo tạm chỉ chứa chương trình thử. Chưa kiểm thử clone từ GitHub.

## CP1 · Đêm 1

- **Quyết định của người dùng** — Three.js, TypeScript và Node.js. HUD dùng HTML/CSS. Ưu tiên gameplay lõi.
- **Giả định** — Đảo bán kính 32 m, năm đèn trên vòng bán kính 20 m. Đầu màn có 35 đom đóm và hai Bóng Mực. Bổ sung một đom đóm mỗi 3 giây và một Bóng Mực mỗi 20 giây đến giới hạn tương ứng 35 và 5. Các nút hành động dùng cạnh nhấn. E nạp vào đèn chưa sáng gần nhất; ánh sáng đánh rơi khi bị chạm sẽ mất. Khi các điều kiện kết thúc trùng tick, ưu tiên thắp đủ đèn, hết lửa, rồi hết giờ. Các bán kính, chi phí, thời gian và điểm nằm trong game.contract.json.
- **Nhật ký AI** — Codex xây mô phỏng chung, CLI, giao diện và bộ kiểm thử. Ca thử sinh Bóng Mực ban đầu kết thúc sớm vì người chơi đứng yên giữa đảo và mất hết lửa. Đặt một đèn sáng tại vị trí xuất phát giúp kiểm tra riêng event sinh ở tick 1200.
- **Kết quả** — Trên Windows với Node.js v24.22.1, TypeScript 5.9.3 và Vite 6.4.1, đã chạy build và npm test từ bản clone của snapshot mã nguồn cục bộ. Tám nhóm test CLI đạt. Một lượt Đêm 1 mặc định với seed 7 chạy lại qua CLI và thắng ở tick 1783 với 1095 điểm. Lưu JSONL và kết quả kiểm thử trong evidence/.
- **Giới hạn kiểm chứng** — Sandbox chặn npm registry và cache thiếu tarball three@0.180.0. Build kiểm chứng dùng bản Three.js đã đóng gói sẵn trên máy. Chưa xác minh cài sạch bằng npm ci với đúng gói Three.js trong lockfile. Edge headless gặp lỗi tiến trình GPU và chưa tạo được ảnh màn chơi. Chưa xác minh thao tác trực tiếp, ảnh trước/sau thắp đèn hay nút chơi lại.

### Các điểm chưa đạt khi chơi thử Phase 1

- **Phông chữ** — Người chơi ghi nhận lỗi hiển thị chữ tiếng Việt trong giao diện.
- **Âm thanh** — Trò chơi chưa có âm thanh.
- **Mô hình 3D** — Cần tăng số đa giác (polygon) cho tất cả vật thể để hình khối chi tiết hơn.
- **Góc nhìn (POV)** — Hiện phải giữ nút chuột trái và kéo để xoay camera. Người chơi muốn xoay góc nhìn bằng cách di chuyển chuột mà không cần giữ nút.

## CP2 · Ba hòn đảo

- **Đầu bài** — Triển khai Ticket-02 trên mốc phase-1. Người chơi chọn xử lý cả phông chữ, điều khiển camera và độ chi tiết mô hình cùng phần âm thanh bắt buộc. Các giả định về điểm xuất phát Đêm 3, điểm sương, TTL và cách kiểm tra nằm trong SPEC-CP2.md.
- **Nhật ký AI** — Codex tách mô phỏng, bản đồ/renderer, UI/âm thanh và trình chạy CLI; dùng cùng bộ tọa độ và Game cho cả hai chế độ. Đã thêm skill kiểm chứng CP2 và tiêu chí nghiệm thu trước khi thay luật. Phiên không cung cấp dữ liệu tính phí để xác nhận chi phí hoặc tổng token.
- **Phát hiện và sửa** — Ngưỡng chặn vách cố định có thể chặn lướt trên dốc; đổi sang độ cao cho phép theo quãng đường ngang. Hướng lá báo gió được chọn từ khi bắt đầu cảnh báo và dùng lại lúc gió nổi. Lộ trình thử đầu tiên ở Đảo Cau và Đảo Chuông bị thua: trình điều khiển kiểm thử được sửa để đi đúng cầu, dốc và xử lý nguy hiểm. Giữ nguyên luật chơi khi tìm lộ trình.
- **Headless** — 8 nhóm hồi quy và 10 nhóm mới đạt. Các lượt chơi mặc định Đêm 1/2/3 thắng lần lượt ở tick 8659/14668/20935 với điểm 1360/1525/1617. Bộ kiểm tra chạy riêng đủ 21600 tick qua CLI trong 0,886 giây trên lần ghi log. Xem evidence/phase2/test-results.txt và ba file night-*.jsonl.
- **Trình duyệt** — Edge 145, Intel HD Graphics 630, 1280×720: 59,87 / 59,99 / 59,99 FPS trung bình, đo mỗi Đêm trong 8 giây sau khởi động. Bài thử UI kiểm tra lưu cài đặt, di chuột không giữ nút, pause, audio, HUD và tổng điểm. Bài thử UI dùng tình huống gần thắng/thua để chuyển màn; các lượt headless phía trên dùng bản đồ mặc định. Ảnh và video có âm thanh trong evidence/cp2-browser.
- **Giới hạn** — Chưa có kết quả test ẩn từ giảng viên. FPS trên các thiết bị khác cần đo trên thiết bị đó.
- **Clone sạch** — Tại commit mã nguồn 7753c22, npm ci, npm run build và npm test đều thành công trên Windows. CLI chạy trọn Đêm 3 trong 1,097 giây ở lần này. Bundle production có SHA-256 94a0264d3afee64e3d99303acac1ca1c23ee8c397b2fc72e0ff75e8c8e9b5fc9, trùng với bản đo FPS. Bài thử trình duyệt cũng phát hiện và kiểm tra lại lỗi nhấn P liên tiếp và dấu tiếng Việt ở tiêu đề.
