# Nghiệm thu CP2 · Ba hòn đảo

Nguồn chuẩn là TICKET-02.md. Đo trên bản production 1280×720; ghi riêng phép thử headless và trình duyệt.

| Hạng mục | Tình huống và tiêu chí đạt |
|---|---|
| Gió Lạc | Mang 5 con trong 15 m kích hoạt đuổi. Chạm khi bất tử vẫn mất 3; pulse khi đang bỏ chạy trả lại chính số đã mất. Không cướp lần hai. |
| Bùa Gió | Nhặt tại cầu hoặc đảo Chuông; đếm đủ 600 tick, chạy 7.2 m/s, lướt lại khi bấm mới. Bùa tái xuất sau 2700 tick gameplay. |
| Chuỗi Đêm | Từ menu xem lời Ông Đăng ở cả ba đảo. Khi thua, chơi lại đúng đảo. Bình Minh bằng tổng điểm ba Đêm thắng, mỗi lượt chỉ cộng một lần. |
| Tạm dừng | Esc hoặc P mở đủ bốn lựa chọn. Giữa hai snapshot paused, sim_tick, vị trí, hồi chiêu và thời gian giống nhau. Tiếp tục đúng lượt, chơi lại đặt lại lượt, về menu kết thúc chuỗi hiện tại. |
| Cài đặt | Đổi âm lượng và độ nhạy, mở lại trang; cả giá trị và tác dụng được giữ. |
| Âm thanh | Sau thao tác vào game nghe được nhạc đêm, nhặt, thắp, pulse, hit, nhảy, lướt, thắng, thua, sinh bóng, đếm 10 giây và báo gió trước 2 giây. |
| HUD | Kiểm tra ở 1280×720: lửa trái, đồng hồ giữa đỏ nhấp nháy khi ≤30 giây, đèn và điểm phải; túi 10 ô, hồi chiêu, nhắc E, chỉ hướng đèn ngoài màn hình. |
| Phong cách | Đối chiếu vật liệu với bảng màu ticket và công thức ánh sáng theo đèn. Dấu tiếng Việt hiển thị đầy đủ, di chuột xoay camera sau một lần bắt chuột. Mô hình chi tiết hơn CP1 và ≥30 FPS trung bình mỗi đảo. |
| Bản đồ và vật lý | Kiểm tra vòng sinh, cầu và bục hai chiều, hai dốc, tầng, tháp; lướt trên không giữ độ cao, rơi mất túi đúng một lần và hồi sinh sau 60 tick. |
| CLI | night 1–3, tick 0, input từng phần, sự kiện, seed, pause và sim_tick đúng contract. Đo đủ 21600 bước Đêm 3 trong ≤30 giây. |

Giả định: Gió Lạc dùng các điểm sương của Bóng Mực. Đêm 3 xuất phát (0,0,-26) để tránh tháp. Đom đóm cố định có ttl_s bằng 0. invuln trong snapshot là boolean. Hướng gió dùng cùng quy ước XZ của bản đồ. Hạ độ nhạy hoặc âm lượng chỉ tác động trình duyệt.

Hồi quy CP1: giữ các phép thử tick, hướng camera, trạng thái input, mã lỗi và tính tất định. Đổi kỳ vọng nhặt/nạp theo sức chứa và điểm mới, pulse theo tâm 3D và quãng đẩy 15 tick, sinh bóng ở tick 300, kết thúc ưu tiên hết lửa. Bằng chứng cũ vẫn thuộc tag phase-1.
