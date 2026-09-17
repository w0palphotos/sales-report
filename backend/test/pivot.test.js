import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PivotEngine, ALL_KEY } from '../src/core/PivotEngine.js';
import { ReportSchema } from '../src/core/ReportSchema.js';
import { TRANSACTIONS, buildDbRows } from './helpers.js';

const schema = new ReportSchema();
const engine = new PivotEngine(schema);
const pivotReport = (dbRows, config) => engine.pivot(dbRows, config);

const byRowKey = (report, ...keys) =>
  new Map(report.rows.map((row) => [keys.map((k) => row.key[k]).join('\u0000'), row]));

describe('pivotReport (cocok dengan contoh di assignment)', () => {
  it('Contoh 1: Total Penjualan per Kota (baris, tanpa kolom)', () => {
    const config = { rows: ['city'], columns: [], values: [{ field: 'amount', aggregation: 'sum' }] };
    const report = pivotReport(buildDbRows(TRANSACTIONS, config), config);

    assert.deepEqual(report.columnKeys, []);
    assert.deepEqual(report.meta.valueColumns, [{ field: 'amount', aggregation: 'sum', label: 'Total Penjualan' }]);

    const rows = byRowKey(report, 'city');
    assert.strictEqual(rows.get('Jakarta').cells[ALL_KEY][0], 275_000_000);
    assert.strictEqual(rows.get('Bandung').cells[ALL_KEY][0], 160_000_000);
    assert.strictEqual(rows.get('Surabaya').cells[ALL_KEY][0], 180_000_000);
    assert.deepEqual(report.grandTotal, [615_000_000]);
  });

  it('Contoh 4: Total Penjualan per Sales dan Kota (baris + kolom)', () => {
    const config = { rows: ['sales_name'], columns: ['city'], values: [{ field: 'amount', aggregation: 'sum' }] };
    const report = pivotReport(buildDbRows(TRANSACTIONS, config), config);

    assert.deepEqual(report.columnKeys, ['Bandung', 'Jakarta', 'Surabaya']);
    assert.deepEqual(report.meta.columnField, { key: 'city', label: 'Kota' });

    const rows = byRowKey(report, 'sales_name');
    assert.deepEqual(rows.get('Andi').cells.Jakarta, [195_000_000]);
    assert.deepEqual(rows.get('Andi').cells.Bandung, [90_000_000]);
    assert.deepEqual(rows.get('Andi').cells.Surabaya, [0]);
    assert.deepEqual(rows.get('Andi').rowTotal, [285_000_000]);
    assert.deepEqual(rows.get('Budi').rowTotal, [175_000_000]);
    assert.deepEqual(rows.get('Citra').rowTotal, [155_000_000]);

    assert.deepEqual(report.columnTotals.Jakarta, [275_000_000]);
    assert.deepEqual(report.columnTotals.Bandung, [160_000_000]);
    assert.deepEqual(report.columnTotals.Surabaya, [180_000_000]);
    assert.deepEqual(report.grandTotal, [615_000_000]);
  });

  it('Contoh 5: Total Penjualan per Kota dan Produk', () => {
    const config = { rows: ['city'], columns: ['product'], values: [{ field: 'amount', aggregation: 'sum' }] };
    const report = pivotReport(buildDbRows(TRANSACTIONS, config), config);

    assert.deepEqual(report.columnKeys, ['Honda', 'Suzuki', 'Yamaha']);

    const rows = byRowKey(report, 'city');
    assert.deepEqual(rows.get('Jakarta').cells.Honda, [120_000_000]);
    assert.deepEqual(rows.get('Jakarta').cells.Suzuki, [80_000_000]);
    assert.deepEqual(rows.get('Jakarta').cells.Yamaha, [75_000_000]);
    assert.deepEqual(rows.get('Bandung').cells.Honda, [0]);
    assert.deepEqual(rows.get('Bandung').cells.Suzuki, [70_000_000]);
    assert.deepEqual(rows.get('Bandung').cells.Yamaha, [90_000_000]);
    assert.deepEqual(rows.get('Surabaya').rowTotal, [180_000_000]);

    assert.deepEqual(report.columnTotals.Honda, [215_000_000]);
    assert.deepEqual(report.columnTotals.Suzuki, [150_000_000]);
    assert.deepEqual(report.columnTotals.Yamaha, [250_000_000]);
    assert.deepEqual(report.grandTotal, [615_000_000]);
  });

  it('Contoh 8: Rata-rata Penjualan per Sales', () => {
    const config = { rows: ['sales_name'], columns: [], values: [{ field: 'amount', aggregation: 'avg' }] };
    const report = pivotReport(buildDbRows(TRANSACTIONS, config), config);

    const rows = byRowKey(report, 'sales_name');
    assert.strictEqual(rows.get('Andi').cells[ALL_KEY][0], 95_000_000);
    assert.strictEqual(rows.get('Budi').cells[ALL_KEY][0], 87_500_000);
    assert.strictEqual(rows.get('Citra').cells[ALL_KEY][0], 77_500_000);
  });

  it('Contoh 10: Total dan Rata-rata per Produk (dua nilai)', () => {
    const config = {
      rows: ['product'],
      columns: [],
      values: [
        { field: 'amount', aggregation: 'sum' },
        { field: 'amount', aggregation: 'avg' },
      ],
    };
    const report = pivotReport(buildDbRows(TRANSACTIONS, config), config);

    const rows = byRowKey(report, 'product');
    assert.deepEqual(rows.get('Honda').cells[ALL_KEY], [215_000_000, 107_500_000]);
    assert.deepEqual(rows.get('Suzuki').cells[ALL_KEY], [150_000_000, 75_000_000]);
    assert.deepEqual(rows.get('Yamaha').cells[ALL_KEY], [250_000_000, 83_333_333.33]);
    assert.deepEqual(report.grandTotal, [615_000_000, 87_857_142.86]);
  });

  it('menghitung jumlah transaksi (COUNT)', () => {
    const config = { rows: ['sales_name'], columns: [], values: [{ field: 'amount', aggregation: 'count' }] };
    const report = pivotReport(buildDbRows(TRANSACTIONS, config), config);

    const rows = byRowKey(report, 'sales_name');
    assert.strictEqual(rows.get('Andi').cells[ALL_KEY][0], 3);
    assert.strictEqual(rows.get('Budi').cells[ALL_KEY][0], 2);
    assert.strictEqual(rows.get('Citra').cells[ALL_KEY][0], 2);
    assert.deepEqual(report.grandTotal, [7]);
  });

  it('mendukung beberapa field baris sekaligus', () => {
    const config = {
      rows: ['city', 'sales_name'],
      columns: [],
      values: [{ field: 'amount', aggregation: 'sum' }],
    };
    const report = pivotReport(buildDbRows(TRANSACTIONS, config), config);
    const rows = byRowKey(report, 'city', 'sales_name');

    assert.strictEqual(rows.get('Jakarta\u0000Andi').cells[ALL_KEY][0], 195_000_000);
    assert.strictEqual(rows.get('Jakarta\u0000Budi').cells[ALL_KEY][0], 80_000_000);
    assert.strictEqual(rows.get('Bandung\u0000Andi').cells[ALL_KEY][0], 90_000_000);
  });

  it('menghormati filter (data sudah disaring)', () => {
    const filtered = TRANSACTIONS.filter((t) => t.city === 'Jakarta');
    const config = { rows: ['sales_name'], columns: [], values: [{ field: 'amount', aggregation: 'sum' }] };
    const report = pivotReport(buildDbRows(filtered, config), config);

    const rows = byRowKey(report, 'sales_name');
    assert.strictEqual(rows.get('Andi').cells[ALL_KEY][0], 195_000_000);
    assert.strictEqual(rows.get('Budi').cells[ALL_KEY][0], 80_000_000);
    assert.strictEqual(rows.has('Citra'), false);
    assert.deepEqual(report.grandTotal, [275_000_000]);
  });

  it('mengisi nol untuk kombinasi yang tidak memiliki data', () => {
    const config = { rows: ['sales_name'], columns: ['city'], values: [{ field: 'amount', aggregation: 'sum' }] };
    const report = pivotReport(buildDbRows(TRANSACTIONS, config), config);
    const rows = byRowKey(report, 'sales_name');

    assert.deepEqual(rows.get('Budi').cells.Bandung, [0]);
    assert.deepEqual(rows.get('Citra').cells.Jakarta, [0]);
  });
});
