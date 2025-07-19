// scripts/refresh-sku-map.js
import fs from 'fs/promises';
import axios from 'axios';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const { Pool } = pg;

const shopify = axios.create({
  baseURL: `${process.env.SHOPIFY_STORE_URL}/admin/api/2023-10`,
  headers: {
    'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
    'Content-Type': 'application/json'
  }
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function isRalawiseSku(sku) {
  return /^[A-Z0-9]{5,}$/i.test(sku); // e.g. "JH001DPBKXS", "YP237BKLO"
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAllProducts() {
  let products = [];
  let since_id = 0;
  let hasMore = true;

  try {
    do {
      const res = await shopify.get(`/products.json`, {
        params: {
          limit: 250,
          since_id,
          fields: 'id,title,variants'
        }
      });

      const batch = res.data.products;
      if (batch.length > 0) {
        products.push(...batch);
        since_id = batch[batch.length - 1].id;
        await sleep(600); // wait 600ms between calls to stay under 2 req/sec
      } else {
        hasMore = false;
      }
    } while (hasMore);

    return products;
  } catch (err) {
    console.error('❌ Failed to fetch products from Shopify');
    console.error(err.response?.data || err.message);
    process.exit(1);
  }
}

async function updateStoreSkus(records) {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const rec of records) {
    try {
      const { rows } = await pool.query(
        `SELECT sku FROM store_skus WHERE variant_id = $1 LIMIT 1`,
        [rec.variant_id]
      );

      const existingSku = rows[0]?.sku;

      if (!existingSku) {
        await pool.query(
          `INSERT INTO store_skus (shop_domain, sku, product_id, variant_id, ralawise_sku)
           VALUES ($1, $2, $3, $4, $5)`,
          ['ggappareluk.myshopify.com', rec.sku, rec.product_id, rec.variant_id, rec.sku]
        );
        inserted++;
        console.log(`✅ Inserted: ${rec.variant_id} → ${rec.sku}`);
      } else if (existingSku !== rec.sku) {
        await pool.query(
          `UPDATE store_skus SET sku = $1, ralawise_sku = $1 WHERE variant_id = $2`,
          [rec.sku, rec.variant_id]
        );
        updated++;
        console.log(`🔁 Updated: ${rec.variant_id} → ${existingSku} ➝ ${rec.sku}`);
      } else {
        skipped++;
        console.log(`⏭️ Skipped: ${rec.variant_id} — SKU unchanged`);
      }
    } catch (err) {
      console.error(`❌ DB error for variant ${rec.variant_id}:`, err.message);
    }
  }

  console.log(`🎯 Sync complete → ${inserted} inserted, ${updated} updated, ${skipped} skipped`);
}

async function refreshSkuMap() {
  console.log(`🔍 Fetching all Shopify products and variants...`);
  const products = await fetchAllProducts();

  const matched = [];

  for (const product of products) {
    for (const variant of product.variants) {
      if (variant.sku && isRalawiseSku(variant.sku)) {
        matched.push({
          sku: variant.sku.trim(),
          product_id: product.id,
          variant_id: variant.id
        });
      }
    }
  }

  console.log(`✅ Found ${matched.length} Ralawise-format variants.`);
  await fs.writeFile('./sku-map.json', JSON.stringify(matched, null, 2));
  console.log('💾 Updated sku-map.json');

  await updateStoreSkus(matched);
}

refreshSkuMap();
