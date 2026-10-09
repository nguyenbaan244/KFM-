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

print('Updated template_b64.js and sample_po_b64.js successfully!')
