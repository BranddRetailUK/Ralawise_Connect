// server/routes/update-skus.js
import express from 'express';
import db from '../db.js';

const router = express.Router();

router.post('/update-skus', async (req, res) => {
  const { matches, shop } = req.body;

  if (!shop || !Array.isArray(matches)) {
    return res.status(400).json({ message: 'Missing shop or matches' });
  }

  let successCount = 0;

  for (const row of matches) {
    const { handle, suggested_sku } = row;
    if (!handle || !suggested_sku) continue;

    try {
      // Get variant ID for this handle
      const variantRes = await db.query(
        `SELECT variant_id FROM products WHERE shop_domain = $1 AND handle = $2 LIMIT 1`,
        [shop, handle]
      );

      const variantId = variantRes.rows[0]?.variant_id;
      if (!variantId) continue;

      await db.query(
        `INSERT INTO store_skus (shop_domain, variant_id, ralawise_sku)
         VALUES ($1, $2, $3)
         ON CONFLICT (shop_domain, variant_id)
         DO UPDATE SET ralawise_sku = EXCLUDED.ralawise_sku`,
        [shop, variantId, suggested_sku]
      );

      successCount++;
    } catch (err) {
      console.error(`❌ Failed to update SKU for ${handle}:`, err.message);
    }
  }

  res.json({
    success: true,
    updated: successCount,
    message: `✅ ${successCount} SKUs updated successfully.`
  });
});

export default router;
