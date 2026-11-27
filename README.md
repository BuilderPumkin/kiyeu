# Thiệp Mời Lễ Kỷ Yếu K28 — Catch The Memory

Website thiệp mời Lễ Kỷ Yếu tương tác 3D của **Ngô Quang Thành Hưng (A3K28)** — **Trường THPT Phan Huy Chú - Đống Đa** (**Chủ Nhật, 27/12/2026 · 08:30 — 11:30**), xây dựng bằng **Three.js**, **GSAP**, **Web Audio API**, **HTML/CSS** và dữ liệu **JSON**.

## Địa chỉ xuất bản (GitHub Pages)

- **URL công khai:** https://builderpumkin.github.io/kiyeu/
- **Link vào thẳng thông tin thiệp & bản đồ:** https://builderpumkin.github.io/kiyeu/?direct=1
- **Repository:** https://github.com/BuilderPumkin/kiyeu

## Tính năng nâng cao đã tích hợp

- **Phim mở đầu 3D + Dải Möbius sợi chỉ 7s dạo đầu:** Chuyển cảnh từ thiên hà xoay, Kars & phiến đá cổ sang dải Möbius nằm ngang mảnh gọn (`0.42`).
- **Lối tắt cho khách quay lại & Deep Link `?direct=1`:** Lần mở đầu tiên trải nghiệm trọn vẹn intro; từ lần quay lại thứ 2 trên cùng trình duyệt, nút **"Vào thẳng thông tin thiệp & bản đồ"** tự hiện dưới màn hình cổng sao (hoặc dùng trực tiếp `?direct=1`).
- **Tối ưu hiệu năng & Pin:** Hỗ trợ `<picture>` WebP cho ảnh phân dạng (`36.6 KB`), giới hạn DPR hợp lý trên di động (`≤ 1.5`), tự động kích hoạt chế độ đồ họa nhẹ (`LowPerf`) nếu FPS thực tế giảm dưới `24`, và tự tạm dừng WebGL khi chuyển tab.
- **Chia sẻ & Lịch:** Ảnh bìa Open Graph `1200×630` ([`og-cover.png`](./public/images/og-cover.png)), nút **"Sao chép link mời"**, Google Maps và Google Calendar đồng bộ khung giờ `08:30 — 11:30`.
- **RSVP & Sổ lưu bút dùng chung:** Sẵn sàng đồng bộ hai chiều với Google Sheet qua [`scripts/google-apps-script-rsvp.gs`](./scripts/google-apps-script-rsvp.gs).

## Bật GitHub Pages (1 lần duy nhất)

1. Mở https://github.com/BuilderPumkin/kiyeu/settings/pages
2. Tại **Build and deployment → Source**, chọn **GitHub Actions**.
3. Workflow [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) sẽ tự build `dist/` và triển khai lên GitHub Pages sau mỗi lần push lên `main`.

## Thu thập RSVP thật qua Google Sheet (tùy chọn 2 phút)

1. Tạo một Google Sheet mới.
2. Mở **Extensions → Apps Script**, dán nội dung tệp [`scripts/google-apps-script-rsvp.gs`](./scripts/google-apps-script-rsvp.gs).
3. Chọn **Deploy → New deployment → Web app** (*Execute as: Me*, *Who has access: Anyone*) và sao chép Web App URL.
4. Dán URL vừa nhận vào trường `"webhookUrl"` trong [`public/data/invitation.json`](./public/data/invitation.json) rồi push lên `main`. Khi chạy thực tế, cả gửi RSVP (`POST`) lẫn tải Sổ lưu bút chung (`GET`) sẽ tự động đồng bộ.

## Chạy và đóng gói cục bộ

```bash
npm install
npm run dev      # Chạy chế độ phát triển tại http://localhost:5175
npm run build    # Đóng gói bản sản xuất vào thư mục dist/
npm run preview  # Xem trước bản build
```
