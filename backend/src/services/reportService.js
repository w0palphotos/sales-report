import { pool } from '../config/db.js';
import { ReportSchema } from '../core/ReportSchema.js';
import { QueryBuilder, ValidationError } from '../core/QueryBuilder.js';
import { PivotEngine } from '../core/PivotEngine.js';
import { CsvFormatter } from '../core/CsvFormatter.js';

export const reportSchema = new ReportSchema(pool);

export async function runReport(config) {
  await reportSchema.loadFromDatabase();
  const queryBuilder = new QueryBuilder(reportSchema);
  const { sql, params } = queryBuilder.build(config);

  const result = await pool.query(sql, params);
  const pivotEngine = new PivotEngine(reportSchema);
  return pivotEngine.pivot(result.rows, config);
}

export async function exportCsv(config) {
  const report = await runReport(config);
  return CsvFormatter.format(report);
}

const DIMENSION_QUERY = {
  sales_name: 'SELECT name FROM salespeople ORDER BY name',
  city: 'SELECT name FROM cities ORDER BY name',
  product: 'SELECT name FROM products ORDER BY name',
  amount: 'SELECT DISTINCT amount::text AS name FROM sales ORDER BY amount',
};

export async function getMeta() {
  await reportSchema.loadFromDatabase();

  const values = {};
  for (const [key] of reportSchema.dimensions.entries()) {
    if (DIMENSION_QUERY[key]) {
      try {
        const result = await pool.query(DIMENSION_QUERY[key]);
        values[key] = result.rows.map((row) => row.name);
      } catch {
        values[key] = [];
      }
    } else {
      values[key] = [];
    }
  }

  return {
    dimensions: Array.from(reportSchema.dimensions.entries()).map(([key, dim]) => ({
      key,
      label: dim.label,
      type: dim.type,
      values: values[key] ?? [],
    })),
    measures: Array.from(reportSchema.measures.entries()).map(([key, measure]) => ({
      key,
      label: measure.label,
      type: measure.type,
    })),
    aggregations: Array.from(reportSchema.aggregations.entries()).map(([key, aggregation]) => ({
      key,
      label: aggregation.label,
      allowedTypes: aggregation.allowedTypes,
    })),
    operators: Array.from(reportSchema.operators.entries()).map(([key, operator]) => ({
      key,
      label: operator.label,
      argCount: operator.argCount,
      textOnly: Boolean(operator.textOnly),
      numberOnly: Boolean(operator.numberOnly),
    })),
  };
}

export async function listSavedReports() {
  const result = await pool.query(
    'SELECT id, name, config, created_at FROM saved_reports ORDER BY created_at DESC',
  );
  return result.rows;
}

export async function getSavedReport(id) {
  const result = await pool.query(
    'SELECT id, name, config, created_at FROM saved_reports WHERE id = $1',
    [id],
  );
  return result.rows[0] ?? null;
}

export async function createSavedReport({ name, config }) {
  const result = await pool.query(
    'INSERT INTO saved_reports (name, config) VALUES ($1, $2) RETURNING id, name, config, created_at',
    [name, JSON.stringify(config)],
  );
  return result.rows[0];
}

export async function updateSavedReport(id, { name, config }) {
  const result = await pool.query(
    'UPDATE saved_reports SET name = $2, config = $3 WHERE id = $1 RETURNING id, name, config, created_at',
    [id, name, JSON.stringify(config)],
  );
  return result.rows[0] ?? null;
}

export async function deleteSavedReport(id) {
  const result = await pool.query('DELETE FROM saved_reports WHERE id = $1 RETURNING id', [id]);
  return result.rows[0] ?? null;
}

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const MAX_COLOR_RULES = 500;

export function validateColorRules(colors, schema) {
  if (!Array.isArray(colors)) {
    throw new ValidationError('Daftar warna harus berupa array.');
  }
  if (colors.length > MAX_COLOR_RULES) {
    throw new ValidationError(`Maksimal ${MAX_COLOR_RULES} aturan warna.`);
  }
  return colors.map((item, index) => {
    const label = `Warna ke-${index + 1}`;
    if (!item || typeof item !== 'object') {
      throw new ValidationError(`${label} harus berupa objek.`);
    }
    if (!item.field || typeof item.field !== 'string' || !schema.getDimension(item.field)) {
      throw new ValidationError(`${label}: field tidak dikenal (${item?.field}).`);
    }
    if (typeof item.value !== 'string' || !item.value.trim() || item.value.length > 200) {
      throw new ValidationError(`${label}: nilai kategori tidak valid.`);
    }
    if (typeof item.bg !== 'string' || !HEX_COLOR.test(item.bg)) {
      throw new ValidationError(`${label}: warna latar tidak valid (gunakan hex, mis. #dbeafe).`);
    }
    if (item.color != null && (typeof item.color !== 'string' || !HEX_COLOR.test(item.color))) {
      throw new ValidationError(`${label}: warna teks tidak valid (gunakan hex).`);
    }
    return {
      field: item.field,
      value: item.value,
      bg: item.bg,
      color: item.color ?? '#2f3437',
    };
  });
}

export async function listCategoryColors(db = pool) {
  const result = await db.query(
    'SELECT id, field, value, bg, color FROM category_colors ORDER BY field, value',
  );
  return result.rows;
}

export async function replaceCategoryColors(colors, db = pool, schema = reportSchema) {
  if (schema === reportSchema) await reportSchema.loadFromDatabase();
  const rules = validateColorRules(colors, schema);

  const statements = [
    { text: 'DELETE FROM category_colors', params: [] },
    ...rules.map((rule) => ({
      text: 'INSERT INTO category_colors (field, value, bg, color) VALUES ($1, $2, $3, $4)',
      params: [rule.field, rule.value, rule.bg, rule.color],
    })),
  ];

  if (typeof db.connect === 'function') {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      for (const statement of statements) {
        await client.query(statement.text, statement.params);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } else {
    for (const statement of statements) {
      await db.query(statement.text, statement.params);
    }
  }

  return listCategoryColors(db);
}
