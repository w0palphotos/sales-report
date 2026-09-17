import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { QueryBuilder, ValidationError } from '../src/core/QueryBuilder.js';
import { ReportSchema } from '../src/core/ReportSchema.js';

const schema = new ReportSchema();
const queryBuilder = new QueryBuilder(schema);

const validateConfig = (config) => queryBuilder.validateConfig(config);
const buildReportQuery = (config) => queryBuilder.build(config);

const SUM_AMOUNT = { field: 'amount', aggregation: 'sum' };

describe('validateConfig', () => {
  it('menerima konfigurasi laporan yang valid', () => {
    assert.doesNotThrow(() =>
      validateConfig({
        rows: ['sales_name'],
        columns: ['city'],
        values: [SUM_AMOUNT],
        filters: [{ field: 'city', operator: '=', value: 'Jakarta' }],
      }),
    );
  });

  it('menolak konfigurasi kosong (tanpa baris, kolom, atau nilai)', () => {
    assert.throws(
      () => validateConfig({ rows: [], columns: [], values: [] }),
      (err) => err instanceof ValidationError && /Pilih minimal satu/.test(err.message),
    );
  });

  it('menolak field baris yang tidak dikenal', () => {
    assert.throws(
      () => validateConfig({ rows: ['nama_palsu'], columns: [], values: [SUM_AMOUNT] }),
      (err) => err instanceof ValidationError && /tidak dikenal/.test(err.message),
    );
  });

  it('menolak perhitungan yang tidak dikenal', () => {
    assert.throws(
      () => validateConfig({ rows: ['city'], columns: [], values: [{ field: 'amount', aggregation: 'median' }] }),
      (err) => err instanceof ValidationError,
    );
  });

  it('menolak operator yang tidak dikenal', () => {
    assert.throws(
      () => validateConfig({ rows: ['city'], columns: [], values: [SUM_AMOUNT], filters: [{ field: 'city', operator: 'LIKE', value: 'x' }] }),
      (err) => err instanceof ValidationError,
    );
  });

  it('menolak operator teks-only pada field angka', () => {
    assert.throws(
      () => validateConfig({ rows: ['city'], columns: [], values: [SUM_AMOUNT], filters: [{ field: 'amount', operator: 'contains', value: 'x' }] }),
      (err) => err instanceof ValidationError,
    );
  });

  it('menolak operator angka pada field teks', () => {
    assert.throws(
      () => validateConfig({ rows: ['city'], columns: [], values: [SUM_AMOUNT], filters: [{ field: 'city', operator: 'between', value: [1, 2] }] }),
      (err) => err instanceof ValidationError,
    );
  });

  it('menolak field yang dipakai di baris sekaligus kolom', () => {
    assert.throws(
      () => validateConfig({ rows: ['city'], columns: ['city'], values: [SUM_AMOUNT] }),
      (err) => err instanceof ValidationError,
    );
  });

  it('menolak filter "between" tanpa dua nilai', () => {
    assert.throws(
      () => validateConfig({ rows: ['city'], columns: [], values: [SUM_AMOUNT], filters: [{ field: 'amount', operator: 'between', value: [1] }] }),
      (err) => err instanceof ValidationError,
    );
  });

  it('menerima Penjualan sebagai baris dan Nama Sales sebagai nilai COUNT', () => {
    assert.doesNotThrow(() =>
      validateConfig({
        rows: ['amount'],
        columns: [],
        values: [{ field: 'sales_name', aggregation: 'count' }],
      }),
    );
  });

  it('menolak perhitungan SUM pada field teks (Nama Sales)', () => {
    assert.throws(
      () => validateConfig({ rows: ['city'], columns: [], values: [{ field: 'sales_name', aggregation: 'sum' }] }),
      (err) => err instanceof ValidationError && /tidak berlaku/.test(err.message),
    );
  });
});

describe('buildReportQuery', () => {
  it('membangun GROUPING SETS untuk laporan baris-saja', () => {
    const { sql, params } = buildReportQuery({ rows: ['city'], columns: [], values: [SUM_AMOUNT] });
    assert.match(sql, /GROUP BY GROUPING SETS \(\(cities\.name\), \(\)\)/);
    assert.deepEqual(params, []);
  });

  it('membangun GROUPING SETS untuk laporan baris + kolom', () => {
    const { sql } = buildReportQuery({
      rows: ['sales_name'],
      columns: ['city'],
      values: [SUM_AMOUNT],
    });
    assert.match(sql, /GROUP BY GROUPING SETS \(\(salespeople\.name, cities\.name\), \(salespeople\.name\), \(cities\.name\), \(\)\)/);
  });

  it('membangun join hanya untuk dimensi yang dipakai', () => {
    const { sql } = buildReportQuery({ rows: ['product'], columns: [], values: [SUM_AMOUNT] });
    assert.match(sql, /JOIN products ON s\.product_id = products\.id/);
    assert.doesNotMatch(sql, /JOIN cities/);
    assert.doesNotMatch(sql, /JOIN salespeople/);
  });

  it('membuat filter dengan parameter terikat', () => {
    const { sql, params } = buildReportQuery({
      rows: ['city'],
      columns: [],
      values: [SUM_AMOUNT],
      filters: [{ field: 'city', operator: '=', value: 'Jakarta' }],
    });
    assert.match(sql, /WHERE cities\.name = \$1/);
    assert.deepEqual(params, ['Jakarta']);
  });

  it('mengubah filter "between" menjadi dua parameter angka', () => {
    const { sql, params } = buildReportQuery({
      rows: ['city'],
      columns: [],
      values: [SUM_AMOUNT],
      filters: [{ field: 'amount', operator: 'between', value: ['50000000', '100000000'] }],
    });
    assert.match(sql, /s\.amount BETWEEN \$1 AND \$2/);
    assert.deepEqual(params, [50_000_000, 100_000_000]);
  });

  it('mengubah filter "contains" menjadi ILIKE', () => {
    const { sql, params } = buildReportQuery({
      rows: ['city'],
      columns: [],
      values: [SUM_AMOUNT],
      filters: [{ field: 'city', operator: 'contains', value: 'ja' }],
    });
    assert.match(sql, /cities\.name ILIKE \$1/);
    assert.deepEqual(params, ['%ja%']);
  });

  it('menggabungkan beberapa filter dengan AND', () => {
    const { sql } = buildReportQuery({
      rows: ['city'],
      columns: [],
      values: [SUM_AMOUNT],
      filters: [
        { field: 'city', operator: '=', value: 'Jakarta' },
        { field: 'amount', operator: '>', value: 80000000 },
      ],
    });
    assert.match(sql, /AND/);
  });

  it('membangun query dengan Penjualan sebagai baris dan Nama Sales COUNT sebagai nilai', () => {
    const { sql } = buildReportQuery({
      rows: ['amount'],
      columns: [],
      values: [{ field: 'sales_name', aggregation: 'count' }],
    });
    assert.match(sql, /SELECT s\.amount AS "_r0", COUNT\(salespeople\.name\) AS "_v0"/);
    assert.match(sql, /JOIN salespeople ON s\.salesperson_id = salespeople\.id/);
    assert.match(sql, /GROUP BY GROUPING SETS \(\(s\.amount\), \(\)\)/);
  });
});
