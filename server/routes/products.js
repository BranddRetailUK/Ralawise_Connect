// server/routes/products.js
import express from 'express';
import { getAccessToken } from '../db.js';
import axios from 'axios';

const router = express.Router();

router.get('/', async (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.status(400).json({ error: 'Missing shop param' });

  const token = await getAccessToken(shop);
  if (!token) return res.status(403).json({ error: 'No access token for shop' });

  try {
    const shopifyRes = await axios.get(`https://${shop}/admin/api/2024-01/products.json?limit=20`, {
      headers: {
        'X-Shopify-Access-Token': token
      }
    });

    const products = shopifyRes.data.products.map(product => ({
      id: product.id,
      title: product.title,
      image: product.image?.src || null,
      variants: product.variants.length,
      handle: product.handle,
      updated_at: product.updated_at
    }));

    res.json({ products });
  } catch (err) {
    console.error('Shopify API error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

export default router;
