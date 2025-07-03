import axios from 'axios';
import db from './db.js';
import dotenv from 'dotenv';
dotenv.config();

export async function syncProductsToDB(shop, token) {
  const products = [];
  let url = `https://${shop}/admin/api/2023-10/products.json?limit=250`;
  let page = 1;

  try {
    while (url) {
      const res = await axios.get(url, {
        headers: {
          'X-Shopify-Access-Token': token,
          'Content-Type': 'application/json',
        },
      });

      const fetched = res.data.products;
      products.push(...fetched);
      console.log(`🛒 Fetched page ${page}: ${fetched.length} products`);
      page++;

      const linkHeader = res.headers['link'];
      if (linkHeader && linkHeader.includes('rel="next"')) {
        const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
        url = match ? match[1] : null;
      } else {
        url = null;
      }
    }
  } catch (err) {
    console.error('❌ Error fetching products:', err.message || err);
  }

  for (const product of products) {
    for (const variant of product.variants) {
      const query = `
        INSERT INTO store_products (
          shop_domain, product_id, variant_id, sku, product_title, product_handle, variant_title
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (variant_id) DO NOTHING;
      `;

      const values = [
        shop,
        product.id,
        variant.id,
        variant.sku,
        product.title,
        product.handle,
        variant.title,
      ];

      try {
        await db.query(query, values);
        console.log(`✅ Inserted SKU ${variant.sku}`);
      } catch (err) {
        console.error(`❌ DB insert error for SKU ${variant.sku}:`, err.message);
      }
    }
  }

  console.log(`🎉 Sync complete: ${products.length} products processed.`);
}
