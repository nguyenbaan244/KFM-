"""
Script chuyển đổi dữ liệu từ File Outbound Honeywell sang File Phiếu Chuyển KDB (Template PT KDB).

Quy tắc ánh xạ (Mapping):
  - Tên viết tắt nơi chuyển (Cột 1 / A) <- Cố định: FGB10101
  - Tên viết tắt nơi nhận   (Cột 2 / B) <- Store Sub Code (Cột AE trong file Honeywell)
  - Barcode                 (Cột 3 / C) <- MCode (Cột L trong file Honeywell, Text '@')
  - Số lượng chuyển         (Cột 4 / D) <- QTY Shipped (Cột R trong file Honeywell)
  - Mã thùng                (Cột 5 / E) <- Pack ID (Cột V trong file Honeywell, Text '@')
  - Ghi chú barcode         (Cột 6 / F) <- Rỗng ("")

Sử dụng:
    python convert_honeywell_to_kdb.py [duong_dan_file_outbound_hw] [duong_dan_file_xuat] [duong_dan_file_template]
"""

import sys
import os
import datetime
import openpyxl

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

def find_outbound_columns(ws_in):
    """
    Tự động tìm cột từ header của file Outbound Honeywell.
    Fallback về vị trí mặc định nếu không khớp:
      MCode: 12 (L)
      QTY Shipped: 18 (R)
      Pack ID: 22 (V)
      Store Sub Code: 31 (AE)
    """
    cols = {
        'mcode': 12,
        'qty_shipped': 18,
        'pack_id': 22,
        'store_sub': 31
    }

    # Quét header ở dòng 1
    for col in range(1, ws_in.max_column + 1):
        raw = str(ws_in.cell(1, col).value or '').strip().lower()
        if raw in ['mcode', 'm-code', 'm_code', 'barcode', 'mã mcode']:
            cols['mcode'] = col
        elif raw in ['qty shipped', 'qty_shipped', 'qtyshipped', 'số lượng chuyển', 'sl xuất', 'sl chuyển']:
            cols['qty_shipped'] = col
        elif raw in ['pack id', 'pack_id', 'packid', 'mã thùng']:
            # Lưu ý: Trong file Honeywell có 2 cột Pack ID (P=16 và V=22). Cột V là mã thùng dạng SO...#001
            # Ưu tiên cột 22 nếu có nhiều cột trùng tên
            if col >= 20 or cols['pack_id'] == 22:
                cols['pack_id'] = col
        elif raw in ['store sub code', 'store_sub_code', 'storesubcode', 'sub code', 'nơi nhận']:
            cols['store_sub'] = col

    return cols

