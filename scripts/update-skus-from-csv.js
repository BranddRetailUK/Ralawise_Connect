// update-skus-from-csv.js
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SHOPIFY_API = axios.create({
  baseURL: `${process.env.SHOPIFY_STORE_URL}/admin/api/2023-10`,
  headers: {
    'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN,
    'Content-Type': 'application/json'
  }
});

const csvFilePath = path.join(__dirname, 'products_export_1 CLEAN.csv');
const dryRun = false; // Set to true for test run

const normalizeKey = key => key.toLowerCase().trim();
const looksLikeColour = val => /black|white|grey|gray|blue|red|green|beige|khaki|lilac|vintage|navy|pink|orange|purple|brown|stone|olive/i.test(val);
const normalizeValue = val => val.toLowerCase().replace(/[-\d\s]/g, '').trim();

// Ralawise SKUs are alphanumeric like JH001DPBK2XL
const isRalawiseSku = sku => /^[A-Z]+\d+[A-Z]+\d*(XL|L|M|S|XS)?$/i.test(sku);

const updates = [];
const updatedVariants = new Set();

fs.createReadStream(csvFilePath)
  .pipe(csv({ separator: ',', mapHeaders: ({ header }) => normalizeKey(header) }))
  .on('data', (row) => {
    const handle = row['handle'];
    const size = row['option1 value'];
    const colour = row['option2 value'];
    const newSku = row['variant sku'];
    const option1Name = row['option1 name']?.toLowerCase();
    const option2Name = row['option2 name']?.toLowerCase();

    if (handle && size && colour && newSku) {
      updates.push({
        handle: handle.trim(),
        option1: size.trim().toLowerCase(),
        option2: colour.trim().toLowerCase(),
        newSku: newSku.trim(),
        option1Name,
        option2Name
      });
    }
  })
  .on('end', async () => {
    console.log(`🔁 Starting ${dryRun ? 'DRY RUN' : 'LIVE'} SKU update for ${updates.length} variants...`);

    for (const item of updates) {
  try {
    // ✅ Skip if the new SKU is not in Ralawise format
    if (!isRalawiseSku(item.newSku)) {
      console.log(`⏩ Skipping ${item.handle} — SKU is not in Ralawise format: ${item.newSku}`);
      continue;
    }

    await new Promise(res => setTimeout(res, 1000)); // Throttle before GET
    const res = await SHOPIFY_API.get(`/products.json`, {
      params: { handle: item.handle }
    });

    const product = res.data.products[0];
    if (!product) throw new Error(`Product not found for handle: ${item.handle}`);

    let sizeKey = 'option1';
    let colourKey = 'option2';
    let val1 = item.option1;
    let val2 = item.option2;

    if (item.option1Name && item.option2Name) {
      if (item.option1Name.includes('colour') || item.option1Name.includes('color')) {
        sizeKey = 'option2';
        colourKey = 'option1';
        val1 = item.option2;
        val2 = item.option1;
      }
    }

    const normVal1 = normalizeValue(val1);
    const normVal2 = normalizeValue(val2);

    let variant = product.variants.find(v =>
      normalizeValue(v[sizeKey]) === normVal1 &&
      normalizeValue(v[colourKey]) === normVal2
    );

    if (!variant && looksLikeColour(item.option1)) {
      variant = product.variants.find(v =>
        normalizeValue(v['option1']) === normalizeValue(item.option2) &&
        normalizeValue(v['option2']) === normalizeValue(item.option1)
      );
    }

    if (!variant) {
      console.warn(`⚠️ Variant not found for handle: ${item.handle}, size: ${val1}, colour: ${val2}`);
      continue;
    }

    if (updatedVariants.has(variant.id)) {
      console.warn(`⚠️ Skipped duplicate update for variant ${variant.id} (already updated)`);
      continue;
    }

    // 🛡️ Prevent accidental downgrade of a valid SKU
    if (isRalawiseSku(variant.sku) && !isRalawiseSku(item.newSku)) {
      console.warn(`🚨 WARNING: Attempted to overwrite valid Ralawise SKU (${variant.sku}) with invalid one (${item.newSku}) — skipping`);
      continue;
    }

    // ✅ Skip if already matches the target SKU
    if (variant.sku?.trim() === item.newSku) {
      console.log(`⏭️  Skipping variant ${variant.id} (already correct: ${variant.sku})`);
      continue;
    }

    if (dryRun) {
      console.log(`🧪 DRY RUN: Would update variant ${variant.id} SKU to ${item.newSku}`);
    } else {
      await SHOPIFY_API.put(`/variants/${variant.id}.json`, {
        variant: { id: variant.id, sku: item.newSku }
      });
      updatedVariants.add(variant.id);
      console.log(`✅ Updated SKU for variant ${variant.id} → ${item.newSku}`);
      await new Promise(res => setTimeout(res, 1000)); // Throttle after PUT
    }

  } catch (err) {
    console.error(`❌ Failed to process SKU update for handle: ${item.handle}`, err.response?.data || err.message);
  }
}


    console.log(`✅ ${dryRun ? 'DRY RUN' : 'LIVE'} SKU update complete.`);
  });
