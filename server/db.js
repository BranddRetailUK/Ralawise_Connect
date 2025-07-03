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
    const result = await db.query(
      `
      INSERT INTO store_tokens (shop_domain, access_token, created_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (shop_domain)
      DO UPDATE SET access_token = $2, created_at = NOW()
      RETURNING *;
      `,
      [shop, token]
    );

    console.log(`✅ Token stored in DB for ${shop}:`, result.rows[0]);
  } catch (err) {
    console.error(`❌ Failed to store token for ${shop}:`, err.message || err);
  }
}

export async function getAccessToken(shop) {
  try {
    const result = await db.query(
      'SELECT access_token FROM store_tokens WHERE shop_domain = $1',
      [shop]
    );

    if (result.rows.length > 0) {
      console.log(`🔑 Retrieved token from DB for ${shop}`);
      return result.rows[0].access_token;
    }

    console.warn(`⚠️ No token found for ${shop}`);
    return null;
  } catch (err) {
    console.error(`❌ Failed to get token for ${shop}:`, err.message || err);
    return null;
  }
}
