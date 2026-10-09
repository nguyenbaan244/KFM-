// PO to Inbound Data Converter Application
(function () {
  'use strict';

  // DOM Elements
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const btnSelectFile = document.getElementById('btnSelectFile');
  const btnLoadDemo = document.getElementById('btnLoadDemo');
  const btnDownload = document.getElementById('btnDownload');
  const btnReset = document.getElementById('btnReset');
  const btnToggleLogic = document.getElementById('btnToggleLogic');
  const logicBanner = document.getElementById('logicBanner');

  const selectChannel = document.getElementById('selectChannel');
  const inputCustomerNote = document.getElementById('inputCustomerNote');
  const inputFilename = document.getElementById('inputFilename');

  const statsSection = document.getElementById('statsSection');
  const statTotalRows = document.getElementById('statTotalRows');
  const statPOCode = document.getElementById('statPOCode');
  const statTotalQty = document.getElementById('statTotalQty');
  const statSupplier = document.getElementById('statSupplier');

  const previewSubtitle = document.getElementById('previewSubtitle');
  const tableToolbar = document.getElementById('tableToolbar');
  const searchInput = document.getElementById('searchInput');
  const tableRowCount = document.getElementById('tableRowCount');
  const tableBody = document.getElementById('tableBody');
  const toastContainer = document.getElementById('toastContainer');

  // Application State
  let convertedRows = [];
  let sourceFileName = '';
  let uniquePOCodes = new Set();
  let defaultSupplier = '';

  // Utility: Convert Base64 to ArrayBuffer
  function base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Utility: Show Toast Notification
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Format Date to DD/MM/YYYY
  function formatDate(val) {
    if (!val) return '';
    if (val instanceof Date && !isNaN(val)) {
      const day = String(val.getDate()).padStart(2, '0');
      const month = String(val.getMonth() + 1).padStart(2, '0');
      const year = val.getFullYear();
      return `${day}/${month}/${year}`;
    }
    if (typeof val === 'object' && val.result) {
      return formatDate(val.result);
    }
    const str = String(val).trim();
    if (str.toLowerCase() === 'none') return '';
    if (str.includes(' ')) {
      const parts = str.split(/\s+/);
      if (parts[0].includes('/') || parts[0].includes('-')) {
        return parts[0];
      }
    }
    return str;
  }

  // Format Number with Commas
  function formatNumber(num) {
    if (num == null || isNaN(num)) return '0';
    return Number(num).toLocaleString('vi-VN');
  }

  // Accordion Toggle for Mapping Logic
  btnToggleLogic.addEventListener('click', () => {
    logicBanner.classList.toggle('collapsed');
  });

  // Drag and Drop Handling
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleIncomingFile(files[0]);
    }
  });

  btnSelectFile.addEventListener('click', () => {
    fileInput.value = '';
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleIncomingFile(e.target.files[0]);
    }
  });

  // Demo File Handler
  btnLoadDemo.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      if (typeof SAMPLE_PO_BASE64 !== 'undefined') {
        const buf = base64ToArrayBuffer(SAMPLE_PO_BASE64);
        sourceFileName = 'PO.xlsx';
        await parsePOData(buf, sourceFileName);
        showToast('Đã tải thành công file PO mẫu!', 'success');
      } else {
        showToast('Không tìm thấy dữ liệu mẫu cục bộ.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Lỗi tải dữ liệu mẫu: ' + err.message, 'error');
    }
  });

  // Handle uploaded File
  async function handleIncomingFile(file) {
    const validExtensions = ['.xlsx', '.xls'];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValid) {
      showToast('Vui lòng chỉ tải lên file Excel (.xlsx hoặc .xls)!', 'error');
      return;
    }

    try {
      showToast('Đang đọc và phân tích file...', 'info');
      sourceFileName = file.name;
      const arrayBuffer = await file.arrayBuffer();
      await parsePOData(arrayBuffer, file.name);
      showToast(`Chuyển đổi thành công ${convertedRows.length} dòng dữ liệu!`, 'success');
    } catch (err) {
      console.error('File parsing error:', err);
      showToast('Có lỗi xảy ra khi đọc file: ' + err.message, 'error');
    }
  }

  // Parse PO Excel file and Map to Inbound format
  async function parsePOData(arrayBuffer, fileName) {
    if (typeof ExcelJS === 'undefined') {
      throw new Error('Thư viện ExcelJS chưa sẵn sàng.');
    }

    const poWb = new ExcelJS.Workbook();
    await poWb.xlsx.load(arrayBuffer);

    if (poWb.worksheets.length === 0) {
      throw new Error('File Excel không có sheet nào.');
    }

    const poWs = poWb.worksheets[0];

    // Find columns by header name or use user defaults:
    // Cột B: 2 (Mã PO) -> Cột A
    // Cột T: 20 (Mã hàng) -> Cột B
    // Cột AD: 30 (Số lượng PR thực nhận) -> Cột C (bỏ nếu = 0)
    // Cột G: 7 (Ngày NCC xác nhận) -> Cột D
    // Cột K: 11 (Tên NCC) -> Cột G
    // Cột X: 24 (NSX) -> Cột H
    // Cột Y: 25 (HSD) -> Cột I
    let colB_po = 2;
    let colT_product = 20;
    let colAD_qty = 30;
    let colG_estDate = 7;
    let colK_supplier = 11;
    let colX_nsx = 24;
    let colY_hsd = 25;

    // Detect header row (row 1)
    const headerRow = poWs.getRow(1);
    if (headerRow) {
      headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const txt = String(cell.value || '').trim().toLowerCase();
        if (txt === 'mã po' || txt === 'ma po') {
          colB_po = colNumber;
        } else if (txt === 'mã hàng' || txt === 'ma hang' || txt === 'mã sp' || txt === 'ma sp' || txt === 'barcode' || txt === 'mã vạch' || txt === 'ma vach') {
          colT_product = colNumber;
        } else if (txt.includes('số lượng pr (thực nhận)') || txt.includes('sl thực nhận') || txt.includes('so luong thuc nhan') || txt.includes('số lượng thực nhận')) {
          colAD_qty = colNumber;
        } else if (txt.includes('ngày giao hàng ncc xác nhận') || txt.includes('ngay giao hang ncc xac nhan') || txt.includes('xác nhận giao hàng')) {
          colG_estDate = colNumber;
        } else if (txt === 'tên nhà cung cấp' || txt === 'ten nha cung cap' || txt === 'tên ncc' || txt === 'ten ncc') {
          colK_supplier = colNumber;
        } else if (txt === 'nsx' || txt === 'ngày sản xuất' || txt === 'ngay san xuat') {
          colX_nsx = colNumber;
        } else if (txt === 'hsd' || txt === 'hạn sử dụng' || txt === 'han su dung') {
          colY_hsd = colNumber;
        }
      });
    }

    convertedRows = [];
    uniquePOCodes = new Set();
    let totalQty = 0;
    let skippedZeroCount = 0;
    defaultSupplier = '';

    const currentChannel = selectChannel.value || 'B2B';
    const currentNote = inputCustomerNote.value.trim();
    const todayStr = formatDate(new Date());

    // Loop through rows starting from row 2
    for (let r = 2; r <= poWs.rowCount; r++) {
      const row = poWs.getRow(r);
      const poCodeVal = row.getCell(colB_po).value;
      const productVal = row.getCell(colT_product).value;
      const qtyVal = row.getCell(colAD_qty).value;
      const estDateVal = row.getCell(colG_estDate).value;
      const supplierVal = row.getCell(colK_supplier).value;
      const nsxVal = row.getCell(colX_nsx).value;
      const hsdVal = row.getCell(colY_hsd).value;

      // Ignore row if both PO code and Product code are blank
      if (poCodeVal == null && productVal == null) {
        continue;
      }

      const poCode = poCodeVal != null ? String(poCodeVal).trim() : '';
      const productCode = productVal != null ? String(productVal).trim() : '';
      const qtyNum = qtyVal != null ? Number(qtyVal) : 0;
      const qty = !isNaN(qtyNum) ? qtyNum : 0;

      // Lưu ý: nếu dòng số lượng thực nhận ở cột AD trong file PO = 0 thì bỏ luôn dòng đó
      if (qty <= 0) {
        skippedZeroCount++;
        continue;
      }

      const estDateStr = formatDate(estDateVal);
      const supplier = supplierVal != null ? String(supplierVal).trim() : '';
      const nsxStr = formatDate(nsxVal);
      const hsdStr = formatDate(hsdVal);

      if (poCode) uniquePOCodes.add(poCode);
      if (supplier && !defaultSupplier) defaultSupplier = supplier;
      totalQty += qty;

      convertedRows.push({
        id: r,
        colA_poCode: poCode,
        colB_productCode: productCode,
        colC_expectedQty: qty,
        colD_estimateReceiveTime: estDateStr,
        colE_customerNote: currentNote,
        colF_zoneType: currentChannel,
        colG_supplier: supplier,
        colH_productionDate: nsxStr,
        colI_expiryDate: hsdStr,
        colJ_inboundDate: todayStr
      });
    }

    if (convertedRows.length === 0) {
      throw new Error('Không tìm thấy dòng dữ liệu nào hợp lệ trong file PO.');
    }

    // Auto suggest file name if empty
    const firstPo = Array.from(uniquePOCodes)[0] || 'DATA';
    const now = new Date();
    const dateStamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
    inputFilename.placeholder = `file_nhap_hang_${firstPo}_${dateStamp}.xlsx`;

    updateUI(totalQty, skippedZeroCount);
  }

  // Update UI Elements
  function updateUI(totalQty, skippedZeroCount = 0) {
    // Stats
    statTotalRows.textContent = convertedRows.length;
    statPOCode.textContent = Array.from(uniquePOCodes).join(', ') || '-';
    statTotalQty.textContent = formatNumber(totalQty);
    statSupplier.textContent = defaultSupplier || '-';
    statSupplier.title = defaultSupplier || '';

    statsSection.style.display = 'grid';
    tableToolbar.style.display = 'flex';
    btnReset.style.display = 'inline-flex';
    btnDownload.disabled = false;

    if (skippedZeroCount > 0) {
      previewSubtitle.textContent = `Nguồn file: ${sourceFileName} (${convertedRows.length} dòng hợp lệ — Đã loại bỏ ${skippedZeroCount} dòng có SL thực nhận = 0)`;
    } else {
      previewSubtitle.textContent = `Nguồn file: ${sourceFileName} (${convertedRows.length} dòng hợp lệ)`;
    }

    renderTableRows(convertedRows);
  }

  // Render Table Rows (Using safe DOM manipulation, avoiding innerHTML with user data)
  function renderTableRows(rows) {
    while (tableBody.firstChild) {
      tableBody.removeChild(tableBody.firstChild);
    }

    if (rows.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 10;
      td.style.textAlign = 'center';
      td.style.padding = '2rem';
      td.textContent = 'Không tìm thấy kết quả nào phù hợp với bộ lọc tìm kiếm.';
      tr.appendChild(td);
      tableBody.appendChild(tr);
      tableRowCount.textContent = '0 dòng hiển thị';
      return;
    }

    const currentChannel = selectChannel.value || 'B2B';
    const currentNote = inputCustomerNote.value || '';

    rows.forEach(item => {
      const tr = document.createElement('tr');

      // Col A: Mã PO
      const tdA = document.createElement('td');
      const spanA = document.createElement('strong');
      spanA.textContent = item.colA_poCode;
      tdA.appendChild(spanA);

      // Col B: Mã hàng (productCode)
      const tdB = document.createElement('td');
      tdB.textContent = item.colB_productCode;
      tdB.style.fontFamily = 'monospace';
      tdB.style.fontWeight = '600';

      // Col C: Số lượng
      const tdC = document.createElement('td');
      tdC.textContent = formatNumber(item.colC_expectedQty);
      tdC.style.fontWeight = '600';

      // Col D: Thời gian dự kiến
      const tdD = document.createElement('td');
      tdD.textContent = item.colD_estimateReceiveTime;

      // Col E: Ghi chú khách hàng (Để trống theo mặc định)
      const tdE = document.createElement('td');
      tdE.textContent = currentNote || item.colE_customerNote || '';

      // Col F: Kênh bán hàng (B2B)
      const tdF = document.createElement('td');
      const badgeF = document.createElement('span');
      badgeF.className = 'badge-channel';
      badgeF.textContent = currentChannel || item.colF_zoneType || 'B2B';
      tdF.appendChild(badgeF);

      // Col G: Nhà cung cấp
      const tdG = document.createElement('td');
      tdG.textContent = item.colG_supplier;

      // Col H: NSX
      const tdH = document.createElement('td');
      tdH.textContent = item.colH_productionDate;

      // Col I: HSD
      const tdI = document.createElement('td');
      tdI.textContent = item.colI_expiryDate;

      // Col J: Ngày nhập kho
      const tdJ = document.createElement('td');
      tdJ.textContent = item.colJ_inboundDate;

      tr.appendChild(tdA);
      tr.appendChild(tdB);
      tr.appendChild(tdC);
      tr.appendChild(tdD);
      tr.appendChild(tdE);
      tr.appendChild(tdF);
      tr.appendChild(tdG);
      tr.appendChild(tdH);
      tr.appendChild(tdI);
      tr.appendChild(tdJ);

      tableBody.appendChild(tr);
    });

    tableRowCount.textContent = `Hiển thị ${rows.length} / ${convertedRows.length} dòng`;
  }

  // Search Filter Handler
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase().trim();
    if (!query) {
      renderTableRows(convertedRows);
      return;
    }

    const filtered = convertedRows.filter(item => {
      return (
        item.colA_poCode.toLowerCase().includes(query) ||
        item.colB_productCode.toLowerCase().includes(query) ||
        item.colD_estimateReceiveTime.toLowerCase().includes(query) ||
        item.colG_supplier.toLowerCase().includes(query) ||
        item.colH_productionDate.toLowerCase().includes(query) ||
        item.colI_expiryDate.toLowerCase().includes(query)
      );
    });

    renderTableRows(filtered);
  });

  // Re-render when Settings change
  selectChannel.addEventListener('change', () => {
    if (convertedRows.length > 0) {
      renderTableRows(convertedRows);
    }
  });

  inputCustomerNote.addEventListener('input', () => {
    if (convertedRows.length > 0) {
      renderTableRows(convertedRows);
    }
  });

  // Reset Handler
  btnReset.addEventListener('click', () => {
    convertedRows = [];
    sourceFileName = '';
    uniquePOCodes.clear();
    defaultSupplier = '';
    searchInput.value = '';
    inputFilename.value = '';
    inputFilename.placeholder = 'Tự động đặt theo Mã PO';

    statsSection.style.display = 'none';
    tableToolbar.style.display = 'none';
    btnReset.style.display = 'none';
    btnDownload.disabled = true;
    previewSubtitle.textContent = 'Vui lòng tải lên file PO để bắt đầu xem trước dữ liệu';

    while (tableBody.firstChild) {
      tableBody.removeChild(tableBody.firstChild);
    }

    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 10;
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    
    const h4 = document.createElement('h4');
    h4.textContent = 'Chưa có dữ liệu chuyển đổi';
    const p = document.createElement('p');
    p.textContent = 'Kéo thả file PO vào khung phía trên hoặc bấm "Chọn file từ máy tính"';
    
    emptyState.appendChild(h4);
    emptyState.appendChild(p);
    td.appendChild(emptyState);
    tr.appendChild(td);
    tableBody.appendChild(tr);

    showToast('Đã làm mới dữ liệu!', 'info');
  });

  // Download Output Excel File
  btnDownload.addEventListener('click', async () => {
    if (convertedRows.length === 0) {
      showToast('Chưa có dữ liệu để xuất file!', 'error');
      return;
    }

    try {
      btnDownload.disabled = true;
      btnDownload.textContent = 'Đang tạo file...';
      showToast('Đang tạo file nhập hàng...', 'info');

      if (typeof TEMPLATE_BASE64 === 'undefined') {
        throw new Error('Template file_nhap_hang (1) (1).xlsx không tồn tại.');
      }

      // Load Template
      const templateBuffer = base64ToArrayBuffer(TEMPLATE_BASE64);
      const outWb = new ExcelJS.Workbook();
      await outWb.xlsx.load(templateBuffer);

      let outWs = outWb.getWorksheet('File nhập hàng');
      if (!outWs) {
        outWs = outWb.worksheets[0];
      }
      if (!outWs) {
        throw new Error('Không tìm thấy sheet "File nhập hàng" trong file mẫu.');
      }

      // Clear sample rows in template if any
      while (outWs.rowCount >= 3) {
        outWs.spliceRows(3, 1);
      }

      const selectedZone = selectChannel.value || 'B2B';
      const userNote = inputCustomerNote.value || '';

      // Populate data rows starting at Row 3
      convertedRows.forEach((item, index) => {
        const rowNumber = 3 + index;
        const targetRow = outWs.getRow(rowNumber);

        // Col A: Mã PO
        targetRow.getCell(1).value = item.colA_poCode || '';
        // Col B: Mã sản phẩm (Mã hàng)
        targetRow.getCell(2).value = item.colB_productCode || '';
        // Col C: Số lượng nhập (Number)
        targetRow.getCell(3).value = Number(item.colC_expectedQty) || 0;
        // Col D: Thời gian dự kiến (dd/mm/yyyy)
        targetRow.getCell(4).value = item.colD_estimateReceiveTime || '';
        // Col E: Ghi chú của khách hàng (Để trống hoặc userNote nếu có)
        targetRow.getCell(5).value = userNote || item.colE_customerNote || '';
        // Col F: Kênh bán hàng (B2B)
        targetRow.getCell(6).value = selectedZone;
        // Col G: Nhà cung cấp
        targetRow.getCell(7).value = item.colG_supplier || '';
        // Col H: Ngày sản xuất
        targetRow.getCell(8).value = item.colH_productionDate || '';
        // Col I: Hạn sử dụng
        targetRow.getCell(9).value = item.colI_expiryDate || '';
        // Col J: Ngày nhập kho (Today)
        targetRow.getCell(10).value = item.colJ_inboundDate || '';

        targetRow.commit();
      });

      // Generate Download File
      const outBuffer = await outWb.xlsx.writeBuffer();
      const blob = new Blob([outBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      // Filename determination
      let filename = inputFilename.value.trim();
      if (!filename) {
        const firstPo = Array.from(uniquePOCodes)[0] || 'DON_HANG';
        const now = new Date();
        const dateStamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
        filename = `file_nhap_hang_${firstPo}_${dateStamp}.xlsx`;
      }
      if (!filename.toLowerCase().endsWith('.xlsx')) {
        filename += '.xlsx';
      }

      // Trigger Browser Download
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      showToast(`Đã tải xuống file: ${filename}`, 'success');
    } catch (err) {
      console.error('Export error:', err);
      showToast('Lỗi khi xuất file: ' + err.message, 'error');
    } finally {
      btnDownload.disabled = false;
      btnDownload.innerHTML = `
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.5V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        Xuất File Nhập Hàng (.xlsx)
      `;
    }
  });

})();
