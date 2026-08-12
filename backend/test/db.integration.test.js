import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { buildReportQuery } from '../src/core/reportBuilder.js';
import { pivotReport } from '../src/core/pivot.js';
import { buildCsv } from '../src/core/csv.js';
import { TRANSACTIONS } from './helpers.js';

const here = dirname(fileURLToPath(import.meta.url));
let db;

before(async () => {
  db = new PGlite();

  const migration = await readFile(join(here, '..', 'db', 'migrations', '001_init.sql'), 'utf8');
  await db.exec(migration);

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
  const { sql, params } = buildReportQuery(config);
  const result = await db.query(sql, params);
  return pivotReport(result.rows, config);
}

describe('integration: migration + query dinamis + pivot (PostgreSQL sesungguhnya)', () => {
  it('Contoh 1: total per kota, baris diurutkan alfabetis', async () => {
    const report = await runReport({ rows: ['city'], columns: [], values: [{ field: 'amount', aggregation: 'sum' }] });

    assert.deepEqual(
      report.rows.map((row) => row.key.city),
      ['Bandung', 'Jakarta', 'Surabaya'],
    );
    assert.deepEqual(report.rows[1].cells.__all__, [275_000_000]);
    assert.deepEqual(report.grandTotal, [615_000_000]);
  });

  it('Contoh 4: total per sales dan kota', async () => {
    const report = await runReport({
      rows: ['sales_name'],
      columns: ['city'],
      values: [{ field: 'amount', aggregation: 'sum' }],
    });

    const andi = report.rows.find((row) => row.key.sales_name === 'Andi');
    assert.deepEqual(andi.cells.Jakarta, [195_000_000]);
    assert.deepEqual(andi.cells.Surabaya, [0]);
    assert.deepEqual(andi.rowTotal, [285_000_000]);
    assert.deepEqual(report.columnTotals.Jakarta, [275_000_000]);
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

    const honda = report.rows.find((row) => row.key.product === 'Honda');
    assert.deepEqual(honda.cells.__all__, [215_000_000, 107_500_000]);
  });

  it('COUNT menghitung transaksi per grup', async () => {
    const report = await runReport({
      rows: ['city'],
      columns: [],
      values: [{ field: 'amount', aggregation: 'count' }],
    });

    const jakarta = report.rows.find((row) => row.key.city === 'Jakarta');
    assert.deepEqual(jakarta.cells.__all__, [3]);
    assert.deepEqual(report.grandTotal, [7]);
  });

  it('filter "between" menyaring nilai', async () => {
    const report = await runReport({
      rows: ['city'],
      columns: [],
      values: [{ field: 'amount', aggregation: 'sum' }],
      filters: [{ field: 'amount', operator: 'between', value: [80_000_000, 100_000_000] }],
    });

    assert.deepEqual(report.grandTotal, [350_000_000]);
  });

  it('filter "contains" case-insensitive', async () => {
    const report = await runReport({
      rows: ['sales_name'],
      columns: [],
      values: [{ field: 'amount', aggregation: 'sum' }],
      filters: [{ field: 'city', operator: 'contains', value: 'ja' }],
    });

    assert.deepEqual(report.grandTotal, [275_000_000]);
  });

  it('export CSV berfungsi terhadap hasil query asli', async () => {
    const config = { rows: ['city'], columns: [], values: [{ field: 'amount', aggregation: 'sum' }] };
    const report = await runReport(config);
    const csv = buildCsv(report);

    assert.match(csv, /Kota,Total Penjualan/);
    assert.match(csv, /Total,615000000/);
  });
});
