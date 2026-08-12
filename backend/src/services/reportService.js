import { pool } from '../config/db.js';
import { DIMENSIONS, MEASURES, AGGREGATIONS, OPERATORS } from '../core/whitelist.js';
import { buildReportQuery } from '../core/reportBuilder.js';
import { pivotReport } from '../core/pivot.js';
import { buildCsv } from '../core/csv.js';

export async function runReport(config) {
  const { sql, params } = buildReportQuery(config);
  const result = await pool.query(sql, params);
  return pivotReport(result.rows, config);
}

export async function exportCsv(config) {
  const report = await runReport(config);
  return buildCsv(report);
}

const DIMENSION_QUERY = {
  sales_name: 'SELECT name FROM salespeople ORDER BY name',
  city: 'SELECT name FROM cities ORDER BY name',
  product: 'SELECT name FROM products ORDER BY name',
};

export async function getMeta() {
  const values = {};
  for (const [key, dim] of Object.entries(DIMENSIONS)) {
    const result = await pool.query(DIMENSION_QUERY[key]);
    values[key] = result.rows.map((row) => row.name);
  }

  return {
    dimensions: Object.entries(DIMENSIONS).map(([key, dim]) => ({
      key,
      label: dim.label,
      type: dim.type,
      values: values[key],
    })),
    measures: Object.entries(MEASURES).map(([key, measure]) => ({
      key,
      label: measure.label,
      type: measure.type,
    })),
    aggregations: Object.entries(AGGREGATIONS).map(([key, aggregation]) => ({
      key,
      label: aggregation.label,
    })),
    operators: Object.entries(OPERATORS).map(([key, operator]) => ({
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
