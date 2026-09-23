import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { QueryBuilder, ValidationError } from '../../src/core/QueryBuilder.js';
import { buildTestSchema } from '../helpers.js';

const schema = buildTestSchema();
const queryBuilder = new QueryBuilder(schema);
const SUM_AMOUNT = { field: 'amount', aggregation: 'sum' };

const build = (config) => queryBuilder.build(config);
const baseReport = (extra) => ({ rows: ['city'], columns: [], values: [SUM_AMOUNT], ...extra });

// Payload klasik. Semuanya harus berakhir sebagai parameter terikat atau
// ditolak, tidak pernah menjadi bagian dari teks SQL.
const PAYLOADS = [
  "Jakarta' OR '1'='1",
  "'; DROP TABLE sales; --",
  '1; DROP TABLE sales',
  "%' OR 1=1 --",
  '" OR ""="',
  "Jakarta\\'; DROP TABLE sales; --",
  "x';COPY (SELECT '') TO PROGRAM 'id';--",
  '$(whoami)',
  '`id`',
  '{{7*7}}',
  'UNION SELECT name FROM salespeople',
];

describe('security: injeksi SQL pada builder dinamis', () => {
  it('nilai filter selalu menjadi parameter, bukan bagian SQL', () => {
    for (const payload of PAYLOADS) {
      const { sql, params } = build(baseReport({ filters: [{ field: 'city', operator: '=', value: payload }] }));

      assert.deepEqual(params, [payload], `payload tidak terikat: ${payload}`);
      assert.equal(sql.includes(payload), false, `payload bocor ke SQL: ${payload}`);
      assert.equal(sql.includes('DROP TABLE'), false);
      assert.equal(sql.includes('UNION'), false);
      assert.match(sql, /WHERE cities\.name = \$1/);
    }
  });

  it('filter "contains" membungkus payload sebagai parameter ILIKE', () => {
    for (const payload of PAYLOADS) {
      const { sql, params } = build(
        baseReport({ filters: [{ field: 'city', operator: 'contains', value: payload }] }),
      );

      assert.deepEqual(params, [`%${payload}%`]);
      assert.equal(sql.includes(payload), false, `payload bocor ke SQL: ${payload}`);
      assert.match(sql, /ILIKE \$1/);
    }
  });

  it('payload yang ditolak: nilai angka tidak bisa menyelundupkan SQL', () => {
    assert.throws(
      () => build(baseReport({ filters: [{ field: 'amount', operator: '>', value: "1; DROP TABLE sales" }] })),
      (err) => err instanceof ValidationError && /Nilai filter tidak valid/.test(err.message),
    );
  });

  it('nama field, agregasi, operator, dan kolom divalidasi allowlist', () => {
    for (const payload of PAYLOADS) {
      assert.throws(() => build(baseReport({ rows: [payload] })), ValidationError, `rows: ${payload}`);
      assert.throws(() => build(baseReport({ columns: [payload] })), ValidationError, `columns: ${payload}`);
      assert.throws(
        () => build(baseReport({ values: [{ field: payload, aggregation: 'sum' }] })),
        ValidationError,
        `values.field: ${payload}`,
      );
      assert.throws(
        () => build(baseReport({ values: [{ field: 'amount', aggregation: payload }] })),
        ValidationError,
        `values.aggregation: ${payload}`,
      );
      assert.throws(
        () => build(baseReport({ filters: [{ field: 'city', operator: payload, value: 'x' }] })),
        ValidationError,
        `filters.operator: ${payload}`,
      );
      assert.throws(
        () => build(baseReport({ filters: [{ field: payload, operator: '=', value: 'x' }] })),
        ValidationError,
        `filters.field: ${payload}`,
      );
    }
  });

  it('SQL yang dibangun hanya menyentuh tabel dan kolom dari metadata schema', () => {
    const { sql } = build({
      rows: ['sales_name', 'city'],
      columns: ['product'],
      values: [
        { field: 'amount', aggregation: 'sum' },
        { field: 'product', aggregation: 'count_unique' },
      ],
      filters: [{ field: 'sales_name', operator: '!=', value: 'Andi' }],
    });

    assert.match(sql, /^SELECT /);
    assert.equal(sql.includes(';'), false, 'tidak boleh ada statement tambahan');
    assert.equal(sql.includes('--'), false, 'tidak boleh ada komentar SQL');
    for (const table of ['salespeople', 'cities', 'products']) {
      if (sql.includes(table)) assert.match(sql, new RegExp(`JOIN ${table} ON s\\.`));
    }
    assert.match(sql, /GROUP BY GROUPING SETS/);
  });

  it('prototype pollution lewat konfigurasi ditolak', () => {
    assert.throws(() => build(baseReport({ rows: ['__proto__'] })), ValidationError);
    assert.throws(() => build(baseReport({ rows: ['constructor'] })), ValidationError);
    assert.throws(() => build(baseReport({ values: [{ field: 'amount', aggregation: '__proto__' }] })), ValidationError);
    assert.equal({}.polluted, undefined);
  });
});
