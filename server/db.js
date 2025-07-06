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

// ✅ Alias for compatibility with collections.js and dashboard-stats.js
export { getAccessToken as getShopToken };

// ✅ Dashboard stat helper
export async function getSyncErrorCount(shop) {
  const result = await db.query(
    `SELECT COUNT(*) FROM sync_logs WHERE shop_domain = $1 AND status = 'error' AND synced_at > NOW() - INTERVAL '1 day'`,
    [shop]
  );
  return parseInt(result.rows[0].count);
}

export async function getMappedSkuCount(shop) {
  const result = await db.query(
    `SELECT COUNT(*) FROM store_skus WHERE shop_domain = $1`,
    [shop]
  );
  return parseInt(result.rows[0].count);
}



// ✅ Logging helper for sync results
export async function logSyncResult(shop, sku, status, message = null) {
  await db.query(
    `INSERT INTO sync_logs (shop_domain, sku, status, message)
     VALUES ($1, $2, $3, $4)`,
    [shop, sku, status, message]
  );
}


export async function getRecentLiveLogs(limit = 50) {
  const result = await db.query(
    `SELECT sku, quantity, synced_at, shop_domain
     FROM sync_status
     ORDER BY synced_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

export async function getRecentSyncLogs(limit = 50) {
  const result = await db.query(
    `SELECT sku, status, message, synced_at, shop_domain
     FROM sync_logs
     ORDER BY synced_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}
