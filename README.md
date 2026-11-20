# Đảo Đèn Lồng · Ba hòn đảo

Cần Node.js 22.12+ và trình duyệt hỗ trợ WebGL 2. Từ thư mục dự án:

```sh
npm ci
npm run build
npm run preview -- --open
```

Chọn **Bắt đầu → Vào đảo**. WASD để đi, di chuột để xoay góc nhìn ngang và dọc, Space để nhảy, Shift để lướt, E để nạp đèn hoặc châm dầu, Q để Tỏa Sáng. Esc/P mở tạm dừng. Cài đặt lưu âm lượng, độ nhạy chuột và bảng màu dễ phân biệt.

| Đêm | Thời lượng | Số đèn cần còn sáng lúc bình minh |
|---|---:|---:|
| Đảo Bến | 240 giây | 3/5 |
| Đảo Cau | 270 giây | 4/6 |
| Đảo Chuông | 300 giây | 5/7 |

Đi qua cầu tre hoặc dùng bục nhảy để tới đảo bên kia ở Đảo Cau. Hai dốc và bục tại (0, 3, 13) dẫn lên tầng trên của Đảo Chuông.

Mỗi đèn mới cần 10 đom đóm. Đèn tắt vì cạn dầu cần 5 để thắp lại. Đèn sáng có 100 dầu, hao 1 mỗi giây. Nhấn E khi đứng gần để châm 10 dầu cho mỗi đom đóm đã dùng. Dưới 30 dầu, đèn mất vùng an toàn và Bóng Mực có thể hút dầu. Mỗi lần thắp thành công tăng sức chứa túi thêm 2, từ 10 tới tối đa 20. Mất cả 3 Ngọn Lửa thì thua ngay. Thắp hết đèn sớm vẫn cần giữ đủ đèn sáng tới bình minh.

Mỗi đom đóm nạp hoặc châm cho 5 điểm. Thắp lần đầu cho 100, thắp lại cho 40. Tỏa Sáng trúng mỗi Bóng Mực cho 5, hoặc 15 nếu nó đang hút dầu. Khi thắng, mỗi đèn còn sáng cho 50 cộng phần nguyên số dầu còn lại; mỗi Ngọn Lửa còn lại cho 50. Tổng điểm Bình Minh cộng ba Đêm đã thắng.

## Kiểm chứng

Chạy `npm test` sau bước build. Chế độ headless dùng Contract v1.2 và chấp nhận scenario/input theo [Ticket-03](TICKET-03.md).

```sh
node dist-cli/headless.js --seed 7 --night 1 --ticks 14400 --out dem-1.jsonl
```

[ADR về vòng đời đèn](ADR-03.md), [thay đổi tương thích](CHANGELOG-03.md), [nhật ký](NHAT-KY.md) và [bằng chứng CP3](evidence/phase3/) ghi kết quả kiểm chứng. Tag `phase-2` lưu cách chơi theo Contract v1.1.

## Sáng tạo của tôi

Mây đội nón lá có đèn nhỏ. Cầu tre, bục nhảy, tháp chuông, Gió Lạc và quần đảo được dựng bằng hình khối Three.js. Âm thanh được tổng hợp bằng Web Audio trong trình duyệt.
