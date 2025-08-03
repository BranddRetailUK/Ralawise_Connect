// server/worker-sync.js
import db from './db.js';
import { runSyncForShop } from './sync-logic.js';
import { refreshSkuMap } from '../scripts/refresh-sku-map.js';

const LOOP_INTERVAL_MINUTES = 10; // how often the loop restarts
const THROTTLE_MS_BETWEEN_STORES = 2000; // delay between each store's sync

async function syncAllStores() {
  try {
    // Refresh SKU mappings before syncing any store
    await refreshSkuMap();

    const { rows: stores } = await db.query(`
      SELECT shop_domain, access_token FROM store_tokens
      WHERE ready_for_sync = true
    `);

    if (stores.length === 0) {
      console.log('⏳ No stores ready for sync.');
      return;
    }

    console.log(`🔁 Syncing ${stores.length} stores...`);

    for (const store of stores) {
      const { shop_domain, access_token } = store;

      try {
        console.log(`🚚 Syncing: ${shop_domain}`);
        await runSyncForShop(shop_domain, access_token);
        console.log(`✅ Done: ${shop_domain}`);
      } catch (err) {
        console.error(`❌ Failed for ${shop_domain}: ${err.message || err}`);
      }

      await new Promise((r) => setTimeout(r, THROTTLE_MS_BETWEEN_STORES));
    }

    console.log(`✅ All store syncs complete.`);
  } catch (err) {
    console.error('❌ Error loading stores:', err.message || err);
  }
}

// Loop forever
(async function mainLoop() {
  while (true) {
    console.log('🔄 Worker sync cycle starting...');
    await syncAllStores();

    console.log(`🕒 Sleeping for ${LOOP_INTERVAL_MINUTES} minutes...\n`);
    await new Promise((r) => setTimeout(r, LOOP_INTERVAL_MINUTES * 60 * 1000));
  }
})();
