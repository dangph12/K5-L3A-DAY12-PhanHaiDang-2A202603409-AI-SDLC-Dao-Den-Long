# Đảo Đèn Lồng

Dùng PRD-0.md làm chuẩn cho CP1. UI và CLI dùng chung mô phỏng 60 Hz. Đọc tuning từ game.contract.json. Sau khi đổi luật, chạy npm run build và npm test rồi ghi bằng chứng thật vào nhật ký.

## CP2

Dùng TICKET-02.md và Test Contract v1.1 cho ba Đêm. CLI và Three.js cùng dùng Game và định nghĩa bản đồ trong src/maps.ts. Theo [skill kiểm chứng CP2](skills/cp2-verification/SKILL.md) khi thay luật hoặc xác nhận bàn giao. Ghi lý do thay kỳ vọng hồi quy so với tag phase-1 trong SPEC-CP2.md.

## CP3

Dùng TICKET-03.md và Contract v1.2. Khi sửa đèn hoặc Bóng Mực, kiểm tra thứ tự trừ dầu, cạn dầu, tương tác, vùng an toàn, pulse và bình minh. Cập nhật các test đã bị luật mới thay thế với lý do trong ADR-03.md. Chạy npm run build và npm test, lưu bằng chứng thực ở evidence/phase3.

## CP4

Dùng TICKET-04.md và Contract v1.3. Giữ nguyên luật và đầu ra JSONL headless v1.0–v1.2. Chạy `npm run build`, `npm test`, soak 10 Đêm và benchmark 30 giây; ghi JSON do lệnh thật tạo cùng giới hạn phép đo. Lưu bằng chứng ở evidence/phase4. Không ghi nhận benchmark đạt ngưỡng giảng viên nếu máy chưa được công bố.
