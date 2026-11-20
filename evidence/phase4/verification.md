# Bằng chứng CP4 — máy phát triển

Ngày chạy: 2026-11-20. Cấu hình chi tiết trong [machine.txt](machine.txt); log build/test/soak/bench nằm cạnh file này. JSON gốc: [bench.json](../../bench.json), [soak.json](../../soak.json).

## Build và hồi quy

- `npm run build`: thành công. Vite có cảnh báo bundle JavaScript 567.61 kB vượt ngưỡng cảnh báo 500 kB; build vẫn hoàn tất.
- `npm test`: thành công; toàn bộ contract/Phase 1, Phase 2, Phase 3, bunny-hop và Phase 4 đều PASS.
- Test Phase 3 đổi kỳ vọng version `1.2` thành `1.3` vì envelope thêm hai lệnh; tuning, luật và JSONL headless không đổi.
- Test API xác nhận leaderboard lưu vào đĩa, còn sau khi khởi động lại server và xuất JSON đúng thứ tự.
- Gói `release/dao-den-long-v1.0.0.zip` đã giải nén vào thư mục tạm sạch; `tests/release-smoke.mjs` xác nhận trang web và API leaderboard phục vụ đúng. Xem `release-smoke.txt`.
- SHA-256 gói: `344380C70147925543CD79EC33B7F5D89AD4800D19556DABE9080051D6FE55F8`.

## Soak

Lệnh: `npm run soak -- --seed 7 --nights 10 --out soak.json`

- 10/10 Đêm chạy xong trong cùng tiến trình; 0 crash.
- Kết quả giả ngẫu nhiên theo contract: 10 lần `lost`.
- RSS sau tải Đêm đầu: 50 MB; sau reset Đêm cuối: 56 MB (1.12×), đạt giới hạn 1.2×.
- Thời lượng máy phát triển: 1.2 giây.

## Benchmark

Lệnh: `npm run bench -- --seed 42 --duration 30 --out bench.json`

- Cảnh: Edge, WebGL2, 1280×720, warmup 3 giây; đủ 200 Bóng Mực wander, 100 đom đóm và ba đèn L1–L3 sáng ở 100 dầu.
- `avg_fps`: 172.1 (ngưỡng 60); `p1_low_fps`: 37.2 (ngưỡng 30); `load_ms`: 2814 (ngưỡng 10000); `frame_ms_p95`: 10.2; `frames`: 5164.
- `vsync_off`: true; Edge chạy với cờ tắt vsync, đo 172.1 FPS trên màn hình 60 Hz.
- `peak_mem_mb`: null. Runner đo bản web và chưa có cách đo đáng tin RSS tổng của browser cùng các tiến trình con.
- Đây là số đo tham khảo trên Intel Core i7-7700HQ, Intel HD Graphics 630, Windows 10, Edge 145; cần đo lại trên máy chấm.

## Giới hạn còn lại

- Video demo MP4 thuộc Checkpoint 5 theo `CHECKPOINTS.md`.
- Chưa có cấu hình máy của giảng viên để kiểm chứng lần cuối.
