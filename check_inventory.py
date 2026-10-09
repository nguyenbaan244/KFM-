"""
Script so sánh và đối soát tồn kho giữa KDB và Honeywell.
Quy tắc:
  - Honeywell: Lấy 'MCode' (hoặc SKU), tên sản phẩm 'SKU Name', tổng tồn 'Total Quantity'.
  - KDB: Lấy 'Mã hàng', tên sản phẩm 'Tên hàng', tồn 'Tồn cuối kỳ'.
  - Ghép nối dữ liệu qua Mã hàng / MCode.
  - Phân tích các trường hợp:
      + Khớp hoàn toàn (Tồn HW == Tồn KDB)
      + Lệch số lượng (Cả 2 đều có nhưng khác nhau)
      + Chỉ có ở KDB (Honeywell thiếu)
      + Chỉ có ở Honeywell (KDB thiếu)

Sử dụng:
    python check_inventory.py [file_honeywell] [file_kdb] [file_xuat_bao_cao]
Ví dụ:
    python check_inventory.py "Tồn Honeywell.xlsx" "Tồn KDB.xlsx" "bao_cao_lech_ton.xlsx"
"""

import sys
import os
import openpyxl
from collections import defaultdict
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

def compare_inventory(hw_file="Tồn Honeywell.xlsx", kdb_file="Tồn KDB.xlsx", output_file="bao_cao_lech_ton.xlsx"):
    if not os.path.exists(hw_file):
        print(f"Lỗi: Không tìm thấy file Honeywell '{hw_file}'")
        return False
    if not os.path.exists(kdb_file):
        print(f"Lỗi: Không tìm thấy file KDB '{kdb_file}'")
        return False

    print(f"Đang đọc file Honeywell: {hw_file}...")
    wb_hw = openpyxl.load_workbook(hw_file, data_only=True)
    ws_hw = wb_hw.active

    # Tìm cột trong Honeywell
    col_hw_sku = 3      # C: SKU
    col_hw_mcode = 4    # D: MCode
    col_hw_name = 6     # F: SKU Name
    col_hw_qty = 12     # L: Total Quantity

    for col in range(1, ws_hw.max_column + 1):
        v = str(ws_hw.cell(1, col).value or '').strip().lower()
        if v == 'sku':
            col_hw_sku = col
        elif v in ['mcode', 'm code', 'mã vạch', 'barcode']:
            col_hw_mcode = col
        elif v in ['sku name', 'tên hàng', 'tên sản phẩm']:
            col_hw_name = col
        elif 'total quantity' in v or 'total qty' in v:
            col_hw_qty = col

    hw_qty_by_mcode = defaultdict(float)
    hw_sku_by_mcode = {}
    hw_name_by_mcode = {}

    for r in range(2, ws_hw.max_row + 1):
        sku = str(ws_hw.cell(r, col_hw_sku).value or '').strip()
        mcode = str(ws_hw.cell(r, col_hw_mcode).value or '').strip()
        name = str(ws_hw.cell(r, col_hw_name).value or '').strip()
        qty_val = ws_hw.cell(r, col_hw_qty).value
        
        # Nếu không có MCode thì fallback sang SKU
        key = mcode if mcode else sku
        if not key:
            continue

        try:
            qty_num = float(qty_val) if qty_val is not None else 0.0
        except (ValueError, TypeError):
            qty_num = 0.0

        hw_qty_by_mcode[key] += qty_num
        if key not in hw_sku_by_mcode or not hw_sku_by_mcode[key]:
            hw_sku_by_mcode[key] = sku
        if key not in hw_name_by_mcode or not hw_name_by_mcode[key]:
            hw_name_by_mcode[key] = name

    print(f"Đang đọc file KDB: {kdb_file}...")
    wb_kdb = openpyxl.load_workbook(kdb_file, data_only=True)
    ws_kdb = wb_kdb.active

    # Tìm cột trong KDB
    col_kdb_code = 3    # C: Mã hàng
    col_kdb_name = 4    # D: Tên hàng
    col_kdb_qty = 13    # M: Tồn cuối kỳ

    for col in range(1, ws_kdb.max_column + 1):
        v = str(ws_kdb.cell(1, col).value or '').strip().lower()
        if v in ['mã hàng', 'ma hang', 'mã sp', 'barcode', 'sku']:
            col_kdb_code = col
        elif v in ['tên hàng', 'ten hang', 'tên sản phẩm']:
            col_kdb_name = col
        elif ('tồn cuối kỳ' in v or 'ton cuoi ky' in v or 'tồn kho' in v) and ('giá trị' not in v and 'gia tri' not in v):
            col_kdb_qty = col

    kdb_qty_by_code = defaultdict(float)
    kdb_name_by_code = {}

    for r in range(2, ws_kdb.max_row + 1):
        code = str(ws_kdb.cell(r, col_kdb_code).value or '').strip()
        name = str(ws_kdb.cell(r, col_kdb_name).value or '').strip()
        qty_val = ws_kdb.cell(r, col_kdb_qty).value

        if not code:
            continue

        try:
            qty_num = float(qty_val) if qty_val is not None else 0.0
        except (ValueError, TypeError):
            qty_num = 0.0

        kdb_qty_by_code[code] += qty_num
        if code not in kdb_name_by_code or not kdb_name_by_code[code]:
            kdb_name_by_code[code] = name

    # Đối soát
    all_codes = sorted(list(set(hw_qty_by_mcode.keys()).union(set(kdb_qty_by_code.keys()))))
    comparison_data = []

    count_match = 0
    count_diff_qty = 0
    count_only_kdb = 0
    count_only_hw = 0

    for code in all_codes:
        in_hw = code in hw_qty_by_mcode
        in_kdb = code in kdb_qty_by_code
        q_hw = hw_qty_by_mcode.get(code, 0.0)
        q_kdb = kdb_qty_by_code.get(code, 0.0)
        diff = q_hw - q_kdb
        sku = hw_sku_by_mcode.get(code, '')
        name = hw_name_by_mcode.get(code) or kdb_name_by_code.get(code, '')

        if in_hw and in_kdb:
            if diff == 0:
                status = "Khớp hoàn toàn"
                count_match += 1
            else:
                status = "Lệch số lượng"
                count_diff_qty += 1
        elif in_kdb and not in_hw:
            status = "Chỉ có ở KDB"
            count_only_kdb += 1
        else:
            status = "Chỉ có ở Honeywell"
            count_only_hw += 1

        comparison_data.append({
            'code': code,
            'sku': sku,
            'name': name,
            'q_kdb': q_kdb,
            'q_hw': q_hw,
            'diff': diff,
            'status': status
        })

    # Sắp xếp: Ưu tiên các dòng bị lệch lên trên, xếp theo độ lớn chênh lệch
    comparison_data.sort(key=lambda x: (x['status'] == "Khớp hoàn toàn", -abs(x['diff']), x['code']))

    # Xuất file Excel báo cáo
    wb_out = openpyxl.Workbook()
    ws_out = wb_out.active
    ws_out.title = "Đối Soát Tồn Kho"

    # Styles
    font_header = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    fill_header = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    fill_diff = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
    fill_match = PatternFill(start_color="ECFDF5", end_color="ECFDF5", fill_type="solid")
    fill_only_kdb = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
    fill_only_hw = PatternFill(start_color="EDE9FE", end_color="EDE9FE", fill_type="solid")

    border_thin = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    headers = [
        "STT", "Mã SKU (HW)", "Mã Hàng / Barcode", "Tên Sản Phẩm",
        "Tồn KDB", "Tồn Honeywell (Total Qty)", "Chênh Lệch (HW - KDB)", "Trạng Thái"
    ]

    for col_idx, h in enumerate(headers, start=1):
        cell = ws_out.cell(1, col_idx, h)
        cell.font = font_header
        cell.fill = fill_header
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = border_thin

    ws_out.row_dimensions[1].height = 26

    for idx, item in enumerate(comparison_data, start=1):
        r = idx + 1
        ws_out.cell(r, 1, idx).alignment = Alignment(horizontal="center")
        ws_out.cell(r, 2, item['sku']).alignment = Alignment(horizontal="center")
        ws_out.cell(r, 3, str(item['code'])).alignment = Alignment(horizontal="center")
        ws_out.cell(r, 4, item['name'])
        
        c_kdb = ws_out.cell(r, 5, int(item['q_kdb']) if item['q_kdb'].is_integer() else item['q_kdb'])
        c_hw = ws_out.cell(r, 6, int(item['q_hw']) if item['q_hw'].is_integer() else item['q_hw'])
        c_diff = ws_out.cell(r, 7, int(item['diff']) if item['diff'].is_integer() else item['diff'])
        c_status = ws_out.cell(r, 8, item['status'])

        c_kdb.number_format = '#,##0'
        c_hw.number_format = '#,##0'
        c_diff.number_format = '#,##0'

        # Highlight màu trạng thái
        if item['status'] == "Khớp hoàn toàn":
            row_fill = fill_match
        elif item['status'] == "Lệch số lượng":
            row_fill = fill_diff
        elif item['status'] == "Chỉ có ở KDB":
            row_fill = fill_only_kdb
        else:
            row_fill = fill_only_hw

        c_status.fill = row_fill
        c_status.alignment = Alignment(horizontal="center")
        if item['diff'] != 0:
            c_diff.fill = row_fill

        for c in range(1, 9):
            ws_out.cell(r, c).border = border_thin

    # Chỉnh độ rộng cột tự động
    col_widths = {1: 8, 2: 16, 3: 18, 4: 45, 5: 14, 6: 22, 7: 20, 8: 18}
    for col_idx, width in col_widths.items():
        col_letter = openpyxl.utils.get_column_letter(col_idx)
        ws_out.column_dimensions[col_letter].width = width

    wb_out.save(output_file)

    total_diff_items = count_diff_qty + count_only_kdb + count_only_hw
    print("=" * 60)
    print("ĐỐI SOÁT TỒN KHO THÀNH CÔNG!")
    print(f"- Tổng số SKU phân tích: {len(all_codes)}")
    print(f"- Số SKU khớp hoàn toàn: {count_match} ({count_match/len(all_codes)*100:.1f}%)")
    print(f"- Tổng số SKU bị lệch: {total_diff_items} ({total_diff_items/len(all_codes)*100:.1f}%)")
    print(f"  + Lệch số lượng tồn: {count_diff_qty}")
    print(f"  + Chỉ có ở KDB (Honeywell thiếu): {count_only_kdb}")
    print(f"  + Chỉ có ở Honeywell (KDB thiếu): {count_only_hw}")
    print(f"- File báo cáo đã xuất: {output_file}")
    print("=" * 60)
    return True

if __name__ == "__main__":
    hw_arg = sys.argv[1] if len(sys.argv) > 1 else "Tồn Honeywell.xlsx"
    kdb_arg = sys.argv[2] if len(sys.argv) > 2 else "Tồn KDB.xlsx"
    out_arg = sys.argv[3] if len(sys.argv) > 3 else "bao_cao_lech_ton.xlsx"
    compare_inventory(hw_arg, kdb_arg, out_arg)
