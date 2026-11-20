# ADR-03 · Đèn có vòng đời nhiên liệu

Đèn giờ mang trạng thái lit, ever_lit, deposited, relit_count và fuelUnits. fuelUnits giữ số nguyên theo đơn vị 1/60 để một tick hao đúng một đơn vị, tránh lỗi số thực. Đèn tắt vì cạn dầu đặt deposited về 0 nhưng giữ ever_lit để lần sau chỉ cần 5 đom đóm. Đèn đang sáng có thể nhận châm dầu.

Kết thúc Đêm xét sau tất cả cập nhật ở tick bình minh. Mất hết Ngọn Lửa được xét trước. Nếu còn sống, số đèn sáng đạt ngưỡng 60% thì thắng và cộng thưởng bình minh. Không còn kết thúc sớm khi toàn bộ đèn sáng.

Các test Phase 1–2 kiểm tra thắng tức thì, điểm theo thời gian và đèn đã sáng không nhận tương tác phải được thay bằng test cạn dầu, châm dầu, thắp lại và ngưỡng sáng bình minh. Các test cơ chế không bị thay tiếp tục chạy.
