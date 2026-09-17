import { Router } from 'express';
import {
  reportHandler,
  exportHandler,
  metaHandler,
  savedListHandler,
  savedGetHandler,
  savedCreateHandler,
  savedUpdateHandler,
  savedDeleteHandler,
  colorsListHandler,
  colorsSaveHandler,
} from '../controllers/reportController.js';

import salesRouter from './sales.js';

const router = Router();

router.use('/sales', salesRouter);

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

router.get('/meta/fields', metaHandler);

router.post('/reports', reportHandler);
router.post('/reports/export', exportHandler);

router.get('/reports/saved', savedListHandler);
router.post('/reports/saved', savedCreateHandler);
router.get('/reports/saved/:id', savedGetHandler);
router.put('/reports/saved/:id', savedUpdateHandler);
router.delete('/reports/saved/:id', savedDeleteHandler);

router.get('/colors', colorsListHandler);
router.put('/colors', colorsSaveHandler);

export default router;
