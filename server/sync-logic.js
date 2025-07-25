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
  await db.query(
    `INSERT INTO sync_status (shop_domain, sku, quantity, synced_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (shop_domain, sku)
     DO UPDATE SET quantity = EXCLUDED.quantity, synced_at = NOW()`,
    [shop, sku, quantity]
  );
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

    console.log(`📦 Loaded ${skuMap.length} SKU mappings from DB`);
    global.liveLogBuffer.push(`📦 Loaded ${skuMap.length} SKU mappings`);

    const locationId = await getLocationId(shop);
    global.liveLogBuffer.push(`📍 Shopify location ID: ${locationId}`);

    for (const item of skuMap) {
      const { ralawise_sku, variant_id: shopify_variant_id } = item;

      if (!ralawise_sku || !shopify_variant_id) {
        global.liveLogBuffer.push(`⚠️ Invalid map entry: ${JSON.stringify(item)}`);
        continue;
      }

      try {
        const { quantity } = await getRalawiseStock(ralawise_sku);

        if (quantity === null) {
          await logToDiskAndMemory({
            sku: ralawise_sku,
            status: 'error',
            error: 'No stock returned'
          });
          continue;
        }

        const inventoryItemId = await getInventoryItemId(shop, shopify_variant_id);
        await updateInventoryLevel(shop, inventoryItemId, locationId, quantity);

        await logToDiskAndMemory({
          sku: ralawise_sku,
          status: 'success',
          quantity,
          variantId: shopify_variant_id,
        });

        await logToSyncStatusTable(shop, ralawise_sku, quantity);

        await new Promise((res) => setTimeout(res, 1500)); // rate limiting
      } catch (err) {
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
