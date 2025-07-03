// server/routes/upload.js
import express from 'express';
import db from '../db.js';
import { getAccessToken } from '../db.js';
import axios from 'axios';

const router = express.Router();

// Upload raw SKU mapping
router.post('/upload-skus', async (req, res) => {
  const { shop, skus } = req.body;

  if (!shop || !Array.isArray(skus)) {
    return res.status(400).json({ error: 'Missing shop or skus array' });
  }

  try {
    let inserted = 0;

    for (const item of skus) {
      const { sku, ralawise_sku, product_id, variant_id } = item;
      if (!sku || !product_id || !variant_id) continue;

      await db.query(
        `
        INSERT INTO store_skus (
          shop_domain, sku, ralawise_sku, product_id, variant_id
        )
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (shop_domain, variant_id)
        DO UPDATE SET
          sku = EXCLUDED.sku,
          ralawise_sku = EXCLUDED.ralawise_sku,
          product_id = EXCLUDED.product_id;
        `,
        [shop, sku, ralawise_sku || null, product_id, variant_id]
      );

      inserted++;
    }

    console.log(`✅ Uploaded ${inserted} SKUs for ${shop}`);
    res.json({ success: true, inserted });
  } catch (err) {
    console.error('❌ Failed to upload SKUs:', err);
    res.status(500).json({ error: 'Failed to store SKU mappings' });
  }
});

// Auto-generate SKU mapping from Shopify products
router.post('/generate-sku-map', async (req, res) => {
  const { shop } = req.body;
  if (!shop) return res.status(400).json({ error: 'Missing shop param' });

  const token = await getAccessToken(shop);
  if (!token) return res.status(403).json({ error: 'Unauthorized store' });

  try {
    const productRes = await axios.get(`https://${shop}/admin/api/2024-01/products.json?limit=250`, {
      headers: { 'X-Shopify-Access-Token': token },
    });

    let inserted = 0;

    for (const product of productRes.data.products) {
      for (const variant of product.variants) {
        const sku = variant.sku?.trim();
        if (!sku || !variant.id) continue;

        await db.query(
          `INSERT INTO store_skus (
            shop_domain, sku, ralawise_sku, product_id, variant_id
          )
          VALUES ($1, $2, $2, $3, $4)
          ON CONFLICT (shop_domain, variant_id)
          DO UPDATE SET
            sku = EXCLUDED.sku,
            ralawise_sku = EXCLUDED.ralawise_sku,
            product_id = EXCLUDED.product_id`,
          [shop, sku, product.id, variant.id]
        );

        inserted++;
      }
    }

    console.log(`✅ Mapped ${inserted} SKUs for ${shop}`);
    res.json({ success: true, inserted });
  } catch (err) {
    console.error('❌ Failed to generate SKU map:', err);
    res.status(500).json({ error: 'SKU mapping failed' });
  }
});

export default router;
