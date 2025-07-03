// src/shopify.js
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

/**
 * Get the Shopify Location ID (uses the first one found)
 */
export async function getLocationId() {
  try {
    const res = await shopify.get('/locations.json');
    const locationId = res.data.locations[0]?.id;
    console.log(`📍 Shopify location ID: ${locationId}`);
    return locationId;
  } catch (err) {
    console.error('❌ Failed to fetch location ID:', err.response?.data || err.message);
    throw err;
  }
}

/**
 * Get inventory item ID for a given variant ID
 */
export async function getInventoryItemId(variantId) {
  try {
    const res = await shopify.get(`/variants/${variantId}.json`);
    return res.data.variant.inventory_item_id;
  } catch (err) {
    console.error(`❌ Failed to get inventory item ID for variant ${variantId}:`, err.response?.data || err.message);
    throw err;
  }
}

/**
 * Update inventory level for a given inventory item at a specific location
 */
export async function updateInventoryLevel(inventoryItemId, locationId, quantity) {
  try {
    await shopify.post('/inventory_levels/set.json', {
      inventory_item_id: inventoryItemId,
      location_id: locationId,
      available: quantity
    });
    console.log(`✅ Inventory updated → Item ID ${inventoryItemId}, Location ID ${locationId}, Qty ${quantity}`);
  } catch (err) {
    console.error(`❌ Failed to update inventory level:`, err.response?.data || err.message);
    throw err;
  }
}
