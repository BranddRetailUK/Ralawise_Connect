// server/db.js
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const db = {
  query: (text, params) => pool.query(text, params),
};

export default db;

export async function storeAccessToken(shop, token) {
  try {
    await db.query(
      `
      INSERT INTO store_tokens (shop_domain, access_token)
      VALUES ($1, $2)
      ON CONFLICT (shop_domain)
      DO UPDATE SET access_token = EXCLUDED.access_token, created_at = now();
      `,
      [shop, token]
    );
    console.log(`✅ Token stored in DB for ${shop}`);
  } catch (err) {
    console.error(`❌ Failed to store token for ${shop}:`, err.message);
  }
}

export async function getAccessToken(shop) {
  try {
    const res = await db.query(
      `SELECT access_token FROM store_tokens WHERE shop_domain = $1`,
      [shop]
    );
    if (res.rows.length) {
      return res.rows[0].access_token;
    }

    // Optional fallback for development
    if (shop === 'ggappareluk.myshopify.com' && process.env.SHOPIFY_ACCESS_TOKEN) {
      console.log('⚠️ Using fallback token from .env for:', shop);
      return process.env.SHOPIFY_ACCESS_TOKEN;
    }

    return null;
  } catch (err) {
    console.error(`❌ Failed to get token for ${shop}:`, err.message);
    return null;
  }
}
