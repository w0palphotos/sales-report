import {
  runReport,
  exportCsv,
  getMeta,
  listSavedReports,
  getSavedReport,
  createSavedReport,
  updateSavedReport,
  deleteSavedReport,
  listCategoryColors,
  replaceCategoryColors,
  reportSchema,
} from '../services/reportService.js';
import { ValidationError, QueryBuilder } from '../core/QueryBuilder.js';

const queryBuilder = new QueryBuilder(reportSchema);

export const wrap = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const parseId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw new ValidationError('ID laporan tidak valid.');
  }
  return id;
};

const parseSavedBody = (body) => {
  const { name, config } = body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new ValidationError('Nama laporan wajib diisi.');
  }
  queryBuilder.validateConfig(config);
  return { name: name.trim(), config };
};

export const metaHandler = wrap(async (_req, res) => {
  const meta = await getMeta();
  res.json(meta);
});

export const reportHandler = wrap(async (req, res) => {
  const report = await runReport(req.body);
  res.json(report);
});

export const exportHandler = wrap(async (req, res) => {
  const csv = await exportCsv(req.body);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="report.csv"');
  res.send(csv);
});

export const savedListHandler = wrap(async (_req, res) => {
  const reports = await listSavedReports();
  res.json({ reports });
});

export const savedGetHandler = wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const report = await getSavedReport(id);
  if (!report) {
    return res.status(404).json({ error: 'Laporan tersimpan tidak ditemukan.' });
  }
  res.json(report);
});

export const savedCreateHandler = wrap(async (req, res) => {
  const { name, config } = parseSavedBody(req.body);
  const report = await createSavedReport({ name, config });
  res.status(201).json(report);
});

export const savedUpdateHandler = wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const { name, config } = parseSavedBody(req.body);
  const report = await updateSavedReport(id, { name, config });
  if (!report) {
    return res.status(404).json({ error: 'Laporan tersimpan tidak ditemukan.' });
  }
  res.json(report);
});

export const savedDeleteHandler = wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const report = await deleteSavedReport(id);
  if (!report) {
    return res.status(404).json({ error: 'Laporan tersimpan tidak ditemukan.' });
  }
  res.status(204).send();
});

export const colorsListHandler = wrap(async (_req, res) => {
  const colors = await listCategoryColors();
  res.json({ colors });
});

export const colorsSaveHandler = wrap(async (req, res) => {
  const colors = await replaceCategoryColors(req.body?.colors);
  res.json({ colors });
});
