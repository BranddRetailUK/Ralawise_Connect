// scripts/refresh-sku-map.js
import fs from 'fs/promises';
import axios from 'axios';
import dotenv from 'dotenv';
import db from '../server/db.js';

dotenv.config();

const API_VERSION = '2024-10';
const PAGE_SIZE = 250;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRalawiseSku(sku) {
  return /^[A-Z0-9]{6,}$/i.test(sku || ''); // e.g. "JH001DPBKXS"
}

function parseNextPageInfo(linkHeader = '') {
  const match = linkHeader.match(/<[^>]*[?&]page_info=([^>]+)>;\s*rel="next"/);
  return match ? match[1] : null;
}

function normalizeShopDomain(urlOrDomain = '') {
  return urlOrDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

async function fetchAllProducts(shop, token) {
  const products = [];
  let pageInfo = null;
  let page = 1;

  while (true) {
    try {
      const params = pageInfo
        ? { limit: PAGE_SIZE, page_info: pageInfo, fields: 'id,title,variants' }
        : { limit: PAGE_SIZE, order: 'id asc', fields: 'id,title,variants' };

      const res = await axios.get(
        `https://${shop}/admin/api/${API_VERSION}/products.json`,
        {
          params,
          headers: {
            'X-Shopify-Access-Token': token,
            'Content-Type': 'application/json',
          },
        }
      );

      const batch = res.data.products || [];
      products.push(...batch);
      console.log(`🛒 ${shop}: fetched page ${page} (${batch.length} products)`);

      const next = parseNextPageInfo(res.headers?.link);
      if (!next) break;

      pageInfo = next;
      page += 1;
      await sleep(500); // small throttle to avoid rate limits
    } catch (err) {
      if (err.response?.status === 429) {
        const waitMs = parseInt(err.response.headers['retry-after'] || '2', 10) * 1000;
        console.warn(`🚦 ${shop}: rate limited, waiting ${waitMs}ms...`);
        await sleep(waitMs);
        continue;
      }

      console.error(`❌ ${shop}: failed to fetch products`, err.response?.data || err.message);
      throw err;
    }
  }

  return products;
}

async function upsertStoreSkus(shop, matched) {
  let processed = 0;

  for (const rec of matched) {
    try {
      await db.query(
        `
        INSERT INTO store_skus (shop_domain, sku, ralawise_sku, product_id, variant_id)
        VALUES ($1, $2, $2, $3, $4)
        ON CONFLICT (shop_domain, variant_id)
        DO UPDATE SET
          sku = EXCLUDED.sku,
          ralawise_sku = EXCLUDED.ralawise_sku,
          product_id = EXCLUDED.product_id
        `,
        [shop, rec.ralawise_sku, rec.product_id, rec.shopify_variant_id]
      );
      processed += 1;
    } catch (err) {
      console.error(`❌ ${shop}: DB upsert failed for variant ${rec.shopify_variant_id}`, err.message || err);
    }
  }

  console.log(`🎯 ${shop}: upserted ${processed} SKU rows into store_skus`);
}

async function refreshSkuMapForStore(shop, token) {
  console.log(`🔍 Refreshing SKU map for ${shop}...`);
  const products = await fetchAllProducts(shop, token);

  const matched = [];
  for (const product of products) {
    for (const variant of product.variants || []) {
      const sku = variant.sku?.trim();
      if (!sku || !isRalawiseSku(sku)) continue;

      matched.push({
        ralawise_sku: sku,
        product_id: product.id,
        shopify_variant_id: variant.id,
      });
    }
  }

  console.log(`✅ ${shop}: found ${matched.length} Ralawise-format variants`);
  await upsertStoreSkus(shop, matched);

  return matched;
}

async function getTargetStores() {
  const { rows } = await db.query(
    `SELECT shop_domain, access_token FROM store_tokens WHERE ready_for_sync = true`
  );

  if (rows.length > 0) return rows;

  // Fallback to env for single-store/manual use
  if (process.env.SHOPIFY_STORE_URL && process.env.SHOPIFY_ACCESS_TOKEN) {
    return [
      {
        shop_domain: normalizeShopDomain(process.env.SHOPIFY_STORE_URL),
        access_token: process.env.SHOPIFY_ACCESS_TOKEN,
      },
    ];
  }

  return [];
}

// Expose the refreshSkuMap function so it can be imported in cron jobs
export async function refreshSkuMap() {
  const stores = await getTargetStores();

  if (!stores.length) {
    console.warn('⚠️ No stores available for SKU refresh.');
    return;
  }

  const filePayload = [];

  for (const { shop_domain, access_token } of stores) {
    const matched = await refreshSkuMapForStore(shop_domain, access_token);

    // Keep sku-map.json for compatibility with legacy batch scripts (first store only)
    if (filePayload.length === 0) {
      filePayload.push(
        ...matched.map((m) => ({
          ralawise_sku: m.ralawise_sku,
          shopify_variant_id: m.shopify_variant_id,
        }))
      );
    }

    await sleep(750); // brief pause between stores to avoid spikes
  }

  if (filePayload.length > 0) {
    await fs.writeFile('./sku-map.json', JSON.stringify(filePayload, null, 2));
    console.log('💾 Updated sku-map.json for legacy batch sync consumers');
  }
}

// If executed directly (`node scripts/refresh-sku-map.js`), run the refresh routine.
if (import.meta.url === `file://${process.argv[1]}`) {
  refreshSkuMap().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
