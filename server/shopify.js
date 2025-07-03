// src/shopify.js
import axios from 'axios';
import dotenv from 'dotenv';
import { getAccessToken } from '../server/db.js';

dotenv.config();

/**
 * Get the Shopify Location ID (first location for the shop)
 */
export async function getLocationId(shop) {
  const token = await getAccessToken(shop);
  if (!token) throw new Error(`Missing token for shop: ${shop}`);

  const res = await axios.get(`https://${shop}/admin/api/2023-10/locations.json`, {
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
    }
  });

  return res.data.locations[0]?.id;
}

/**
 * Get inventory item ID for a variant
 */
export async function getInventoryItemId(shop, variantId) {
  const token = await getAccessToken(shop);
  if (!token) throw new Error(`Missing token for shop: ${shop}`);

  const res = await axios.get(`https://${shop}/admin/api/2023-10/variants/${variantId}.json`, {
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
    }
  });

  return res.data.variant.inventory_item_id;
}

/**
 * Update inventory level for a given inventory item and location
 */
export async function updateInventoryLevel(shop, inventoryItemId, locationId, quantity) {
  const token = await getAccessToken(shop);
  if (!token) throw new Error(`Missing token for shop: ${shop}`);

  await axios.post(`https://${shop}/admin/api/2023-10/inventory_levels/set.json`, {
    inventory_item_id: inventoryItemId,
    location_id: locationId,
    available: quantity
  }, {
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
    }
  });

  console.log(`✅ Inventory updated → Item ID ${inventoryItemId}, Qty ${quantity}, Location ${locationId}`);
}
