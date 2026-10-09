import base64

with open('file_nhap_hang (1) (1).xlsx', 'rb') as f:
    tpl_data = f.read()
tpl_b64 = base64.b64encode(tpl_data).decode('utf-8')

with open('template_b64.js', 'w', encoding='utf-8') as f:
    f.write(f'var TEMPLATE_BASE64 = "{tpl_b64}";\nif (typeof module !== "undefined" && module.exports) {{ module.exports = TEMPLATE_BASE64; }}\n')

with open('PO.xlsx', 'rb') as f:
    po_data = f.read()
po_b64 = base64.b64encode(po_data).decode('utf-8')

with open('sample_po_b64.js', 'w', encoding='utf-8') as f:
    f.write(f'var SAMPLE_PO_BASE64 = "{po_b64}";\nif (typeof module !== "undefined" && module.exports) {{ module.exports = SAMPLE_PO_BASE64; }}\n')

with open('Tồn Honeywell.xlsx', 'rb') as f:
    hw_data = f.read()
hw_b64 = base64.b64encode(hw_data).decode('utf-8')

with open('Tồn KDB.xlsx', 'rb') as f:
    kdb_data = f.read()
kdb_b64 = base64.b64encode(kdb_data).decode('utf-8')

with open('sample_inventory_b64.js', 'w', encoding='utf-8') as f:
    f.write(f'var SAMPLE_HW_BASE64 = "{hw_b64}";\nvar SAMPLE_KDB_BASE64 = "{kdb_b64}";\n')

print('Generated all base64 files successfully!')
