import { pool } from '../config/db.js';

const positiveInt = (value, fallback) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
};

// Batas aman: melindungi memori, bandwidth, dan jumlah query per permintaan.
const MAX_SALES_ROWS = positiveInt(process.env.MAX_SALES_ROWS, 5000);
const MAX_BULK_ROWS = positiveInt(process.env.MAX_BULK_ROWS, 1000);
const MAX_NAME_LENGTH = 200;
// Kolom `amount` bertipe NUMERIC(14,2): maksimal 12 digit di depan koma.
const MAX_AMOUNT = 99_999_999_999.99;

const validationError = (message) => {
  const error = new Error(message);
  error.status = 400;
  return error;
};

// Statement statis per tabel dimensi: nama tabel tidak pernah diinterpolasi,
// dan seluruh nilainya parameter terikat.
const DIMENSION_SQL = {
  salespeople: {
    select: 'SELECT id, name FROM salespeople WHERE name = ANY($1::text[])',
    insert: 'INSERT INTO salespeople (name) SELECT unnest($1::text[]) RETURNING id, name',
  },
  cities: {
    select: 'SELECT id, name FROM cities WHERE name = ANY($1::text[])',
    insert: 'INSERT INTO cities (name) SELECT unnest($1::text[]) RETURNING id, name',
  },
  products: {
    select: 'SELECT id, name FROM products WHERE name = ANY($1::text[])',
    insert: 'INSERT INTO products (name) SELECT unnest($1::text[]) RETURNING id, name',
  },
};

// `pg.Pool` punya connect() (koneksi khusus untuk transaksi); PGlite pada tes
// sudah berupa satu koneksi sehingga cukup BEGIN/COMMIT langsung.
async function inTransaction(db, run) {
  if (typeof db.connect === 'function') {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const result = await run(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  await db.query('BEGIN');
  try {
    const result = await run(db);
    await db.query('COMMIT');
    return result;
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
}

const requireName = (value, field, index) => {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name) throw validationError(`Baris ke-${index + 1}: ${field} wajib diisi.`);
  if (name.length > MAX_NAME_LENGTH) {
    throw validationError(`Baris ke-${index + 1}: ${field} maksimal ${MAX_NAME_LENGTH} karakter.`);
  }
  return name;
};

function normalizeSalesRows(dataArray) {
  if (!Array.isArray(dataArray)) {
    throw validationError('Payload harus berupa array transaksi.');
  }
  if (dataArray.length === 0) {
    throw validationError('Tidak ada transaksi yang dikirim.');
  }
  if (dataArray.length > MAX_BULK_ROWS) {
    throw validationError(`Maksimal ${MAX_BULK_ROWS} transaksi per permintaan.`);
  }

  return dataArray.map((item, index) => {
    const data = item ?? {};

    // Nama diperiksa lebih dulu supaya pesannya sesuai kolom yang kurang.
    const salesperson_name = requireName(data.salesperson_name, 'salesperson_name', index);
    const city_name = requireName(data.city_name, 'city_name', index);
    const product_name = requireName(data.product_name, 'product_name', index);

    const amount = Number(data.amount);
    if (data.amount === undefined || data.amount === null || !Number.isFinite(amount)) {
      throw validationError(`Baris ke-${index + 1}: amount tidak valid (${data.amount}).`);
    }
    if (amount < 0 || amount > MAX_AMOUNT) {
      throw validationError(`Baris ke-${index + 1}: amount harus antara 0 dan ${MAX_AMOUNT}.`);
    }

    return { salesperson_name, city_name, product_name, amount };
  });
}

// Satu SELECT + satu INSERT untuk semua nama, sehingga jumlah query tetap
// (tidak lagi 3 select + 3 insert per baris).
async function resolveDimensionIds(client, table, names) {
  const sql = DIMENSION_SQL[table];
  if (!sql) throw new Error(`Tabel dimensi tidak dikenal: ${table}`);

  const unique = [...new Set(names)];
  const found = new Map();
  if (unique.length === 0) return found;

  const existing = await client.query(sql.select, [unique]);
  for (const row of existing.rows) found.set(row.name, row.id);

  const missing = unique.filter((name) => !found.has(name));
  if (missing.length > 0) {
    const created = await client.query(sql.insert, [missing]);
    for (const row of created.rows) found.set(row.name, row.id);
  }

  return found;
}

export async function insertSales(dataArray, db = pool) {
  const rows = normalizeSalesRows(dataArray);

  return inTransaction(db, async (client) => {
    const salespeople = await resolveDimensionIds(client, 'salespeople', rows.map((row) => row.salesperson_name));
    const cities = await resolveDimensionIds(client, 'cities', rows.map((row) => row.city_name));
    const products = await resolveDimensionIds(client, 'products', rows.map((row) => row.product_name));

    // Satu statement statis tanpa interpolasi: seluruh baris dikirim sebagai
    // empat array parameter, lalu di-unnest oleh PostgreSQL.
    await client.query(
      `INSERT INTO sales (salesperson_id, city_id, product_id, amount)
       SELECT * FROM unnest($1::int[], $2::int[], $3::int[], $4::numeric[])`,
      [
        rows.map((row) => salespeople.get(row.salesperson_name)),
        rows.map((row) => cities.get(row.city_name)),
        rows.map((row) => products.get(row.product_name)),
        rows.map((row) => row.amount),
      ],
    );

    return { count: rows.length };
  });
}

export async function listSales(db = pool) {
  const result = await db.query(
    `SELECT s.id, sp.name AS salesperson_name, c.name AS city_name, p.name AS product_name,
            s.amount, s.created_at
     FROM sales s
     JOIN salespeople sp ON s.salesperson_id = sp.id
     JOIN cities c ON s.city_id = c.id
     JOIN products p ON s.product_id = p.id
     ORDER BY s.id ASC
     LIMIT $1`,
    [MAX_SALES_ROWS],
  );
  return result.rows;
}
