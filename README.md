# Đảo Đèn Lồng · Ba hòn đảo

Chơi ba Đêm bằng Node.js 22.12+ và trình duyệt có WebGL 2. Mở terminal trong thư mục dự án.

```sh
npm ci
npm run build
npm run preview -- --open
```

Chọn **Bắt đầu → Vào đảo**. Đi bằng WASD và di chuột để xoay camera. Space để nhảy, Shift để lướt, E nạp ánh sáng, Q tỏa sáng. Esc hoặc P tạm dừng. Âm lượng và độ nhạy chuột được lưu trong Cài đặt.

| Đêm | Mục tiêu | Đường đi |
|---|---|---|
| Đảo Bến · 300 giây | 5 đèn | Nhặt đom đóm ở hai vòng quanh đảo. Đèn đã sáng bảo vệ Mây khỏi Bóng Mực. |
| Đảo Cau · 330 giây | 6 đèn | Đi qua cầu tre hoặc dùng bục nhảy sang đảo kia. Bùa Gió ở giữa cầu giúp chạy nhanh và lướt liên tiếp. |
| Đảo Chuông · 360 giây | 7 đèn | Hai dốc dẫn lên tầng giữa; bục tại (0, 3, 13) đưa Mây tới tháp. Canh lá bay và hiệu lệnh gió. |

Túi mang 10 đom đóm. Mỗi đèn cần 10 và nhớ số đã nạp. Pulse tốn 3 con, làm choáng Bóng Mực và có thể lấy lại đồ Gió Lạc đã cướp. Rơi khỏi đảo làm mất một Ngọn Lửa và toàn bộ túi. Mỗi Đêm bắt đầu với 3 Ngọn Lửa.

Mỗi đom đóm **nạp vào đèn** cho 10 điểm, thắp đèn cho 100 điểm, mỗi Bóng Mực trúng pulse cho 5 điểm. Thắng Đêm được cộng thêm hai lần phần nguyên số giây còn lại và 50 điểm mỗi Ngọn Lửa còn lại. Bình Minh tổng kết điểm của ba Đêm thắng.

## Kiểm chứng

Sau khi build, chạy `npm test`. Ví dụ kiểm tra nạp đom đóm cuối cùng hoặc chạy riêng một đảo:

```sh
node dist-cli/headless.js --night 1 --seed 7 --ticks 60 --scenario tests/win.json --inputs tests/interact.json --snapshot-every 1 --out win.jsonl
node dist-cli/headless.js --night 3 --seed 7 --ticks 21600 --out dem-3.jsonl
```

Để phát lại một lượt thắng từ đầu Đảo Chuông bằng đúng input đã kiểm tra, dùng hai lệnh sau. Có thể thay bằng Đêm 2 và seed 7 cho Đảo Cau.

```sh
node tests/campaign.mjs 3 1 route.json
node dist-cli/headless.js --night 3 --seed 1 --ticks 21600 --inputs route.json --snapshot-every 21600 --out dem-3-thang.jsonl
```

CLI dừng khi thắng, thua hoặc đủ số tick. Các scenario và điều kiện nghiệm thu dựa trên [Ticket-02](TICKET-02.md), [spec CP2](SPEC-CP2.md) và [contract v1.1](game.contract.json). Xem [kết quả CLI và FPS](evidence/phase2/), [ảnh và video có âm thanh](evidence/cp2-browser/) và [nhật ký](NHAT-KY.md). Tag `phase-1` lưu bản Đêm 1 dùng contract v1.0.

## Sáng tạo của tôi

Mây đội nón lá có treo đèn nhỏ. Cầu tre, bục nhảy, tháp chuông, Gió Lạc và quần đảo được dựng bằng hình khối Three.js. Nhạc và hiệu ứng được tổng hợp bằng Web Audio trong trình duyệt.

