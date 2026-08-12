import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('[db] DATABASE_URL belum diset. Seluruh query yang membutuhkan database akan gagal.');
}

const needsSsl = !!connectionString && !/(localhost|127\.0\.0\.1)/.test(connectionString);

export const pool = new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});

export const query = (text, params) => pool.query(text, params);
