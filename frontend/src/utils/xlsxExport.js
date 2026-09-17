import { injectNativeChart } from './xlsxChartXml.js';

function colToLetter(index) {
  let temp = index;
  let letter = '';
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter;
}

async function loadExcelLibs() {
  // ponytail: lazy-load heavy excel libs so they stay out of the initial bundle
  return Promise.all([import('exceljs'), import('jszip')]);
}

// Normalize the backend pivot payload once, so sheet builders share one shape.
function buildPivotLayout(report) {
  const { meta, columnKeys = [], rows = [], columnTotals = {}, grandTotal = [] } = report;
  const { rowFields = [], columnField = null, valueColumns = [] } = meta ?? {};
  return {
    rowFields,
    columnField,
    valueColumns,
    columnKeys,
    rows,
    columnTotals,
    grandTotal,
    hasCol: Boolean(columnField),
    valCount: valueColumns.length,
  };
}

function headerStyle() {
  return {
    font: { bold: true, name: 'Calibri', size: 11 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F6F3' } },
  };
}

function borderStyle() {
  const thin = { style: 'thin', color: { argb: 'FFE5E5E3' } };
  return { top: thin, left: thin, bottom: thin, right: thin };
}

function styleHeader(row) {
  const { font, fill } = headerStyle();
  row.font = font;
  row.fill = fill;
}

// Apply '#,##0' to every numeric cell from a 1-based start column.
function formatNumericCells(row, fromCol = 1) {
  for (let colIdx = fromCol; colIdx <= row.cellCount; colIdx++) {
    const cell = row.getCell(colIdx);
    if (typeof cell.value === 'number') cell.numFmt = '#,##0';
  }
}

function applyGridStyle(ws, colWidth) {
  const border = borderStyle();
  ws.columns.forEach((col) => {
    col.width = colWidth;
  });
  ws.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = border;
    });
  });
}

function addPivotHeaders(ws, layout) {
  const { rowFields, valueColumns, columnKeys, hasCol, valCount } = layout;

  if (!hasCol) {
    const row = ws.addRow([...rowFields.map((rf) => rf.label), ...valueColumns.map((vc) => vc.label)]);
    styleHeader(row);
    return;
  }

  // Row 1: top group header (column key spans valCount cells) + Grand Total.
  const top = [...rowFields.map((rf) => rf.label)];
  for (const ck of columnKeys) {
    top.push(ck);
    for (let v = 1; v < valCount; v++) top.push('');
  }
  top.push('Grand Total');
  for (let v = 1; v < valCount; v++) top.push('');
  styleHeader(ws.addRow(top));

  // Row 2: value sub-headers under each column key.
  const sub = [...rowFields.map(() => '')];
  for (let c = 0; c < columnKeys.length; c++) {
    for (const vc of valueColumns) sub.push(vc.label);
  }
  for (const vc of valueColumns) sub.push(vc.label);
  styleHeader(ws.addRow(sub));

  // Merges: row fields span both header rows; each column key spans its values.
  for (let i = 0; i < rowFields.length; i++) {
    const colLetter = colToLetter(i + 1);
    ws.mergeCells(`${colLetter}1:${colLetter}2`);
  }
  let offset = rowFields.length + 1;
  for (const _ck of columnKeys) {
    if (valCount > 1) ws.mergeCells(`${colToLetter(offset)}1:${colToLetter(offset + valCount - 1)}1`);
    offset += Math.max(1, valCount);
  }
  if (valCount > 1) ws.mergeCells(`${colToLetter(offset)}1:${colToLetter(offset + valCount - 1)}1`);
}

function pivotDataLine(row, layout) {
  const { rowFields, columnKeys, hasCol } = layout;
  const line = rowFields.map((rf) => row.key[rf.key] ?? '');
  if (hasCol) {
    for (const ck of columnKeys) line.push(...(row.cells[ck] ?? []));
    line.push(...(row.rowTotal ?? []));
  } else {
    line.push(...(row.cells['__all__'] ?? []));
  }
  return line;
}

