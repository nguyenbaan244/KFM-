"""
Script chuyển đổi dữ liệu từ File Yêu Cầu Chuyển Hàng KDB sang File Tạo Order Honeywell.
Quy tắc nâng cấp:
  1/ Tách mỗi 50 dòng thành 1 order khác nhau, đánh dấu bằng hậu tố -1, -2, -3...
  2/ Nạp file Inventory Balance để sắp xếp thứ tự các dòng theo vị trí kho (A1 -> A9 và B1 -> B8),
     giúp nhân viên pick theo từng dãy thuận tiện, không phải đi lòng vòng kho.

Quy tắc ánh xạ (Mapping):
  - Mã đơn gốc (Cột 1 / A)        <- [Nơi nhận (viết tắt)] & "_" & ddmmyyyy & "-" & order_index (ví dụ: B001_10102026-1)
  - Gói dịch vụ (Cột 2 / B)        <- B2C3D
  - Tên người nhận (Cột 3 / C)     <- [Nơi nhận (viết tắt)] (Cột N) (ví dụ: B001)
  - Số điện thoại (Cột 4 / D)      <- 0973468464 (Text)
  - Địa chỉ (Cột 5 / E)            <- [Nơi nhận] (Cột O) (ví dụ: KFM_HNI_YHO - CT3 Yên Hoà Park View)
  - Xã/Phường (Cột 6 / F)          <- Rỗng ("")
  - Quận/Huyện (Cột 7 / G)         <- Rỗng ("")
  - Tỉnh/Thành (Cột 8 / H)         <- Rỗng ("")
  - Mã sản phẩm (Cột 9 / I)        <- [Barcode] (Cột C)
  - Số lượng xuất (Cột 10 / J)     <- [Số lượng cần chuyển] (Cột Q, nếu <= 0 thì bỏ qua)
  - Mã đối tác VC (Cột 11 / K)     <- GHN
  - Mã vận đơn (Cột 12 / L)        <- Rỗng ("")
  - Gói cước VC (Cột 13 / M)       <- 2
  - Tiền thu hộ (Cột 14 / N)       <- 0
  - Yêu cầu đơn hàng (Cột 15 / O)  <- 1
  - Hình thức thanh toán (Cột 16 / P) <- 2
  - Tên hàng hoá (Cột 17 / Q)      <- [Tên sản phẩm] (Cột D)
  - Link Bill Sàn TMĐT (Cột 19 / S)<- [Mã yêu cầu] (Cột B)
  - Mã Cửa Hàng (Cột 21 / U)       <- [Nơi nhận (viết tắt)] (Cột N) (ví dụ: B001)
  - Các field còn lại (18, 20)     <- Rỗng ("")

Sử dụng:
    python convert_kdb_to_honeywell.py [duong_dan_file_kdb] [duong_dan_file_xuat] [duong_dan_file_template] [duong_dan_file_inventory] [so_dong_tach]
"""

import sys
import os
import re
import datetime
from collections import defaultdict
import openpyxl

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

def parse_location_sort_key(loc_str):
    """
    Tạo khóa sắp xếp vị trí kho:
    Ưu tiên:
      1: Dãy A (A1 -> A9)
      2: Dãy B (B1 -> B8)
      3: Các dãy chữ cái khác (L1, L2,...)
      5: Các vị trí đặc biệt (TAM.PL.1,...)
      99: Rỗng hoặc không có vị trí
    Chi tiết sắp xếp tiếp theo:
      - Số dãy (1, 2, 3...)
      - Số kệ / bay (001, 002...)
      - Tầng / tier (A, B, C...)
    """
    if not loc_str:
        return (99, 99, 9999, 'Z', '')
    
    clean_loc = str(loc_str).strip()
    m = re.match(r'^([A-Za-z])(\d+)(?:-(\d+))?(?:-([A-Za-z0-9]+))?', clean_loc)
    if m:
        letter = m.group(1).upper()
        aisle_num = int(m.group(2))
        bay_num = int(m.group(3)) if m.group(3) else 0
        tier = m.group(4).upper() if m.group(4) else ''
        
        if letter == 'A':
            prio = 1
        elif letter == 'B':
            prio = 2
        else:
            prio = 3
        return (prio, aisle_num, bay_num, tier, clean_loc)
    
    return (5, 99, 9999, 'Z', clean_loc)

