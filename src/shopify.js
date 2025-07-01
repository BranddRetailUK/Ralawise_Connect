// shopify.js
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

export async function getLocationId() {
  const res = await shopify.get('/locations.json');
  return res.data.locations[0].id; // Use first location
}

export async function getInventoryItemId(variantId) {
  const res = await shopify.get(`/variants/${variantId}.json`);
  return res.data.variant.inventory_item_id;
}

export async function updateInventoryLevel(inventoryItemId, locationId, quantity) {
  await shopify.post('/inventory_levels/set.json', {
    inventory_item_id: inventoryItemId,
    location_id: locationId,
    available: quantity
  });
}
