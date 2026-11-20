---
name: cp2-verification
description: Kiểm chứng thay đổi gameplay và bàn giao Contract v1.1 của Đảo Đèn Lồng.
---

Đọc mục bị ảnh hưởng trong TICKET-02.md và bảng nghiệm thu SPEC-CP2.md. Đối chiếu tuning với giá trị thực của cả CLI và trình duyệt.

Khi đổi luật, chạy `npm run build` rồi `npm test`. Để tái hiện một lỗi thời điểm, đặt scenario sát ngưỡng, dùng `--snapshot-every 1` và so tick trước/sau sự kiện. Dùng sim_tick để kiểm tra cooldown, sinh, TTL và gió qua pause; dùng tick cho frame input và thứ tự bản ghi.

Với thay đổi cảnh hoặc HUD, kiểm tra bản preview production ở 1280×720. Ghi cấu hình máy và phương pháp đo cùng kết quả. Đưa bằng chứng CP2 vào evidence/phase2, ghi giả định và các giới hạn kiểm chứng trong NHAT-KY.md. Xem tag phase-1 khi cần đầu ra theo luật cũ.
