import { storeAccessToken, getAccessToken } from './db.js';

const testShop = 'ralawise-connect.myshopify.com';
const testToken = 'shpat_test_token_123456';

async function runTest() {
  console.log('🧪 Inserting token...');
  await storeAccessToken(testShop, testToken);

  console.log('🧪 Retrieving token...');
  const token = await getAccessToken(testShop);

  console.log('✅ Retrieved token:', token);
}

runTest();
