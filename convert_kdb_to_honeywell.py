"""
Script chuyển đổi dữ liệu từ File Yêu Cầu Chuyển Hàng KDB sang File Tạo Order Honeywell.
Quy tắc ánh xạ (Mapping):
  - Mã đơn gốc (Cột 1 / A)        <- [Nơi nhận (viết tắt)] + "_1" (ví dụ: B001 -> B001_1)
  - Gói dịch vụ (Cột 2 / B)        <- B2C3D
  - Tên người nhận (Cột 3 / C)     <- [Nơi nhận] (ví dụ: KFM_HNI_YHO - CT3 Yên Hoà Park View)
  - Số điện thoại (Cột 4 / D)      <- 0973468464 (Text)
  - Địa chỉ (Cột 5 / E)            <- Rỗng ("")
  - Xã/Phường (Cột 6 / F)          <- Rỗng ("")
  - Quận/Huyện (Cột 7 / G)         <- Rỗng ("")
  - Tỉnh/Thành (Cột 8 / H)         <- Rỗng ("")
  - Mã sản phẩm (Cột 9 / I)        <- [Barcode]
  - Số lượng xuất (Cột 10 / J)     <- [Số lượng cần chuyển] (Nếu <= 0 thì bỏ qua)
  - Mã đối tác VC (Cột 11 / K)     <- GHN
  - Mã vận đơn (Cột 12 / L)        <- Rỗng ("")
  - Gói cước VC (Cột 13 / M)       <- 2
  - Tiền thu hộ (Cột 14 / N)       <- 0
  - Yêu cầu đơn hàng (Cột 15 / O)  <- 1
  - Hình thức thanh toán (Cột 16 / P) <- 3
  - Tên hàng hoá (Cột 17 / Q)      <- [Tên sản phẩm]
  - Các field còn lại (18..21)     <- Rỗng ("")

Sử dụng:
    python convert_kdb_to_honeywell.py [duong_dan_file_kdb] [duong_dan_file_xuat] [duong_dan_file_template]
"""

import sys
import os
import datetime
import openpyxl

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

def find_input_columns(ws_in):
    cols = {
        'barcode': 3,
        'product_name': 4,
        'dest_short': 14,
        'dest_full': 15,
        'qty': 17
    }

    # Header scan (row 1)
    for col in range(1, ws_in.max_column + 1):
        raw = str(ws_in.cell(1, col).value or '').strip().lower()
        if raw in ['barcode', 'mã barcode', 'mã vạch', 'mã sản phẩm', 'mã hàng']:
            cols['barcode'] = col
        elif raw in ['tên sản phẩm', 'ten san pham', 'tên hàng', 'tên hàng hoá', 'ten hang hoa']:
            cols['product_name'] = col
        elif 'nơi nhận' in raw and ('viết tắt' in raw or 'vt' in raw or '(vt)' in raw):
            cols['dest_short'] = col
        elif raw in ['nơi nhận', 'noi nhan', 'tên nơi nhận', 'kho nhận']:
            cols['dest_full'] = col
        elif 'số lượng cần chuyển' in raw or 'sl cần chuyển' in raw or 'so luong can chuyen' in raw or raw == 'số lượng chuyển':
            cols['qty'] = col

    return cols

