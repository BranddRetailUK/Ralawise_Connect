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

// Global log buffer for live dashboard stream
global.liveLogBuffer = [];

function appendLog(entry) {
  const timestamp = new Date().toISOString();
  const log = { time: timestamp, ...entry };

  global.liveLogBuffer.push(
    `[${new Date(timestamp).toLocaleTimeString()}] ${
      log.status === 'success'
        ? '✅'
        : '❌'
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

export async function runSyncForShop(shop, token) {
  console.log(`🔁 Starting stock sync for: ${shop}`);
  global.liveLogBuffer = [];

  try {
    const { rows: skuMap } = await db.query(
      'SELECT ralawise_sku, variant_id FROM store_skus WHERE shop_domain = $1',
      [shop]
    );

    console.log(`📦 Loaded ${skuMap.length} SKU mappings from DB`);
    global.liveLogBuffer.push(`📦 Loaded ${skuMap.length} SKU mappings`);

    const locationId = await getLocationId();
    console.log(`📍 Shopify location ID: ${locationId}`);
    global.liveLogBuffer.push(`📍 Shopify location ID: ${locationId}`);

    for (const item of skuMap) {
      const { ralawise_sku, variant_id: shopify_variant_id } = item;

      if (!ralawise_sku || !shopify_variant_id) {
        console.warn(`⚠️ Invalid map entry, skipping:`, item);
        global.liveLogBuffer.push(
          `⚠️ Invalid map entry, skipping: ${JSON.stringify(item)}`
        );
        continue;
      }

      try {
        console.log(`🔎 Fetching Ralawise stock for SKU: ${ralawise_sku}`);
        global.liveLogBuffer.push(`🔎 Checking ${ralawise_sku}`);

        const { quantity } = await getRalawiseStock(ralawise_sku);

        if (quantity === null) {
          appendLog({
            sku: ralawise_sku,
            status: 'error',
            error: 'No stock returned',
          });
          continue;
        }

        const inventoryItemId = await getInventoryItemId(shopify_variant_id);
        console.log(
          `📥 Updating Shopify inventory for variant ${shopify_variant_id} → Qty: ${quantity}`
        );
        global.liveLogBuffer.push(
          `📥 Shopify update: ${shopify_variant_id} → ${quantity}`
        );

        await updateInventoryLevel(inventoryItemId, locationId, quantity);

        console.log(
          `✅ Stock synced → Variant ID: ${shopify_variant_id}, Qty: ${quantity}`
        );
        appendLog({
          sku: ralawise_sku,
          status: 'success',
          quantity,
          variantId: shopify_variant_id,
        });

        await new Promise((res) => setTimeout(res, 1500));
      } catch (err) {
        console.error(`❌ Sync failed for ${ralawise_sku}:`, err);
        appendLog({
          sku: ralawise_sku,
          status: 'error',
          error: err.message || err,
          variantId: shopify_variant_id,
        });
      }
    }

    global.liveLogBuffer.push(`✅ Sync complete for: ${shop}`);
    console.log(`✅ Sync complete for: ${shop}`);
  } catch (err) {
    console.error('❌ Critical sync error:', err);
    global.liveLogBuffer.push(`❌ Critical sync error: ${err.message || err}`);
    throw err;
  }
}
