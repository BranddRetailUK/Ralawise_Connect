// server/sync-logic.js
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';
import {
  getLocationId,
  getInventoryItemId,
  updateInventoryLevel
} from '../src/shopify.js';
import { getRalawiseStock } from '../src/ralawise.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logPath = path.join(__dirname, '../sync-log.json');

global.liveLogBuffer = [];
const variantTitleCache = new Map();
const previousQuantityCache = new Map();
let last429At = 0;
const MAX_RETRIES = 1; // keep calls lean to avoid piling up 429s
const BASE_DELAY_MS = 2000; // increase base delay slightly to ease rate limits
const GLOBAL_429_BACKOFF_MS = 5000;

async function logToDiskAndMemory(entry) {
  const timestamp = new Date().toISOString();
  const log = { time: timestamp, ...entry };

  global.liveLogBuffer.push(
    `[${new Date(timestamp).toLocaleTimeString()}] ${
      log.status === 'success' ? '✅' : '❌'
    } ${log.sku} ${
      log.status === 'success'
        ? `synced → Qty ${log.quantity}`
        : `error: ${log.error}`
    }`
  );

  const existing = fsSync.existsSync(logPath)
    ? JSON.parse(fsSync.readFileSync(logPath, 'utf8'))
    : [];

  existing.unshift(log);
  fsSync.writeFileSync(logPath, JSON.stringify(existing.slice(0, 50), null, 2));
}

async function logToSyncStatusTable(shop, sku, quantity) {
  // Manual upsert so we don't depend on a DB constraint being present
  const updated = await db.query(
    `UPDATE sync_status
       SET quantity = $3, synced_at = NOW()
     WHERE shop_domain = $1 AND sku = $2`,
    [shop, sku, quantity]
  );

  if (updated.rowCount === 0) {
    await db.query(
      `INSERT INTO sync_status (shop_domain, sku, quantity, synced_at)
       VALUES ($1, $2, $3, NOW())`,
      [shop, sku, quantity]
    );
  }
}

async function loadPreviousQuantities(shop) {
  const { rows } = await db.query(
    `SELECT sku, quantity FROM sync_status WHERE shop_domain = $1`,
    [shop]
  );
  const map = new Map();
  for (const row of rows) {
    map.set(row.sku, row.quantity);
  }
  previousQuantityCache.set(shop, map);
  return map;
}

function getRetryDelayMs(err) {
  if (err?.response?.headers?.['retry-after']) {
    const seconds = parseInt(err.response.headers['retry-after'], 10);
    if (!Number.isNaN(seconds)) return seconds * 1000;
  }
  return BASE_DELAY_MS;
}