def convert_kdb_transfer_to_order(
    input_file_path=None,
    template_path=None,
    output_path=None,
    service_type="B2C3D",
    phone="0973468464",
    transporter="GHN",
    shipping_rate=2,
    cod=0,
    order_req=1,
    payment_type=3,
    suffix="_1"
):
    # Determine default paths
    if not input_file_path:
        default_inputs = [
            os.path.join("KDB qua Honeywell", "yeu_cau_chuyen_hang_thuong_10102026-094746.xlsx"),
            "yeu_cau_chuyen_hang.xlsx"
        ]
        for candidate in default_inputs:
            if os.path.exists(candidate):
                input_file_path = candidate
                break

    if not template_path:
        default_tpls = [
            os.path.join("KDB qua Honeywell", "Template import tạo order Honeywell.xlsx"),
            "Template import tạo order Honeywell.xlsx"
        ]
        for candidate in default_tpls:
            if os.path.exists(candidate):
                template_path = candidate
                break

    if not input_file_path or not os.path.exists(input_file_path):
        print(f"Lỗi: Không tìm thấy file KDB '{input_file_path}'")
        return False

    if not template_path or not os.path.exists(template_path):
        print(f"Lỗi: Không tìm thấy file template '{template_path}'")
        return False

    print(f"Đang đọc file yêu cầu chuyển hàng KDB: {input_file_path}...")
    wb_in = openpyxl.load_workbook(input_file_path, data_only=True)
    ws_in = wb_in.active

    col_map = find_input_columns(ws_in)

    print(f"Đang đọc file mẫu tạo order Honeywell: {template_path}...")
    wb_out = openpyxl.load_workbook(template_path)
    ws_out = wb_out.active

    # Xóa các dòng mẫu từ dòng 4 trở đi nếu có
    if ws_out.max_row >= 4:
        ws_out.delete_rows(4, ws_out.max_row - 3)

    out_row = 4
    total_qty = 0
    skipped_zero_count = 0
    unique_orders = set()
    unique_destinations = set()

    for r in range(2, ws_in.max_row + 1):
        barcode_val = ws_in.cell(r, col_map['barcode']).value
        product_name_val = ws_in.cell(r, col_map['product_name']).value
        dest_short_val = ws_in.cell(r, col_map['dest_short']).value
        dest_full_val = ws_in.cell(r, col_map['dest_full']).value
        qty_val = ws_in.cell(r, col_map['qty']).value

        # Bỏ qua nếu cả Barcode và Tên SP đều rỗng
        if barcode_val is None and product_name_val is None:
            continue

        try:
            qty_num = float(qty_val) if qty_val is not None else 0
        except (ValueError, TypeError):
            qty_num = 0

        if qty_num <= 0:
            skipped_zero_count += 1
            continue

        barcode_str = str(barcode_val).strip() if barcode_val is not None else ""
        product_name_str = str(product_name_val).strip() if product_name_val is not None else ""
        dest_short_str = str(dest_short_val).strip() if dest_short_val is not None else ""
        dest_full_str = str(dest_full_val).strip() if dest_full_val is not None else ""

        # Mã đơn gốc: [Nơi nhận (viết tắt)] + suffix (ví dụ B001 -> B001_1)
        order_code = f"{dest_short_str}{suffix}" if dest_short_str else f"ORDER{suffix}"
        unique_orders.add(order_code)
        if dest_full_str:
            unique_destinations.add(dest_full_str)

        final_qty = int(qty_num) if qty_num.is_integer() else qty_num
        total_qty += final_qty

        # Cột 1 (A): Mã đơn gốc *
        ws_out.cell(out_row, 1, order_code)
        # Cột 2 (B): Gói dịch vụ *
        ws_out.cell(out_row, 2, service_type)
        # Cột 3 (C): Tên người nhận *
        ws_out.cell(out_row, 3, dest_full_str)
        # Cột 4 (D): Số điện thoại * (Text '@')
        cell_d = ws_out.cell(out_row, 4, str(phone).strip())
        cell_d.number_format = '@'
        # Cột 5 (E): Địa chỉ (rỗng)
        ws_out.cell(out_row, 5, "")
        # Cột 6 (F): Xã/Phường (rỗng)
        ws_out.cell(out_row, 6, "")
        # Cột 7 (G): Quận/Huyện (rỗng)
        ws_out.cell(out_row, 7, "")
        # Cột 8 (H): Tỉnh/Thành (rỗng)
        ws_out.cell(out_row, 8, "")
        # Cột 9 (I): Mã Sản phẩm * (Text '@')
        cell_i = ws_out.cell(out_row, 9, barcode_str)
        cell_i.number_format = '@'
        # Cột 10 (J): Số lượng Xuất *
        ws_out.cell(out_row, 10, final_qty)
        # Cột 11 (K): Mã đối tác vận chuyển
        ws_out.cell(out_row, 11, transporter)
        # Cột 12 (L): Mã vận đơn (rỗng)
        ws_out.cell(out_row, 12, "")
        # Cột 13 (M): Gói cước vận chuyển*
        ws_out.cell(out_row, 13, shipping_rate)
        # Cột 14 (N): Tiền thu hộ *
        ws_out.cell(out_row, 14, cod)
        # Cột 15 (O): Yêu cầu đơn hàng *
        ws_out.cell(out_row, 15, order_req)
        # Cột 16 (P): Hình thức thanh toán *
        ws_out.cell(out_row, 16, payment_type)
        # Cột 17 (Q): Tên hàng hoá *
        ws_out.cell(out_row, 17, product_name_str)
        # Các cột còn lại (18..21): rỗng
        for c_extra in range(18, 22):
            ws_out.cell(out_row, c_extra, "")

        out_row += 1

    total_converted = out_row - 4
    if total_converted == 0:
        print("Cảnh báo: Không có dòng dữ liệu hợp lệ nào được chuyển đổi.")
        return False

    # Đảm bảo format text cho cột SĐT và Barcode
    ws_out.column_dimensions['D'].number_format = '@'
    ws_out.column_dimensions['I'].number_format = '@'

    if not output_path:
        first_order = list(unique_orders)[0] if unique_orders else "ORDER"
        date_stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = f"order_honeywell_{first_order}_{date_stamp}.xlsx"

    wb_out.save(output_path)
    print("=" * 60)
    print("CHUYỂN ĐỔI ORDER HONEYWELL THÀNH CÔNG!")
    print(f"- Số dòng xuất: {total_converted}")
    print(f"- Đã loại bỏ số dòng có SL <= 0: {skipped_zero_count}")
    print(f"- Mã đơn gốc: {', '.join(sorted(unique_orders))}")
    print(f"- Nơi nhận: {', '.join(sorted(unique_destinations))}")
    print(f"- Tổng số lượng xuất: {total_qty}")
    print(f"- File đã xuất: {output_path}")
    print("=" * 60)
    return True

if __name__ == "__main__":
    in_arg = sys.argv[1] if len(sys.argv) > 1 else None
    out_arg = sys.argv[2] if len(sys.argv) > 2 else None
    tpl_arg = sys.argv[3] if len(sys.argv) > 3 else None
    convert_kdb_transfer_to_order(in_arg, template_path=tpl_arg, output_path=out_arg)
