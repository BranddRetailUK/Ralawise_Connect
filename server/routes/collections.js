// server/routes/collections.js
import express from 'express';
import { getShopToken } from '../db.js';
import axios from 'axios';

const router = express.Router();

router.get('/', async (req, res) => {
  const { shop } = req.query;

  if (!shop) return res.status(400).json({ error: 'Missing shop param' });

  const token = await getShopToken(shop);
  if (!token) return res.status(403).json({ error: 'Missing token for shop' });

  try {
    const [custom, smart] = await Promise.all([
      axios.get(`https://${shop}/admin/api/2024-04/custom_collections.json?fields=id,title,handle,products_count`, {
        headers: { 'X-Shopify-Access-Token': token },
      }),
      axios.get(`https://${shop}/admin/api/2024-04/smart_collections.json?fields=id,title,handle,products_count`, {
        headers: { 'X-Shopify-Access-Token': token },
      }),
    ]);

    const collections = [...custom.data.custom_collections, ...smart.data.smart_collections];

    res.json({
      collections: collections.map((c) => ({
        id: c.id,
        title: c.title,
        handle: c.handle,
        product_count: c.products_count || 0,
      })),
    });
  } catch (err) {
    console.error('❌ Error fetching collections:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch collections' });
  }
});

export default router;
