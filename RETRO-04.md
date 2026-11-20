# Retro các phase — Đảo Đèn Lồng

## Điều hiệu quả

Ở Phase 1, tách `Game` khỏi Three.js giúp cùng luật chạy trong trình duyệt và CLI. Contract JSON, seed cố định và JSONL tạo ra các ca kiểm chứng tái lập được. Phase 2 mở rộng lên ba bản đồ mà tiếp tục dùng chung `Game` và `maps.ts`; log từng Đêm cho thấy đường bot sai do đi lệch cầu hoặc dốc thay vì phải đoán luật. Phase 3 ghi lại thay đổi luật đèn trong ADR và sửa những assertion cũ bị luật bình minh thay thế. Phase 4 dùng lại các khe này cho soak test và thêm test server/API cho leaderboard.

## AI sai và cách phát hiện

Nhật ký Phase 1–2 ghi lại các lượt thử ban đầu thua do chọn vị trí chiến thuật hoặc đường đi sai; scenario, snapshot và log đã giúp phân biệt lỗi bot với lỗi mô phỏng. Trong Phase 3, phép thử kiểm tra tác động trực tiếp lên điểm, nhiên liệu, vùng an toàn và kết thúc Đêm để phát hiện các giả định không còn đúng.

Trong Phase 4, lần đầu chạy `npm test` dừng ở assertion cũ đòi contract 1.2. Đây là kỳ vọng phiên bản đã lỗi thời vì contract 1.3 chỉ thêm lệnh, không đổi luật; cập nhật assertion kèm lý do và chạy lại toàn bộ suite. Smoke benchmark cũng cho thấy `load_ms` ban đầu đo tới lúc hoàn tất benchmark thay vì khung đầu tiên; đã đổi điểm lấy số đo và chạy benchmark lại. Các lượt thử này củng cố việc dùng output thật để kiểm tra định nghĩa trường đo.

## Harness hữu ích nhất

`AGENTS.md` giữ lệnh build/test/evidence rõ ràng; contract và tuning JSON tập trung các con số; test headless bảo vệ hành vi giữa các phase. Seed cố định cho soak/benchmark giúp tái hiện cảnh. Test API kiểm tra cùng lúc lưu bền và xuất CLI, nơi một phép thử UI riêng lẻ khó phát hiện lệch nguồn dữ liệu.

## Token và chi phí AI

Phiên làm việc hiện tại không cung cấp báo cáo token hoặc chi phí theo repo. Không có cơ sở để đưa ra một con số ước tính đáng tin, nên retro ghi rõ là chưa đo được thay vì tự tạo số. Cách tiết kiệm đã áp dụng là đọc đúng các file liên quan, tái sử dụng mô phỏng/contract, thêm server Node tích hợp không kéo framework/database và chạy smoke benchmark ngắn trước lượt 30 giây.

## Nếu làm lại

Mình sẽ xác minh sớm cách trình duyệt lưu cùng dữ liệu với CLI và xác định khả năng đo RSS/vsync trước khi viết runner. Phần đo benchmark cần một lượt thử trên máy được công bố; kết quả hiện có chỉ là tham khảo trên máy phát triển. Video demo được thực hiện ở Checkpoint 5.
