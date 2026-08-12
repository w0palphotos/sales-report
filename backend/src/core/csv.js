import { ALL_KEY } from './pivot.js';

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildCsv(report) {
  const { meta, columnKeys, rows, columnTotals, grandTotal } = report;
  const { rowFields, columnField, valueColumns } = meta;
  const lines = [];

  const header = [];
  for (const field of rowFields) header.push(field.label);

  if (columnField) {
    for (const columnKey of columnKeys) {
      for (const valueColumn of valueColumns) header.push(`${columnKey} · ${valueColumn.label}`);
    }
    for (const valueColumn of valueColumns) header.push(`${valueColumn.label} · Total`);
  } else {
    for (const valueColumn of valueColumns) header.push(valueColumn.label);
  }
  lines.push(header.map(csvCell).join(','));

  for (const row of rows) {
    const line = [];
    for (const field of rowFields) line.push(row.key[field.key]);

    if (columnField) {
      for (const columnKey of columnKeys) line.push(...row.cells[columnKey]);
      line.push(...row.rowTotal);
    } else {
      line.push(...row.cells[ALL_KEY]);
    }
    lines.push(line.map(csvCell).join(','));
  }

  const footer = [];
  rowFields.forEach((_, index) => footer.push(index === 0 ? 'Total' : ''));

  if (columnField) {
    for (const columnKey of columnKeys) footer.push(...columnTotals[columnKey]);
    footer.push(...grandTotal);
  } else {
    footer.push(...grandTotal);
  }
  lines.push(footer.map(csvCell).join(','));

  return lines.join('\r\n');
}
