// server/cron-batch-sync.js
import { runSyncForShop } from './sync-logic.js';
import db from './db.js';

(async () => {
  console.log('🌀 Starting batch sync for all installed stores...');

  try {
    const { rows: stores } = await db.query('SELECT shop_domain, access_token FROM store_tokens');

    for (const store of stores) {
      const { shop_domain, access_token } = store;
      console.log(`🔁 Syncing store: ${shop_domain}`);

      try {
        await runSyncForShop(shop_domain, access_token);
        console.log(`✅ Finished sync for ${shop_domain}`);
      } catch (err) {
        console.error(`❌ Sync failed for ${shop_domain}:`, err.message || err);
      }
    }

    console.log('✅ All store syncs complete.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to load stores:', err.message || err);
    process.exit(1);
  }
})();
