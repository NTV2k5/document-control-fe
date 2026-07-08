# CLAUDE.md - Hướng Dẫn & Nhật Ký Phát Triển Dự Án Document Control

Tài liệu này tổng hợp toàn bộ ngữ cảnh (context), những gì đã làm, quy chuẩn thiết kế, cấu trúc thư mục, quy tắc viết code và quy trình làm việc (workflow) bắt buộc phải tuân thủ khi phát triển dự án **GDU Document Control React Frontend**.

---

## 1. Ngữ Cảnh Dự Án (Project Context)
Dự án được chuyển đổi từ một phiên bản Next.js có sẵn sang nền tảng **React.js** sử dụng **Vite** làm build tool và **TailwindCSS** để tùy chỉnh giao diện. Mục tiêu tối thượng của dự án là **đảm bảo giao diện bám sát thiết kế Figma 100%**, đồng thời duy trì tính tương tác mượt mà và tối ưu hóa trải nghiệm người dùng (UX).

---

## 2. Những Thay Đổi & Tính Năng Đã Hoàn Thành (Overview of Done)

### 🔀 Quy Trình Git & Quản Lý Nhánh (Git Workflow)
- Luôn tạo nhánh riêng cho từng tính năng hoặc bản sửa lỗi theo cấu trúc: `feat/ui-figma-alignment-v[x]` hoặc `fix/[feature-name]`.
- Cam kết commit sạch và thực hiện merge không tua nhanh (`--no-ff`) vào nhánh `main` kèm theo thông điệp merge rõ ràng.

### 🏛️ Hệ Thống Sidebar (Thanh Điều Hướng Bên Trái)
- **Logo Area**: Đổi biểu tượng chiếc khiên thành hình tròn có icon `Landmark` màu xanh dương với hiệu ứng bóng mờ mịn (`shadow-[0_4px_12px_rgba(37,99,235,0.35)]`).
- **Logo Text**: Dòng chữ `"Document Control"` được đặt ngang hàng trên cùng một dòng (`whitespace-nowrap`), đi kèm badge `"ADMIN"` màu xanh ở ngay phía dưới.
- **Nav Items**: Cập nhật biểu tượng và nhãn tương ứng 100% thiết kế Figma (`LayoutDashboard` -> Overview, `FileText` -> Published Documents, `FolderGit2` -> University Hubs, `Folders` -> My Hubs, `Ticket` -> Tickets...).
- **Cỡ chữ & Layout**: Giảm kích cỡ font chữ của các mục điều hướng xuống `12.5px`, khoảng cách `gap-3`, lề `px-3` để hiển thị trọn vẹn nhãn `"Published Documents"` mà không bị cắt hoặc hiện dấu ba chấm (`...`).
- **Mục được chọn (Active Item)**: Bo tròn toàn bộ (`rounded-full`), nền màu xanh dương `bg-blue-600` với hiệu ứng bóng sáng nhẹ (`shadow-[0_8px_16px_rgba(37,99,235,0.25)]`). Loại bỏ khung nền icon khi sidebar ở chế độ mở rộng để nhìn thanh thoát hơn.

### 🔍 Thanh Tìm Kiếm & Hashtag Trending (Header)
- **Thanh tìm kiếm**: Độ rộng được kéo giãn tối đa (`flex-1`) để cân đối và tương quan với độ dài của hàng hashtag bên dưới.
- **Hashtag Trending**: Di chuyển cố định ngay bên dưới thanh tìm kiếm trong component `Header` thay vì nằm trong nội dung trang, giúp cố định vị trí khi cuộn trang.
- **Nút chuyển đổi ngôn ngữ**: Thiết kế tương tác giống mẫu Figma.

### 🏠 Trang Chủ Overview & Các Sub-components
- **Overview Title**: Có cỡ chữ lớn `text-3xl font-bold text-slate-900` đồng bộ hoàn toàn với trang Published Documents.
- **OverviewBanner**:
  - Dòng chữ `"Document Control"` được căn chỉnh nằm ngang hàng trên dòng thứ hai (sử dụng `whitespace-nowrap` trên thẻ span của nó).
  - Tăng chiều rộng của hộp kính mờ (Glassmorphic Card) lên tối đa `420px -> 480px` để bao bọc hoàn hảo chữ `"Document Control"`, không cho chữ chạm mép hoặc tràn ra ngoài card.
  - Các nút *"Get Started"* và *"AI Assist"* đã được cấu hình định tuyến thông qua `useNavigate`.