def load_inventory_mapping(inventory_path):
    """
    Đọc file Inventory Balance để tạo từ điển ánh xạ:
    Barcode / SKU / MCode -> { location: str, qty: float }
    """
    if not inventory_path or not os.path.exists(inventory_path):
        return {}

    try:
        wb_inv = openpyxl.load_workbook(inventory_path, data_only=True)
        ws_inv = wb_inv.active
    except Exception as e:
        print(f"Cảnh báo: Không thể đọc file inventory '{inventory_path}': {e}")
        return {}

    # Quét tiêu đề dòng 1
    sku_col = 3
    mcode_col = 4
    scode_col = 5
    loc_col = 9
    qty_col = 15

    for c in range(1, ws_inv.max_column + 1):
        raw = str(ws_inv.cell(1, c).value or '').strip().lower()
        if raw in ['sku', 'mã sku', 'ma sku']:
            sku_col = c
        elif raw in ['mcode', 'm-code', 'barcode', 'mã barcode', 'mã vạch']:
            mcode_col = c
        elif raw in ['scode', 's-code']:
            scode_col = c
        elif raw in ['location id', 'location', 'vị trí', 'vi tri', 'mã vị trí']:
            loc_col = c
        elif raw in ['qty available', 'available qty', 'sl khả dụng', 'ton kha dung']:
            qty_col = c
        elif raw in ['total quantity', 'total qty', 'tổng tồn'] and qty_col == 15:
            qty_col = c

    inv_records = defaultdict(list)
    for r in range(2, ws_inv.max_row + 1):
        sku = str(ws_inv.cell(r, sku_col).value or '').strip()
        mcode = str(ws_inv.cell(r, mcode_col).value or '').strip()
        scode = str(ws_inv.cell(r, scode_col).value or '').strip()
        loc = str(ws_inv.cell(r, loc_col).value or '').strip()
        qty_val = ws_inv.cell(r, qty_col).value or 0

        try:
            qty_num = float(qty_val)
        except (ValueError, TypeError):
            qty_num = 0

        if not loc:
            continue

        item_data = {'loc': loc, 'qty': qty_num}
        if mcode:
            inv_records[mcode].append(item_data)
        if sku:
            inv_records[sku].append(item_data)
        if scode:
            inv_records[scode].append(item_data)

    # Chọn vị trí tối ưu: vị trí có tồn khả dụng cao nhất, hoặc vị trí có thứ tự pick sớm nhất
    inv_map = {}
    for code, items in inv_records.items():
        # Sắp xếp theo QTY giảm dần, rồi theo vị trí tăng dần
        items_sorted = sorted(items, key=lambda x: (-x['qty'], parse_location_sort_key(x['loc'])))
        inv_map[code] = items_sorted[0]['loc']

    print(f"Đã đọc file Inventory Balance: {len(inv_map)} mã SKU/Barcode được ánh xạ vị trí kho.")
    return inv_map

