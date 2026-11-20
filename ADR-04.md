# ADR-04 — Lưu leaderboard và đo benchmark

## Trạng thái

Đã chấp nhận cho Phase 4.

## Quyết định

Dùng server Node tích hợp, không thêm framework hay dịch vụ ngoài. Server phục vụ thư mục `dist`, cung cấp API leaderboard và lưu `data/leaderboard.json`; lệnh `--export-leaderboard` đọc chính file này. Game mở ở localhost, nhờ đó UI và CLI dùng cùng nguồn điểm. Thay đổi này làm `npm start` thành cách chạy được khuyến nghị; `npm run preview` vẫn giữ cho xem web tĩnh nhưng không có API lưu điểm.

Benchmark mở Edge/Chrome cục bộ qua Chrome DevTools Protocol, đặt viewport 1280×720, dựng cảnh theo seed và lấy frame time trực tiếp từ `requestAnimationFrame`. Runner truyền cờ tắt vsync; lần đo phát triển đạt trên tần số màn hình 60 Hz nên báo `vsync_off:true`. RSS tiến trình web ghi `null` cho tới khi có phép đo đáng tin cậy xuyên tiến trình trên các hệ điều hành được hỗ trợ.

## Hệ quả

- Không cần database hay dependency runtime mới; bảng top 10 phù hợp cho một người chơi cục bộ.
- Chạy bằng Vite preview không thể lưu leaderboard; hướng dẫn phát hành dùng Node server.
- Chỉ số `vsync_off` và RSS cần được đọc cùng cấu hình máy, không suy rộng một lần đo sang mọi hệ thống.
- Mô phỏng headless mặc định không đổi; benchmark dùng cờ scenario nội bộ để giữ Mây đứng yên và tắt tương tác/kết thúc màn.
