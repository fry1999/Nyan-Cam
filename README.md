# Nyan Cam

Ứng dụng camera web tiếng Việt: chọn mood, gợi ý tạo dáng mẫu, camera trước/sau, lưới, hẹn giờ 3/5 giây, bốn bộ lọc và tải ảnh JPEG. Giao diện responsive cho điện thoại và desktop. Không cần cài dependency.

## Chạy

Node.js 22+ (đã kiểm tra với Node 24).

```sh
cd /workspace/Nyan-Cam
npm start
```

Mặc định cổng 3000. Camera cần HTTPS khi truy cập từ điện thoại hoặc máy khác; localhost được trình duyệt cho phép. Cho phép quyền camera khi mở app. Dùng `npm run dev` để tự khởi động lại server khi sửa file, `npm test` để kiểm tra HTTP/API.

## Bật AI thật

Sao chép `.env.example` thành `.env` và cấu hình `NYAN_AI_API_KEY` bằng khóa OpenAI riêng trên máy chủ (không commit hoặc gửi khóa qua chat). Có thể đổi `NYAN_AI_MODEL`, mặc định `gpt-4.1-mini`. Khởi động lại server. Máy chủ cần truy cập HTTPS đến `api.openai.com`; API có tính phí.

AI chỉ nhận một khung hình khi người dùng bấm phân tích và xác nhận. Ảnh được thu nhỏ trước khi gửi. Server không lưu ảnh và không gửi khóa về trình duyệt. Khi chưa có khóa, giao diện ghi rõ gợi ý mẫu. Bộ lọc là xử lý màu trên thiết bị, không phải chỉnh ảnh bằng AI.

Ảnh chụp giữ trong bộ nhớ tab (tối đa 12 ảnh), mất khi tải lại/đóng trang. Tải về để lưu. Chưa có tài khoản, lưu trữ đám mây, tự chọn ảnh đẹp, phân tích liên tục hay chỉnh ảnh bằng câu lệnh.

Đây là MVP phát triển cục bộ. Trước khi đưa API công khai cần thêm xác thực, hạn mức theo người dùng và giám sát chi phí. Hiện server giới hạn kích thước yêu cầu, thời gian chờ và một yêu cầu AI đồng thời mỗi địa chỉ kết nối; chưa phải cơ chế chống lạm dụng đầy đủ.
