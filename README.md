# Thiệp Mời Lễ Kỷ Yếu K28 — Catch The Memory

Website thiệp mời Lễ Kỷ Yếu tương tác 3D của **Ngô Quang Thành Hưng (A3K28)** — **Trường THPT Phan Huy Chú - Đống Đa**, xây dựng bằng **Three.js**, **GSAP**, **Web Audio API**, **HTML/CSS** và dữ liệu **JSON**.

## Địa chỉ xuất bản (GitHub Pages)

- **URL công khai:** https://builderpumkin.github.io/kiyeu/
- **Repository:** https://github.com/BuilderPumkin/kiyeu

## Bật GitHub Pages (1 lần duy nhất)

1. Mở repo trên GitHub → chọn tab **Settings**.
2. Vào mục **Pages** ở thanh bên trái.
3. Trong phần **Build and deployment → Source**, chọn **GitHub Actions**.
4. Mỗi lần push lên nhánh `main`, workflow [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) sẽ tự động cài đặt, build `dist/` và triển khai trang web.

## Chạy và đóng gói cục bộ

```bash
npm install
npm run dev      # Chạy chế độ phát triển tại http://localhost:5175
npm run build    # Đóng gói bản sản xuất vào thư mục dist/
npm run preview  # Xem trước bản build
```

## Cấu hình thu thập RSVP thực tế

Mặc định form **Xác nhận tham dự (RSVP)** lưu dữ liệu trên `localStorage` của trình duyệt người dùng. Để nhận danh sách khách mời tập trung (qua Google Apps Script, Formspree, Make/Webhook…), hãy dán URL endpoint POST JSON vào trường `"webhookUrl"` trong tệp [`public/data/invitation.json`](./public/data/invitation.json):

```json
"rsvp": {
  "webhookUrl": "https://your-webhook-endpoint.example.com"
}
```
