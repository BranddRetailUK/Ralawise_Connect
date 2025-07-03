// server/sync-logic.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { updateInventoryLevel } from './shopify.js';
import { getRalawiseStock } from '../src/ralawise.js'; // ✅ updated path

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runSyncForShop(shop, token) {
  console.log(`🔁 [runSyncForShop] Sync started for: ${shop}`);

  try {
    const mapPath = path.join(__dirname, '../sku-map.json');
    const data = await fs.readFile(mapPath, 'utf8');
    const skuMap = JSON.parse(data);

    console.log(`📦 Loaded ${skuMap.length} SKUs from sku-map.json`);

    for (const item of skuMap) {
      const { shopify_sku: shopifySKU, ralawise_sku: ralawiseSKU, inventory_item_id, location_id } = item;

      if (!ralawiseSKU || !inventory_item_id || !location_id) {
        console.warn(`⚠️ Missing data for SKU: ${shopifySKU}, skipping...`);
        continue;
      }

      try {
        console.log(`🔎 Fetching stock for: ${ralawiseSKU}`);
        const { quantity } = await getRalawiseStock(ralawiseSKU);

        console.log(`📥 Updating inventory → ${shopifySKU} to Qty: ${quantity}`);
        await updateInventoryLevel(inventory_item_id, location_id, quantity);

        // Optional: Delay to respect Shopify rate limits
        await new Promise(res => setTimeout(res, 1500));
      } catch (err) {
        console.error(`❌ Error syncing ${shopifySKU}: ${err.message || err}`);
      }
    }

    console.log(`✅ [runSyncForShop] Sync complete for: ${shop}`);
  } catch (err) {
    console.error('❌ Error in runSyncForShop:', err);
    throw err;
  }
}
