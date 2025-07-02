// server/cron-batch-sync.js

import { runFullSync } from './sync-logic.js'; // or wherever your main logic lives

const shop = process.env.DEFAULT_SHOP; // set this in Railway variables

console.log(`⏳ Starting batch sync for ${shop}...`);

runFullSync(shop)
  .then(() => {
    console.log(`✅ Batch sync complete.`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(`❌ Sync failed:`, err);
    process.exit(1);
  });