function pivotFooterLine(layout) {
  const { rowFields, columnKeys, columnTotals, grandTotal, hasCol } = layout;
  const footer = rowFields.map((_, i) => (i === 0 ? 'Grand Total' : ''));
  if (hasCol) {
    for (const ck of columnKeys) footer.push(...(columnTotals[ck] ?? []));
    footer.push(...grandTotal);
  } else {
    footer.push(...grandTotal);
  }
  return footer;
}

function addPivotSheet(wb, layout) {
  const ws = wb.addWorksheet('Laporan Penjualan', { views: [{ showGridLines: true }] });
  addPivotHeaders(ws, layout);

  for (const row of layout.rows) {
    const added = ws.addRow(pivotDataLine(row, layout));
    formatNumericCells(added);
  }

  // Grand Total footer (only if row dimensions exist).
  if (layout.rowFields.length > 0) {
    const footer = ws.addRow(pivotFooterLine(layout));
    styleHeader(footer);
    formatNumericCells(footer, layout.rowFields.length + 1);
  }

  applyGridStyle(ws, 20);
}

// Flat model for the Visualisasi sheet: one category per pivot row,
// one series per column key (pivot with columns) or per value column.
function buildVizModel(layout) {
  const { rowFields, columnKeys, valueColumns, rows, hasCol } = layout;
  const categories = rows.map(
    (row) => rowFields.map((field) => row.key[field.key]).join(' · ') || 'Item',
  );

  if (hasCol) {
    return {
      header: [rowFields.map((rf) => rf.label).join(' · ') || 'Kategori', ...columnKeys],
      categories,
      seriesList: columnKeys.map((ck, i) => ({
        name: ck,
        colLetter: colToLetter(i + 2),
        data: rows.map((row) => (row.cells[ck] ? row.cells[ck][0] : 0)),
      })),
    };
  }

  return {
    header: [rowFields.map((rf) => rf.label).join(' · ') || 'Kategori', ...valueColumns.map((vc) => vc.label)],
    categories,
    seriesList: valueColumns.map((vc, i) => ({
      name: vc.label,
      colLetter: colToLetter(i + 2),
      data: rows.map((row) => (row.cells['__all__'] ? row.cells['__all__'][i] : 0)),
    })),
  };
}

function addVizSheet(wb, layout) {
  const ws = wb.addWorksheet('Visualisasi', { views: [{ showGridLines: true }] });
  const { header, categories, seriesList } = buildVizModel(layout);

  styleHeader(ws.addRow(header));
  for (let rIdx = 0; rIdx < layout.rows.length; rIdx++) {
    const added = ws.addRow([categories[rIdx], ...seriesList.map((s) => s.data[rIdx] ?? 0)]);
    formatNumericCells(added, 2);
  }

  applyGridStyle(ws, 22);
  return { categories, seriesList };
}

export async function buildXlsxBuffer(report) {
  const [{ default: ExcelJS }, { default: JSZip }] = await loadExcelLibs();
  const layout = buildPivotLayout(report);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sales Report Builder';
  wb.created = new Date();

  addPivotSheet(wb, layout);
  const viz = addVizSheet(wb, layout);

  const zip = await JSZip.loadAsync(await wb.xlsx.writeBuffer());

  // ExcelJS cannot author charts: inject a native OpenXML chart bound to the
  // Visualisasi flat table. Empty reports simply skip the chart.
  await injectNativeChart(zip, viz);

  return zip.generateAsync({ type: 'blob' });
}

export async function parseXlsxBuffer(buffer) {
  const [{ default: ExcelJS }] = await Promise.all([import('exceljs')]);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  const json = [];
  const headers = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell, colNumber) => {
        headers[colNumber] = String(cell.value ?? '').trim();
      });
    } else {
      const rowObj = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber];
        if (header) {
          rowObj[header] = cell.value;
        }
      });
      json.push(rowObj);
    }
  });
  return json;
}
