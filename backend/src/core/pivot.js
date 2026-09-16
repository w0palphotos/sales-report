import { DIMENSIONS, MEASURES, AGGREGATIONS } from './whitelist.js';

export const ALL_KEY = '__all__';

const toNumber = (value) => (typeof value === 'number' ? value : Number(value));

const round2 = (value) => {
  const number = Number.isFinite(value) ? value : toNumber(value);
  return Number.isInteger(number) ? number : Math.round(number * 100) / 100;
};

export function pivotReport(dbRows, config) {
  const { rows, columns, values } = config;
  const valueCount = values.length;

  const rowFields = rows.map((key) => ({ key, label: DIMENSIONS[key].label }));
  const columnField = columns.length
    ? { key: columns[0], label: DIMENSIONS[columns[0]].label }
    : null;

  const valueColumns = values.map((value) => {
    const fieldLabel = MEASURES[value.field]?.label ?? DIMENSIONS[value.field]?.label ?? value.field;
    return {
      field: value.field,
      aggregation: value.aggregation,
      label:
        value.aggregation === 'count'
          ? (value.field === 'amount' ? 'Jumlah Transaksi' : `Jumlah ${fieldLabel}`)
          : `${AGGREGATIONS[value.aggregation].label} ${fieldLabel}`,
    };
  });

  const zeroRow = () => Array.from({ length: valueCount }, () => 0);
  const cellValues = (row) =>
    Array.from({ length: valueCount }, (_, i) => round2(toNumber(row[`_v${i}`] ?? 0)));

  const rowIsNull = (row) => rows.every((_, i) => row[`_r${i}`] == null);
  const colIsNull = (row) => (columns.length ? row._c == null : true);

  const rowMap = new Map();
  const keyJson = (key) => JSON.stringify(key);
  const columnSet = new Set();
  let columnTotals = {};
  let grandTotal = null;

  for (const row of dbRows) {
    const valuesRow = cellValues(row);

    if (rowIsNull(row)) {
      if (colIsNull(row)) {
        grandTotal = valuesRow;
      } else {
        columnTotals[row._c] = valuesRow;
      }
      continue;
    }

    const key = Object.fromEntries(rows.map((field, i) => [field, row[`_r${i}`]]));
    const json = keyJson(key);
    const entry = rowMap.get(json) ?? { key, cells: {}, rowTotal: null };

    if (columns.length === 0) {
      entry.cells[ALL_KEY] = valuesRow;
      entry.rowTotal = valuesRow;
    } else if (colIsNull(row)) {
      entry.rowTotal = valuesRow;
    } else {
      columnSet.add(row._c);
      entry.cells[row._c] = valuesRow;
    }

    rowMap.set(json, entry);
  }

  const columnKeys = columns.length ? [...columnSet].sort() : [];
  const cellKeys = columns.length ? columnKeys : [ALL_KEY];

  const rowsOut = [...rowMap.values()].map((entry) => {
    const cells = {};
    for (const cellKey of cellKeys) cells[cellKey] = entry.cells[cellKey] ?? zeroRow();
    return { key: entry.key, cells, rowTotal: entry.rowTotal ?? zeroRow() };
  });

  const columnTotalsOut = {};
  for (const cellKey of cellKeys) columnTotalsOut[cellKey] = columnTotals[cellKey] ?? zeroRow();

  return {
    meta: {
      rows,
      columns,
      values,
      rowFields,
      columnField,
      valueColumns,
    },
    columnKeys,
    rows: rowsOut,
    columnTotals: columnTotalsOut,
    grandTotal: grandTotal ?? zeroRow(),
  };
}
