// scripts/manual-sync-gg.js
import { runSyncForShop } from '../server/sync-logic.js';
import dotenv from 'dotenv';

dotenv.config();

const shop = 'ggappareluk.myshopify.com';
const token = 'shpua_...'; // Replace with your actual access token

console.log(`🔁 Running manual sync for: ${shop}`);
await runSyncForShop(shop, token);
console.log('✅ Manual sync complete');
