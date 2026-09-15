import { pool } from '../config/db.js';

async function getOrCreateDimension(client, table, name) {
  let res = await client.query(`SELECT id FROM ${table} WHERE name = $1`, [name]);
  if (res.rows.length > 0) {
    return res.rows[0].id;
  }
  res = await client.query(`INSERT INTO ${table} (name) VALUES ($1) RETURNING id`, [name]);
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
