import { runSyncForShop } from './sync-logic.js';

const shop = process.env.DEFAULT_SHOP || 'ggappareluk.myshopify.com';
const token = process.env.SHOPIFY_ACCESS_TOKEN || 'your-fallback-token';

(async () => {
  console.log(`🌀 Starting batch sync for ${shop}...`);
  try {
    await runSyncForShop(shop, token);
    console.log('✅ Sync complete.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Sync failed:', err);
    process.exit(1);
  }
})();