async function withRateLimitRetry(fn, context = 'request') {
  let attempt = 0;
  while (attempt < MAX_RETRIES) {
    try {
      return await fn();
    } catch (err) {
      const status = err.response?.status;
      if (status === 429 && attempt < MAX_RETRIES - 1) {
        const waitMs = getRetryDelayMs(err);
        console.warn(`🚦 Rate limited during ${context}. Waiting ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise((res) => setTimeout(res, waitMs));
        attempt += 1;
        last429At = Date.now();
        continue;
      }
      throw err;
    }
  }
}

function isRalawiseSku(sku) {
  return /^[A-Z0-9]{6,}$/i.test(sku || '');
}

async function getVariantLabel(shop, variantId) {
  if (variantTitleCache.has(variantId)) return variantTitleCache.get(variantId);

  let label = null;
  try {
    // Try store_products (newer table)
    const sp = await db.query(
      `SELECT product_title, variant_title, product_handle
       FROM store_products
       WHERE shop_domain = $1 AND variant_id = $2
       LIMIT 1`,
      [shop, variantId]
    );

    if (sp.rows.length) {
      const { product_title, variant_title, product_handle } = sp.rows[0];
      label = `${product_title || 'Unknown product'} — ${variant_title || 'Variant'}`.trim();
      if (product_handle) {
        label = `${label} (/${product_handle})`;
      }
    } else {
      // Fallback to legacy products table if present
      const legacy = await db.query(
        `SELECT title, handle FROM products WHERE shop_domain = $1 AND variant_id = $2 LIMIT 1`,
        [shop, variantId]
      );
      if (legacy.rows.length) {
        const { title, handle } = legacy.rows[0];
        label = `${title || 'Unknown product'}${handle ? ` (/${handle})` : ''}`;
      }
    }
  } catch (err) {
    console.warn(`⚠️ Failed to load variant label for ${variantId}:`, err.message || err);
  }

  variantTitleCache.set(variantId, label);
  return label;
}

export async function runSyncForShop(shop, token, options = {}) {
  const { reverse = false } = options;
  console.log(`🔁 Starting stock sync for: ${shop} ${reverse ? '(reversed)' : ''}`);
  global.liveLogBuffer = [];

  try {
    const orderDirection = reverse ? 'DESC' : 'ASC';

    const { rows: skuMap } = await db.query(
      `SELECT ralawise_sku, variant_id FROM store_skus WHERE shop_domain = $1 ORDER BY created_at ${orderDirection}`,
      [shop]
    );

    // Filter to Ralawise-format SKUs only; skip any legacy/non-Ralawise rows to avoid wasted API calls
    const filteredSkuMap = skuMap.filter((row) => isRalawiseSku(row.ralawise_sku));
    const skipped = skuMap.length - filteredSkuMap.length;

    console.log(`📦 Loaded ${filteredSkuMap.length} SKU mappings from DB${skipped > 0 ? ` (skipped ${skipped} non-Ralawise rows)` : ''}`);
    global.liveLogBuffer.push(`📦 Loaded ${filteredSkuMap.length} SKU mappings${skipped > 0 ? ` (skipped ${skipped} non-Ralawise rows)` : ''}`);

    const locationId = await getLocationId(shop);
    global.liveLogBuffer.push(`📍 Shopify location ID: ${locationId}`);

    const prevQuantities = await loadPreviousQuantities(shop);

    for (const item of filteredSkuMap) {
      const { ralawise_sku, variant_id: shopify_variant_id } = item;

      if (!ralawise_sku || !shopify_variant_id) {
        global.liveLogBuffer.push(`⚠️ Invalid map entry: ${JSON.stringify(item)}`);
        continue;
      }

        try {
          const { quantity } = await getRalawiseStock(ralawise_sku);

        if (quantity === null) {
          console.warn(`⚠️ ${shop} ${ralawise_sku}: no stock returned`);
          await logToDiskAndMemory({
            sku: ralawise_sku,
            status: 'error',
            error: 'No stock returned'
          });
          continue;
        }

        const prevQty = prevQuantities.get(ralawise_sku);
        if (prevQty !== undefined && prevQty === quantity) {
          const label = await getVariantLabel(shop, shopify_variant_id);
          const skipMsg = `⏭️ ${shop} ${ralawise_sku}: no quantity change (${quantity})` + (label ? ` — ${label}` : '');
          console.log(skipMsg);
          global.liveLogBuffer.push(skipMsg);
          continue;
        }

        let inventoryItemId;
        try {
          inventoryItemId = await withRateLimitRetry(
            () => getInventoryItemId(shop, shopify_variant_id),
            `getInventoryItemId for ${shopify_variant_id}`
          );
        } catch (err) {
          if (err.response?.status === 404) {
            console.warn(`🚫 ${shop} ${ralawise_sku}: variant ${shopify_variant_id} not found on Shopify (removing mapping)`);
            await db.query(
              'DELETE FROM store_skus WHERE shop_domain = $1 AND variant_id = $2',
              [shop, shopify_variant_id]
            );
            await logToDiskAndMemory({
              sku: ralawise_sku,
              status: 'error',
              error: 'Variant not found (deleted mapping)',
              variantId: shopify_variant_id,
            });
            continue;
          }
          throw err;
        }

        try {
          await withRateLimitRetry(
            () => updateInventoryLevel(shop, inventoryItemId, locationId, quantity),
            `updateInventoryLevel for ${shopify_variant_id}`
          );
        } catch (err) {
          if (err.response?.status === 404) {
            console.warn(`🚫 ${shop} ${ralawise_sku}: inventory update 404 for variant ${shopify_variant_id} (removing mapping)`);
            await db.query(
              'DELETE FROM store_skus WHERE shop_domain = $1 AND variant_id = $2',
              [shop, shopify_variant_id]
            );
            await logToDiskAndMemory({
              sku: ralawise_sku,
              status: 'error',
              error: 'Inventory update 404 (deleted mapping)',
              variantId: shopify_variant_id,
            });
            continue;
          }
          throw err;
        }

        const label = await getVariantLabel(shop, shopify_variant_id);
        console.log(
          `✅ ${shop} ${ralawise_sku}: set qty ${quantity} (variant ${shopify_variant_id}, item ${inventoryItemId})` +
            (label ? ` — ${label}` : '')
        );

        await logToDiskAndMemory({
          sku: ralawise_sku,
          status: 'success',
          quantity,
          variantId: shopify_variant_id,
        });

        await logToSyncStatusTable(shop, ralawise_sku, quantity);

        // Base pacing
        await new Promise((res) => setTimeout(res, BASE_DELAY_MS));

        // If we recently hit a 429, inject an extra pause to cool down
        if (Date.now() - last429At < 60_000) {
          await new Promise((res) => setTimeout(res, GLOBAL_429_BACKOFF_MS));
        }
      } catch (err) {
        console.error(`❌ ${shop} ${ralawise_sku}: sync failed`, err.message || err);
        await logToDiskAndMemory({
          sku: ralawise_sku,
          status: 'error',
          error: err.message || err,
          variantId: shopify_variant_id,
        });
      }
    }

    global.liveLogBuffer.push(`✅ Sync complete for: ${shop}`);
  } catch (err) {
    global.liveLogBuffer.push(`❌ Critical sync error: ${err.message || err}`);
    throw err;
  }
}
