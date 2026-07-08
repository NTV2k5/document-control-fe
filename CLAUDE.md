# GDU Document Control - Hướng dẫn dự án & Quy chuẩn thiết kế (FE)

Tài liệu này ghi nhận toàn bộ ngữ cảnh dự án, các thay đổi giao diện chính đã thực hiện để bám sát Figma, cùng các quy tắc phát triển, cấu trúc thư mục, quy chuẩn code bắt buộc phải tuân thủ khi phát triển Frontend cho dự án `document-control` (ReactJS).

---

## 📌 Tổng quan dự án & Ngữ cảnh (Context)
Dự án được chuyển đổi từ một phiên bản chạy NextJS sang dự án chạy ReactJS hoàn chỉnh.
- **Trang Overview (Tổng quan)** và các trang con khác cần bám sát thiết kế Figma **giống 100%**.
- Giao diện sử dụng hệ màu hiện đại, tối ưu hóa kích thước hiển thị để tránh tình trạng bị cắt khuất nội dung, hỗ trợ hiển thị tốt trên các thiết bị.

---

## 🛠️ Quy chuẩn code & Quy tắc phát triển (Từ AGENTS.md)

### 1. Nguyên tắc cốt lõi
- **Suy nghĩ trước khi code**: Hiểu rõ yêu cầu trước khi chỉnh sửa. Ưu tiên giải pháp sạch sẽ và có tính kiến trúc tốt thay vì chỉ vá lỗi triệu chứng.
- **Đơn giản là trên hết**: Tránh tạo các lớp trừu tượng, wrapper hoặc helper không cần thiết.
- **Chỉnh sửa chính xác (Surgical Changes)**: Chỉ thay đổi code liên quan trực tiếp đến kết quả mong muốn. Không trộn lẫn dọn dẹp code không liên quan.
- **Xác thực trước khi hoàn thành**: Luôn chạy kiểm tra trước khi báo cáo hoàn thành:
  ```bash
  yarn typecheck     # hoặc tsc --noEmit
  yarn lint:eslint   # lint code
  ```

### 2. Cấu trúc thư mục dự án
- `src/routes`: Chỉ chứa khai báo các tuyến đường (route). Giữ các file này thật mỏng.
- `src/pages`: Chứa page-level UI hoặc page wrapper.
- `src/sections`: Chứa các phần UI lớn cỡ màn hình (screen-sized business UI sections).
- `src/components`: Chứa các component có thể tái sử dụng.
- `src/api`: Chứa các module gọi API.
- `src/lib`: Chứa các hàm hỗ trợ chung, logic editor, tiện ích cụ thể của app.
- `src/models`: Định nghĩa các model/type dùng chung.
- `src/stores`: Quản lý trạng thái (state/store).
- `reactjs-platform/ui` & `reactjs-platform/utilities`: Thư viện dùng chung từ nền tảng.

### 3. Quy chuẩn đặt tên Folders & Files
- Sử dụng chữ thường ngăn cách bằng dấu gạch ngang (kebab-case) cho toàn bộ folder và tên file.
- Không đặt tên file dạng camelCase hay trộn lẫn nhiều phong cách trong cùng một module.
- Các hậu tố bắt buộc:
  - `*.page.tsx`: Component trang
  - `*.section.tsx`: Component phần lớn
  - `*.component.tsx`: Component tái sử dụng
  - `*.store.ts`: Store trạng thái
  - `*.type.ts`: Types/interfaces của module
  - `*.api.ts`: Module gọi API
  - `index.ts`: Chỉ chứa xuất khẩu (barrel exports). Không được viết xuất khẩu bị lỗi kiểu `export * from '.'`.

### 4. Quy tắc Export & Import
- **Không sử dụng `export default`** cho trang hoặc phần giao diện (page/section). Luôn luôn dùng **Named Export**.
- Sử dụng import tương đối thông thường bên trong `src`. Không sử dụng `@/...` imports.
- Chỉ dùng các alias được cấu hình sẵn như `api`, `reactjs-platform/ui`, `reactjs-platform/utilities`.
- Ưu tiên nén import qua các file barrel hiện có.

### 5. Đặt tên Types/Interfaces
- Sử dụng tiền tố viết hoa để phân biệt:
  - `I`: cho Interfaces (ví dụ: `IUserProfile`)
  - `T`: cho Type Aliases (ví dụ: `TPartner`)
  - `E`: cho Enums (ví dụ: `EDocumentStatus`)

---

## 🎨 Quy chuẩn Thiết kế bắt buộc & Các phần đã hoàn thành

