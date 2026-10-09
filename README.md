# Công Cụ Chuyển Đổi Dữ Liệu PO Sang File Nhập Hàng

Ứng dụng web tĩnh và script Python giúp tự động chuyển đổi dữ liệu từ File PO (Purchase Order) sang biểu mẫu File Nhập Hàng theo định dạng chuẩn.

## Tính Năng Chính
- **Xử lý trực tiếp trên trình duyệt (Web App):** Kéo thả file PO vào giao diện để xem trước bảng dữ liệu và tải về file Excel thành phẩm.
- **Script dòng lệnh Python (`convert_po.py`):** Dành cho việc xử lý hàng loạt hoặc tự động hóa.
- **Tự động lọc dòng không hợp lệ:** Loại bỏ các dòng có số lượng thực nhận (cột AD) <= 0.
- **Sẵn sàng triển khai:** Có thể deploy ngay lên Vercel, Netlify hoặc GitHub Pages dưới dạng web tĩnh.

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
