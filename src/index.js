
import { getStock } from './ralawise.js';
import {
  getLocationId,
  getInventoryItemId,
  updateInventoryLevel
} from './shopify.js';
import skuMap from '../sku-map.json' assert { type: 'json' };

async function syncAll() {
  console.log(`\n🔄 Starting inventory sync at ${new Date().toLocaleString()}`);
  const locationId = await getLocationId();
  console.log(`📍 Shopify location ID: ${locationId}`);

  for (const item of skuMap) {
    try {
      console.log(`\n🔁 Syncing SKU: ${item.ralawise_sku}...`);

      const { sku, quantity } = await getStock(item.ralawise_sku);
      console.log(`📦 Ralawise response: SKU ${sku}, Quantity ${quantity}`);

      if (!sku || quantity === null) {
        console.warn(`⚠️ Skipping invalid or missing Ralawise SKU: ${item.ralawise_sku}`);
        continue;
      }

      const inventoryItemId = await getInventoryItemId(item.shopify_variant_id);
      console.log(`🧩 Shopify inventoryItemId for variant ${item.shopify_variant_id}: ${inventoryItemId}`);

            await updateInventoryLevel(inventoryItemId, locationId, quantity);
      console.log(`✅ Stock updated → SKU: ${sku}, Qty: ${quantity}`);

      // Shopify max: 2 requests/sec → use ~1.1s delay to stay safe
      await new Promise(res => setTimeout(res, 1100));
    } catch (err) {
      if (err.response?.status === 429) {
        const wait = parseInt(err.response.headers['retry-after'] || '2') * 1000;
        console.warn(`🚦 Rate limit hit. Waiting ${wait / 1000}s before retrying...`);
        await new Promise(res => setTimeout(res, wait));
        continue; // Skip to next SKU (or you could retry this one if needed)
      }

      console.error(`❌ Error syncing SKU ${item.ralawise_sku}:`);
      if (err.response) {
        console.error(`   Status: ${err.response.status}`);
        console.error(`   Data:`, err.response.data);
        console.error(`   Headers:`, err.response.headers);
      } else {
        console.error(`   ${err.stack || err.message}`);
      }
    }
  }


  console.log('\n✅ Inventory sync complete.\n');
}



// Run once on script start
syncAll();
