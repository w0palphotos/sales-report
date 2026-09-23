import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PivotEngine } from '../src/core/PivotEngine.js';
import { CsvFormatter } from '../src/core/CsvFormatter.js';
import { TRANSACTIONS, buildDbRows, buildTestSchema } from './helpers.js';

const schema = buildTestSchema();
const engine = new PivotEngine(schema);

const render = (config, transactions = TRANSACTIONS) =>
  CsvFormatter.format(engine.pivot(buildDbRows(transactions, config), config));

describe('buildCsv', () => {
  it('Contoh 1: header + baris + total (tanpa kolom)', () => {
    const config = { rows: ['city'], columns: [], values: [{ field: 'amount', aggregation: 'sum' }] };
    const csv = render(config);

    const lines = csv.split('\r\n');
    assert.equal(lines[0], 'Kota,Total Penjualan');
    assert.ok(lines.includes('Bandung,160000000'));
    assert.ok(lines.includes('Jakarta,275000000'));
    assert.ok(lines.includes('Surabaya,180000000'));
    assert.equal(lines.at(-1), 'Total,615000000');
  });

  it('Contoh 4: header berlapis baris+kolom', () => {
    const config = { rows: ['sales_name'], columns: ['city'], values: [{ field: 'amount', aggregation: 'sum' }] };
    const csv = render(config);

    const lines = csv.split('\r\n');
    assert.equal(
      lines[0],
      'Nama Sales,Bandung · Total Penjualan,Jakarta · Total Penjualan,Surabaya · Total Penjualan,Total Penjualan · Total',
    );
    assert.ok(lines.includes('Andi,90000000,195000000,0,285000000'));
    assert.ok(lines.includes('Budi,0,80000000,95000000,175000000'));
    assert.ok(lines.includes('Citra,70000000,0,85000000,155000000'));
    assert.equal(lines.at(-1), 'Total,160000000,275000000,180000000,615000000');
  });

  it('meng-escape nilai yang mengandung koma', () => {
    const config = { rows: ['sales_name'], columns: [], values: [{ field: 'amount', aggregation: 'sum' }] };
    const transactions = [
      { sales_name: 'Dewi, S.E.', city: 'Jakarta', product: 'Honda', amount: 100 },
      { sales_name: 'Dewi, S.E.', city: 'Jakarta', product: 'Honda', amount: 50 },
    ];
    const csv = render(config, transactions);

    const lines = csv.split('\r\n');
    assert.equal(lines[0], 'Nama Sales,Total Penjualan');
    assert.ok(lines.includes('"Dewi, S.E.",150'));
  });
});
