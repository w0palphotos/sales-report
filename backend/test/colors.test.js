import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { ReportSchema } from '../src/core/ReportSchema.js';
import { applyMigrations, buildTestSchema } from './helpers.js';
import {
  validateColorRules,
  listCategoryColors,
  replaceCategoryColors,
} from '../src/services/reportService.js';

describe('validateColorRules (tanpa database)', () => {
  const schema = buildTestSchema();

  it('menerima aturan valid dan menormalisasi warna teks default', () => {
    const rules = validateColorRules(
      [{ field: 'city', value: 'Jakarta', bg: '#dbeafe' }],
      schema,
    );
    assert.deepEqual(rules, [
      { field: 'city', value: 'Jakarta', bg: '#dbeafe', color: '#2f3437' },
    ]);
  });

  it('menolak bukan array', () => {
    assert.throws(() => validateColorRules('bukan-array', schema), /array/);
  });

  it('menolak field yang tidak dikenal', () => {
    assert.throws(
      () => validateColorRules([{ field: 'palsu', value: 'X', bg: '#ffffff' }], schema),
      /tidak dikenal/,
    );
  });

  it('menolak nilai kategori kosong', () => {
    assert.throws(
      () => validateColorRules([{ field: 'city', value: '  ', bg: '#ffffff' }], schema),
      /nilai kategori/,
    );
  });

  it('menolak warna latar bukan hex', () => {
    assert.throws(
      () => validateColorRules([{ field: 'city', value: 'Jakarta', bg: 'biru' }], schema),
      /latar/,
    );
  });

  it('menolak warna teks bukan hex', () => {
    assert.throws(
      () =>
        validateColorRules(
          [{ field: 'city', value: 'Jakarta', bg: '#ffffff', color: 'red' }],
          schema,
        ),
      /teks/,
    );
  });
});

describe('category_colors dengan PGlite', () => {
  let db;
  let schema;

  before(async () => {
    db = new PGlite();
    await applyMigrations(db);
    schema = new ReportSchema(db);
    await schema.loadFromDatabase();
  });

  after(async () => {
    await db.close();
  });

  it('mulai dari daftar kosong', async () => {
    assert.deepEqual(await listCategoryColors(db), []);
  });

  it('replace-all menyimpan lalu memuat kembali', async () => {
    const saved = await replaceCategoryColors(
      [
        { field: 'city', value: 'Jakarta', bg: '#dbeafe', color: '#1e3a8a' },
        { field: 'product', value: 'Honda', bg: '#fef3c7' },
      ],
      db,
      schema,
    );
    assert.equal(saved.length, 2);
    assert.deepEqual(await listCategoryColors(db), saved);
  });

  it('replace-all menimpa seluruh isi lama', async () => {
    const saved = await replaceCategoryColors(
      [{ field: 'city', value: 'Bandung', bg: '#dcfce7' }],
      db,
      schema,
    );
    assert.equal(saved.length, 1);
    assert.equal(saved[0].value, 'Bandung');
  });

  it('input tidak valid menolak dan data lama utuh', async () => {
    await assert.rejects(
      replaceCategoryColors([{ field: 'city', value: 'Jakarta', bg: 'bukan-hex' }], db, schema),
      /latar/,
    );
    const current = await listCategoryColors(db);
    assert.equal(current.length, 1);
    assert.equal(current[0].value, 'Bandung');
  });
});
