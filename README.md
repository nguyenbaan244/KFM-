# Công Cụ Chuyển Đổi Dữ Liệu PO Sang File Nhập Hàng

Ứng dụng web tĩnh và script Python giúp tự động chuyển đổi dữ liệu từ File PO (Purchase Order) sang biểu mẫu File Nhập Hàng theo định dạng chuẩn.

## Tính Năng Chính
1. **Tab 1 - Convert template KDB -> Honeywell:**
   - Tự động chuyển đổi dữ liệu file PO (10 cột) sang file Nhập hàng chuẩn.
   - Bỏ qua các dòng có số lượng thực nhận (cột AD) <= 0.
   - Hỗ trợ tải dữ liệu mẫu, xem trước bảng dữ liệu và tải file Excel hoàn chỉnh.

2. **Tab 2 - Check tồn KDB và Honeywell:**
   - Đối soát số lượng tồn kho theo SKU giữa hệ thống Honeywell (`Total Quantity`) và KDB (`Tồn cuối kỳ`).
   - Phân tích chi tiết các trạng thái: Khớp hoàn toàn, Lệch số lượng, Chỉ có ở KDB, Chỉ có ở Honeywell.
   - Bộ lọc thông minh theo danh mục lệch và ô tìm kiếm nhanh theo SKU/Barcode.
   - Xuất báo cáo đối soát chênh lệch chi tiết dạng Excel (.xlsx).
   - Đi kèm script dòng lệnh `check_inventory.py` cho tự động hóa.

3. **Tab 3 - Check vị trí tồn Honeywell:**
   - Kiểm tra định dạng vị trí lưu kho chuẩn `XX-YYY-Z`.
   - Báo cáo SKU ở vị trí chuẩn, chưa vào chuẩn, hoặc không có vị trí.
   - Script dòng lệnh: `check_honeywell_location.py`.

4. **Tab 4 - Convert đơn hàng KDB -> Honeywell (Tạo Order):**
   - Chuyển đổi dữ liệu yêu cầu chuyển hàng từ KDB sang file Excel tạo order Honeywell 21 cột chuẩn.
   - Quy tắc:
     - `Mã đơn gốc`: `[Nơi nhận (viết tắt)]` + `_` + `ddmmyyyy` ngày hiện tại (ví dụ `B001` &rarr; `B001_10102026`).
     - `Gói dịch vụ`: `B2C3D`.
     - `Tên người nhận`: `[Nơi nhận (viết tắt)]` - Cột N (ví dụ `B001`).
     - `Số điện thoại`: `0973468464` (Text).
     - `Địa chỉ`: `[Nơi nhận]` - Cột O (ví dụ `KFM_HNI_YHO - CT3 Yên Hoà Park View`).
     - `Mã sản phẩm`: `[Barcode]` (Cột C).
     - `Số lượng xuất`: `[Số lượng cần chuyển]` (Cột Q).
     - `Mã đối tác VC`: `GHN`, `Gói cước`: `2`, `COD`: `0`, `Yêu cầu`: `1`, `Thanh toán`: `3`.
     - `Tên hàng hoá`: `[Tên sản phẩm]` (Cột D).
     - `Cột S (Link bill sàn TMĐT)`: `[Mã yêu cầu]` - Cột B.
     - Các trường còn lại (6, 7, 8, 12, 18, 20, 21) để trống.
   - Đi kèm script dòng lệnh: `convert_kdb_to_honeywell.py`.

## Quy Tắc Ánh Xạ Dữ Liệu PO (10 Cột)
| Cột Nhập Hàng | Tên Trường | Cột Nguồn PO | Ghi Chú |
| :--- | :--- | :--- | :--- |
| **A** | `orderInboundCode` | **B** | Mã PO |
| **B** | `productCode` | **T** | Mã hàng (Barcode) |
| **C** | `expectedQuantity` | **AD** | Số lượng PR thực nhận (Bỏ nếu = 0) |
| **D** | `estimateReceiveTime` | **G** | Ngày NCC xác nhận (Kiểu Text, nếu < Today thì lấy Today) |
| **E** | `customerNote` | - | Để trống |
| **F** | `zoneType` | - | Điền `B2B` |
| **G** | `supplier` | **K** | Tên nhà cung cấp |
| **H** | `productionDate` | **X** | Ngày sản xuất (`dd/mm/yyyy`) |
| **I** | `expiryDate` | **Y** | Hạn sử dụng (`dd/mm/yyyy`) |
| **J** | `inboundDate` | - | Ngày hiện tại (`dd/mm/yyyy`) |

## Cách Sử Dụng Cục Bộ
1. **Chạy giao diện Web:** Click đúp vào file `Chay_Giao_Dien.bat` hoặc chạy:
   ```bash
   python server.py
   ```
2. **Chạy script Python chuyển PO:**
   ```bash
   python convert_po.py [duong_dan_file_po] [duong_dan_file_xuat]
   ```
3. **Chạy script Python tạo Order Honeywell:**
   ```bash
   python convert_kdb_to_honeywell.py [duong_dan_file_kdb] [duong_dan_file_xuat]
   ```

