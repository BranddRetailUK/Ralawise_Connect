// server/routes/sync.js
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { getAccessToken } from '../db.js';
import { runSyncForShop } from '../sync-logic.js';

const router = express.Router();

// 🔁 Trigger sync for a shop
router.get('/sync', async (req, res) => {
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

// 🧾 Serve sync logs to frontend
router.get('/sync-logs', async (req, res) => {
  const logPath = path.resolve('sync-log.json');

  try {
    // Check if file exists
    await fs.access(logPath);
    const data = await fs.readFile(logPath, 'utf8');
    const logs = JSON.parse(data);
    res.json({ logs });
  } catch (err) {
    if (err.code === 'ENOENT') {
      // File doesn't exist yet — return empty logs
      res.json({ logs: [] });
    } else {
      console.error('❌ Failed to load sync logs:', err);
      res.status(500).json({ error: 'Failed to load logs' });
    }
  }
});

export default router;
