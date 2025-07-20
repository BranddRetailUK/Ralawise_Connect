// server/cron-batch-sync-reverse.js
import { runSyncForShop } from './sync-logic.js';
import db, { logSyncResult } from './db.js';

(async () => {
  console.log('🔄 Starting REVERSE batch sync for all installed stores (newest SKUs first)...');

  try {
    // Get stores ordered by latest token creation (assumes latest shops = newest SKUs)
    const { rows: stores } = await db.query('SELECT shop_domain, access_token FROM store_tokens ORDER BY created_at DESC');

    for (const store of stores) {
      const { shop_domain, access_token } = store;
      console.log(`🔁 Reverse syncing store: ${shop_domain}`);

      try {
        await runSyncForShop(shop_domain, access_token, { reverse: true });
        console.log(`✅ Finished reverse sync for ${shop_domain}`);

        await logSyncResult(shop_domain, 'REVERSE_STORE_SYNC', 'success', 'Reverse cron sync completed');
      } catch (err) {
        console.error(`❌ Reverse sync failed for ${shop_domain}:`, err.message || err);

        await logSyncResult(shop_domain, 'REVERSE_STORE_SYNC', 'error', err.message || 'Reverse cron sync error');
      }
    }

    console.log('✅ All reverse store syncs complete.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to load stores for reverse sync:', err.message || err);
    process.exit(1);
  }
})();