### 1. Sidebar (Thanh điều hướng bên trái)
- **Kích thước**: Rộng `w-64` (256px) khi mở rộng và `w-[72px]` khi thu gọn.
- **Logo**: 
  - Sử dụng icon `Landmark` màu xanh làm chủ đạo đặt trong vòng tròn đổ bóng blur nhẹ (`shadow-[0_4px_12px_rgba(37,99,235,0.35)]`).
  - Dòng chữ **"Document Control"** và badge **"ADMIN"** phải hiển thị ngang hàng, không bị rớt dòng nhờ thuộc tính `whitespace-nowrap` trên một cỡ chữ phù hợp (`text-[14px]`).
- **Menu Items**:
  - Icons và nhãn tương ứng: Overview (`LayoutDashboard`), Published Documents (`FileText`), University Hubs (`Network`), My Hubs (`FolderGit2`), Tickets (`Ticket`).
  - Font size của các mục đạt `text-[12.5px] font-bold` để đảm bảo nhãn dài như **"Published Documents"** được hiển thị đầy đủ không bị cắt hoặc có dấu `...`.
  - Padding trong expanded mode thu hẹp thành `px-3 py-2.5 gap-3` để tạo khoảng trống cho văn bản.
  - Trạng thái kích hoạt (Active State): Sử dụng nền xanh đậm (`bg-blue-600`), chữ trắng, bo tròn đầy đủ (`rounded-full`) và có hiệu ứng bóng đổ mờ (`shadow-[0_8px_16px_rgba(37,99,235,0.25)]`).

### 2. Header (Thanh đầu trang)
- **Thanh tìm kiếm (Search Bar)**: Chiều ngang giãn rộng tự do (`flex-1 max-w-none`) để cân xứng với danh sách hashtag trending nằm phía dưới.
- **Hashtag Trending**: Nằm cố định ngay dưới thanh tìm kiếm trong Header, không bị cuộn đi khi lăn chuột.
- **Chuyển đổi ngôn ngữ**: Interactive Language Toggle trực quan và mượt mà.

### 3. Banner Overview & Glassmorphic Card
- Cụm chữ chính trong banner:
  - `GDU Portal` (Dòng 1)
  - `Document Control` (Dòng 2 - màu cyan với class `whitespace-nowrap`)
- Khung kính mờ (Glassmorphic Card) bao quanh chữ có kích thước giới hạn tối đa `md:max-w-[480px]` để chứa trọn vẹn văn bản không bị tràn/đè qua viền card.

### 4. Recently Interacted Cards
- **Kích thước**: Chiều rộng thu gọn thành `w-[190px] min-w-[190px]` giúp hiển thị hàng ngang gọn gàng.
- **Badge loại file**: Đặt ở góc trên bên trái, văn bản bên trong (WORD, EXCEL, PDF...) viết hoa và có màu đen/xám đậm (`text-slate-800`).
- **Icon file**: Đặt bên trong vùng nền màu nhạt của card, nằm ngay dưới badge loại file. Icon được thiết kế trong một khung vuông màu trắng bo góc có đổ bóng mượt.
- **Avatars**: Chứa nhóm ảnh đại diện của người dùng tương tác (`https://i.pravatar.cc/...`) xếp chồng nhẹ lên nhau ở góc dưới bên phải.

### 5. AI Chatbot Widget
- Cấu hình một nút nổi chatbot AI (`fixed bottom-6 right-6 z-50`) hình vuông bo góc vừa phải (`rounded-2xl`) màu xanh đậm (`bg-blue-600`) chứa icon robot (`Bot`), hiển thị ở mọi trang thông qua `MainLayout`.

### 6. Đồng nhất kích thước tiêu đề chính
- Tiêu đề trang **Overview** và tiêu đề trang **Published Documents** phải có cùng một kích thước và màu sắc đồng bộ: `text-3xl font-bold text-slate-900`.
- Các bảng thống kê (Report Stat Cards) trong trang Published Documents sử dụng cỡ chữ số liệu `text-2xl` để cân bằng với Overview.

---

## 🚀 Quy trình Git Workflow bắt buộc
Mọi thay đổi, tính năng mới hoặc sửa lỗi đều phải tuân thủ nghiêm ngặt quy trình làm việc sau:
1. Tạo một nhánh mới từ `main` với tên mô tả rõ ràng (ví dụ: `feat/ui-figma-alignment-v7`, `fix/sidebar-profile-store`).
2. Thực hiện các chỉnh sửa cục bộ, chạy kiểm tra kiểu dữ liệu (`yarn typecheck`).
3. Commit mã nguồn với thông điệp rõ ràng theo chuẩn Conventional Commits.
4. Merge nhánh tính năng vào nhánh `main` sử dụng cờ `--no-ff` để giữ vết lịch sử commit rõ ràng:
   ```bash
   git checkout main
   git merge <ten-nhanh-rieng> --no-ff -m "merge: <mo-ta-merge>"
   ```
5. Đảm bảo chạy lại kiểm tra tổng thể trên nhánh `main` trước khi đẩy lên remote repository.