- **Recently Interacted**:
  - **Thu gọn card**: Giảm chiều rộng mỗi card từ `240px` xuống `190px` giúp hiển thị nhiều card hơn trên hàng ngang.
  - **Vị trí Icon loại File**: Đặt gọn gàng bên trong vùng nền màu phía trên, nằm ngay dưới badge loại tài liệu (không còn lơ lửng chia đôi card).
  - **Màu chữ Badge**: Các chữ tiêu đề định dạng (`WORD`, `EXCEL`, `PDF`...) được đưa về màu đen/xám đậm mặc định (`text-slate-800`), chỉ có icon file và nền của vùng chứa là có màu tương ứng.
  - **Tương tác**: Thay thế nút gạt toggle thành danh sách avatar người dùng xếp chồng lên nhau ở footer để đúng với thiết kế, hỗ trợ cuộn ngang mượt mà.
- **Quick Access**: Từng thẻ card liên kết điều hướng bằng `useNavigate`, hiệu ứng hover mượt mà, thẻ *"Need Help"* kích hoạt biểu mẫu mở Ticket.
- **AI Chatbot Button**: Nút chatbot nổi cố định ở góc dưới cùng bên phải (`fixed bottom-6 right-6 z-50`) trên mọi trang. Thiết kế là một hình vuông bo góc vừa phải (`rounded-2xl`) màu xanh dương, chứa icon robot.

---

## 3. Quy Định Thiết Kế Bắt Buộc Tuân Theo (Figma UI & Design Rules)

1. **Aesthetics & Colors**: Tuyệt đối không dùng các màu cơ bản (plain red, plain blue). Phải dùng bảng màu hiện đại phối hợp HSL hoặc hex cụ thể (như màu xanh thương hiệu `#1d4ed8` / `bg-blue-600`).
2. **Typography**: Đồng nhất kích thước và màu sắc tiêu đề chính giữa các trang (Ví dụ: `Overview` và `Published Documents` đều là `text-3xl font-bold text-slate-900`).
3. **No Placeholders**: Nếu cần hiển thị ảnh minh họa hoặc avatar, sử dụng API mock thực tế (ví dụ: `https://i.pravatar.cc/` cho avatar) chứ không dùng ảnh lỗi hay khung trống.
4. **Responsive Layouts**: Đảm bảo khoảng cách lề hai bên luôn cân đối (`max-w-screen-2xl mx-auto px-6 py-6`), không dính sát viền màn hình máy tính.

---

## 4. Nguyên Tắc Viết Code (Coding Conventions)

### Cấu Trúc File & Thư Mục
Tuân thủ quy tắc đặt tên **lowercase kebab-case** (không dùng camelCase cho file/thư mục). Sử dụng các hậu tố bắt buộc sau:
- `*.page.tsx`: Component trang.
- `*.section.tsx`: Phân đoạn giao diện nghiệp vụ lớn.
- `*.component.tsx`: Component tái sử dụng.
- `*.store.ts`: File quản lý trạng thái (Zustand/Store).
- `*.type.ts`: File chứa các interface/type của module.
- `index.ts`: Chỉ chứa lệnh export (barrel export).

**Cấu trúc thư mục chuẩn của một module:**
```txt
folder-name/
  folder-name.component.tsx (hoặc .section.tsx, .page.tsx)
  folder-name.type.ts
  index.ts
```

### Quy Tắc Import / Export
- **Không dùng `export default`** cho các trang hoặc phân đoạn giao diện. Luôn dùng Named Export (ví dụ: `export const HomePage = ...`).
- **Không viết barrel hỏng** như `export * from '.'`. Barrel file phải export tường minh các file con (ví dụ: `export * from './home.page'`).
- **Import tối giản**: Ưu tiên import từ các barrel file có sẵn của platform layer hoặc components.
- Không tự ý đưa các đường dẫn tắt mới như `@/...` mà dùng import tương đối chuẩn hoặc platform alias (`reactjs-platform/ui`, `reactjs-platform/utilities`, `api`).

### Đặt Tên Kiểu Dữ Liệu (Types)
- Interface bắt đầu bằng chữ `I` (Ví dụ: `IHomeSectionProps`).
- Type alias bắt đầu bằng chữ `T` (Ví dụ: `TVariableKey`).
- Enum bắt đầu bằng chữ `E` (Ví dụ: `EDocumentStatus`).

---

## 5. Quy Trình Xác Thực & Dọn Dẹp (Verification Workflow)

Mỗi khi chỉnh sửa xong code, trước khi tạo commit, **bắt buộc** phải chạy lệnh kiểm tra TypeScript và Build để đảm bảo dự án không phát sinh lỗi biên dịch:
```bash
yarn typecheck
```
*(Lệnh này tương đương với chạy file script `./scripts/with-project-node.sh tsc --noEmit`)*