> **Cá nhân** (1 người / 1 MSSV) · Áp dụng SDLC cùng AI để xây một **game 3D** qua **4 phase**, từ yêu cầu ban đầu tới bản phát hành.
> **Lab board + trợ giảng:** **[Đảo Đèn Lồng Lab](https://claude.ai/artifact/Q1RYyv1dxjUczzCbd2ZnoW)**

---

## Tài liệu của lab

| File | Nội dung |
|---|---|
| [GUIDE.md](GUIDE.md) | Hướng dẫn làm lab: vòng làm việc mỗi phase, harness, kiểm chứng, token |
| [CHECKPOINTS.md](CHECKPOINTS.md) | Các mốc tự kiểm tra từ chuẩn bị đến nộp bài |
| [SUBMISSION.md](SUBMISSION.md) | Đặt tên repo, hạn nộp, tag, Release, video, checklist |
| [RULES.md](RULES.md) | Quy định: AI, trung thực về bằng chứng, bản quyền, bảo mật |
| [RUBRIC.md](RUBRIC.md) | Thang điểm chi tiết |

## Lab board

Yêu cầu dự án được phát hành tại **[Đảo Đèn Lồng Lab](https://claude.ai/artifact/Q1RYyv1dxjUczzCbd2ZnoW)**. Mỗi phase là một tab (tab chưa phát hành bị khóa), mỗi tab có trợ giảng AI riêng chỉ trả lời trong phạm vi phase đó. Trợ giảng cần đăng nhập claude.ai và dùng lượt Claude của bạn.

## Dự án

**Đảo Đèn Lồng**: game 3D góc nhìn thứ ba. Mây, người giữ đèn nhỏ tuổi, gom đom đóm để thắp lại các Đèn Lồng Lớn và né Bóng Mực trong sương đen.

- Không ràng buộc công nghệ; chạy được trên macOS hoặc Linux.
- Tuân theo **Test Contract** (chế độ headless) để được chấm tự động và so sánh với nhau.

| Phase | Bạn nhận | Nộp |
|---|---|---|
| 1 | **PRD-0** (mô tả tổng quát) + Test Contract | tag `phase-1` |
| 2 | **Ticket-02**, phát hành khi Phase 1 kết thúc | tag `phase-2` |
| 3 | **Ticket-03**, phát hành khi Phase 2 kết thúc | tag `phase-3` |
| 4 | **Ticket-04**, phát hành khi Phase 3 kết thúc | tag `phase-4` + Release `v1.0.0` |

Yêu cầu sẽ được bổ sung và có thể thay đổi giữa các phase, giống dự án thật.

### Lịch 4 giờ

Bài lab kéo dài **4 giờ**. Phase 1 và 2 khoảng **1 giờ**, Phase 3 khoảng **30 phút**, Phase 4 khoảng **1 giờ 30 phút**. Mỗi phase phát hành đúng mốc giờ. Phase mới xuất hiện trên lab board khi tới mốc.

| Mốc | Sự kiện | Hạn tag |
|---|---|---|
| 0h | Phát hành **Phase 1** (PRD-0), gồm cả phần chuẩn bị | `phase-1` trước mốc 1h |
| 1h | Phát hành **Phase 2** | `phase-2` trước mốc 2h |
| 2h | Phát hành **Phase 3** | `phase-3` trước mốc 2h30 |
| 2h30 | Phát hành **Phase 4** | `phase-4`, Release `v1.0.0` và video trước mốc 4h |
| 4h | Hết giờ lab, chốt bài | |

Hết giờ mỗi phase thì tag và chuyển sang phase tiếp theo, dù phase chưa hoàn hảo. Chỗ chưa xong ghi trung thực trong bằng chứng.

---

## Gợi ý SDLC (cách làm là của bạn)

Mỗi phase là một vòng nhỏ. Công cụ, thứ tự, định dạng tài liệu đều tự do; đây chỉ là gợi ý:

1. **Requirements:** biến yêu cầu thành tiêu chí nghiệm thu kiểm chứng được. Chỗ mơ hồ thì tự giả định và ghi lại.
2. **Plan:** nghĩ cách kiểm chứng **trước** khi để agent viết code.
3. **Build:** để agent viết, bạn điều phối và review.
4. **Verify:** chạy thật, kiểm tra hành vi thật. *Không có bằng chứng thì chưa xong*: "agent bảo chạy rồi" không phải bằng chứng.
5. **Evaluate:** cái gì đạt, AI sai ở đâu, harness (AGENTS.md, skill, hook) cần chỉnh gì.
6. **Release:** gắn tag.

## Ba điều cần nhớ

> Bạn được **tự do sáng tạo thêm** quanh phần lõi (nhân vật, cơ chế nhỏ, câu chuyện, hiệu ứng, âm thanh…). Sáng tạo gọn và không phá yêu cầu được tính điểm trong hạng mục F của [RUBRIC](RUBRIC.md); ghi mục "Sáng tạo của tôi" trong README của bạn.

- **Game tốt là game đúng yêu cầu của khách hàng**, không phải game phức tạp hay đẹp nhất. Làm đúng và chứng minh được là đúng trước, trau chuốt sau.
- **Cân nhắc kỹ quota token của bạn.** Đốt nhiều token không làm bài tốt hơn. Ngữ cảnh gọn, kế hoạch rõ, kiểm chứng sớm thường vừa rẻ vừa đúng hơn chạy agent liên tục.
- **Kiểm chứng là phần quan trọng nhất.** Bằng chứng (test, output headless, ảnh, số đo) đáng giá hơn lời mô tả.

---

## Bàn giao cuối cùng

Một **repo GitHub cá nhân, public**, gồm:

1. **Toàn bộ mã nguồn** của game qua 4 phase, tag `phase-1` … `phase-4`, Release `v1.0.0`.
2. **Video demo `.mp4` dưới 5 phút** (đính kèm Release `v1.0.0` hoặc `docs/demo/demo.mp4`, link ở đầu README): chơi thử và cho thấy bằng chứng game chạy đúng.
3. **Bằng chứng kiểm chứng** của từng phase (định dạng tự chọn).
4. **Harness AI đã dùng** (AGENTS.md / CLAUDE.md, skills, hooks, plugins…), giữ nguyên trong repo và lịch sử git.
5. **Ghi chép ngắn:** spec/giả định mỗi phase, nhật ký dùng AI (gồm token/chi phí ước tính), retro.

Không commit API key, token hay `.env`. Gửi link repo theo hướng dẫn của Coach.

## Đánh giá (100 điểm)

| Hạng mục | Điểm |
|---|---|
| Test tự động ẩn (headless, gồm kiểm tra lại phase trước) | 30 |
| Kiểm chứng & bằng chứng của bạn | 20 |
| Quy trình SDLC & harness AI | 15 |
| Evaluation & retro (gồm cách bạn dùng token) | 10 |
| Hiệu năng & ổn định | 10 |
| Chất lượng sản phẩm (đúng yêu cầu, chơi được) | 10 |
| Video demo | 5 |

## Quy định

- Dùng AI thoải mái; không sao chép repo của người khác.
- Bằng chứng phải thật: test luôn đạt hay output sửa tay là vi phạm.
- Nhân vật, bối cảnh là bản gốc của lab; asset bên ngoài chỉ dùng loại CC0/CC-BY/MIT hoặc tự tạo, ghi nguồn trong `CREDITS.md`.
