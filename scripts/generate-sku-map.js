// NEW: generate-complete-sku-map.js
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_PATH = path.join(__dirname, '../sku-map.json');

const shopify = axios.create({
  baseURL: `${process.env.SHOPIFY_STORE_URL}/admin/api/2023-10`,
  headers: {
    'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
    'Content-Type': 'application/json'
  }
});

const isRalawiseSku = sku => /^[A-Z]+\d+[A-Z]+\d*(XL|L|M|S|XS)?$/i.test(sku);

async function fetchAllProducts() {
  let products = [];
  let since_id = 0;
  let hasMore = true;

  while (hasMore) {
    const res = await shopify.get('/products.json', {
      params: { limit: 250, since_id }
    });

    const batch = res.data.products;
    if (batch.length > 0) {
      products.push(...batch);
      since_id = batch[batch.length - 1].id;
    } else {
      hasMore = false;
    }
  }

  return products;
}

async function generateSkuMap() {
  const products = await fetchAllProducts();
  const variants = products.flatMap(p => p.variants);

  const map = variants
    .filter(v => isRalawiseSku(v.sku))
    .map(v => ({
      ralawise_sku: v.sku.trim(),
      shopify_variant_id: v.id
    }));

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(map, null, 2));
  console.log(`✅ sku-map.json written with ${map.length} valid Ralawise SKUs.`);
}

generateSkuMap().catch(console.error);