def find_input_columns(ws_in):
    cols = {
        'req_code': 2,
        'barcode': 3,
        'product_name': 4,
        'dest_short': 14,
        'dest_full': 15,
        'qty': 17
    }

    # Header scan (row 1)
    for col in range(1, ws_in.max_column + 1):
        raw = str(ws_in.cell(1, col).value or '').strip().lower()
        if raw in ['mã yêu cầu', 'ma yeu cau', 'mã yc', 'ma yc', 'số yc', 'so yc', 'yêu cầu', 'yeu cau']:
            cols['req_code'] = col
        elif raw in ['barcode', 'mã barcode', 'mã vạch', 'mã sản phẩm', 'mã hàng']:
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
    inventory_path=None,
    split_lines=50,
    service_type="B2C3D",
    phone="0973468464",
    transporter="GHN",
    shipping_rate=2,
    cod=0,
    order_req=1,
    payment_type=2,
    suffix=None
):
    if suffix is None:
        today_str = datetime.datetime.now().strftime("%d%m%Y")
        suffix = f"_{today_str}"

    # Tự động tìm file đầu vào KDB mặc định
    if not input_file_path:
        default_inputs = [
            os.path.join("KDB qua Honeywell", "yeu_cau_chuyen_hang_thuong_10102026-094746.xlsx"),
            "yeu_cau_chuyen_hang_thuong_10102026-094746.xlsx",
            "yeu_cau_chuyen_hang.xlsx"
        ]
        for candidate in default_inputs:
            if os.path.exists(candidate):
                input_file_path = candidate
                break

    # Tự động tìm template
    if not template_path:
        default_tpls = [
            os.path.join("KDB qua Honeywell", "Template import tạo order Honeywell.xlsx"),
            "Template import tạo order Honeywell.xlsx"
        ]
        for candidate in default_tpls:
            if os.path.exists(candidate):
                template_path = candidate
                break

    # Tự động tìm Inventory Balance
    if not inventory_path:
        default_invs = [
            "Inventory Balance.xlsx",
            os.path.join("KDB qua Honeywell", "Inventory Balance.xlsx"),
            "Tồn Honeywell.xlsx"
        ]
        for candidate in default_invs:
            if os.path.exists(candidate):
                inventory_path = candidate
                break

    if not input_file_path or not os.path.exists(input_file_path):
        print(f"Lỗi: Không tìm thấy file KDB '{input_file_path}'")
        return False

    if not template_path or not os.path.exists(template_path):
        print(f"Lỗi: Không tìm thấy file template '{template_path}'")
        return False

    # Đọc Inventory Mapping
    inv_map = {}
    if inventory_path and os.path.exists(inventory_path):
        print(f"Đang đọc dữ liệu vị trí tồn kho từ: {inventory_path}...")
        inv_map = load_inventory_mapping(inventory_path)
    else:
        print("Thông báo: Không tìm thấy file Inventory Balance. Sẽ giữ nguyên thứ tự gốc.")

    print(f"Đang đọc file yêu cầu chuyển hàng KDB: {input_file_path}...")
    wb_in = openpyxl.load_workbook(input_file_path, data_only=True)
    ws_in = wb_in.active

    col_map = find_input_columns(ws_in)

    # Đọc danh sách các dòng hợp lệ
    raw_items = []
    skipped_zero_count = 0
    total_qty = 0

    for r in range(2, ws_in.max_row + 1):
        req_code_val = ws_in.cell(r, col_map['req_code']).value
        barcode_val = ws_in.cell(r, col_map['barcode']).value
        product_name_val = ws_in.cell(r, col_map['product_name']).value
        dest_short_val = ws_in.cell(r, col_map['dest_short']).value
        dest_full_val = ws_in.cell(r, col_map['dest_full']).value
        qty_val = ws_in.cell(r, col_map['qty']).value

        if barcode_val is None and product_name_val is None:
            continue

        try:
            qty_num = float(qty_val) if qty_val is not None else 0
        except (ValueError, TypeError):
            qty_num = 0

        if qty_num <= 0:
            skipped_zero_count += 1
            continue

        final_qty = int(qty_num) if qty_num.is_integer() else qty_num
        total_qty += final_qty

        req_code_str = str(req_code_val).strip() if req_code_val is not None else ""
        barcode_str = str(barcode_val).strip() if barcode_val is not None else ""
        product_name_str = str(product_name_val).strip() if product_name_val is not None else ""
        dest_short_str = str(dest_short_val).strip() if dest_short_val is not None else ""
        dest_full_str = str(dest_full_val).strip() if dest_full_val is not None else ""

        loc_str = inv_map.get(barcode_str, "")

        raw_items.append({
            'req_code': req_code_str,
            'barcode': barcode_str,
            'product_name': product_name_str,
            'dest_short': dest_short_str,
            'dest_full': dest_full_str,
            'qty': final_qty,
            'location': loc_str
        })

    if not raw_items:
        print("Cảnh báo: Không có dòng dữ liệu hợp lệ nào được chuyển đổi.")
        return False

    # 1. Sắp xếp thứ tự theo vị trí kho: A1 -> A9 và B1 -> B8
    if inv_map:
        print("Đang sắp xếp các dòng SKU theo vị trí kho (A1-A9 & B1-B8)...")
        raw_items.sort(key=lambda item: (item['dest_short'], parse_location_sort_key(item['location'])))
    else:
        raw_items.sort(key=lambda item: item['dest_short'])

    # 2. Phân chia thành các order với mỗi nhóm tối đa split_lines dòng (mặc định 50 dòng)
    split_size = int(split_lines) if split_lines and int(split_lines) > 0 else 50
    print(f"Đang phân tách order: mỗi {split_size} dòng thành 1 order (-1, -2, -3...)...")

    # Nhóm theo nơi nhận
    dest_groups = defaultdict(list)
    for it in raw_items:
        dest_groups[it['dest_short']].append(it)

    processed_rows = []
    order_summaries = []

    for d_short, items_in_dest in dest_groups.items():
        base_prefix = f"{d_short}{suffix}" if d_short else f"ORDER{suffix}"
        dest_full_name = items_in_dest[0]['dest_full'] if items_in_dest else ""

        # Chia nhỏ mỗi 50 dòng
        num_orders = (len(items_in_dest) + split_size - 1) // split_size
        for o_idx in range(num_orders):
            chunk = items_in_dest[o_idx * split_size : (o_idx + 1) * split_size]
            order_code = f"{base_prefix}-{o_idx + 1}"

            first_loc = chunk[0]['location'] or "N/A"
            last_loc = chunk[-1]['location'] or "N/A"
            loc_list = [c['location'] for c in chunk if c['location']]
            chunk_qty = sum(c['qty'] for c in chunk)

            order_summaries.append({
                'order_code': order_code,
                'dest_short': d_short,
                'dest_full': dest_full_name,
                'lines': len(chunk),
                'qty': chunk_qty,
                'loc_range': f"{first_loc} -> {last_loc}" if loc_list else "Không có vị trí"
            })

            for it in chunk:
                it['order_code'] = order_code
                processed_rows.append(it)

    # 3. Ghi dữ liệu vào file template Honeywell
    print(f"Đang ghi dữ liệu vào file mẫu tạo order Honeywell: {template_path}...")
    wb_out = openpyxl.load_workbook(template_path)
    ws_out = wb_out.active

    # Xóa các dòng mẫu từ dòng 4 trở đi nếu có
    if ws_out.max_row >= 4:
        ws_out.delete_rows(4, ws_out.max_row - 3)

    out_row = 4
    for it in processed_rows:
        # Cột 1 (A): Mã đơn gốc * (đã được đánh dấu -1, -2, -3...)
        ws_out.cell(out_row, 1, it['order_code'])
        # Cột 2 (B): Gói dịch vụ *
        ws_out.cell(out_row, 2, service_type)
        # Cột 3 (C): Tên người nhận * = Nơi nhận (viết tắt) - Cột N
        ws_out.cell(out_row, 3, it['dest_short'])
        # Cột 4 (D): Số điện thoại * (Text '@')
        cell_d = ws_out.cell(out_row, 4, str(phone).strip())
        cell_d.number_format = '@'
        # Cột 5 (E): Địa chỉ = Nơi nhận - Cột O
        ws_out.cell(out_row, 5, it['dest_full'])
        # Cột 6 (F): Xã/Phường (rỗng)
        ws_out.cell(out_row, 6, "")
        # Cột 7 (G): Quận/Huyện (rỗng)
        ws_out.cell(out_row, 7, "")
        # Cột 8 (H): Tỉnh/Thành (rỗng)
        ws_out.cell(out_row, 8, "")
        # Cột 9 (I): Mã Sản phẩm * (Text '@')
        cell_i = ws_out.cell(out_row, 9, it['barcode'])
        cell_i.number_format = '@'
        # Cột 10 (J): Số lượng Xuất *
        ws_out.cell(out_row, 10, it['qty'])
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
        ws_out.cell(out_row, 17, it['product_name'])
        # Cột 18 (R): Giá trị hàng hóa (rỗng)
        ws_out.cell(out_row, 18, "")
        # Cột 19 (S): Link Bill Sàn TMĐT = Mã yêu cầu (Cột B)
        ws_out.cell(out_row, 19, it['req_code'])
        # Cột 20 (T): Mã Tuyến (rỗng)
        ws_out.cell(out_row, 20, "")
        # Cột 21 (U): Mã Cửa Hàng = Nơi nhận (viết tắt) - Cột N
        ws_out.cell(out_row, 21, it['dest_short'])

        out_row += 1

    # Đảm bảo format text cho cột SĐT và Barcode
    ws_out.column_dimensions['D'].number_format = '@'
    ws_out.column_dimensions['I'].number_format = '@'

    if not output_path:
        first_order = order_summaries[0]['order_code'].split('-')[0] if order_summaries else "ORDER"
        date_stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = f"order_honeywell_{first_order}_{date_stamp}.xlsx"

    wb_out.save(output_path)

    print("=" * 70)
    print("CHUYỂN ĐỔI ORDER HONEYWELL THÀNH CÔNG!")
    print(f"- Tổng số dòng xuất: {len(processed_rows)}")
    print(f"- Đã loại bỏ số dòng có SL <= 0: {skipped_zero_count}")
    print(f"- Tổng số đơn hàng được tách (mỗi {split_size} dòng): {len(order_summaries)} đơn")
    print(f"- Tổng số lượng xuất: {total_qty}")
    print(f"- File đã xuất: {output_path}")
    print("-" * 70)
    print("CHI TIẾT CÁC ĐƠN HÀNG ĐÃ TÁCH & DẢI VỊ TRÍ:")
    for sm in order_summaries:
        print(f"  + {sm['order_code']:<25} | {sm['lines']:>2} dòng | SL: {sm['qty']:>4} | Vị trí: {sm['loc_range']}")
    print("=" * 70)
    return True

if __name__ == "__main__":
    in_arg = sys.argv[1] if len(sys.argv) > 1 else None
    out_arg = sys.argv[2] if len(sys.argv) > 2 else None
    tpl_arg = sys.argv[3] if len(sys.argv) > 3 else None
    inv_arg = sys.argv[4] if len(sys.argv) > 4 else None
    split_arg = int(sys.argv[5]) if len(sys.argv) > 5 and sys.argv[5].isdigit() else 50
    convert_kdb_transfer_to_order(in_arg, template_path=tpl_arg, output_path=out_arg, inventory_path=inv_arg, split_lines=split_arg)
