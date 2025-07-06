// server/routes/sync.js
import express from 'express';
import { runSyncForShop } from '../sync-logic.js';
import {
  getAccessToken,
  logSyncResult,
  getRecentLiveLogs,
  getRecentSyncLogs
} from '../db.js';

const router = express.Router();

// Manual Start Sync
router.get('/sync', async (req, res) => {
  const shop = req.query.shop;
  if (!shop) return res.status(400).json({ error: 'Missing shop parameter' });

  try {
    const token = await getAccessToken(shop);
    if (!token) return res.status(403).json({ error: 'Shop not authorized' });

    console.log(`🔁 Manual sync started for: ${shop}`);
    await runSyncForShop(shop, token);
    await logSyncResult(shop, 'STORE_SYNC', 'success', 'Manual sync completed');

    res.json({ status: 'success', message: `Sync complete for ${shop}` });
  } catch (err) {
    console.error(`❌ Sync error for ${shop}:`, err.message || err);
    await logSyncResult(shop, 'STORE_SYNC', 'error', err.message || 'Unknown sync failure');
    res.status(500).json({ error: 'Sync failed', details: err.message || err });
  }
});

// Historical sync logs from sync_logs table
router.get('/sync-logs', async (req, res) => {
  try {
    const logs = await getRecentSyncLogs();
    res.json({ logs });
  } catch (err) {
    console.error('❌ Failed to load sync logs:', err);
    res.status(500).json({ error: 'Failed to load sync logs' });
  }
});

// Live per-SKU logs from sync_status table
router.get('/live-logs', async (req, res) => {
  try {
    const rows = await getRecentLiveLogs();
    const logs = rows.map(row => {
      const time = new Date(row.synced_at).toLocaleTimeString();
      return `[${time}] ✅ ${row.sku} → Qty ${row.quantity}`;
    });
    res.json({ logs });
  } catch (err) {
    console.error('❌ Failed to load live logs:', err);
    res.status(500).json({ error: 'Failed to load live logs' });
  }
});

export default router;