def convert_honeywell_to_kdb(
    input_file_path=None,
    template_path=None,
    output_path=None,
    from_loc="FGB10101"
):
    if not input_file_path:
        default_inputs = [
            os.path.join("Honeywell qua KDB", "Outbound Honeywell.xlsx"),
            "Outbound Honeywell.xlsx"
        ]
        for candidate in default_inputs:
            if os.path.exists(candidate):
                input_file_path = candidate
                break

    if not template_path:
        default_tpls = [
            os.path.join("Honeywell qua KDB", "Template PT KDB.xlsx"),
            "Template PT KDB.xlsx"
        ]
        for candidate in default_tpls:
            if os.path.exists(candidate):
                template_path = candidate
                break

    if not input_file_path or not os.path.exists(input_file_path):
        print(f"Lỗi: Không tìm thấy file Outbound Honeywell '{input_file_path}'")
        return False

    if not template_path or not os.path.exists(template_path):
        print(f"Lỗi: Không tìm thấy file template '{template_path}'")
        return False

    print(f"Đang đọc file Outbound Honeywell: {input_file_path}...")
    wb_in = openpyxl.load_workbook(input_file_path, data_only=True)
    ws_in = wb_in.active

    col_map = find_outbound_columns(ws_in)

    print(f"Đang đọc file template PT KDB: {template_path}...")
    wb_out = openpyxl.load_workbook(template_path)
    ws_out = wb_out.active

    # Xóa các dòng mẫu từ dòng 2 trở đi nếu có
    if ws_out.max_row >= 2:
        ws_out.delete_rows(2, ws_out.max_row - 1)

    out_row = 2
    total_qty = 0
    skipped_zero = 0
    unique_stores = set()
    unique_packs = set()

    for r in range(2, ws_in.max_row + 1):
        mcode_val = ws_in.cell(r, col_map['mcode']).value
        qty_val = ws_in.cell(r, col_map['qty_shipped']).value
        pack_val = ws_in.cell(r, col_map['pack_id']).value
        store_sub_val = ws_in.cell(r, col_map['store_sub']).value

        # Bỏ qua nếu dòng hoàn toàn trống
        if mcode_val is None and qty_val is None and pack_val is None and store_sub_val is None:
            continue

        try:
            qty_num = float(qty_val) if qty_val is not None else 0
        except (ValueError, TypeError):
            qty_num = 0

        if qty_num <= 0:
            skipped_zero += 1
            continue

        mcode_str = str(mcode_val).strip() if mcode_val is not None else ""
        pack_str = str(pack_val).strip() if pack_val is not None else ""
        store_sub_str = str(store_sub_val).strip() if store_sub_val is not None else ""

        if store_sub_str:
            unique_stores.add(store_sub_str)
        if pack_str:
            unique_packs.add(pack_str)

        final_qty = int(qty_num) if qty_num.is_integer() else qty_num
        total_qty += final_qty

        # Cột 1 (A): Tên viết tắt nơi chuyển (cố định)
        ws_out.cell(out_row, 1, from_loc)

        # Cột 2 (B): Tên viết tắt nơi nhận = Store Sub Code
        ws_out.cell(out_row, 2, store_sub_str)

        # Cột 3 (C): Barcode = MCode (Text '@')
        cell_c = ws_out.cell(out_row, 3, mcode_str)
        cell_c.number_format = '@'

        # Cột 4 (D): Số lượng chuyển = QTY Shipped
        ws_out.cell(out_row, 4, final_qty)

        # Cột 5 (E): Mã thùng = Pack ID (Text '@')
        cell_e = ws_out.cell(out_row, 5, pack_str)
        cell_e.number_format = '@'

        # Cột 6 (F): Ghi chú barcode (rỗng)
        ws_out.cell(out_row, 6, "")

        out_row += 1

    total_converted = out_row - 2
    if total_converted == 0:
        print("Cảnh báo: Không có dòng dữ liệu hợp lệ nào được chuyển đổi.")
        return False

    # Format text format cho toàn bộ cột Barcode và Mã thùng
    ws_out.column_dimensions['A'].width = 15
    ws_out.column_dimensions['B'].width = 15
    ws_out.column_dimensions['C'].width = 18
    ws_out.column_dimensions['D'].width = 15
    ws_out.column_dimensions['E'].width = 25
    ws_out.column_dimensions['F'].width = 15

    if not output_path:
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = f"phieu_chuyen_KDB_{timestamp}.xlsx"

    wb_out.save(output_path)
    print("=" * 60)
    print("CHUYỂN ĐỔI PHIẾU CHUYỂN KDB THÀNH CÔNG!")
    print(f"- Số dòng xuất: {total_converted}")
    print(f"- Bỏ qua dòng có số lượng <= 0: {skipped_zero}")
    print(f"- Tổng số lượng chuyển: {total_qty}")
    print(f"- Số nơi nhận độc nhất: {len(unique_stores)}")
    print(f"- Số mã thùng (Pack ID): {len(unique_packs)}")
    print(f"- File đã xuất: {output_path}")
    print("=" * 60)
    return True

if __name__ == "__main__":
    in_path = sys.argv[1] if len(sys.argv) > 1 else None
    out_path = sys.argv[2] if len(sys.argv) > 2 else None
    tpl_path = sys.argv[3] if len(sys.argv) > 3 else None

    success = convert_honeywell_to_kdb(in_path, tpl_path, out_path)
    if not success:
        sys.exit(1)
