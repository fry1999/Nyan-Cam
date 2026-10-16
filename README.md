# Nyan Cam — app iOS / Android

Ứng dụng React Native + Expo + TypeScript, giao diện tiếng Việt tông kem/hồng. Mã app nằm trong `mobile/`; backend Node.js và bản web thử nghiệm trước đó nằm ở thư mục gốc và `public/`.

## Tính năng app native

- Camera trước/sau, flash camera sau, lưới căn khung, hẹn giờ 3/5 giây.
- Bốn bối cảnh với hướng dẫn tạo dáng mẫu, ghi nhãn rõ ràng.
- Ảnh được giữ trong vùng lưu trữ của app qua những lần khởi động. Thư viện để xem, chia sẻ, xóa hoặc xuất ảnh ra thư viện điện thoại. Gỡ app có thể làm mất ảnh chưa xuất.
- AI nhận xét ánh sáng/bố cục từ **ảnh gần nhất đã chụp**, sau khi người dùng xác nhận. Không gửi luồng camera liên tục. Ảnh được thu nhỏ trước khi gửi, khóa OpenAI chỉ nằm ở backend.
- Màn hình cài đặt để nhập địa chỉ backend; camera và thư viện không cần backend hoặc khóa AI.

Chưa có bộ lọc native, làm đẹp, tự chọn ảnh đẹp, tài khoản hoặc đồng bộ đám mây. Bộ lọc của bản web cũ chưa được chuyển sang native.

## Chạy trên điện thoại

Yêu cầu Node.js **24.3+ (nhánh 24 LTS)**, npm và Expo Go tương thích **Expo SDK 58**. Dùng phiên bản Node 24 LTS hiện hành đáp ứng yêu cầu này. Nếu Expo Go trên thiết bị không hỗ trợ SDK này, dùng development build tương ứng.

```sh
cd mobile
npm ci
npm start
```

Quét QR bằng Expo Go trên Android hoặc Camera/Expo Go trên iPhone. Máy chạy Metro và điện thoại cần kết nối được với nhau (thường cùng Wi-Fi). Cấp quyền camera khi được hỏi. Một môi trường cloud không truy cập được từ điện thoại sẽ cần kết nối mạng/tunnel phù hợp; không mặc định QR của cloud có thể dùng trực tiếp.

- Android emulator đã cấu hình: `npm run android`.
- iOS simulator: `npm run ios` trên **macOS có Xcode**.
- App chỉ yêu cầu quyền lưu thư viện khi bạn chọn lưu ảnh. Không yêu cầu microphone.

## Backend AI (không bắt buộc để chụp ảnh)

Chạy ở thư mục gốc repo:

```sh
cp .env.example .env
# Điền NYAN_AI_API_KEY trong .env trên máy chủ, không commit khóa.
npm start
```

Mặc định cổng 3000, model `gpt-4.1-mini`; đổi bằng `PORT` / `NYAN_AI_MODEL`. Backend cần HTTPS egress đến `api.openai.com` và hạn mức API. Không cần cài dependency cho backend.

Trong app, mở **⚙**, nhập URL backend và chọn **Lưu & kiểm tra kết nối**:

- Điện thoại thật: địa chỉ LAN của máy chạy backend, ví dụ `http://192.168.1.10:3000` khi cùng Wi-Fi. `localhost` trên điện thoại là chính điện thoại đó.
- Android emulator mặc định: `http://10.0.2.2:3000`.
- iOS simulator trên cùng Mac: `http://localhost:3000`.
- Bản phát hành yêu cầu backend **HTTPS**. HTTP chỉ được app cho phép ở chế độ development; chính sách mạng hệ điều hành cũng phải cho phép.

Có thể đặt URL mặc định bằng `mobile/.env`, theo `mobile/.env.example`, rồi khởi động lại Metro. Biến `EXPO_PUBLIC_API_URL` được đóng gói công khai vào app: **không bao giờ đặt khóa OpenAI trong biến EXPO_PUBLIC_**. URL lưu trong cài đặt app được ưu tiên.

Backend không ghi ảnh ra đĩa. Dữ liệu gửi tới OpenAI chịu chính sách của nhà cung cấp. Endpoint AI hiện dành cho phát triển riêng; trước khi công khai cần xác thực người dùng, hạn mức và kiểm soát chi phí. Không công khai máy chủ có khóa chỉ dựa vào giới hạn yêu cầu đồng thời hiện tại.

## Kiểm tra

Từ thư mục gốc:

```sh
npm test
cd mobile
npm run typecheck
npm run export:check
```

`npm test` ở gốc chạy cả test backend và test client API mobile (9 bài). Các test AI mô phỏng phản hồi nhà cung cấp, không gọi AI trả phí. `export:check` tạo bundle JavaScript/Hermes cho iOS và Android; **không phải APK/IPA hoặc kiểm thử trên thiết bị**.

Đã kiểm tra trong cloud: TypeScript, 9 test, Expo native config và xuất bundle iOS/Android. Chưa kiểm tra camera/quyền thư viện trên thiết bị thật và chưa gọi AI thật do chưa cấu hình khóa.

Checklist trên điện thoại trước phát hành:

1. Cho phép/từ chối quyền camera; đổi camera, flash, lưới, hẹn giờ.
2. Chụp, mở lại app để kiểm tra giữ ảnh; lưu thư viện, chia sẻ, xóa khỏi app.
3. Đưa app ra nền khi đếm giờ để xác nhận hủy chụp và camera hoạt động lại.
4. Kết nối backend; thử thiếu khóa, mất mạng, đồng ý/hủy gửi ảnh AI.

## Tạo bản cài đặt

`mobile/eas.json` có profile `development`, `preview` và `production`. Từ thư mục `mobile`, sau khi cấu hình tài khoản Expo/EAS, project và thông tin ký:

```sh
npx eas-cli build --platform android --profile preview
# APK thử nghiệm; iOS cần Apple Developer và provisioning phù hợp.
```

Chưa chạy EAS Build, chưa tạo APK/IPA và chưa phát hành lên cửa hàng. Bundle identifier `com.nyancam.app` và icon hiện tại là cấu hình phát triển; cần xác nhận định danh sở hữu và thay icon trước khi phát hành.
