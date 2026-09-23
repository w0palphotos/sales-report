import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { QueryBuilder } from '../src/core/QueryBuilder.js';
import { PivotEngine } from '../src/core/PivotEngine.js';
import { CsvFormatter } from '../src/core/CsvFormatter.js';
import { ReportSchema } from '../src/core/ReportSchema.js';
import { TRANSACTIONS, applyMigrations } from './helpers.js';

let db;
let schema;
let queryBuilder;
let pivotEngine;

before(async () => {
  db = new PGlite();
  await applyMigrations(db);

  schema = new ReportSchema(db);
  await schema.loadFromDatabase();
  queryBuilder = new QueryBuilder(schema);
  pivotEngine = new PivotEngine(schema);

  for (const name of ['Andi', 'Budi', 'Citra']) {
    await db.query('INSERT INTO salespeople (name) VALUES ($1)', [name]);
  }
  for (const name of ['Jakarta', 'Bandung', 'Surabaya']) {
    await db.query('INSERT INTO cities (name) VALUES ($1)', [name]);
  }
  for (const name of ['Honda', 'Suzuki', 'Yamaha']) {
    await db.query('INSERT INTO products (name) VALUES ($1)', [name]);
  }
  for (const transaction of TRANSACTIONS) {
    await db.query(
      `INSERT INTO sales (salesperson_id, city_id, product_id, amount)
       SELECT sp.id, c.id, p.id, $1
       FROM salespeople sp, cities c, products p
       WHERE sp.name = $2 AND c.name = $3 AND p.name = $4`,
      [transaction.amount, transaction.sales_name, transaction.city, transaction.product],
    );
  }
});

after(async () => {
  await db.close();
});

async function runReport(config) {
  const { sql, params } = queryBuilder.build(config);
  const result = await db.query(sql, params);
  return pivotEngine.pivot(result.rows, config);
}

const buildCsv = (report) => CsvFormatter.format(report);

const byRowKey = (report, ...keys) =>
  new Map(report.rows.map((row) => [keys.map((k) => row.key[k]).join('\u0000'), row]));

