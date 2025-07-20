// scripts/prune-dead-variants.js
import dotenv from 'dotenv';
import { Pool } from 'pg';
import axios from 'axios';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const shop = 'cf8ee0-fe.myshopify.com';
const token = process.env.SHOPIFY_ACCESS_TOKEN;

const shopify = axios.create({
  baseURL: `${process.env.SHOPIFY_STORE_URL}/admin/api/2023-10`,
  headers: {
    'X-Shopify-Access-Token': token,
    'Content-Type': 'application/json'
  }
});

async function main() {
  const { rows } = await pool.query(`
    SELECT variant_id FROM store_skus
    WHERE shop_domain = $1
  `, [shop]);

  for (const row of rows) {
    try {
      await shopify.get(`/variants/${row.variant_id}.json`);
    } catch (err) {
      if (err.response?.status === 404) {
        console.log(`🧹 Deleting missing variant: ${row.variant_id}`);
        await pool.query(`
          DELETE FROM store_skus
          WHERE variant_id = $1
        `, [row.variant_id]);
      } else {
        console.error(`❌ Failed to check variant ${row.variant_id}:`, err.message);
      }
    }
  }

  console.log('✅ Prune complete.');
}

main();
