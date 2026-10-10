// KFM WMS Portal Application - PO Converter & Inventory Reconciliation
(function () {
  'use strict';

  // ============================================================
  // TAB NAVIGATION
  // ============================================================
  const tabBtnConvert = document.getElementById('tabBtnConvert');
  const tabBtnInventory = document.getElementById('tabBtnInventory');
  const tabBtnLocHW = document.getElementById('tabBtnLocHW');
  const tabBtnOrderKDB = document.getElementById('tabBtnOrderKDB');
  const tabConvert = document.getElementById('tabConvert');
  const tabInventory = document.getElementById('tabInventory');
  const tabLocHW = document.getElementById('tabLocHW');
  const tabOrderKDB = document.getElementById('tabOrderKDB');

  function switchTab(targetTab) {
    tabBtnConvert.classList.remove('active');
    tabBtnInventory.classList.remove('active');
    if (tabBtnLocHW) tabBtnLocHW.classList.remove('active');
    if (tabBtnOrderKDB) tabBtnOrderKDB.classList.remove('active');

    tabConvert.style.display = 'none';
    tabInventory.style.display = 'none';
    if (tabLocHW) tabLocHW.style.display = 'none';
    if (tabOrderKDB) tabOrderKDB.style.display = 'none';

    if (targetTab === 'tabConvert') {
      tabBtnConvert.classList.add('active');
      tabConvert.style.display = 'block';
    } else if (targetTab === 'tabInventory') {
      tabBtnInventory.classList.add('active');
      tabInventory.style.display = 'block';
    } else if (targetTab === 'tabLocHW') {
      if (tabBtnLocHW) tabBtnLocHW.classList.add('active');
      if (tabLocHW) tabLocHW.style.display = 'block';
    } else if (targetTab === 'tabOrderKDB') {
      if (tabBtnOrderKDB) tabBtnOrderKDB.classList.add('active');
      if (tabOrderKDB) tabOrderKDB.style.display = 'block';
    }
  }

  tabBtnConvert.addEventListener('click', () => switchTab('tabConvert'));
  tabBtnInventory.addEventListener('click', () => switchTab('tabInventory'));
  if (tabBtnLocHW) {
    tabBtnLocHW.addEventListener('click', () => switchTab('tabLocHW'));
  }
  if (tabBtnOrderKDB) {
    tabBtnOrderKDB.addEventListener('click', () => switchTab('tabOrderKDB'));
  }

  // ============================================================
  // UTILITIES
  // ============================================================
  const toastContainer = document.getElementById('toastContainer');

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

  function base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

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

  function parseDate(val) {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val.getTime())) {
      return new Date(val.getFullYear(), val.getMonth(), val.getDate());
    }
    if (typeof val === 'object' && val.result) {
      return parseDate(val.result);
    }
    if (typeof val === 'number' && val > 30000) {
      const utcDays = Math.floor(val - 25569);
      const d = new Date(utcDays * 86400 * 1000);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
    let str = String(val).trim();
    if (!str || str.toLowerCase() === 'none') return null;
    if (str.includes(' ')) {
      str = str.split(/\s+/)[0];
    }
    const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) {
      const day = parseInt(dmy[1], 10);
      const month = parseInt(dmy[2], 10) - 1;
      const year = parseInt(dmy[3], 10);
      const d = new Date(year, month, day);
      if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
        return d;
      }
    }
    const ymd = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (ymd) {
      const year = parseInt(ymd[1], 10);
      const month = parseInt(ymd[2], 10) - 1;
      const day = parseInt(ymd[3], 10);
      const d = new Date(year, month, day);
      if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
        return d;
      }
    }
    return null;
  }

  function processEstimateDate(val) {
    if (!val) return '';
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const parsed = parseDate(val);
    if (parsed) {
      if (parsed < today) {
        return formatDate(today);
      }
      return formatDate(parsed);
    }
    return formatDate(val);
  }

  function formatNumber(num) {
    if (num == null || isNaN(num)) return '0';
    return Number(num).toLocaleString('vi-VN');
  }

  // ============================================================
  // TAB 1: CONVERT TEMPLATE KDB -> HONEYWELL
  // ============================================================
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

  let convertedRows = [];
  let sourceFileName = '';
  let uniquePOCodes = new Set();
  let defaultSupplier = '';

  btnToggleLogic.addEventListener('click', () => {
    logicBanner.classList.toggle('collapsed');
  });

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

  async function handleIncomingFile(file) {
    const validExtensions = ['.xlsx', '.xls'];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValid) {
      showToast('Vui lòng chỉ tải lên file Excel (.xlsx hoặc .xls)!', 'error');
      return;
    }

    try {
      showToast('Đang đọc và phân tích file PO...', 'info');
      sourceFileName = file.name;
      const arrayBuffer = await file.arrayBuffer();
      await parsePOData(arrayBuffer, file.name);
      showToast(`Chuyển đổi thành công ${convertedRows.length} dòng dữ liệu!`, 'success');
    } catch (err) {
      console.error('File parsing error:', err);
      showToast('Có lỗi xảy ra khi đọc file: ' + err.message, 'error');
    }
  }

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

    let colB_po = 2;
    let colT_product = 20;
    let colAD_qty = 30;
    let colG_estDate = 7;
    let colK_supplier = 11;
    let colX_nsx = 24;
    let colY_hsd = 25;

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

    for (let r = 2; r <= poWs.rowCount; r++) {
      const row = poWs.getRow(r);
      const poCodeVal = row.getCell(colB_po).value;
      const productVal = row.getCell(colT_product).value;
      const qtyVal = row.getCell(colAD_qty).value;
      const estDateVal = row.getCell(colG_estDate).value;
      const supplierVal = row.getCell(colK_supplier).value;
      const nsxVal = row.getCell(colX_nsx).value;
      const hsdVal = row.getCell(colY_hsd).value;

      if (poCodeVal == null && productVal == null) {
        continue;
      }

      const poCode = poCodeVal != null ? String(poCodeVal).trim() : '';
      const productCode = productVal != null ? String(productVal).trim() : '';
      const qtyNum = qtyVal != null ? Number(qtyVal) : 0;
      const qty = !isNaN(qtyNum) ? qtyNum : 0;

      // Bỏ qua dòng nếu số lượng thực nhận <= 0
      if (qty <= 0) {
        skippedZeroCount++;
        continue;
      }

      const estDateStr = processEstimateDate(estDateVal);
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

    const firstPo = Array.from(uniquePOCodes)[0] || 'DATA';
    const now = new Date();
    const dateStamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
    inputFilename.placeholder = `file_nhap_hang_${firstPo}_${dateStamp}.xlsx`;

    updateUI(totalQty, skippedZeroCount);
  }

  function updateUI(totalQty, skippedZeroCount = 0) {
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

      const tdA = document.createElement('td');
      const spanA = document.createElement('strong');
      spanA.textContent = item.colA_poCode;
      tdA.appendChild(spanA);

      const tdB = document.createElement('td');
      tdB.textContent = item.colB_productCode;
      tdB.style.fontFamily = 'monospace';
      tdB.style.fontWeight = '600';

      const tdC = document.createElement('td');
      tdC.textContent = formatNumber(item.colC_expectedQty);
      tdC.style.fontWeight = '600';

      const tdD = document.createElement('td');
      tdD.textContent = item.colD_estimateReceiveTime;

      const tdE = document.createElement('td');
      tdE.textContent = currentNote || item.colE_customerNote || '';

      const tdF = document.createElement('td');
      const badgeF = document.createElement('span');
      badgeF.className = 'badge-channel';
      badgeF.textContent = currentChannel || item.colF_zoneType || 'B2B';
      tdF.appendChild(badgeF);

      const tdG = document.createElement('td');
      tdG.textContent = item.colG_supplier;

      const tdH = document.createElement('td');
      tdH.textContent = item.colH_productionDate;

      const tdI = document.createElement('td');
      tdI.textContent = item.colI_expiryDate;

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

  selectChannel.addEventListener('change', () => {
    if (convertedRows.length > 0) renderTableRows(convertedRows);
  });

  inputCustomerNote.addEventListener('input', () => {
    if (convertedRows.length > 0) renderTableRows(convertedRows);
  });

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
        throw new Error('Template file_nhap_hang không tồn tại.');
      }

      const templateBuffer = base64ToArrayBuffer(TEMPLATE_BASE64);
      const outWb = new ExcelJS.Workbook();
      await outWb.xlsx.load(templateBuffer);

      let outWs = outWb.getWorksheet('File nhập hàng');
      if (!outWs) outWs = outWb.worksheets[0];
      if (!outWs) throw new Error('Không tìm thấy sheet "File nhập hàng" trong file mẫu.');

      while (outWs.rowCount >= 3) {
        outWs.spliceRows(3, 1);
      }

      const selectedZone = selectChannel.value || 'B2B';
      const userNote = inputCustomerNote.value || '';

      // Thiết lập định dạng kiểu Text (@) cho Cột D (giống cột I & J)
      outWs.getColumn(4).numFmt = '@';
      outWs.getColumn(8).numFmt = '@';
      outWs.getColumn(9).numFmt = '@';
      outWs.getColumn(10).numFmt = '@';

      convertedRows.forEach((item, index) => {
        const rowNumber = 3 + index;
        const targetRow = outWs.getRow(rowNumber);

        targetRow.getCell(1).value = item.colA_poCode || '';
        targetRow.getCell(2).value = item.colB_productCode || '';
        targetRow.getCell(3).value = Number(item.colC_expectedQty) || 0;

        // Cột D: estimateReceiveTime - kiểu text giống cột I & J, nếu < today thì đổi thành today
        const estDateFinal = processEstimateDate(item.colD_estimateReceiveTime);
        const cellD = targetRow.getCell(4);
        cellD.value = estDateFinal || '';
        cellD.numFmt = '@';

        targetRow.getCell(5).value = userNote || item.colE_customerNote || '';
        targetRow.getCell(6).value = selectedZone;
        targetRow.getCell(7).value = item.colG_supplier || '';

        const cellH = targetRow.getCell(8);
        cellH.value = item.colH_productionDate || '';
        cellH.numFmt = '@';

        const cellI = targetRow.getCell(9);
        cellI.value = item.colI_expiryDate || '';
        cellI.numFmt = '@';

        const cellJ = targetRow.getCell(10);
        cellJ.value = item.colJ_inboundDate || '';
        cellJ.numFmt = '@';

        targetRow.commit();
      });

      const outBuffer = await outWb.xlsx.writeBuffer();
      const blob = new Blob([outBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

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

  // ============================================================
  // TAB 2: CHECK TỒN KDB VÀ HONEYWELL
  // ============================================================
  const dropZoneHW = document.getElementById('dropZoneHW');
  const dropZoneKDB = document.getElementById('dropZoneKDB');
  const fileInputHW = document.getElementById('fileInputHW');
  const fileInputKDB = document.getElementById('fileInputKDB');
  const btnSelectHW = document.getElementById('btnSelectHW');
  const btnSelectKDB = document.getElementById('btnSelectKDB');
  const statusHW = document.getElementById('statusHW');
  const statusKDB = document.getElementById('statusKDB');
  const fileNameHW = document.getElementById('fileNameHW');
  const fileNameKDB = document.getElementById('fileNameKDB');
  const btnLoadDemoInventory = document.getElementById('btnLoadDemoInventory');
  const btnCompareInventory = document.getElementById('btnCompareInventory');

  const invStatsSection = document.getElementById('invStatsSection');
  const statInvTotal = document.getElementById('statInvTotal');
  const statInvMatch = document.getElementById('statInvMatch');
  const statInvDiff = document.getElementById('statInvDiff');
  const statInvNetQty = document.getElementById('statInvNetQty');

  const invResultCard = document.getElementById('invResultCard');
  const invSubtitle = document.getElementById('invSubtitle');
  const btnResetInventory = document.getElementById('btnResetInventory');
  const btnDownloadInventoryReport = document.getElementById('btnDownloadInventoryReport');

  const filterPills = document.getElementById('filterPills');
  const invSearchInput = document.getElementById('invSearchInput');
  const invRowCount = document.getElementById('invRowCount');
  const invTableBody = document.getElementById('invTableBody');

  const badgeDiff = document.getElementById('badgeDiff');
  const badgeDiffQty = document.getElementById('badgeDiffQty');
  const badgeOnlyKDB = document.getElementById('badgeOnlyKDB');
  const badgeOnlyHW = document.getElementById('badgeOnlyHW');
  const badgeMatch = document.getElementById('badgeMatch');
  const badgeAll = document.getElementById('badgeAll');

  // Inventory State
  let hwBuffer = null;
  let kdbBuffer = null;
  let nameFileHW = '';
  let nameFileKDB = '';
  let comparisonResults = [];
  let currentInvFilter = 'diff'; // 'diff', 'diff_qty', 'only_kdb', 'only_hw', 'match', 'all'

  // Dropzone Events for HW
  ['dragenter', 'dragover'].forEach(name => {
    dropZoneHW.addEventListener(name, (e) => {
      e.preventDefault();
      dropZoneHW.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach(name => {
    dropZoneHW.addEventListener(name, (e) => {
      e.preventDefault();
      dropZoneHW.classList.remove('dragover');
    });
  });
  dropZoneHW.addEventListener('drop', (e) => {
    if (e.dataTransfer.files.length > 0) handleHWFile(e.dataTransfer.files[0]);
  });
  btnSelectHW.addEventListener('click', () => {
    fileInputHW.value = '';
    fileInputHW.click();
  });
  fileInputHW.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleHWFile(e.target.files[0]);
  });

  // Dropzone Events for KDB
  ['dragenter', 'dragover'].forEach(name => {
    dropZoneKDB.addEventListener(name, (e) => {
      e.preventDefault();
      dropZoneKDB.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach(name => {
    dropZoneKDB.addEventListener(name, (e) => {
      e.preventDefault();
      dropZoneKDB.classList.remove('dragover');
    });
  });
  dropZoneKDB.addEventListener('drop', (e) => {
    if (e.dataTransfer.files.length > 0) handleKDBFile(e.dataTransfer.files[0]);
  });
  btnSelectKDB.addEventListener('click', () => {
    fileInputKDB.value = '';
    fileInputKDB.click();
  });
  fileInputKDB.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleKDBFile(e.target.files[0]);
  });

  async function handleHWFile(file) {
    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      showToast('Vui lòng chọn file Excel Honeywell (.xlsx hoặc .xls)!', 'error');
      return;
    }
    nameFileHW = file.name;
    hwBuffer = await file.arrayBuffer();
    setHWReady(nameFileHW);
    checkEnableCompare();
  }

  async function handleKDBFile(file) {
    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      showToast('Vui lòng chọn file Excel KDB (.xlsx hoặc .xls)!', 'error');
      return;
    }
    nameFileKDB = file.name;
    kdbBuffer = await file.arrayBuffer();
    setKDBReady(nameFileKDB);
    checkEnableCompare();
  }

  function setHWReady(filename) {
    dropZoneHW.classList.add('has-file');
    statusHW.innerHTML = '<span class="status-badge ready">Đã sẵn sàng</span>';
    fileNameHW.textContent = filename;
    showToast(`Đã nhận file Honeywell: ${filename}`, 'info');
  }

  function setKDBReady(filename) {
    dropZoneKDB.classList.add('has-file');
    statusKDB.innerHTML = '<span class="status-badge ready">Đã sẵn sàng</span>';
    fileNameKDB.textContent = filename;
    showToast(`Đã nhận file KDB: ${filename}`, 'info');
  }

  function checkEnableCompare() {
    btnCompareInventory.disabled = !(hwBuffer && kdbBuffer);
  }

  // Load Demo Inventory Files
  btnLoadDemoInventory.addEventListener('click', () => {
    if (typeof SAMPLE_HW_BASE64 === 'undefined' || typeof SAMPLE_KDB_BASE64 === 'undefined') {
      showToast('Không tìm thấy dữ liệu tồn kho mẫu cục bộ.', 'error');
      return;
    }
    try {
      nameFileHW = 'Tồn Honeywell.xlsx';
      nameFileKDB = 'Tồn KDB.xlsx';
      hwBuffer = base64ToArrayBuffer(SAMPLE_HW_BASE64);
      kdbBuffer = base64ToArrayBuffer(SAMPLE_KDB_BASE64);
      setHWReady(nameFileHW);
      setKDBReady(nameFileKDB);
      checkEnableCompare();
      showToast('Đã tải thành công 2 file mẫu Tồn Honeywell và Tồn KDB!', 'success');
      // Auto run comparison on demo load
      runInventoryComparison();
    } catch (err) {
      console.error(err);
      showToast('Lỗi tải dữ liệu mẫu: ' + err.message, 'error');
    }
  });

  // Run Comparison Button
  btnCompareInventory.addEventListener('click', () => {
    runInventoryComparison();
  });

  async function runInventoryComparison() {
    if (!hwBuffer || !kdbBuffer) {
      showToast('Vui lòng tải lên cả 2 file Honeywell và KDB!', 'error');
      return;
    }

    try {
      showToast('Đang phân tích và đối soát tồn kho...', 'info');
      btnCompareInventory.disabled = true;

      // 1. Parse Honeywell
      const hwWb = new ExcelJS.Workbook();
      await hwWb.xlsx.load(hwBuffer);
      const hwWs = hwWb.worksheets[0];

      let colHw_sku = 3;
      let colHw_mcode = 4;
      let colHw_name = 6;
      let colHw_qty = 12;

      const hwHeaderRow = hwWs.getRow(1);
      if (hwHeaderRow) {
        hwHeaderRow.eachCell((cell, colNumber) => {
          const v = String(cell.value || '').trim().toLowerCase();
          if (v === 'sku') colHw_sku = colNumber;
          else if (v === 'mcode' || v === 'm code' || v === 'barcode' || v === 'mã vạch') colHw_mcode = colNumber;
          else if (v === 'sku name' || v === 'tên hàng' || v === 'tên sản phẩm') colHw_name = colNumber;
          else if (v.includes('total quantity') || v.includes('total qty')) colHw_qty = colNumber;
        });
      }

      const hwMap = new Map(); // key (mcode or sku) -> { sku, mcode, name, totalQty }

      for (let r = 2; r <= hwWs.rowCount; r++) {
        const row = hwWs.getRow(r);
        const skuVal = row.getCell(colHw_sku).value;
        const mcodeVal = row.getCell(colHw_mcode).value;
        const nameVal = row.getCell(colHw_name).value;
        const qtyVal = row.getCell(colHw_qty).value;

        const sku = skuVal != null ? String(skuVal).trim() : '';
        const mcode = mcodeVal != null ? String(mcodeVal).trim() : '';
        const name = nameVal != null ? String(nameVal).trim() : '';
        const key = mcode || sku;

        if (!key) continue;

        const qtyNum = qtyVal != null ? Number(qtyVal) : 0;
        const qty = !isNaN(qtyNum) ? qtyNum : 0;

        if (!hwMap.has(key)) {
          hwMap.set(key, { sku, mcode, name, qty: 0 });
        }
        const item = hwMap.get(key);
        item.qty += qty;
        if (!item.sku && sku) item.sku = sku;
        if (!item.name && name) item.name = name;
      }

      // 2. Parse KDB
      const kdbWb = new ExcelJS.Workbook();
      await kdbWb.xlsx.load(kdbBuffer);
      const kdbWs = kdbWb.worksheets[0];

      let colKdb_code = 3;
      let colKdb_name = 4;
      let colKdb_qty = 13;

      const kdbHeaderRow = kdbWs.getRow(1);
      if (kdbHeaderRow) {
        kdbHeaderRow.eachCell((cell, colNumber) => {
          const v = String(cell.value || '').trim().toLowerCase();
          if (v === 'mã hàng' || v === 'ma hang' || v === 'mã sp' || v === 'barcode' || v === 'sku') {
            colKdb_code = colNumber;
          } else if (v === 'tên hàng' || v === 'ten hang' || v === 'tên sản phẩm') {
            colKdb_name = colNumber;
          } else if ((v.includes('tồn cuối kỳ') || v.includes('ton cuoi ky') || v.includes('tồn kho')) && !v.includes('giá trị') && !v.includes('gia tri')) {
            colKdb_qty = colNumber;
          }
        });
      }

      const kdbMap = new Map(); // code -> { code, name, qty }

      for (let r = 2; r <= kdbWs.rowCount; r++) {
        const row = kdbWs.getRow(r);
        const codeVal = row.getCell(colKdb_code).value;
        const nameVal = row.getCell(colKdb_name).value;
        const qtyVal = row.getCell(colKdb_qty).value;

        const code = codeVal != null ? String(codeVal).trim() : '';
        const name = nameVal != null ? String(nameVal).trim() : '';

        if (!code) continue;

        const qtyNum = qtyVal != null ? Number(qtyVal) : 0;
        const qty = !isNaN(qtyNum) ? qtyNum : 0;

        if (!kdbMap.has(code)) {
          kdbMap.set(code, { code, name, qty: 0 });
        }
        const item = kdbMap.get(code);
        item.qty += qty;
        if (!item.name && name) item.name = name;
      }

      // 3. Reconcile
      const allKeys = new Set([...hwMap.keys(), ...kdbMap.keys()]);
      comparisonResults = [];

      let countMatch = 0;
      let countDiffQty = 0;
      let countOnlyKDB = 0;
      let countOnlyHW = 0;
      let netDiffQty = 0;

      allKeys.forEach(code => {
        const inHW = hwMap.has(code);
        const inKDB = kdbMap.has(code);
        const hwItem = hwMap.get(code) || { sku: '', mcode: code, name: '', qty: 0 };
        const kdbItem = kdbMap.get(code) || { code: code, name: '', qty: 0 };

        const qHW = hwItem.qty;
        const qKDB = kdbItem.qty;
        const diff = qHW - qKDB;
        netDiffQty += diff;

        let status = '';
        let statusType = '';

        if (inHW && inKDB) {
          if (diff === 0) {
            status = 'Khớp hoàn toàn';
            statusType = 'match';
            countMatch++;
          } else {
            status = 'Lệch số lượng';
            statusType = 'diff_qty';
            countDiffQty++;
          }
        } else if (inKDB && !inHW) {
          status = 'Chỉ có ở KDB';
          statusType = 'only_kdb';
          countOnlyKDB++;
        } else {
          status = 'Chỉ có ở Honeywell';
          statusType = 'only_hw';
          countOnlyHW++;
        }

        comparisonResults.push({
          code: code,
          sku: hwItem.sku || '',
          name: hwItem.name || kdbItem.name || '',
          qKDB: qKDB,
          qHW: qHW,
          diff: diff,
          status: status,
          statusType: statusType
        });
      });

      // Sort: Discrepant items first, ordered by largest difference
      comparisonResults.sort((a, b) => {
        if (a.statusType === 'match' && b.statusType !== 'match') return 1;
        if (a.statusType !== 'match' && b.statusType === 'match') return -1;
        return Math.abs(b.diff) - Math.abs(a.diff);
      });

      const totalDiffItems = countDiffQty + countOnlyKDB + countOnlyHW;

      // Update Badges
      badgeDiff.textContent = totalDiffItems;
      badgeDiffQty.textContent = countDiffQty;
      badgeOnlyKDB.textContent = countOnlyKDB;
      badgeOnlyHW.textContent = countOnlyHW;
      badgeMatch.textContent = countMatch;
      badgeAll.textContent = comparisonResults.length;

      // Update Stats
      statInvTotal.textContent = formatNumber(comparisonResults.length);
      statInvMatch.textContent = `${formatNumber(countMatch)} (${((countMatch/comparisonResults.length)*100).toFixed(1)}%)`;
      statInvDiff.textContent = `${formatNumber(totalDiffItems)} (${((totalDiffItems/comparisonResults.length)*100).toFixed(1)}%)`;
      statInvNetQty.textContent = `${netDiffQty > 0 ? '+' : ''}${formatNumber(netDiffQty)}`;

      invStatsSection.style.display = 'grid';
      invResultCard.style.display = 'block';

      invSubtitle.textContent = `Đối soát: ${nameFileHW} & ${nameFileKDB} — ${totalDiffItems} SKU lệch, ${countMatch} SKU khớp`;

      renderInventoryTable();
      showToast(`Đối soát xong ${comparisonResults.length} SKU! Có ${totalDiffItems} SKU bị lệch tồn.`, 'success');
    } catch (err) {
      console.error('Inventory compare error:', err);
      showToast('Lỗi đối soát tồn kho: ' + err.message, 'error');
    } finally {
      btnCompareInventory.disabled = false;
    }
  }

  // Filter Pills Handling
  filterPills.querySelectorAll('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      filterPills.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentInvFilter = btn.dataset.filter;
      renderInventoryTable();
    });
  });

  // Search in inventory
  invSearchInput.addEventListener('input', () => {
    renderInventoryTable();
  });

  function renderInventoryTable() {
    while (invTableBody.firstChild) {
      invTableBody.removeChild(invTableBody.firstChild);
    }

    const query = invSearchInput.value.toLowerCase().trim();

    const filtered = comparisonResults.filter(item => {
      // 1. Filter pill
      if (currentInvFilter === 'diff' && item.statusType === 'match') return false;
      if (currentInvFilter === 'diff_qty' && item.statusType !== 'diff_qty') return false;
      if (currentInvFilter === 'only_kdb' && item.statusType !== 'only_kdb') return false;
      if (currentInvFilter === 'only_hw' && item.statusType !== 'only_hw') return false;
      if (currentInvFilter === 'match' && item.statusType !== 'match') return false;

      // 2. Query search
      if (query) {
        return (
          item.code.toLowerCase().includes(query) ||
          item.sku.toLowerCase().includes(query) ||
          item.name.toLowerCase().includes(query)
        );
      }
      return true;
    });

    if (filtered.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 8;
      td.style.textAlign = 'center';
      td.style.padding = '2.5rem';
      td.textContent = 'Không có SKU nào phù hợp với bộ lọc hiển thị.';
      tr.appendChild(td);
      invTableBody.appendChild(tr);
      invRowCount.textContent = '0 dòng hiển thị';
      return;
    }

    filtered.forEach((item, index) => {
      const tr = document.createElement('tr');

      // STT
      const tdIdx = document.createElement('td');
      tdIdx.textContent = index + 1;
      tdIdx.style.textAlign = 'center';
      tdIdx.style.color = '#94a3b8';

      // SKU
      const tdSku = document.createElement('td');
      tdSku.textContent = item.sku || '-';
      tdSku.style.fontFamily = 'monospace';
      tdSku.style.fontWeight = '600';

      // Mã Hàng / Barcode
      const tdCode = document.createElement('td');
      tdCode.textContent = item.code;
      tdCode.style.fontFamily = 'monospace';
      tdCode.style.fontWeight = '600';
      tdCode.style.color = '#1e3a8a';

      // Tên sản phẩm
      const tdName = document.createElement('td');
      tdName.textContent = item.name;

      // Tồn KDB
      const tdKDB = document.createElement('td');
      tdKDB.textContent = formatNumber(item.qKDB);
      tdKDB.style.fontWeight = '600';
      tdKDB.style.textAlign = 'right';

      // Tồn HW
      const tdHW = document.createElement('td');
      tdHW.textContent = formatNumber(item.qHW);
      tdHW.style.fontWeight = '600';
      tdHW.style.textAlign = 'right';

      // Chênh lệch
      const tdDiff = document.createElement('td');
      tdDiff.style.textAlign = 'right';
      const spanDiff = document.createElement('span');
      spanDiff.className = 'diff-val';
      if (item.diff > 0) {
        spanDiff.className += ' positive';
        spanDiff.textContent = `+${formatNumber(item.diff)}`;
      } else if (item.diff < 0) {
        spanDiff.className += ' negative';
        spanDiff.textContent = formatNumber(item.diff);
      } else {
        spanDiff.className += ' zero';
        spanDiff.textContent = '0';
      }
      tdDiff.appendChild(spanDiff);

      // Trạng thái badge
      const tdStatus = document.createElement('td');
      tdStatus.style.textAlign = 'center';
      const badge = document.createElement('span');
      badge.className = `badge-status ${item.statusType.replace('_', '-')}`;
      badge.textContent = item.status;
      tdStatus.appendChild(badge);

      tr.appendChild(tdIdx);
      tr.appendChild(tdSku);
      tr.appendChild(tdCode);
      tr.appendChild(tdName);
      tr.appendChild(tdKDB);
      tr.appendChild(tdHW);
      tr.appendChild(tdDiff);
      tr.appendChild(tdStatus);

      invTableBody.appendChild(tr);
    });

    invRowCount.textContent = `Hiển thị ${filtered.length} / ${comparisonResults.length} SKU`;
  }

  // Reset Inventory
  btnResetInventory.addEventListener('click', () => {
    hwBuffer = null;
    kdbBuffer = null;
    nameFileHW = '';
    nameFileKDB = '';
    comparisonResults = [];

    dropZoneHW.classList.remove('has-file');
    dropZoneKDB.classList.remove('has-file');
    statusHW.innerHTML = '<span class="status-badge waiting">Chưa tải file</span>';
    statusKDB.innerHTML = '<span class="status-badge waiting">Chưa tải file</span>';
    fileNameHW.textContent = 'Kéo thả file Tồn Honeywell vào đây';
    fileNameKDB.textContent = 'Kéo thả file Tồn KDB vào đây';
    btnCompareInventory.disabled = true;

    invStatsSection.style.display = 'none';
    invResultCard.style.display = 'none';

    showToast('Đã làm mới dữ liệu đối soát tồn kho!', 'info');
  });

  // Export Inventory Discrepancy Report to Excel
  btnDownloadInventoryReport.addEventListener('click', async () => {
    if (comparisonResults.length === 0) {
      showToast('Chưa có dữ liệu đối soát để xuất!', 'error');
      return;
    }

    try {
      btnDownloadInventoryReport.disabled = true;
      btnDownloadInventoryReport.textContent = 'Đang tạo báo cáo...';

      const outWb = new ExcelJS.Workbook();
      const ws = outWb.addWorksheet('Báo Cáo Lệch Tồn');

      // Setup Headers
      ws.columns = [
        { header: 'STT', key: 'idx', width: 8 },
        { header: 'Mã SKU (HW)', key: 'sku', width: 16 },
        { header: 'Mã Hàng / Barcode', key: 'code', width: 20 },
        { header: 'Tên Sản Phẩm', key: 'name', width: 45 },
        { header: 'Tồn KDB', key: 'qKDB', width: 14 },
        { header: 'Tồn Honeywell (Total Qty)', key: 'qHW', width: 22 },
        { header: 'Chênh Lệch (HW - KDB)', key: 'diff', width: 20 },
        { header: 'Trạng Thái', key: 'status', width: 20 }
      ];

      // Style Header Row
      const headerRow = ws.getRow(1);
      headerRow.height = 26;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1E3A8A' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      // Add Data Rows
      comparisonResults.forEach((item, index) => {
        const row = ws.addRow({
          idx: index + 1,
          sku: item.sku,
          code: item.code,
          name: item.name,
          qKDB: item.qKDB,
          qHW: item.qHW,
          diff: item.diff,
          status: item.status
        });

        row.getCell(1).alignment = { horizontal: 'center' };
        row.getCell(2).alignment = { horizontal: 'center' };
        row.getCell(3).alignment = { horizontal: 'center' };
        row.getCell(5).numFmt = '#,##0';
        row.getCell(6).numFmt = '#,##0';
        row.getCell(7).numFmt = '#,##0';
        row.getCell(8).alignment = { horizontal: 'center' };

        // Color coding status
        if (item.statusType === 'diff_qty') {
          row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
          row.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        } else if (item.statusType === 'only_kdb') {
          row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
          row.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
        } else if (item.statusType === 'only_hw') {
          row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE9FE' } };
          row.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE9FE' } };
        } else {
          row.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
        }
      });

      const outBuffer = await outWb.xlsx.writeBuffer();
      const blob = new Blob([outBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      const now = new Date();
      const dateStamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
      const filename = `bao_cao_lech_ton_KDB_Honeywell_${dateStamp}.xlsx`;

      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      showToast(`Đã xuất báo cáo: ${filename}`, 'success');
    } catch (err) {
      console.error('Export report error:', err);
      showToast('Lỗi khi xuất báo cáo: ' + err.message, 'error');
    } finally {
      btnDownloadInventoryReport.disabled = false;
      btnDownloadInventoryReport.innerHTML = `
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.5V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        Xuất Báo Cáo Lệch Tồn (.xlsx)
      `;
    }
  });

  // ============================================================
  // TAB 3: HONEYWELL LOCATION CHECKER (XX-YYY-Z)
  // ============================================================
  const fileInputLoc = document.getElementById('fileInputLoc');
  const btnSelectLocFile = document.getElementById('btnSelectLocFile');
  const btnLoadDemoLoc = document.getElementById('btnLoadDemoLoc');
  const locFileName = document.getElementById('locFileName');

  const locStatsSection = document.getElementById('locStatsSection');
  const statLocTotalSKU = document.getElementById('statLocTotalSKU');
  const statLocTotalQty = document.getElementById('statLocTotalQty');
  const statLocStdQty = document.getElementById('statLocStdQty');
  const statLocNonStdQty = document.getElementById('statLocNonStdQty');

  const locSummaryGrid = document.getElementById('locSummaryGrid');
  const locResultCard = document.getElementById('locResultCard');
  const locSubtitle = document.getElementById('locSubtitle');
  const btnDownloadLocReport = document.getElementById('btnDownloadLocReport');

  const locFilterPills = document.getElementById('locFilterPills');
  const badgeLocNonStd = document.getElementById('badgeLocNonStd');
  const badgeLocQC = document.getElementById('badgeLocQC');
  const badgeLocTam = document.getElementById('badgeLocTam');
  const badgeLocStd = document.getElementById('badgeLocStd');
  const badgeLocAll = document.getElementById('badgeLocAll');

  const locSearchInput = document.getElementById('locSearchInput');
  const locRowCount = document.getElementById('locRowCount');
  const locTableBody = document.getElementById('locTableBody');

  const STD_LOCATION_REGEX = /^[A-Za-z0-9]{2}-[A-Za-z0-9]{3}-[A-Za-z0-9]$/;

  let honeywellLocationData = [];
  let currentLocFilter = 'non_std';
  let currentLocSearch = '';

  if (btnSelectLocFile && fileInputLoc) {
    btnSelectLocFile.addEventListener('click', () => {
      fileInputLoc.value = '';
      fileInputLoc.click();
    });

    fileInputLoc.addEventListener('change', async (e) => {
      if (e.target.files.length > 0) {
        const file = e.target.files[0];
        try {
          showToast(`Đang đọc file tồn Honeywell: ${file.name}...`, 'info');
          const buffer = await file.arrayBuffer();
          await parseAndCheckHoneywellLocation(buffer, file.name);
          showToast(`Đã kiểm tra xong vị trí tồn kho file ${file.name}!`, 'success');
        } catch (err) {
          console.error(err);
          showToast('Lỗi đọc file: ' + err.message, 'error');
        }
      }
    });
  }

  if (btnLoadDemoLoc) {
    btnLoadDemoLoc.addEventListener('click', async () => {
      try {
        if (typeof SAMPLE_HW_BASE64 !== 'undefined') {
          showToast('Đang tải dữ liệu mẫu Tồn Honeywell...', 'info');
          const buffer = base64ToArrayBuffer(SAMPLE_HW_BASE64);
          await parseAndCheckHoneywellLocation(buffer, 'Tồn Honeywell.xlsx (Mẫu)');
          showToast('Đã phân tích xong dữ liệu mẫu Tồn Honeywell!', 'success');
        } else {
          showToast('Không tìm thấy dữ liệu mẫu Honeywell.', 'error');
        }
      } catch (err) {
        console.error(err);
        showToast('Lỗi: ' + err.message, 'error');
      }
    });
  }

  async function parseAndCheckHoneywellLocation(arrayBuffer, fileName) {
    if (typeof ExcelJS === 'undefined') {
      throw new Error('Thư viện ExcelJS chưa sẵn sàng.');
    }

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arrayBuffer);

    if (wb.worksheets.length === 0) {
      throw new Error('File Excel không có sheet nào.');
    }

    const ws = wb.worksheets[0];

    // Detect column indexes (fallback to default standard columns: C=3, D=4, F=6, I=9, L=12)
    let colSKU = 3;
    let colCode = 4;
    let colName = 6;
    let colLoc = 9;
    let colQty = 12;

    const headerRow = ws.getRow(1);
    if (headerRow) {
      headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const txt = String(cell.value || '').trim().toLowerCase();
        if (txt === 'sku') {
          colSKU = colNumber;
        } else if (txt === 'mcode' || txt === 'mã hàng' || txt === 'barcode') {
          colCode = colNumber;
        } else if (txt === 'sku name' || txt === 'tên sản phẩm' || txt === 'tên hàng') {
          colName = colNumber;
        } else if (txt === 'location id' || txt === 'location' || txt === 'vị trí') {
          colLoc = colNumber;
        } else if (txt === 'total quantity' || txt === 'total qty' || txt.includes('total quantity')) {
          colQty = colNumber;
        }
      });
    }

    honeywellLocationData = [];

    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const skuVal = String(row.getCell(colSKU).value || '').trim();
      if (!skuVal) continue;

      const codeVal = String(row.getCell(colCode).value || '').trim();
      const nameVal = String(row.getCell(colName).value || '').trim();
      const locVal = String(row.getCell(colLoc).value || '').trim();

      const rawQty = row.getCell(colQty).value;
      let qty = 0;
      if (typeof rawQty === 'number') {
        qty = rawQty;
      } else if (rawQty != null) {
        const n = parseFloat(String(rawQty).replace(/,/g, ''));
        qty = isNaN(n) ? 0 : n;
      }

      const isStd = STD_LOCATION_REGEX.test(locVal);
      let statusType = 'std';
      let statusLabel = 'Chuẩn XX-YYY-Z';
      let note = 'Vị trí chuẩn kệ kho';

      const locUpper = locVal.toUpperCase();

      if (isStd) {
        statusType = 'std';
        statusLabel = 'Chuẩn XX-YYY-Z';
        note = 'Vị trí chuẩn kệ kho';
      } else if (qty === 0) {
        statusType = 'zero_qty';
        statusLabel = 'Vị trí cũ (Tồn = 0)';
        note = 'Định dạng cũ/lịch sử nhưng số lượng tồn = 0';
      } else if (locUpper.includes('QC')) {
        statusType = 'qc';
        statusLabel = 'INBOUND_QC (Chưa vào kệ)';
        note = 'Hàng đang ở khu vực kiểm QC, chưa putaway nhập kệ';
      } else if (locUpper.includes('TAM')) {
        statusType = 'tam';
        statusLabel = 'TAM.PL.6 (Tạm Pallet)';
        note = 'Hàng đang lưu tại pallet tạm, cần sắp xếp vào vị trí';
      } else {
        statusType = 'non_std';
        statusLabel = `Chưa chuẩn (${locVal || 'Trống'})`;
        note = 'Vị trí không theo chuẩn XX-YYY-Z, cần kiểm tra';
      }

      honeywellLocationData.push({
        sku: skuVal,
        code: codeVal,
        name: nameVal,
        location: locVal,
        qty: qty,
        isStandard: isStd,
        statusType: statusType,
        statusLabel: statusLabel,
        note: note
      });
    }

    if (locFileName) {
      locFileName.textContent = `${fileName} (${honeywellLocationData.length} dòng dữ liệu)`;
    }

    renderLocationAnalysis();
  }

  function renderLocationAnalysis() {
    if (honeywellLocationData.length === 0) {
      if (locStatsSection) locStatsSection.style.display = 'none';
      if (locSummaryGrid) locSummaryGrid.style.display = 'none';
      if (locResultCard) locResultCard.style.display = 'none';
      return;
    }

    const uniqueSKUCount = new Set(honeywellLocationData.map(r => r.sku)).size;
    const totalQty = honeywellLocationData.reduce((acc, r) => acc + r.qty, 0);

    const stdItems = honeywellLocationData.filter(r => r.isStandard);
    const stdQty = stdItems.reduce((acc, r) => acc + r.qty, 0);

    const nonStdActiveItems = honeywellLocationData.filter(r => !r.isStandard && r.qty > 0);
    const nonStdQty = nonStdActiveItems.reduce((acc, r) => acc + r.qty, 0);
    const nonStdSKUCount = new Set(nonStdActiveItems.map(r => r.sku)).size;

    const qcItems = honeywellLocationData.filter(r => r.statusType === 'qc');
    const qcQty = qcItems.reduce((acc, r) => acc + r.qty, 0);
    const qcSKUCount = new Set(qcItems.map(r => r.sku)).size;

    const tamItems = honeywellLocationData.filter(r => r.statusType === 'tam');
    const tamQty = tamItems.reduce((acc, r) => acc + r.qty, 0);
    const tamSKUCount = new Set(tamItems.map(r => r.sku)).size;

    // Update KPI cards
    if (statLocTotalSKU) statLocTotalSKU.textContent = formatNumber(uniqueSKUCount);
    if (statLocTotalQty) statLocTotalQty.textContent = formatNumber(totalQty);
    if (statLocStdQty) statLocStdQty.textContent = formatNumber(stdQty);
    if (statLocNonStdQty) statLocNonStdQty.textContent = formatNumber(nonStdQty);

    // Update breakdown summary boxes
    if (locSummaryGrid) {
      locSummaryGrid.innerHTML = `
        <div class="loc-summary-box warn">
          <div class="summary-box-top">
            <span class="box-tag red">INBOUND_QC</span>
            <strong>${formatNumber(qcQty)} sản phẩm</strong>
          </div>
          <p>${qcSKUCount} SKU &bull; ${qcItems.length} dòng đang ở khu vực kiểm hàng QC (chờ putaway nhập kệ)</p>
        </div>

        <div class="loc-summary-box amber">
          <div class="summary-box-top">
            <span class="box-tag amber">TAM.PL.6</span>
            <strong>${formatNumber(tamQty)} sản phẩm</strong>
          </div>
          <p>${tamSKUCount} SKU &bull; ${tamItems.length} dòng đang ở vị trí tạm Pallet (cần sắp xếp)</p>
        </div>

        <div class="loc-summary-box info">
          <div class="summary-box-top">
            <span class="box-tag blue">Chuẩn XX-YYY-Z</span>
            <strong>${formatNumber(stdQty)} sản phẩm</strong>
          </div>
          <p>${stdItems.length} dòng (${new Set(stdItems.map(r => r.sku)).size} SKU) đã ở vị trí lưu kho hợp lệ</p>
        </div>
      `;
    }

    // Update Badges
    if (badgeLocNonStd) badgeLocNonStd.textContent = nonStdActiveItems.length;
    if (badgeLocQC) badgeLocQC.textContent = qcItems.length;
    if (badgeLocTam) badgeLocTam.textContent = tamItems.length;
    if (badgeLocStd) badgeLocStd.textContent = stdItems.length;
    if (badgeLocAll) badgeLocAll.textContent = honeywellLocationData.length;

    if (locSubtitle) {
      locSubtitle.textContent = `Tổng: ${formatNumber(uniqueSKUCount)} SKU, ${formatNumber(totalQty)} sp. Phát hiện ${nonStdSKUCount} SKU (${formatNumber(nonStdQty)} sp) chưa ở vị trí chuẩn XX-YYY-Z!`;
    }

    // Show sections
    if (locStatsSection) locStatsSection.style.display = 'grid';
    if (locSummaryGrid) locSummaryGrid.style.display = 'grid';
    if (locResultCard) locResultCard.style.display = 'block';

    filterAndRenderLocationTable();
  }

  function filterAndRenderLocationTable() {
    if (!locTableBody) return;

    let filtered = honeywellLocationData.filter(item => {
      // 1. Filter pill
      if (currentLocFilter === 'non_std') {
        if (!(!item.isStandard && item.qty > 0)) return false;
      } else if (currentLocFilter === 'qc') {
        if (item.statusType !== 'qc') return false;
      } else if (currentLocFilter === 'tam') {
        if (item.statusType !== 'tam') return false;
      } else if (currentLocFilter === 'std') {
        if (!item.isStandard) return false;
      }

      // 2. Search query
      if (currentLocSearch) {
        const q = currentLocSearch.toLowerCase();
        const match =
          item.sku.toLowerCase().includes(q) ||
          item.code.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          item.location.toLowerCase().includes(q) ||
          item.statusLabel.toLowerCase().includes(q) ||
          item.note.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });

    if (locRowCount) {
      locRowCount.textContent = `Hiển thị ${filtered.length} dòng (trên tổng ${honeywellLocationData.length} dòng)`;
    }

    if (filtered.length === 0) {
      locTableBody.innerHTML = `
        <tr>
          <td colspan="8">
            <div class="empty-state">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h4>Không tìm thấy dữ liệu phù hợp</h4>
              <p>Thử đổi bộ lọc hoặc xóa từ khóa tìm kiếm</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const fragment = document.createDocumentFragment();

    filtered.forEach((item, index) => {
      const tr = document.createElement('tr');

      let locBadgeClass = 'std';
      let statusBadgeClass = 'std';

      if (!item.isStandard) {
        if (item.qty === 0) {
          locBadgeClass = 'std';
          statusBadgeClass = 'zero-qty';
        } else {
          locBadgeClass = 'non-std';
          statusBadgeClass = 'non-std';
        }
      }

      tr.innerHTML = `
        <td style="text-align: center; color: var(--slate-400);">${index + 1}</td>
        <td><strong>${item.sku}</strong></td>
        <td>${item.code || '-'}</td>
        <td style="max-width: 320px; white-space: normal;">${item.name || '-'}</td>
        <td><span class="loc-highlight ${locBadgeClass}">${item.location || '(Trống)'}</span></td>
        <td style="font-weight: 700; color: ${item.qty > 0 ? 'var(--slate-900)' : 'var(--slate-400)'};">${formatNumber(item.qty)}</td>
        <td><span class="badge-status ${statusBadgeClass}">${item.statusLabel}</span></td>
        <td style="font-size: 0.82rem; color: var(--slate-600);">${item.note}</td>
      `;

      fragment.appendChild(tr);
    });

    locTableBody.innerHTML = '';
    locTableBody.appendChild(fragment);
  }

  // Filter Pills Event Listener for Tab 3
  if (locFilterPills) {
    locFilterPills.addEventListener('click', (e) => {
      const btn = e.target.closest('.pill-btn');
      if (!btn) return;

      locFilterPills.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      currentLocFilter = btn.dataset.filter || 'non_std';
      filterAndRenderLocationTable();
    });
  }

  // Search Input for Tab 3
  if (locSearchInput) {
    locSearchInput.addEventListener('input', (e) => {
      currentLocSearch = e.target.value.trim();
      filterAndRenderLocationTable();
    });
  }

  // Download Location Report Excel
  if (btnDownloadLocReport) {
    btnDownloadLocReport.addEventListener('click', async () => {
      if (honeywellLocationData.length === 0) {
        showToast('Chưa có dữ liệu để xuất báo cáo!', 'error');
        return;
      }

      try {
        btnDownloadLocReport.disabled = true;
        btnDownloadLocReport.innerHTML = `<span>Đang tạo file Excel...</span>`;

        const outWb = new ExcelJS.Workbook();
        outWb.creator = 'KFM Operations Portal';
        outWb.created = new Date();

        const ws = outWb.addWorksheet('Vi_tri_ton_Honeywell', {
          views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }]
        });

        ws.columns = [
          { header: 'STT', key: 'stt', width: 8 },
          { header: 'Mã SKU', key: 'sku', width: 16 },
          { header: 'Mã Hàng / Barcode', key: 'code', width: 20 },
          { header: 'Tên Sản Phẩm', key: 'name', width: 45 },
          { header: 'Location ID', key: 'loc', width: 20 },
          { header: 'Số Lượng Tồn', key: 'qty', width: 16 },
          { header: 'Trạng Thái Vị Trí', key: 'status', width: 26 },
          { header: 'Ghi Chú Đánh Giá', key: 'note', width: 45 }
        ];

        // Style Header
        const headerRow = ws.getRow(1);
        headerRow.height = 26;
        headerRow.eachCell((cell) => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E293B' }
          };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        // Add Data Rows
        honeywellLocationData.forEach((item, idx) => {
          const row = ws.addRow({
            stt: idx + 1,
            sku: item.sku,
            code: item.code,
            name: item.name,
            loc: item.location,
            qty: item.qty,
            status: item.statusLabel,
            note: item.note
          });

          row.getCell(1).alignment = { horizontal: 'center' };
          row.getCell(2).alignment = { horizontal: 'center' };
          row.getCell(3).alignment = { horizontal: 'center' };
          row.getCell(5).alignment = { horizontal: 'center' };
          row.getCell(6).numFmt = '#,##0';
          row.getCell(7).alignment = { horizontal: 'center' };

          // Highlight non-standard locations with qty > 0
          if (!item.isStandard && item.qty > 0) {
            if (item.statusType === 'qc') {
              row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
              row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
            } else if (item.statusType === 'tam') {
              row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
              row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
            } else {
              row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
              row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
            }
          }
        });

        const outBuffer = await outWb.xlsx.writeBuffer();
        const blob = new Blob([outBuffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const now = new Date();
        const dateStamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const filename = `bao_cao_location_honeywell_${dateStamp}.xlsx`;

        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);

        showToast(`Đã xuất báo cáo: ${filename}`, 'success');
      } catch (err) {
        console.error(err);
        showToast('Lỗi khi xuất báo cáo: ' + err.message, 'error');
      } finally {
        btnDownloadLocReport.disabled = false;
        btnDownloadLocReport.innerHTML = `
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.5V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Xuất Báo Cáo Location (.xlsx)
        `;
      }
    });
  }

  // ============================================================
  // TAB 4: CONVERT ĐƠN HÀNG KDB -> HONEYWELL
  // ============================================================
  const btnToggleOrderLogic = document.getElementById('btnToggleOrderLogic');
  const orderLogicBanner = document.getElementById('orderLogicBanner');
  if (btnToggleOrderLogic && orderLogicBanner) {
    btnToggleOrderLogic.addEventListener('click', () => {
      orderLogicBanner.classList.toggle('collapsed');
    });
  }

  const orderDropZone = document.getElementById('orderDropZone');
  const orderFileInput = document.getElementById('orderFileInput');
  const btnSelectOrderFile = document.getElementById('btnSelectOrderFile');
  const btnLoadDemoOrder = document.getElementById('btnLoadDemoOrder');

  const orderInputPhone = document.getElementById('orderInputPhone');
  const orderInputService = document.getElementById('orderInputService');
  const orderInputSuffix = document.getElementById('orderInputSuffix');
  const orderInputFilename = document.getElementById('orderInputFilename');

  const orderStatsSection = document.getElementById('orderStatsSection');
  const statOrderTotalRows = document.getElementById('statOrderTotalRows');
  const statOrderCode = document.getElementById('statOrderCode');
  const statOrderDest = document.getElementById('statOrderDest');
  const statOrderTotalQty = document.getElementById('statOrderTotalQty');

  const orderTableSection = document.getElementById('orderTableSection');
  const orderTableToolbar = document.getElementById('orderTableToolbar');
  const orderSearchInput = document.getElementById('orderSearchInput');
  const orderTableRowCount = document.getElementById('orderTableRowCount');
  const orderTableBody = document.getElementById('orderTableBody');
  const btnDownloadOrder = document.getElementById('btnDownloadOrder');
  const btnResetOrder = document.getElementById('btnResetOrder');
  const orderPreviewSubtitle = document.getElementById('orderPreviewSubtitle');

  let convertedOrderRows = [];
  let orderUniqueCodes = new Set();
  let orderDestinations = new Set();
  let orderTotalQty = 0;
  let orderSourceFileName = '';

  function getTodayOrderSuffix() {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    return `_${dd}${mm}${yyyy}`;
  }

  if (orderInputSuffix) {
    orderInputSuffix.value = getTodayOrderSuffix();
  }

  function findTransferColumns(ws) {
    const cols = {
      reqCode: -1,
      barcode: -1,
      productName: -1,
      destShort: -1,
      destFull: -1,
      qty: -1
    };
    const headerRow = ws.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      const raw = String(cell.value || '').trim().toLowerCase();
      if (raw === 'mã yêu cầu' || raw === 'ma yeu cau' || raw === 'mã yc' || raw === 'ma yc' || raw === 'số yc' || raw === 'so yc' || raw === 'yêu cầu') {
        cols.reqCode = colNumber;
      } else if (raw === 'barcode' || raw === 'mã barcode' || raw === 'mã vạch' || raw === 'mã sản phẩm' || raw === 'mã hàng') {
        cols.barcode = colNumber;
      } else if (raw === 'tên sản phẩm' || raw === 'tên hàng' || raw === 'tên hàng hoá' || raw === 'ten san pham') {
        cols.productName = colNumber;
      } else if (raw.includes('nơi nhận') && (raw.includes('viết tắt') || raw.includes('vt') || raw.includes('(vt)'))) {
        cols.destShort = colNumber;
      } else if (raw === 'nơi nhận' || raw === 'tên nơi nhận' || raw === 'kho nhận' || raw === 'noi nhan') {
        cols.destFull = colNumber;
      } else if (raw.includes('số lượng cần chuyển') || raw.includes('sl cần chuyển') || raw.includes('so luong can chuyen') || raw === 'số lượng chuyển') {
        cols.qty = colNumber;
      }
    });

    if (cols.reqCode === -1) cols.reqCode = 2;
    if (cols.barcode === -1) cols.barcode = 3;
    if (cols.productName === -1) cols.productName = 4;
    if (cols.destShort === -1) cols.destShort = 14;
    if (cols.destFull === -1) cols.destFull = 15;
    if (cols.qty === -1) cols.qty = 17;

    return cols;
  }

  function renderOrderTable(rows) {
    if (!orderTableBody) return;
    orderTableBody.innerHTML = '';
    if (orderTableRowCount) {
      orderTableRowCount.textContent = `Hiển thị ${formatNumber(rows.length)} / ${formatNumber(convertedOrderRows.length)} dòng`;
    }

    const fragment = document.createDocumentFragment();
    const displayRows = rows.slice(0, 500);

    displayRows.forEach(item => {
      const tr = document.createElement('tr');

      const tdStt = document.createElement('td');
      tdStt.textContent = item.stt;
      tr.appendChild(tdStt);

      const tdOrder = document.createElement('td');
      const strongOrder = document.createElement('strong');
      strongOrder.textContent = item.orderCode;
      tdOrder.appendChild(strongOrder);
      tr.appendChild(tdOrder);

      const tdService = document.createElement('td');
      tdService.textContent = item.serviceType;
      tr.appendChild(tdService);

      // Cột C: Tên người nhận = Nơi nhận viết tắt (cột N)
      const tdReceiver = document.createElement('td');
      tdReceiver.textContent = item.receiverName;
      tdReceiver.style.fontWeight = '600';
      tr.appendChild(tdReceiver);

      const tdPhone = document.createElement('td');
      tdPhone.textContent = item.phone;
      tdPhone.style.fontFamily = 'monospace';
      tr.appendChild(tdPhone);

      // Cột E: Địa chỉ = Nơi nhận (cột O)
      const tdAddr = document.createElement('td');
      tdAddr.textContent = item.address;
      tr.appendChild(tdAddr);

      const tdBarcode = document.createElement('td');
      tdBarcode.textContent = item.barcode;
      tdBarcode.style.fontFamily = 'monospace';
      tdBarcode.style.fontWeight = '600';
      tr.appendChild(tdBarcode);

      const tdQty = document.createElement('td');
      tdQty.textContent = formatNumber(item.qty);
      tdQty.style.fontWeight = '600';
      tr.appendChild(tdQty);

      const tdTrans = document.createElement('td');
      const badgeTrans = document.createElement('span');
      badgeTrans.className = 'badge-channel';
      badgeTrans.textContent = item.transporter;
      tdTrans.appendChild(badgeTrans);
      tr.appendChild(tdTrans);

      const tdRate = document.createElement('td');
      tdRate.textContent = item.shippingRate;
      tr.appendChild(tdRate);

      const tdCod = document.createElement('td');
      tdCod.textContent = item.cod;
      tr.appendChild(tdCod);

      const tdReq = document.createElement('td');
      tdReq.textContent = item.orderReq;
      tr.appendChild(tdReq);

      const tdPay = document.createElement('td');
      tdPay.textContent = item.paymentType;
      tr.appendChild(tdPay);

      const tdProd = document.createElement('td');
      tdProd.textContent = item.productName;
      tr.appendChild(tdProd);

      // Cột S: Link bill sàn TMĐT = Mã yêu cầu (cột B)
      const tdLinkBill = document.createElement('td');
      tdLinkBill.textContent = item.linkBill;
      tdLinkBill.style.fontFamily = 'monospace';
      tr.appendChild(tdLinkBill);

      fragment.appendChild(tr);
    });

    orderTableBody.appendChild(fragment);

    if (rows.length > 500) {
      const trMore = document.createElement('tr');
      const tdMore = document.createElement('td');
      tdMore.colSpan = 15;
      tdMore.style.textAlign = 'center';
      tdMore.style.color = '#64748b';
      tdMore.style.fontStyle = 'italic';
      tdMore.style.padding = '1rem';
      tdMore.textContent = `... và ${formatNumber(rows.length - 500)} dòng khác (toàn bộ dữ liệu sẽ được xuất ra file Excel)`;
      trMore.appendChild(tdMore);
      orderTableBody.appendChild(trMore);
    }
  }

  async function parseTransferData(arrayBuffer, fileName) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arrayBuffer);
    const ws = wb.worksheets[0];
    if (!ws) throw new Error('File Excel không có sheet nào hợp lệ.');

    const colMap = findTransferColumns(ws);

    convertedOrderRows = [];
    orderUniqueCodes = new Set();
    orderDestinations = new Set();
    orderTotalQty = 0;
    orderSourceFileName = fileName || 'yeu_cau_chuyen_hang.xlsx';
    let skippedZero = 0;

    const phone = (orderInputPhone ? orderInputPhone.value.trim() : '') || '0973468464';
    const serviceType = (orderInputService ? orderInputService.value.trim() : '') || 'B2C3D';
    const defaultSuffix = getTodayOrderSuffix();
    const suffix = (orderInputSuffix ? orderInputSuffix.value.trim() : '') || defaultSuffix;

    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const reqCodeVal = row.getCell(colMap.reqCode).value;
      const barcodeVal = row.getCell(colMap.barcode).value;
      const productNameVal = row.getCell(colMap.productName).value;
      const destShortVal = row.getCell(colMap.destShort).value;
      const destFullVal = row.getCell(colMap.destFull).value;
      const qtyVal = row.getCell(colMap.qty).value;

      if (barcodeVal == null && productNameVal == null) continue;

      let qty = 0;
      if (qtyVal != null) {
        const n = Number(qtyVal);
        if (!isNaN(n)) qty = n;
      }

      if (qty <= 0) {
        skippedZero++;
        continue;
      }

      const reqCodeStr = reqCodeVal != null ? String(reqCodeVal).trim() : '';
      const barcodeStr = barcodeVal != null ? String(barcodeVal).trim() : '';
      const productNameStr = productNameVal != null ? String(productNameVal).trim() : '';
      const destShortStr = destShortVal != null ? String(destShortVal).trim() : '';
      const destFullStr = destFullVal != null ? String(destFullVal).trim() : '';

      const orderCode = destShortStr ? `${destShortStr}${suffix}` : `ORDER${suffix}`;
      orderUniqueCodes.add(orderCode);
      if (destFullStr) orderDestinations.add(destFullStr);
      orderTotalQty += qty;

      convertedOrderRows.push({
        stt: convertedOrderRows.length + 1,
        orderCode: orderCode,
        destShort: destShortStr,
        serviceType: serviceType,
        receiverName: destShortStr, // Tên người nhận = nơi nhận (viết tắt) - cột N
        destFull: destFullStr,
        phone: phone,
        address: destFullStr,       // Địa chỉ = nơi nhận - cột O
        ward: '',
        district: '',
        province: '',
        barcode: barcodeStr,
        qty: qty,
        transporter: 'GHN',
        shippingCode: '',
        shippingRate: 2,
        cod: 0,
        orderReq: 1,
        paymentType: 3,
        productName: productNameStr,
        reqCode: reqCodeStr,
        linkBill: reqCodeStr        // Cột S (Link bill sàn TMĐT) = Mã yêu cầu (cột B)
      });
    }

    if (convertedOrderRows.length === 0) {
      throw new Error('Không tìm thấy dòng dữ liệu hợp lệ (SL chuyển > 0) trong file KDB.');
    }

    if (statOrderTotalRows) statOrderTotalRows.textContent = formatNumber(convertedOrderRows.length);
    if (statOrderCode) statOrderCode.textContent = Array.from(orderUniqueCodes).join(', ') || '-';
    if (statOrderDest) statOrderDest.textContent = Array.from(orderDestinations).join(', ') || '-';
    if (statOrderTotalQty) statOrderTotalQty.textContent = formatNumber(orderTotalQty);

    if (orderStatsSection) orderStatsSection.style.display = 'grid';
    if (orderTableSection) orderTableSection.style.display = 'block';
    if (orderTableToolbar) orderTableToolbar.style.display = 'flex';
    if (btnDownloadOrder) btnDownloadOrder.disabled = false;

    if (orderPreviewSubtitle) {
      orderPreviewSubtitle.textContent = `File nguồn: ${fileName} | Đã tải ${convertedOrderRows.length} dòng (Đã lọc bỏ ${skippedZero} dòng SL <= 0)`;
    }

    const firstOrder = Array.from(orderUniqueCodes)[0] || 'ORDER';
    const now = new Date();
    const dateStamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    if (orderInputFilename) {
      orderInputFilename.placeholder = `order_honeywell_${firstOrder}_${dateStamp}.xlsx`;
    }

    renderOrderTable(convertedOrderRows);
  }

  async function handleOrderIncomingFile(file) {
    const validExtensions = ['.xlsx', '.xls'];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValid) {
      showToast('Vui lòng chỉ tải lên file Excel (.xlsx hoặc .xls)!', 'error');
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      await parseTransferData(arrayBuffer, file.name);
      showToast(`Đã tải thành công ${file.name}!`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi đọc file KDB: ' + err.message, 'error');
    }
  }

  if (orderDropZone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      orderDropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        orderDropZone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      orderDropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        orderDropZone.classList.remove('dragover');
      });
    });

    orderDropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length > 0) {
        handleOrderIncomingFile(files[0]);
      }
    });

    orderDropZone.addEventListener('click', (e) => {
      if (e.target.closest('#btnLoadDemoOrder')) return;
      if (orderFileInput) orderFileInput.click();
    });
  }

  if (btnSelectOrderFile && orderFileInput) {
    btnSelectOrderFile.addEventListener('click', (e) => {
      e.stopPropagation();
      orderFileInput.click();
    });

    orderFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleOrderIncomingFile(e.target.files[0]);
      }
    });
  }

  if (btnLoadDemoOrder) {
    btnLoadDemoOrder.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        if (typeof SAMPLE_TRANSFER_KDB_BASE64 !== 'undefined' && SAMPLE_TRANSFER_KDB_BASE64) {
          const buf = base64ToArrayBuffer(SAMPLE_TRANSFER_KDB_BASE64);
          await parseTransferData(buf, 'yeu_cau_chuyen_hang_thuong_10102026-094746.xlsx');
          showToast('Đã nạp file yêu cầu chuyển hàng KDB mẫu có sẵn!', 'success');
        } else {
          showToast('Không tìm thấy dữ liệu mẫu cục bộ cho chuyển hàng KDB.', 'error');
        }
      } catch (err) {
        console.error(err);
        showToast('Lỗi tải dữ liệu mẫu: ' + err.message, 'error');
      }
    });
  }

  if (orderSearchInput) {
    orderSearchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim().toLowerCase();
      if (!query) {
        renderOrderTable(convertedOrderRows);
        return;
      }
      const filtered = convertedOrderRows.filter(item =>
        item.barcode.toLowerCase().includes(query) ||
        item.productName.toLowerCase().includes(query) ||
        item.orderCode.toLowerCase().includes(query) ||
        item.destFull.toLowerCase().includes(query)
      );
      renderOrderTable(filtered);
    });
  }

  if (btnResetOrder) {
    btnResetOrder.addEventListener('click', () => {
      convertedOrderRows = [];
      orderUniqueCodes.clear();
      orderDestinations.clear();
      orderTotalQty = 0;
      if (orderFileInput) orderFileInput.value = '';
      if (orderSearchInput) orderSearchInput.value = '';
      if (orderStatsSection) orderStatsSection.style.display = 'none';
      if (orderTableSection) orderTableSection.style.display = 'none';
      if (orderTableToolbar) orderTableToolbar.style.display = 'none';
      if (btnDownloadOrder) btnDownloadOrder.disabled = true;
      if (orderTableBody) orderTableBody.innerHTML = '';
      if (orderInputSuffix) orderInputSuffix.value = getTodayOrderSuffix();
      showToast('Đã đặt lại dữ liệu tạo order.', 'info');
    });
  }

  if (btnDownloadOrder) {
    btnDownloadOrder.addEventListener('click', async () => {
      if (convertedOrderRows.length === 0) {
        showToast('Không có dữ liệu để xuất!', 'error');
        return;
      }

      try {
        btnDownloadOrder.disabled = true;
        btnDownloadOrder.textContent = 'Đang tạo file Excel...';

        if (typeof TEMPLATE_ORDER_HW_BASE64 === 'undefined' || !TEMPLATE_ORDER_HW_BASE64) {
          throw new Error('Template tạo order Honeywell không tồn tại.');
        }

        const templateBuffer = base64ToArrayBuffer(TEMPLATE_ORDER_HW_BASE64);
        const outWb = new ExcelJS.Workbook();
        await outWb.xlsx.load(templateBuffer);

        let outWs = outWb.worksheets[0];
        if (!outWs) throw new Error('Không tìm thấy sheet hợp lệ trong file template.');

        // Xóa các dòng mẫu từ dòng 4 trở đi
        while (outWs.rowCount >= 4) {
          outWs.spliceRows(4, 1);
        }

        // Định dạng Text (@) cho SĐT (cột 4) và Barcode (cột 9)
        outWs.getColumn(4).numFmt = '@';
        outWs.getColumn(9).numFmt = '@';

        const currentPhone = (orderInputPhone ? orderInputPhone.value.trim() : '') || '0973468464';
        const currentService = (orderInputService ? orderInputService.value.trim() : '') || 'B2C3D';
        const defaultSuffix = getTodayOrderSuffix();
        const currentSuffix = (orderInputSuffix ? orderInputSuffix.value.trim() : '') || defaultSuffix;

        convertedOrderRows.forEach((item, index) => {
          const rowNumber = 4 + index;
          const targetRow = outWs.getRow(rowNumber);

          const orderCode = item.destShort ? `${item.destShort}${currentSuffix}` : item.orderCode;

          targetRow.getCell(1).value = orderCode;
          targetRow.getCell(2).value = currentService;
          // Cột 3 (C): Tên người nhận = nơi nhận (viết tắt) - Cột N
          targetRow.getCell(3).value = item.destShort || '';

          const cellPhone = targetRow.getCell(4);
          cellPhone.value = currentPhone;
          cellPhone.numFmt = '@';

          // Cột 5 (E): Địa chỉ = nơi nhận - Cột O
          targetRow.getCell(5).value = item.destFull || '';
          targetRow.getCell(6).value = '';
          targetRow.getCell(7).value = '';
          targetRow.getCell(8).value = '';

          const cellBarcode = targetRow.getCell(9);
          cellBarcode.value = item.barcode || '';
          cellBarcode.numFmt = '@';

          targetRow.getCell(10).value = Number(item.qty) || 0;
          targetRow.getCell(11).value = 'GHN';
          targetRow.getCell(12).value = '';
          targetRow.getCell(13).value = 2;
          targetRow.getCell(14).value = 0;
          targetRow.getCell(15).value = 1;
          targetRow.getCell(16).value = 3;
          targetRow.getCell(17).value = item.productName || '';
          targetRow.getCell(18).value = '';
          // Cột 19 (S): Link Bill Sàn TMĐT = Mã yêu cầu (Cột B)
          targetRow.getCell(19).value = item.reqCode || '';
          targetRow.getCell(20).value = '';
          targetRow.getCell(21).value = '';

          targetRow.commit();
        });

        const outBuffer = await outWb.xlsx.writeBuffer();
        const blob = new Blob([outBuffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        let filename = orderInputFilename ? orderInputFilename.value.trim() : '';
        if (!filename) {
          const firstOrder = Array.from(orderUniqueCodes)[0] || 'ORDER';
          const now = new Date();
          const dateStamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
          filename = `order_honeywell_${firstOrder}_${dateStamp}.xlsx`;
        }
        if (!filename.toLowerCase().endsWith('.xlsx')) {
          filename += '.xlsx';
        }

        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);

        showToast(`Đã xuất file tạo order thành công: ${filename}`, 'success');
      } catch (err) {
        console.error('Order Export error:', err);
        showToast('Lỗi khi xuất file: ' + err.message, 'error');
      } finally {
        btnDownloadOrder.disabled = false;
        btnDownloadOrder.innerHTML = `
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.5V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Xuất File Tạo Order Honeywell (.xlsx)
        `;
      }
    });
  }

})();

