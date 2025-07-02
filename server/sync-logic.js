// server/sync-logic.js
export async function runSyncForShop(shop, token) {
  console.log(`🔁 [runSyncForShop] Sync started for: ${shop}`);

  // Simulate a delay to mock syncing
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log(`✅ [runSyncForShop] Sync complete for: ${shop}`);
}
