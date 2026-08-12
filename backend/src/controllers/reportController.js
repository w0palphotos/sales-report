import {
  runReport,
  exportCsv,
  getMeta,
  listSavedReports,
  getSavedReport,
  createSavedReport,
  updateSavedReport,
  deleteSavedReport,
} from '../services/reportService.js';
import { ValidationError, validateConfig } from '../core/reportBuilder.js';

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
  validateConfig(config);
  return { name: name.trim(), config };
};

export const reportHandler = wrap(async (req, res) => {
  res.json(await runReport(req.body));
});

export const exportHandler = wrap(async (req, res) => {
  const csv = await exportCsv(req.body);
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="laporan-${date}.csv"`);
  res.send(csv);
});

export const metaHandler = wrap(async (_req, res) => {
  res.json(await getMeta());
});

export const savedListHandler = wrap(async (_req, res) => {
  res.json({ reports: await listSavedReports() });
});

export const savedGetHandler = wrap(async (req, res) => {
  const report = await getSavedReport(parseId(req.params.id));
  if (!report) {
    res.status(404).json({ error: 'Laporan tidak ditemukan.' });
    return;
  }
  res.json(report);
});

export const savedCreateHandler = wrap(async (req, res) => {
  const { name, config } = parseSavedBody(req.body);
  res.status(201).json(await createSavedReport({ name, config }));
});

export const savedUpdateHandler = wrap(async (req, res) => {
  const { name, config } = parseSavedBody(req.body);
  const report = await updateSavedReport(parseId(req.params.id), { name, config });
  if (!report) {
    res.status(404).json({ error: 'Laporan tidak ditemukan.' });
    return;
  }
  res.json(report);
});

export const savedDeleteHandler = wrap(async (req, res) => {
  const deleted = await deleteSavedReport(parseId(req.params.id));
  if (!deleted) {
    res.status(404).json({ error: 'Laporan tidak ditemukan.' });
    return;
  }
  res.status(204).end();
});
