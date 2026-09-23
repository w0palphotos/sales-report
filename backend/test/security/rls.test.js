import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from '../helpers.js';

const TABLES = [
  'category_colors',
  'cities',
  'field_catalog',
  'products',
  'sales',
  'salespeople',
  'saved_reports',
  'table_styles',
];

let db;

before(async () => {
  db = new PGlite();
  await applyMigrations(db);
});

after(async () => {
  await db.close();
});

describe('security: Row Level Security', () => {
  it('aktif untuk seluruh tabel aplikasi', async () => {
    const { rows } = await db.query(
      'SELECT relname, relrowsecurity FROM pg_class WHERE relname = ANY($1::text[]) ORDER BY relname',
      [TABLES],
    );

    assert.deepEqual(rows.map((row) => row.relname), TABLES);
    for (const row of rows) {
      assert.equal(row.relrowsecurity, true, `${row.relname} belum mengaktifkan RLS`);
    }
  });

  it('tanpa FORCE RLS, sehingga pemilik tabel (backend) tetap bisa mengakses', async () => {
    const { rows } = await db.query(
      'SELECT relname, relforcerowsecurity FROM pg_class WHERE relname = ANY($1::text[])',
      [TABLES],
    );

    for (const row of rows) {
      assert.equal(row.relforcerowsecurity, false, `${row.relname} memakai FORCE RLS`);
    }
  });

  it('role non-pemilik tanpa policy tidak bisa membaca data', async () => {
    await db.exec(`
      INSERT INTO salespeople (name) VALUES ('Andi');
      INSERT INTO cities (name) VALUES ('Jakarta');
      INSERT INTO products (name) VALUES ('Honda');
      INSERT INTO sales (salesperson_id, city_id, product_id, amount)
        SELECT sp.id, c.id, p.id, 100
        FROM salespeople sp, cities c, products p;
    `);

    const owned = await db.query('SELECT count(*)::int AS n FROM sales');
    assert.equal(owned.rows[0].n, 1, 'pemilik tabel harus tetap melihat datanya');

    await db.exec('CREATE ROLE rls_probe');
    await db.exec('GRANT SELECT ON sales TO rls_probe');
    await db.exec('SET ROLE rls_probe');
    const asProbe = await db.query('SELECT count(*)::int AS n FROM sales');
    await db.exec('RESET ROLE');

    assert.equal(asProbe.rows[0].n, 0, 'role non-pemilik seharusnya tidak melihat baris apa pun');
  });
});
