// server/sync-logic.js
import fs from 'fs/promises';
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
          console.warn(`⚠️ No quantity returned for ${ralawise_sku}, skipping`);
          continue;
        }

        const inventoryItemId = await getInventoryItemId(shopify_variant_id);

        console.log(`📥 Updating Shopify inventory for variant ${shopify_variant_id} → Qty: ${quantity}`);
        await updateInventoryLevel(inventoryItemId, locationId, quantity);

        console.log(`✅ Stock synced → Variant ID: ${shopify_variant_id}, Qty: ${quantity}`);
        await new Promise(res => setTimeout(res, 1500)); // Rate limit buffer
      } catch (err) {
        console.error(`❌ Sync failed for ${ralawise_sku}: ${err.message || err}`);
      }
    }

    console.log(`✅ Sync complete for: ${shop}`);
  } catch (err) {
    console.error('❌ Critical sync error:', err.message || err);
    throw err;
  }
}
