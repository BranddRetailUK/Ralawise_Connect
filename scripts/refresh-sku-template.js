const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

const OUTPUT_PATH = './sku-map-template.json';

const shopify = axios.create({
  baseURL: `${process.env.SHOPIFY_STORE_URL}/admin/api/2023-10`,
  headers: {
    'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
    'Content-Type': 'application/json'
  }
});

// Paginated product fetch
async function fetchAllProducts() {
  let products = [];
  let since_id = 0;
  let hasMore = true;

  while (hasMore) {
    const res = await shopify.get('/products.json', {
      params: {
        limit: 250,
        since_id
      }
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

async function buildTemplate() {
  const products = await fetchAllProducts();
  const variants = products.flatMap(p => p.variants);

  const map = variants
    .map(v => v.sku?.trim())
    .filter((sku, index, arr) => sku && arr.indexOf(sku) === index) // de-dupe + ignore empty
    .map(sku => ({
      ralawise_sku: sku,
      shopify_variant_id: ""
    }));

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(map, null, 2));
  console.log(`✅ sku-map-template.json created with ${map.length} SKUs`);
}

buildTemplate().catch(console.error);
