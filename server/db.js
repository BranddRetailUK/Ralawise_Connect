// server/db.js
import dotenv from 'dotenv';
dotenv.config();

const store = new Map(); // In-memory store

export async function storeAccessToken(shop, token) {
  store.set(shop, { token, createdAt: new Date() });
  console.log(`✅ Token stored for ${shop}`);
}

export async function getAccessToken(shop) {
  // First check in-memory
  const stored = store.get(shop)?.token;
  if (stored) return stored;

  // Fallback: use .env token for dev
  if (shop === 'ggappareluk.myshopify.com' && process.env.SHOPIFY_ACCESS_TOKEN) {
    console.log('⚠️ Using fallback token from .env for:', shop);
    return process.env.SHOPIFY_ACCESS_TOKEN;
  }

  return null;
}
