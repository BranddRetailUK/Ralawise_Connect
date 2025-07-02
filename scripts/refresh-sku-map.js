// src/refresh-sku-map.js
import fs from 'fs/promises';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const shopify = axios.create({
  baseURL: `${process.env.SHOPIFY_STORE_URL}/admin/api/2023-10`,
  headers: {
    'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
    'Content-Type': 'application/json'
  }
});

function isRalawiseSku(sku) {
  return /^[A-Z0-9]{5,}$/.test(sku); // e.g. "JH001DPBKXS", "GD01B"
}

async function fetchAllVariants() {
  let variants = [];
  let pageInfo = null;

  try {
    do {
      const res = await shopify.get(`/products.json`, {
        params: {
          limit: 250,
          page_info: pageInfo,
          fields: 'id,variants'
        },
        headers: {
          ...(pageInfo && { 'Link': `<${pageInfo}>; rel="next"` })
        }
      });

      for (const product of res.data.products) {
        for (const variant of product.variants) {
          variants.push({
            sku: variant.sku,
            id: variant.id
          });
        }
      }

      const linkHeader = res.headers.link;
      const match = linkHeader?.match(/<([^>]+)>; rel="next"/);
      pageInfo = match ? new URL(match[1]).searchParams.get('page_info') : null;

    } while (pageInfo);

    return variants;
  } catch (err) {
    console.error('❌ Failed to fetch variants from Shopify');
    console.error(err.response?.data || err.message);
    process.exit(1);
  }
}

async function refreshSkuMap() {
  console.log(`🔍 Fetching all Shopify variants...`);
  const allVariants = await fetchAllVariants();

  const filtered = allVariants
    .filter(v => v.sku && isRalawiseSku(v.sku))
    .map(v => ({
      ralawise_sku: v.sku,
      shopify_variant_id: v.id
    }));

  const unique = Array.from(
    new Map(filtered.map(item => [`${item.ralawise_sku}_${item.shopify_variant_id}`, item])).values()
  );

  console.log(`✅ Found ${unique.length} Ralawise-format variants.`);

  await fs.writeFile('./sku-map.json', JSON.stringify(unique, null, 2));
  console.log('💾 Updated sku-map.json');
}

refreshSkuMap();
