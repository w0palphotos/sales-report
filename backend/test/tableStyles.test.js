import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { ReportSchema } from '../src/core/ReportSchema.js';
import { applyMigrations, buildTestSchema } from './helpers.js';
import {
  validateTableStyles,
  listTableStyles,
  replaceTableStyles,
} from '../src/services/reportService.js';

describe('validateTableStyles (tanpa database)', () => {
  const schema = buildTestSchema();

  it('menerima aturan baris dan kolom valid', () => {
    const rules = validateTableStyles(
      [
        { kind: 'row', key: 'sales_name=Andi', bg: '#ff0000' },
        { kind: 'column', key: 'col:product:Honda', bg: '#0000ff', color: '#ffffff' },
        { kind: 'column', key: 'rowdim:city', bg: '#00ff00' },
        { kind: 'column', key: 'val:amount:sum', bg: '#ffff00' },
      ],
      schema,
    );
    assert.equal(rules.length, 4);
    assert.equal(rules[0].color, '#2f3437');
  });

  it('menolak bukan array', () => {
    assert.throws(() => validateTableStyles({}, schema), /array/);
  });

  it('menolak kind asing', () => {
    assert.throws(
      () => validateTableStyles([{ kind: 'diagonal', key: 'x', bg: '#ffffff' }], schema),
      /kind/,
    );
  });

  it('menolak kunci kolom asing', () => {
    assert.throws(
      () => validateTableStyles([{ kind: 'column', key: 'col:palsu:X', bg: '#ffffff' }], schema),
      /kunci kolom/,
    );
    assert.throws(
      () => validateTableStyles([{ kind: 'column', key: 'bebas', bg: '#ffffff' }], schema),
      /kunci kolom/,
    );
  });

  it('menolak bg bukan hex', () => {
    assert.throws(
      () => validateTableStyles([{ kind: 'row', key: 'a=b', bg: 'merah' }], schema),
      /latar/,
    );
  });
});

describe('table_styles dengan PGlite', () => {
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
    assert.deepEqual(await listTableStyles(db), []);
  });

  it('replace-all menyimpan lalu memuat kembali', async () => {
    const saved = await replaceTableStyles(
      [{ kind: 'row', key: 'sales_name=Andi', bg: '#ff0000' }],
      db,
      schema,
    );
    assert.equal(saved.length, 1);
    assert.deepEqual(await listTableStyles(db), saved);
  });

  it('input tidak valid menolak dan data lama utuh', async () => {
    await assert.rejects(
      replaceTableStyles([{ kind: 'row', key: 'x', bg: 'bukan-hex' }], db, schema),
      /latar/,
    );
    assert.equal((await listTableStyles(db)).length, 1);
  });
});
