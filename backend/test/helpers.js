import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ReportSchema } from '../src/core/ReportSchema.js';

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

// Meniru agregasi SQL di QueryBuilder dari daftar transaksi (setelah filter).
function aggregate(list, value) {
  const numbers = list.map((t) => Number(t[value.field]));
  const total = numbers.reduce((acc, n) => acc + n, 0);

  switch (value.aggregation) {
    case 'sum':
      return round2(total);
    case 'avg':
      return round2(total / list.length);
    case 'min':
      return round2(Math.min(...numbers));
    case 'max':
      return round2(Math.max(...numbers));
    case 'count':
      return list.length;
    case 'count_unique':
      return new Set(list.map((t) => t[value.field])).size;
    default:
      throw new Error(`Agregasi belum disimulasikan di fixture tes: ${value.aggregation}`);
  }
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

// Katalog field fixture. Di produksi isinya dibaca dari tabel `field_catalog`,
// di tes cukup data ini supaya mesin pivot bisa diuji tanpa database.
const FIELD_CATALOG = [
  { source_column: 'salesperson_id', field_key: 'sales_name', label: 'Nama Sales', reference_column: 'name' },
  { source_column: 'city_id', field_key: 'city', label: 'Kota', reference_column: 'name' },
  { source_column: 'product_id', field_key: 'product', label: 'Produk', reference_column: 'name' },
  { source_column: 'amount', field_key: 'amount', label: 'Penjualan', reference_column: null },
];

const FOREIGN_KEYS = [
  { column_name: 'salesperson_id', foreign_table: 'salespeople' },
  { column_name: 'city_id', foreign_table: 'cities' },
  { column_name: 'product_id', foreign_table: 'products' },
];

const SOURCE_COLUMNS = [
  { column_name: 'id', data_type: 'bigint' },
  { column_name: 'salesperson_id', data_type: 'integer' },
  { column_name: 'city_id', data_type: 'integer' },
  { column_name: 'product_id', data_type: 'integer' },
  { column_name: 'amount', data_type: 'numeric' },
  { column_name: 'created_at', data_type: 'timestamp with time zone' },
];

// Hasil introspeksi fixture: dipakai buildTestSchema() dan tes yang perlu
// menyuntikkan katalog field ke schema milik aplikasi (tanpa database).
export const TEST_INTROSPECTION = {
  foreignKeys: FOREIGN_KEYS,
  columns: SOURCE_COLUMNS,
  catalog: FIELD_CATALOG,
};

export function buildTestSchema() {
  const schema = new ReportSchema();
  schema.loadFromIntrospection(TEST_INTROSPECTION);
  return schema;
}

// Menerapkan seluruh file migrasi (urut nama) ke database tes.
export async function applyMigrations(db) {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations');
  const files = (await readdir(dir)).filter((file) => file.endsWith('.sql')).sort();
  for (const file of files) {
    await db.exec(await readFile(join(dir, file), 'utf8'));
  }
}
