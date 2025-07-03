// server/routes/sync.js
import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { runSyncForShop } from '../sync-logic.js';
import { getAccessToken } from '../db.js';

const router = express.Router();

router.get('/sync', async (req, res) => {
  const shop = req.query.shop;

  if (!shop) return res.status(400).json({ error: 'Missing shop parameter' });

  try {
    const token = await getAccessToken(shop);
    if (!token) return res.status(403).json({ error: 'Shop not authorized' });

    await runSyncForShop(shop, token);
    res.json({ status: 'success', message: `Sync complete for ${shop}` });
  } catch (err) {
    console.error('❌ Sync error:', err);
    res.status(500).json({ error: 'Sync failed', details: err.message || err });
  }
});

router.get('/sync-logs', async (req, res) => {
  const logPath = path.resolve('sync-log.json');

  try {
    await fs.access(logPath);
    const data = await fs.readFile(logPath, 'utf8');
    const logs = JSON.parse(data);
    res.json({ logs });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.json({ logs: [] });
    }
    console.error('❌ Failed to load sync logs:', err);
    res.status(500).json({ error: 'Failed to load logs' });
  }
});

router.get('/live-logs', (req, res) => {
  res.json({ logs: global.liveLogBuffer || [] });
});

export default router;
