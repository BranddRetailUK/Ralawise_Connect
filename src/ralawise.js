// src/ralawise.js
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

let cachedToken = null;
let tokenExpiry = 0;

async function login() {
  try {
    const res = await axios.post('https://api.ralawise.com/v1/login', {
      user: process.env.RALAWISE_USER,
      password: process.env.RALAWISE_PASSWORD
    });

    cachedToken = res.data.access_token;
    tokenExpiry = Date.now() + res.data.expires_in * 1000;

    return cachedToken;
  } catch (err) {
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

  try {
    const res = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      }
    });

    const variant = res.data.productGroup?.products?.[0]?.variants?.[0];

    if (!variant) {
      return { sku: null, quantity: null };
    }

    const result = {
      sku: variant.sku || null,
      quantity: variant.availableStock?.quantity ?? null,
    };

    console.log(`📦 Parsed Ralawise stock:`, result);
    return result;

  } catch (err) {
    throw err;
  }
}