describe('integration: migration + query dinamis + pivot (PostgreSQL sesungguhnya)', () => {
  it('Contoh 1: total per kota, baris diurutkan alfabetis', async () => {
    const report = await runReport({
      rows: ['city'],
      columns: [],
      values: [{ field: 'amount', aggregation: 'sum' }],
    });

    const rows = byRowKey(report, 'city');
    assert.deepEqual(
      report.rows.map((r) => r.key.city),
      ['Bandung', 'Jakarta', 'Surabaya'],
    );
    assert.strictEqual(rows.get('Bandung').cells.__all__[0], 160_000_000);
    assert.strictEqual(rows.get('Jakarta').cells.__all__[0], 275_000_000);
    assert.strictEqual(rows.get('Surabaya').cells.__all__[0], 180_000_000);
    assert.deepEqual(report.grandTotal, [615_000_000]);
  });

  it('Contoh 4: total per sales dan kota', async () => {
    const report = await runReport({
      rows: ['sales_name'],
      columns: ['city'],
      values: [{ field: 'amount', aggregation: 'sum' }],
    });

    assert.deepEqual(report.columnKeys, ['Bandung', 'Jakarta', 'Surabaya']);
    const rows = byRowKey(report, 'sales_name');
    assert.deepEqual(rows.get('Andi').cells.Jakarta, [195_000_000]);
    assert.deepEqual(rows.get('Andi').cells.Bandung, [90_000_000]);
    assert.deepEqual(rows.get('Andi').cells.Surabaya, [0]);
    assert.deepEqual(rows.get('Andi').rowTotal, [285_000_000]);
    assert.deepEqual(report.grandTotal, [615_000_000]);
  });

  it('Contoh 10: total dan rata-rata per produk', async () => {
    const report = await runReport({
      rows: ['product'],
      columns: [],
      values: [
        { field: 'amount', aggregation: 'sum' },
        { field: 'amount', aggregation: 'avg' },
      ],
    });

    const rows = byRowKey(report, 'product');
    assert.deepEqual(rows.get('Honda').cells.__all__, [215_000_000, 107_500_000]);
    assert.deepEqual(rows.get('Suzuki').cells.__all__, [150_000_000, 75_000_000]);
    assert.deepEqual(rows.get('Yamaha').cells.__all__, [250_000_000, 83_333_333.33]);
    assert.deepEqual(report.grandTotal, [615_000_000, 87_857_142.86]);
  });

  it('COUNT menghitung transaksi per grup', async () => {
    const report = await runReport({
      rows: ['sales_name'],
      columns: [],
      values: [{ field: 'amount', aggregation: 'count' }],
    });

    const rows = byRowKey(report, 'sales_name');
    assert.strictEqual(rows.get('Andi').cells.__all__[0], 3);
    assert.strictEqual(rows.get('Budi').cells.__all__[0], 2);
    assert.strictEqual(rows.get('Citra').cells.__all__[0], 2);
    assert.deepEqual(report.grandTotal, [7]);
  });

  it('filter "between" menyaring nilai', async () => {
    const report = await runReport({
      rows: ['sales_name'],
      columns: [],
      values: [{ field: 'amount', aggregation: 'sum' }],
      filters: [{ field: 'amount', operator: 'between', value: [80_000_000, 100_000_000] }],
    });

    const rows = byRowKey(report, 'sales_name');
    assert.strictEqual(rows.get('Andi').cells.__all__[0], 90_000_000);
    assert.strictEqual(rows.get('Budi').cells.__all__[0], 175_000_000);
    assert.strictEqual(rows.get('Citra').cells.__all__[0], 85_000_000);
    assert.deepEqual(report.grandTotal, [350_000_000]);
  });

  it('filter "contains" case-insensitive', async () => {
    const report = await runReport({
      rows: ['sales_name'],
      columns: [],
      values: [{ field: 'amount', aggregation: 'sum' }],
      filters: [{ field: 'city', operator: 'contains', value: 'kar' }],
    });

    const rows = byRowKey(report, 'sales_name');
    assert.strictEqual(rows.get('Andi').cells.__all__[0], 195_000_000);
    assert.strictEqual(rows.get('Budi').cells.__all__[0], 80_000_000);
    assert.strictEqual(rows.has('Citra'), false);
    assert.deepEqual(report.grandTotal, [275_000_000]);
  });

  it('export CSV berfungsi terhadap hasil query asli', async () => {
    const report = await runReport({
      rows: ['city'],
      columns: [],
      values: [{ field: 'amount', aggregation: 'sum' }],
    });
    const csv = buildCsv(report);
    assert.ok(csv.includes('Jakarta,275000000'));
    assert.ok(csv.includes('Total,615000000'));
  });

  it('katalog field dibaca dari tabel field_catalog', () => {
    const salesperson = schema.getDimension('sales_name');
    assert.equal(salesperson.label, 'Nama Sales');
    assert.equal(salesperson.table, 'salespeople');
    assert.equal(salesperson.foreignKey, 'salesperson_id');

    assert.equal(schema.getDimension('amount').label, 'Penjualan');
    assert.equal(schema.getDimension('amount').type, 'number');
    // Kolom pembukuan tidak ikut menjadi field laporan.
    assert.equal(schema.getDimension('created_at'), undefined);
  });

  it('COUNT DISTINCT (Jumlah) menghitung nilai unik per grup', async () => {
    const report = await runReport({
      rows: ['sales_name'],
      columns: [],
      values: [{ field: 'city', aggregation: 'count_unique' }],
    });

    const rows = byRowKey(report, 'sales_name');
    assert.strictEqual(rows.get('Andi').cells.__all__[0], 2);
    assert.strictEqual(rows.get('Budi').cells.__all__[0], 2);
    assert.strictEqual(rows.get('Citra').cells.__all__[0], 2);
    assert.deepEqual(report.grandTotal, [3]);
  });

  it('filter "!=" mengecualikan nilai', async () => {
    const report = await runReport({
      rows: ['product'],
      columns: [],
      values: [{ field: 'amount', aggregation: 'sum' }],
      filters: [{ field: 'sales_name', operator: '!=', value: 'Andi' }],
    });

    const rows = byRowKey(report, 'product');
    assert.strictEqual(rows.get('Honda').cells.__all__[0], 95_000_000);
    assert.strictEqual(rows.get('Suzuki').cells.__all__[0], 150_000_000);
    // Yamaha: 85jt milik Citra; 90jt milik Andi ikut dikecualikan.
    assert.strictEqual(rows.get('Yamaha').cells.__all__[0], 85_000_000);
  });
});
