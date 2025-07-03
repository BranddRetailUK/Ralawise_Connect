// src/ralawise.js
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

let cachedToken = null;
let tokenExpiry = 0;

async function login() {
  console.log("🔐 Logging into Ralawise...");
  try {
    const res = await axios.post('https://api.ralawise.com/v1/login', {
      user: process.env.RALAWISE_USER,
      password: process.env.RALAWISE_PASSWORD
    });

    cachedToken = res.data.access_token;
    tokenExpiry = Date.now() + res.data.expires_in * 1000;

    console.log("✅ Ralawise token acquired:");
    return cachedToken;
  } catch (err) {
    console.error("❌ Failed to authenticate with Ralawise.");
    throw err;
  }
}

async function getToken() {
  if (!cachedToken || Date.now() >= tokenExpiry) {
    return await login();
  }
  return cachedToken;
}

export async function getRalawiseStock(sku) {
  const token = await getToken();
  const url = `https://api.ralawise.com/v1/inventory/${sku}`;
  console.log(`👉 Requesting stock from: ${url}`);

  try {
    const res = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const variant = res.data.productGroup?.products?.[0]?.variants?.[0];

    if (!variant) {
      console.warn(`⚠️ No variant data found in Ralawise response for SKU: ${sku}`);
      return { sku: null, quantity: null };
    }

    const result = {
      sku: variant.sku || null,
      quantity: variant.availableStock?.quantity ?? null
    };

    console.log(`📦 Parsed Ralawise stock:`, result);
    return result;

  } catch (err) {
    if (err.response?.status === 404) {
      console.warn(`⚠️ Ralawise SKU not found: ${sku}`);
      return { sku: null, quantity: null };
    }

    if (err.response?.status === 429) {
      console.error("🚫 Rate limit hit. Retrying in 2s...");
      await new Promise(r => setTimeout(r, 2200));
      return await getRalawiseStock(sku);
    }

    console.error(`❌ Error fetching stock for SKU ${sku}`);
    throw err;
  }
}
