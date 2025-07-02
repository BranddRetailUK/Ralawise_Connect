// server/routes/sync.js
import express from 'express';
import { getAccessToken } from '../db.js';
import { runSyncForShop } from '../sync-logic.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.status(400).json({ error: 'Missing shop param' });

  const token = await getAccessToken(shop);
  if (!token) return res.status(403).json({ error: 'Shop not installed or authorized' });

  try {
    await runSyncForShop(shop, token);
    res.json({ status: 'success', message: `Sync started for ${shop}` });
  } catch (err) {
    console.error('Sync failed:', err.message);
    res.status(500).json({ error: 'Sync failed', details: err.message });
  }
});

export default router;
