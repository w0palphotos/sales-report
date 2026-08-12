import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from '../src/config/db.js';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', 'db', 'migrations');

async function migrate() {
  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('[migrate] tidak ada file migrasi.');
    return;
  }

  for (const file of files) {
    const sql = await readFile(join(migrationsDir, file), 'utf8');
    await pool.query(sql);
    console.log(`[migrate] diterapkan: ${file}`);
  }
}

migrate()
  .then(() => pool.end())
  .catch((err) => {
    console.error('[migrate] gagal:', err.message);
    return pool.end().finally(() => process.exit(1));
  });
