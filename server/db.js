// server/db.js
const store = new Map(); // Replace with real DB later

export async function storeAccessToken(shop, token) {
  store.set(shop, { token, createdAt: new Date() });
  console.log(`✅ Token stored for ${shop}`);
}

export async function getAccessToken(shop) {
  return store.get(shop)?.token || null;
}
