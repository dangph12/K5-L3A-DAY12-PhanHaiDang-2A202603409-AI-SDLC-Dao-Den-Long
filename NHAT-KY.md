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
