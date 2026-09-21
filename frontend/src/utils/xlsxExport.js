import { injectNativeChart } from './xlsxChartXml.js';
import { resolveColor, resolveTableStyle, rowSignature, TOTAL_KEY } from './cellStyle.js';

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

function hexToArgb(hex) {
  let digits = String(hex ?? '').trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(digits)) digits = digits.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(digits)) return null;
  return `FF${digits.toUpperCase()}`;
}

function fillFor(hex) {
  const argb = hexToArgb(hex);
  return argb ? { type: 'pattern', pattern: 'solid', fgColor: { argb } } : null;
}

// Tint baris: warna persis aturan pertama yang cocok di antara field baris.
function rowTintHex(pivotRow, layout, colors) {
  for (const rf of layout.rowFields) {
    const rule = resolveColor(rf.key, pivotRow.key?.[rf.key], colors);
    if (rule?.bg) return rule.bg;
  }
  return null;
}

function columnTintHex(ck, layout, colors) {
  if (!layout.columnField || ck == null) return null;
  const rule = resolveColor(layout.columnField.key, ck, colors);
  return rule?.bg ?? null;
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

function addPivotHeaders(ws, layout, colors = {}, styles = {}) {
  const { rowFields, valueColumns, columnKeys, hasCol, valCount } = layout;

  if (!hasCol) {
    const row = ws.addRow([...rowFields.map((rf) => rf.label), ...valueColumns.map((vc) => vc.label)]);
    styleHeader(row);
    return;
  }

  // Row 1: top group header (column key spans valCount cells) + Grand Total.
  const top = rowFields.map((rf) => rf.label);
  for (const ck of columnKeys) {
    top.push(ck);
    for (let v = 1; v < valCount; v++) top.push('');
  }
  top.push('Grand Total');
  for (let v = 1; v < valCount; v++) top.push('');
  styleHeader(ws.addRow(top));

  // Row 2: value sub-headers under each column key.
  const sub = rowFields.map(() => '');
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

  // Tint sel grup kolom yang cocok (baris header atas, sel master merge).
  if (hasCol) {
    const topRow = ws.getRow(1);
    rowFields.forEach((rf, i) => {
      const ds = resolveTableStyle('column', `rowdim:${rf.key}`, styles);
      const fill = fillFor(ds?.bg);
      if (fill) topRow.getCell(i + 1).fill = fill;
    });
    let pos = rowFields.length + 1; // 1-based
    for (const ck of columnKeys) {
      const style =
        resolveTableStyle('column', `col:${layout.columnField.key}:${ck}`, styles) ?? null;
      const fill = fillFor(style?.bg ?? columnTintHex(ck, layout, colors));
      if (fill) topRow.getCell(pos).fill = fill;
      pos += Math.max(1, valCount);
    }
    // Header grup Grand Total.
    const grandStyle = resolveTableStyle(
      'column',
      `col:${layout.columnField.key}:${TOTAL_KEY}`,
      styles,
    );
    const grandFill = fillFor(grandStyle?.bg);
    if (grandFill) topRow.getCell(pos).fill = grandFill;
    // Sub-header measure (baris 2, Grand Total dikecualikan).
    const subRow = ws.getRow(2);
    for (let g = 0; g < columnKeys.length; g++) {
      for (let v = 0; v < Math.max(1, valCount); v++) {
        const vc = valueColumns[v];
        if (!vc) continue;
        const vs = resolveTableStyle('column', `val:${vc.field ?? vc.key}:${vc.aggregation}`, styles);
        const fill = fillFor(vs?.bg);
        if (fill) subRow.getCell(rowFields.length + 1 + g * Math.max(1, valCount) + v).fill = fill;
      }
    }
  } else {
    const headRow = ws.getRow(1);
    rowFields.forEach((rf, i) => {
      const ds = resolveTableStyle('column', `rowdim:${rf.key}`, styles);
      const fill = fillFor(ds?.bg);
      if (fill) headRow.getCell(i + 1).fill = fill;
    });
    valueColumns.forEach((vc, v) => {
      const vs = resolveTableStyle('column', `val:${vc.field ?? vc.key}:${vc.aggregation}`, styles);
      const fill = fillFor(vs?.bg);
      if (fill) headRow.getCell(rowFields.length + 1 + v).fill = fill;
    });
  }
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

function addPivotSheet(wb, layout, colors = {}, styles = {}) {
  const ws = wb.addWorksheet('Laporan Penjualan', { views: [{ showGridLines: true }] });
  addPivotHeaders(ws, layout, colors, styles);

  const rowFieldCount = layout.rowFields.length;
  for (const row of layout.rows) {
    const added = ws.addRow(pivotDataLine(row, layout));
    formatNumericCells(added);

    // Preseden sel label: kategori penuh > baris > kolom dimensi > tint lama.
    const tint = rowTintHex(row, layout, colors);
    const tintFill = fillFor(tint);
    const rowStyle = resolveTableStyle(
      'row',
      rowSignature(row.key, layout.rowFields),
      styles,
    );
    const rowFill = fillFor(rowStyle?.bg);
    const rowFont = rowStyle?.color ? hexToArgb(rowStyle.color) : null;
    for (let c = 1; c <= rowFieldCount; c++) {
      const rf = layout.rowFields[c - 1];
      const rule = resolveColor(rf.key, row.key?.[rf.key], colors);
      const cell = added.getCell(c);
      if (rule?.bg) {
        const fill = fillFor(rule.bg);
        if (fill) cell.fill = fill;
        const fontArgb = hexToArgb(rule.color);
        if (fontArgb) cell.font = { color: { argb: fontArgb } };
      } else if (rowFill) {
        cell.fill = rowFill;
        if (rowFont) cell.font = { color: { argb: rowFont } };
      } else {
        const ds = resolveTableStyle('column', `rowdim:${rf.key}`, styles);
        const dimFill = fillFor(ds?.bg);
        if (dimFill) {
          cell.fill = dimFill;
          const dimFont = ds.color ? hexToArgb(ds.color) : null;
          if (dimFont) cell.font = { color: { argb: dimFont } };
        } else if (tintFill) {
          cell.fill = tintFill;
        }
      }
    }

    // Preseden sel nilai: baris > kolom (grup lalu measure) > tint lama. Grand Total ikut baris.
    const valueCellCount = added.cellCount - rowFieldCount;
    for (let k = 0; k < valueCellCount; k++) {
      const groupIdx = layout.valCount === 0 ? -1 : Math.floor(k / layout.valCount);
      const ck =
        groupIdx >= 0 && groupIdx < layout.columnKeys.length ? layout.columnKeys[groupIdx] : null;
      const vc = layout.valueColumns[layout.valCount === 0 ? 0 : k % layout.valCount];
      let style = rowStyle?.bg ? rowStyle : null;
      if (!style && layout.columnField && groupIdx >= 0) {
        const groupKey =
          ck != null
            ? `col:${layout.columnField.key}:${ck}`
            : `col:${layout.columnField.key}:${TOTAL_KEY}`;
        style = resolveTableStyle('column', groupKey, styles) ?? null;
      }
      if (!style && vc) {
        style =
          resolveTableStyle('column', `val:${vc.field ?? vc.key}:${vc.aggregation}`, styles) ??
          null;
      }
      const legacy = columnTintHex(ck, layout, colors) ?? tint;
      const fill = fillFor(style?.bg ?? legacy);
      if (fill) {
        const cell = added.getCell(rowFieldCount + 1 + k);
        cell.fill = fill;
        const fontArgb = style?.color ? hexToArgb(style.color) : null;
        if (fontArgb) cell.font = { color: { argb: fontArgb } };
      }
    }
  }

  // Grand Total footer (only if row dimensions exist).
  if (layout.rowFields.length > 0) {
    const footer = ws.addRow(pivotFooterLine(layout));
    styleHeader(footer);
    formatNumericCells(footer, layout.rowFields.length + 1);
    const totalStyle = resolveTableStyle('row', TOTAL_KEY, styles);
    const totalFill = fillFor(totalStyle?.bg);
    if (totalFill) footer.eachCell((cell) => { cell.fill = totalFill; });
  }

  applyGridStyle(ws, 20);
  return ws;
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

// Blok data datar untuk chart, ditulis di bawah tabel pivot pada sheet yang sama.
function addVizBlock(ws, layout, startRow) {
  const { header, categories, seriesList } = buildVizModel(layout);

  const headerRow = ws.getRow(startRow);
  headerRow.values = header;
  styleHeader(headerRow);

  for (let rIdx = 0; rIdx < categories.length; rIdx++) {
    const added = ws.getRow(startRow + 1 + rIdx);
    added.values = [categories[rIdx], ...seriesList.map((s) => s.data[rIdx] ?? 0)];
    formatNumericCells(added, 2);
  }

  return {
    startRow,
    endRow: startRow + categories.length,
    categories,
    seriesList,
  };
}

export async function buildXlsxBuffer(report, colors = {}, tableStyles = {}) {
  const [{ default: ExcelJS }, { default: JSZip }] = await loadExcelLibs();
  const layout = buildPivotLayout(report);
  const cls = colors ?? {};
  const sty = tableStyles ?? {};

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sales Report Builder';
  wb.created = new Date();

  const ws = addPivotSheet(wb, layout, cls, sty);

  // Visualisasi menyatu di sheet yang sama, tepat di bawah tabel dengan margin.
  const anchorRowStart = ws.rowCount + 1; // 0-based: sisakan satu baris kosong
  const anchorRowEnd = anchorRowStart + 18;
  const vizStart = anchorRowEnd + 3; // data datar chart diletakkan di bawah chart
  const viz = addVizBlock(ws, layout, vizStart);
  applyGridStyle(ws, 20);

  const zip = await JSZip.loadAsync(await wb.xlsx.writeBuffer());

  // ExcelJS cannot author charts: inject a native OpenXML chart bound to the
  // flat chart block on the same "Laporan Penjualan" sheet.
  await injectNativeChart(zip, {
    seriesList: viz.seriesList,
    categories: viz.categories,
    geom: {
      headerRow: viz.startRow,
      startRow: viz.startRow + 1,
      endRow: viz.endRow,
      anchorFromCol: 0,
      anchorEndCol: 11,
      anchorRowStart,
      anchorRowEnd,
    },
  });

  return zip.generateAsync({ type: 'blob' });
}

export async function parseXlsxBuffer(buffer) {
  const { default: ExcelJS } = await import('exceljs');
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
