import { Router } from 'express';
import { insertSales, listSales } from '../services/salesService.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const sales = await listSales();
    res.json({ sales });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const result = await insertSales([req.body]);
    res.status(201).json({ message: 'Data successfully saved.', result });
  } catch (err) {
    next(err);
  }
});

router.post('/bulk', async (req, res, next) => {
  try {
    const result = await insertSales(req.body);
    res.status(201).json({ message: `${result.count} rows successfully saved.` });
  } catch (err) {
    next(err);
  }
});

export default router;
