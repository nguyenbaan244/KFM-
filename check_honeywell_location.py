"""
Script kiểm tra số SKU, số lượng và các mã chưa có trong location chuẩn XX-YYY-Z trong file Tồn Honeywell.
Sử dụng:
    python check_honeywell_location.py [file_honeywell] [file_xuat_bao_cao]
Ví dụ:
    python check_honeywell_location.py "Tồn Honeywell.xlsx" "bao_cao_location_honeywell.xlsx"
"""

import sys
import os
import re
import openpyxl
from collections import defaultdict
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

def check_honeywell_locations(hw_file="Tồn Honeywell.xlsx", output_file="bao_cao_location_honeywell.xlsx"):
    if not os.path.exists(hw_file):
        print(f"Lỗi: Không tìm thấy file '{hw_file}'")
        return False

    print(f"Đang đọc file Honeywell: {hw_file}...")
    wb = openpyxl.load_workbook(hw_file, data_only=True)
    ws = wb.active

    col_loc = 9  # I: Location ID
    col_sku = 3  # C: SKU
    col_mcode = 4 # D: MCode
    col_name = 6 # F: SKU Name
    col_qty = 12 # L: Total Quantity

    for c in range(1, ws.max_column + 1):
        v = str(ws.cell(1, c).value or '').strip().lower()
        if v == 'sku': col_sku = c
        elif v in ['mcode', 'm code', 'barcode', 'mã vạch']: col_mcode = c
        elif v in ['sku name', 'tên hàng', 'tên sản phẩm']: col_name = c
        elif 'location' in v: col_loc = c
        elif 'total quantity' in v or 'total qty' in v: col_qty = c

    # Pattern chuẩn vị trí: XX-YYY-Z (ví dụ: A3-001-B, B7-006-A)
    # 2 ký tự (chữ/số) - 3 ký tự (thường là số) - 1 ký tự (chữ)
    pattern_std = re.compile(r'^[A-Za-z0-9]{2}-[A-Za-z0-9]{3}-[A-Za-z0-9]$')

    all_skus = set()
    total_qty_hw = 0.0

    valid_rows = []
    invalid_rows = []

    for r in range(2, ws.max_row + 1):
        sku = str(ws.cell(r, col_sku).value or '').strip()
        mcode = str(ws.cell(r, col_mcode).value or '').strip()
        name = str(ws.cell(r, col_name).value or '').strip()
        loc = str(ws.cell(r, col_loc).value or '').strip()
        qty = float(ws.cell(r, col_qty).value or 0)

        if not sku and not mcode:
            continue

        all_skus.add(sku if sku else mcode)
        total_qty_hw += qty

        is_std = bool(pattern_std.match(loc))
        row_info = {
            'row': r,
            'sku': sku,
            'mcode': mcode,
            'name': name,
            'loc': loc,
            'qty': qty,
            'is_std': is_std
        }

        if is_std:
            valid_rows.append(row_info)
        else:
            invalid_rows.append(row_info)

    # Lọc các dòng vị trí không chuẩn mà có số lượng > 0
    non_std_with_qty = [x for x in invalid_rows if x['qty'] > 0]
    non_std_zero_qty = [x for x in invalid_rows if x['qty'] == 0]

    # Phân loại theo SKU
    non_std_skus = set(x['sku'] for x in non_std_with_qty if x['sku'])
    total_non_std_qty = sum(x['qty'] for x in non_std_with_qty)
    std_qty = sum(x['qty'] for x in valid_rows)

    print("=" * 60)
    print("KẾT QUẢ KIỂM TRA FILE TỒN HONEYWELL:")
    print(f"- Tổng số dòng dữ liệu: {ws.max_row - 1}")
    print(f"- Tổng số SKU riêng biệt: {len(all_skus)}")
    print(f"- Tổng số lượng tồn: {total_qty_hw:,.0f}")
    print("-" * 60)
    print(f"- Số dòng ở vị trí chuẩn XX-YYY-Z: {len(valid_rows)} dòng | Tổng SL: {std_qty:,.0f}")
    print(f"- Số dòng ở vị trí BẤT THƯỜNG / CHƯA CHUẨN (có tồn > 0): {len(non_std_with_qty)} dòng")
    print(f"  + Tổng số SKU bị ảnh hưởng: {len(non_std_skus)} SKU")
    print(f"  + Tổng số lượng ở vị trí bất thường: {total_non_std_qty:,.0f}")
    print(f"- Số dòng ở vị trí bất thường nhưng tồn = 0: {len(non_std_zero_qty)} dòng")
    print("=" * 60)

    # Thống kê theo từng location bất thường
    loc_summary = defaultdict(lambda: {'rows': 0, 'qty': 0.0, 'skus': set()})
    for x in non_std_with_qty:
        l = x['loc']
        loc_summary[l]['rows'] += 1
        loc_summary[l]['qty'] += x['qty']
        loc_summary[l]['skus'].add(x['sku'])

    print("Chi tiết các vị trí bất thường:")
    for l, d in sorted(loc_summary.items(), key=lambda item: item[1]['qty'], reverse=True):
        print(f"  * Location '{l}': {len(d['skus'])} SKU | {d['rows']} dòng | Tổng SL: {d['qty']:,.0f}")

    # Xuất file Excel báo cáo
    wb_out = openpyxl.Workbook()

    # Sheet 1: Danh sách các mã chưa ở vị trí chuẩn
    ws1 = wb_out.active
    ws1.title = "DS Mã Chưa Chuẩn Location"

    # Sheet 2: Tổng hợp theo Location bất thường
    ws2 = wb_out.create_sheet(title="Tổng Hợp Theo Location")

    # Styles
    font_header = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    fill_header_blue = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    fill_header_amber = PatternFill(start_color="B45309", end_color="B45309", fill_type="solid")
    fill_warn = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
    border_thin = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    headers1 = [
        "STT", "Mã SKU", "Mã Hàng / Barcode", "Tên Sản Phẩm",
        "Location Hiện Tại", "Số Lượng Tồn", "Trạng Thái Vị Trí", "Ghi Chú"
    ]

    for col_idx, h in enumerate(headers1, start=1):
        cell = ws1.cell(1, col_idx, h)
        cell.font = font_header
        cell.fill = fill_header_blue
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = border_thin
    ws1.row_dimensions[1].height = 26

    # Sắp xếp các dòng bất thường theo Location, rồi theo SKU
    non_std_with_qty.sort(key=lambda x: (x['loc'], -x['qty'], x['sku']))

    for idx, item in enumerate(non_std_with_qty, start=1):
        r = idx + 1
        ws1.cell(r, 1, idx).alignment = Alignment(horizontal="center")
        ws1.cell(r, 2, item['sku']).alignment = Alignment(horizontal="center")
        ws1.cell(r, 3, str(item['mcode'])).alignment = Alignment(horizontal="center")
        ws1.cell(r, 4, item['name'])
        
        c_loc = ws1.cell(r, 5, item['loc'])
        c_loc.alignment = Alignment(horizontal="center")
        c_loc.font = Font(name="Calibri", bold=True, color="B91C1C")
        c_loc.fill = fill_warn

        c_qty = ws1.cell(r, 6, int(item['qty']) if item['qty'].is_integer() else item['qty'])
        c_qty.number_format = '#,##0'
        c_qty.font = Font(name="Calibri", bold=True)

        status_text = "Chưa vào vị trí chuẩn"
        note_text = ""
        if "QC" in item['loc'].upper():
            note_text = "Khu vực kiểm hàng / chờ nhập kho"
        elif "TAM" in item['loc'].upper():
            note_text = "Vị trí tạm pallet"
        else:
            note_text = "Sai định dạng XX-YYY-Z"

        ws1.cell(r, 7, status_text).alignment = Alignment(horizontal="center")
        ws1.cell(r, 8, note_text)

        for c in range(1, 9):
            ws1.cell(r, c).border = border_thin

    col_widths1 = {1: 8, 2: 16, 3: 18, 4: 45, 5: 20, 6: 16, 7: 22, 8: 32}
    for col_idx, width in col_widths1.items():
        ws1.column_dimensions[openpyxl.utils.get_column_letter(col_idx)].width = width

    # Sheet 2: Tổng hợp theo Location
    headers2 = ["STT", "Location Bất Thường", "Số Lượng SKU", "Số Dòng", "Tổng Số Lượng Tồn", "Đánh Giá"]
    for col_idx, h in enumerate(headers2, start=1):
        cell = ws2.cell(1, col_idx, h)
        cell.font = font_header
        cell.fill = fill_header_amber
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = border_thin
    ws2.row_dimensions[1].height = 26

    for idx, (loc_name, data) in enumerate(sorted(loc_summary.items(), key=lambda x: x[1]['qty'], reverse=True), start=1):
        r = idx + 1
        ws2.cell(r, 1, idx).alignment = Alignment(horizontal="center")
        c_loc = ws2.cell(r, 2, loc_name)
        c_loc.alignment = Alignment(horizontal="center")
        c_loc.font = Font(name="Calibri", bold=True)

        ws2.cell(r, 3, len(data['skus'])).number_format = '#,##0'
        ws2.cell(r, 4, data['rows']).number_format = '#,##0'
        c_qty = ws2.cell(r, 5, int(data['qty']) if data['qty'].is_integer() else data['qty'])
        c_qty.number_format = '#,##0'
        c_qty.font = Font(name="Calibri", bold=True)

        eval_text = "Chờ chuyển vào kệ lưu trữ (Putaway)" if "QC" in loc_name.upper() else "Cần sắp xếp lại vị trí"
        ws2.cell(r, 6, eval_text)

        for c in range(1, 7):
            ws2.cell(r, c).border = border_thin

    col_widths2 = {1: 8, 2: 24, 3: 16, 4: 14, 5: 22, 6: 35}
    for col_idx, width in col_widths2.items():
        ws2.column_dimensions[openpyxl.utils.get_column_letter(col_idx)].width = width

    wb_out.save(output_file)
    print(f"- Đã xuất báo cáo chi tiết ra file: {output_file}")
    return True

if __name__ == "__main__":
    file_hw = sys.argv[1] if len(sys.argv) > 1 else "Tồn Honeywell.xlsx"
    file_out = sys.argv[2] if len(sys.argv) > 2 else "bao_cao_location_honeywell.xlsx"
    check_honeywell_locations(file_hw, file_out)
