export const TRANSACTIONS = [
  { sales_name: 'Andi', city: 'Jakarta', product: 'Honda', amount: 120_000_000 },
  { sales_name: 'Andi', city: 'Bandung', product: 'Yamaha', amount: 90_000_000 },
  { sales_name: 'Budi', city: 'Jakarta', product: 'Suzuki', amount: 80_000_000 },
  { sales_name: 'Budi', city: 'Surabaya', product: 'Honda', amount: 95_000_000 },
  { sales_name: 'Citra', city: 'Bandung', product: 'Suzuki', amount: 70_000_000 },
  { sales_name: 'Citra', city: 'Surabaya', product: 'Yamaha', amount: 85_000_000 },
  { sales_name: 'Andi', city: 'Jakarta', product: 'Yamaha', amount: 75_000_000 },
];

const round2 = (value) => (Number.isInteger(value) ? value : Math.round(value * 100) / 100);

function aggregate(list, value) {
  if (value.aggregation === 'sum') {
    return round2(list.reduce((acc, t) => acc + t.amount, 0));
  }
  if (value.aggregation === 'avg') {
    return round2(list.reduce((acc, t) => acc + t.amount, 0) / list.length);
  }
  return list.length;
}

/**
 * Membangun "db rows" panjang seperti yang dihasilkan query GROUPING SETS
 * di PostgreSQL, dari daftar transaksi (setelah filter). Independen dari
 * implementasi pivot, jadi cocok sebagai fixture pengujian.
 */
export function buildDbRows(transactions, config) {
  const { rows, columns, values } = config;
  const colPresent = columns.length > 0;
  const keyOf = (parts) => parts.join('\u0000');
  const rowKey = (t) => keyOf(rows.map((field) => t[field]));

  const rowsList = [...new Set(transactions.map(rowKey))].sort();
  const colsList = colPresent
    ? [...new Set(transactions.map((t) => t[columns[0]]))].sort()
    : [];

  const groupBy = (getKey) => {
    const groups = new Map();
    for (const t of transactions) {
      const key = getKey(t);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(t);
    }
    return groups;
  };

  const compute = (list) => values.map((v) => aggregate(list, v));

  const out = [];
  const cellGroups = groupBy((t) => (colPresent ? keyOf([rowKey(t), t[columns[0]]]) : rowKey(t)));

  for (const rk of rowsList) {
    const rowKeyParts = rk.split('\u0000');
    for (const ck of colsList) {
      const list = cellGroups.get(colPresent ? keyOf([rk, ck]) : rk) ?? [];
      if (list.length === 0) continue;

      const result = {};
      rows.forEach((_, i) => { result[`_r${i}`] = rowKeyParts[i]; });
      if (colPresent) result._c = ck;
      values.forEach((_, i) => { result[`_v${i}`] = compute(list)[i]; });
      out.push(result);
    }

    const rowTotal = { };
    rows.forEach((_, i) => { rowTotal[`_r${i}`] = rowKeyParts[i]; });
    if (colPresent) rowTotal._c = null;
    values.forEach((_, i) => { rowTotal[`_v${i}`] = compute(groupBy(rowKey).get(rk))[i]; });
    out.push(rowTotal);
  }

  if (colPresent) {
    const colGroups = groupBy((t) => t[columns[0]]);
    for (const ck of colsList) {
      const colTotal = { };
      rows.forEach((_, i) => { colTotal[`_r${i}`] = null; });
      colTotal._c = ck;
      values.forEach((_, i) => { colTotal[`_v${i}`] = compute(colGroups.get(ck))[i]; });
      out.push(colTotal);
    }
  }

  const grand = { };
  rows.forEach((_, i) => { grand[`_r${i}`] = null; });
  if (colPresent) grand._c = null;
  values.forEach((_, i) => { grand[`_v${i}`] = compute(transactions)[i]; });
  out.push(grand);

  return out;
}
