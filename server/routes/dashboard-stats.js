// server/routes/dashboard-stats.js
import express from 'express';
import axios from 'axios';
import { getShopToken, getSyncErrorCount, getMappedSkuCount } from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.status(400).json({ error: 'Missing shop param' });

  const token = await getShopToken(shop);
  if (!token) return res.status(403).json({ error: 'Missing token for shop' });

  try {
    // Get product count
    const productRes = await axios.get(`https://${shop}/admin/api/2024-04/products/count.json`, {
      headers: { 'X-Shopify-Access-Token': token },
    });

    // Get custom and smart collection counts
    const [customCount, smartCount] = await Promise.all([
      axios.get(`https://${shop}/admin/api/2024-04/custom_collections/count.json`, {
        headers: { 'X-Shopify-Access-Token': token },
      }),
      axios.get(`https://${shop}/admin/api/2024-04/smart_collections/count.json`, {
        headers: { 'X-Shopify-Access-Token': token },
      }),
    ]);

    // DB-based stats
    const syncErrors = await getSyncErrorCount(shop);      // from sync_logs
    const mappedSkus = await getMappedSkuCount(shop);      // from store_skus

    res.json({
      products: productRes.data.count,
      collections: customCount.data.count + smartCount.data.count,
      sync_errors: syncErrors,
      mapped_skus: mappedSkus,
    });

  } catch (err) {
    console.error('❌ Failed to load dashboard stats:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to load dashboard stats' });
  }
});

export default router;
