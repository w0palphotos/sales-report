import { pool } from '../src/config/db.js';

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('TRUNCATE sales, salespeople, cities, products, saved_reports RESTART IDENTITY CASCADE');
    await client.query('COMMIT');
    console.log('[seed] Selesai: Semua tabel berhasil di-truncate (dikosongkan).');
    console.log('[seed] Gunakan fitur "Input Data" di Frontend untuk meng-import data_awal.csv');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('[seed] gagal:', err.message);
  process.exit(1);
});

