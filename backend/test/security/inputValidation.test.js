import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from '../helpers.js';
import { insertSales, listSales } from '../../src/services/salesService.js';

let db;

before(async () => {
  db = new PGlite();
  await applyMigrations(db);
});

after(async () => {
  await db.close();
});

const sale = (overrides = {}) => ({
  salesperson_name: 'Andi',
  city_name: 'Jakarta',
  product_name: 'Honda',
  amount: 1000,
  ...overrides,
});

const countSales = async () => {
  const { rows } = await db.query('SELECT count(*)::int AS n FROM sales');
  return rows[0].n;
};

describe('security: validasi & pembatasan input transaksi', () => {
  it('menerima transaksi dan membuat dimensi baru', async () => {
    assert.deepEqual(await insertSales([sale()], db), { count: 1 });

    const sales = await listSales(db);
    assert.equal(sales.length, 1);
    assert.equal(sales[0].salesperson_name, 'Andi');
    assert.equal(sales[0].city_name, 'Jakarta');
    assert.equal(Number(sales[0].amount), 1000);
  });

  it('bulk: nama yang sama dipakai ulang, yang baru dibuat sekali saja', async () => {
    const result = await insertSales(
      [
        sale({ salesperson_name: 'Budi', city_name: 'Bandung', amount: 2000 }),
        sale({ salesperson_name: 'Budi', city_name: 'Bandung', amount: 3000 }),
        sale({ salesperson_name: 'Citra', city_name: 'Bandung', amount: 4000 }),
      ],
      db,
    );

    assert.deepEqual(result, { count: 3 });

    const people = await db.query('SELECT name FROM salespeople ORDER BY name');
    assert.deepEqual(people.rows.map((row) => row.name), ['Andi', 'Budi', 'Citra']);

    const cities = await db.query('SELECT name FROM cities ORDER BY name');
    assert.deepEqual(cities.rows.map((row) => row.name), ['Bandung', 'Jakarta']);

    assert.equal(await countSales(), 4);
  });

  it('menolak input tidak valid dan tidak menyisipkan baris apa pun', async () => {
    const before = await countSales();

    const cases = [
      [[{}], /salesperson_name wajib diisi/],
      [['bukan objek'], /salesperson_name wajib diisi/],
      [[sale({ amount: -1 })], /amount harus antara/],
      [[sale({ amount: 'bukan angka' })], /amount tidak valid/],
      [[sale({ amount: 1e12 })], /amount harus antara/],
      [[sale({ salesperson_name: 'x'.repeat(201) })], /maksimal 200 karakter/],
      [[sale(), sale({ city_name: '   ' })], /city_name wajib diisi/],
      [[], /Tidak ada transaksi/],
      ['bukan array', /harus berupa array/],
      [sale(), /harus berupa array/],
    ];

    for (const [payload, pattern] of cases) {
      await assert.rejects(
        insertSales(payload, db),
        (err) => err.status === 400 && pattern.test(err.message),
        `payload tidak ditolak sesuai ${pattern}: ${JSON.stringify(payload).slice(0, 60)}`,
      );
    }

    assert.equal(await countSales(), before);
  });

  it('membatasi jumlah baris per permintaan (anti resource exhaustion)', async () => {
    const tooMany = Array.from({ length: 1001 }, () => sale());

    await assert.rejects(
      insertSales(tooMany, db),
      (err) => err.status === 400 && /Maksimal 1000 transaksi/.test(err.message),
    );
  });

  it('menyimpan nama bertanda kutip sebagai data biasa, bukan perintah SQL', async () => {
    const evil = "Andi'; DROP TABLE sales; --";

    assert.deepEqual(await insertSales([sale({ salesperson_name: evil })], db), { count: 1 });

    const table = await db.query("SELECT to_regclass('public.sales') IS NOT NULL AS ada");
    assert.equal(table.rows[0].ada, true, 'tabel sales harus masih ada');

    const people = await db.query('SELECT name FROM salespeople WHERE name = $1', [evil]);
    assert.equal(people.rows.length, 1);
  });
});
