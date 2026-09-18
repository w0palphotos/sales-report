import { pool } from '../config/db.js';

async function getOrCreateDimension(client, table, name) {
  // Nama tabel tidak pernah diinterpolasi: tiap tabel punya statement statis.
  // Nilai yang lolos validasi ini selalu berasal dari konstanta internal.
  let selectText;
  let insertText;
  if (table === 'salespeople') {
    selectText = 'SELECT id FROM salespeople WHERE name = $1';
    insertText = 'INSERT INTO salespeople (name) VALUES ($1) RETURNING id';
  } else if (table === 'cities') {
    selectText = 'SELECT id FROM cities WHERE name = $1';
    insertText = 'INSERT INTO cities (name) VALUES ($1) RETURNING id';
  } else if (table === 'products') {
    selectText = 'SELECT id FROM products WHERE name = $1';
    insertText = 'INSERT INTO products (name) VALUES ($1) RETURNING id';
  } else {
    throw new Error(`Tabel dimensi tidak dikenal: ${table}`);
  }
  let res = await client.query(selectText, [name]);
  if (res.rows.length > 0) {
    return res.rows[0].id;
  }
  res = await client.query(insertText, [name]);
  return res.rows[0].id;
}

export async function insertSales(dataArray) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    let insertedCount = 0;
    
    for (const data of dataArray) {
      const { salesperson_name, city_name, product_name, amount } = data;
      
      if (!salesperson_name || !city_name || !product_name || amount === undefined || amount === null) {
        throw new Error('Missing required fields: salesperson_name, city_name, product_name, or amount');
      }
      
      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount < 0) {
         throw new Error(`Invalid amount: ${amount}`);
      }

      const spId = await getOrCreateDimension(client, 'salespeople', salesperson_name);
      const cityId = await getOrCreateDimension(client, 'cities', city_name);
      const prodId = await getOrCreateDimension(client, 'products', product_name);
      
      await client.query(
        'INSERT INTO sales (salesperson_id, city_id, product_id, amount) VALUES ($1, $2, $3, $4)',
        [spId, cityId, prodId, numAmount]
      );
      insertedCount++;
    }
    
      await client.query('COMMIT');
    return { count: insertedCount };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function listSales() {
  const result = await pool.query(`
    SELECT s.id, sp.name AS salesperson_name, c.name AS city_name, p.name AS product_name,
           s.amount, s.created_at
    FROM sales s
    JOIN salespeople sp ON s.salesperson_id = sp.id
    JOIN cities c ON s.city_id = c.id
    JOIN products p ON s.product_id = p.id
    ORDER BY s.id ASC
  `);
  return result.rows;
}
