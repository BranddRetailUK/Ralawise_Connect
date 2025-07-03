// server/sync-logic.js
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getLocationId,
  getInventoryItemId,
  updateInventoryLevel
} from '../src/shopify.js';
import { getRalawiseStock } from '../src/ralawise.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logPath = path.join(__dirname, '../sync-log.json');

function appendLog(entry) {
  const timestamp = new Date().toISOString();
  const log = { time: timestamp, ...entry };

  const existing = fsSync.existsSync(logPath)
    ? JSON.parse(fsSync.readFileSync(logPath, 'utf8'))
    : [];

  existing.unshift(log);
  fsSync.writeFileSync(logPath, JSON.stringify(existing.slice(0, 50), null, 2));
}

export async function runSyncForShop(shop, token) {
  console.log(`🔁 Starting stock sync for: ${shop}`);

  try {
    const mapPath = path.join(__dirname, '../sku-map.json');
    const data = await fs.readFile(mapPath, 'utf8');
    const skuMap = JSON.parse(data);
    console.log(`📦 Loaded ${skuMap.length} SKU mappings from sku-map.json`);

    const locationId = await getLocationId();
    console.log(`📍 Shopify location ID: ${locationId}`);

    for (const item of skuMap) {
      const { ralawise_sku, shopify_variant_id } = item;

      if (!ralawise_sku || !shopify_variant_id) {
        console.warn(`⚠️ Invalid map entry, skipping:`, item);
        continue;
      }

      try {
        console.log(`🔎 Fetching Ralawise stock for SKU: ${ralawise_sku}`);
        const { quantity } = await getRalawiseStock(ralawise_sku);

        if (quantity === null) {
          console.warn(`⚠️ No quantity for ${ralawise_sku}, skipping`);
          appendLog({ sku: ralawise_sku, status: 'error', error: 'No stock returned' });
          continue;
        }

        const inventoryItemId = await getInventoryItemId(shopify_variant_id);

        console.log(`📥 Updating Shopify inventory for variant ${shopify_variant_id} → Qty: ${quantity}`);
        await updateInventoryLevel(inventoryItemId, locationId, quantity);

        console.log(`✅ Stock synced → Variant ID: ${shopify_variant_id}, Qty: ${quantity}`);
        appendLog({ sku: ralawise_sku, status: 'success', quantity, variantId: shopify_variant_id });
        await new Promise(res => setTimeout(res, 1500));
      } catch (err) {
        console.error(`❌ Sync failed for ${ralawise_sku}: ${err.message || err}`);
        appendLog({ sku: ralawise_sku, status: 'error', error: err.message || err, variantId: shopify_variant_id });
      }
    }

    console.log(`✅ Sync complete for: ${shop}`);
  } catch (err) {
    console.error('❌ Critical sync error:', err.message || err);
    throw err;
  }
}
