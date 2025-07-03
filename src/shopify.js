// src/shopify.js
import axios from 'axios';
import dotenv from 'dotenv';
import { getAccessToken } from '../server/db.js';

dotenv.config();

/**
 * Get the Shopify Location ID (uses the first one found)
 */
export async function getLocationId(shop) {
  const token = await getAccessToken(shop);
  if (!token) throw new Error(`Missing token for shop: ${shop}`);

  try {
    const res = await axios.get(`https://${shop}/admin/api/2023-10/locations.json`, {
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
      }
    });
    const locationId = res.data.locations[0]?.id;
    console.log(`📍 Shopify location ID for ${shop}: ${locationId}`);
    return locationId;
  } catch (err) {
    console.error(`❌ Failed to fetch location ID for ${shop}:`, err.response?.data || err.message);
    throw err;
  }
}

/**
 * Get inventory item ID for a given variant ID
 */
export async function getInventoryItemId(shop, variantId) {
  const token = await getAccessToken(shop);
  if (!token) throw new Error(`Missing token for shop: ${shop}`);

  try {
    const res = await axios.get(`https://${shop}/admin/api/2023-10/variants/${variantId}.json`, {
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
      }
    });
    return res.data.variant.inventory_item_id;
  } catch (err) {
    console.error(`❌ Failed to get inventory item ID for variant ${variantId}:`, err.response?.data || err.message);
    throw err;
  }
}

/**
 * Update inventory level for a given inventory item at a specific location
 */
export async function updateInventoryLevel(shop, inventoryItemId, locationId, quantity) {
  const token = await getAccessToken(shop);
  if (!token) throw new Error(`Missing token for shop: ${shop}`);

  try {
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

    console.log(`✅ Inventory updated → Item ID ${inventoryItemId}, Location ${locationId}, Qty ${quantity}`);
  } catch (err) {
    console.error(`❌ Failed to update inventory level:`, err.response?.data || err.message);
    throw err;
  }
}
