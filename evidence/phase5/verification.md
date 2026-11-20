# Bằng chứng video Checkpoint 5

- `docs/demo/demo.mp4`: 272,888 giây (4 phút 33 giây), 37.248.626 byte; H.264/AAC, dưới 5 phút và 100 MB. Cảnh chơi được kiểm tra ở giây 170; thẻ bằng chứng ở giây 266.
- Thẻ cuối video lấy số liệu từ `evidence/phase4/test-results.txt`, `bench-run.txt` và `soak-run.txt`. Benchmark là kết quả máy phát triển, chưa xác nhận ngưỡng trên máy giảng viên.
- `headless-demo.jsonl` được tạo bằng lệnh `node dist-cli/headless.js --seed 7 --night 1 --ticks 3 --scenario evidence/phase3/dawn-scenario.json --out evidence/phase5/headless-demo.jsonl`; kết quả `won`, tick 3, điểm 477.
