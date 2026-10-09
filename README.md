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

## Quy Tắc Ánh Xạ Dữ Liệu (10 Cột)
| Cột Nhập Hàng | Tên Trường | Cột Nguồn PO | Ghi Chú |
| :--- | :--- | :--- | :--- |
| **A** | `orderInboundCode` | **B** | Mã PO |
| **B** | `productCode` | **T** | Mã hàng (Barcode) |
| **C** | `expectedQuantity` | **AD** | Số lượng PR thực nhận (Bỏ nếu = 0) |
| **D** | `estimateReceiveTime` | **G** | Ngày NCC xác nhận (`dd/mm/yyyy`) |
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
2. **Chạy script Python:**
   ```bash
   python convert_po.py [duong_dan_file_po] [duong_dan_file_xuat]
   ```
   Ví dụ:
   ```bash
   python convert_po.py PO.xlsx ket_qua_nhap_hang.xlsx
   ```
