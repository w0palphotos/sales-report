import { pool } from '../config/db.js';
import { ReportSchema } from '../core/ReportSchema.js';
import { QueryBuilder } from '../core/QueryBuilder.js';
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
