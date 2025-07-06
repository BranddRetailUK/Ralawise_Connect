// server/routes/sku-match.js
import express from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const upload = multer({ dest: path.join(__dirname, '../../uploads') });

// === Normalize Input ===
function clean(str) {
  return (str || '')
    .toString()
    .trim()
    .replace(/-/g, ' ')              // convert dash to space
    .replace(/\s+/g, '')             // remove all spaces
    .replace(/[^a-zA-Z0-9]/g, '')    // strip non-alphanum
    .toLowerCase();
}

// === Match SKU from DB ===
async function findMatchingSKU(styleCode, colour, size) {
  const query = `
    SELECT * FROM ralawise_skus
    WHERE LOWER(REPLACE(colour_name, ' ', '')) = $1
      AND LOWER(REPLACE(size_code, ' ', '')) = $2
      AND style_code = $3
    LIMIT 1
  `;
  const values = [clean(colour), clean(size), styleCode];
  const result = await db.query(query, values);
  return result.rows[0] || null;
}

// === Upload + Match Route ===
router.post('/match-skus', upload.single('file'), async (req, res) => {
  const filePath = path.resolve(req.file.path);
  const results = [];

  try {
    const stream = fs.createReadStream(filePath).pipe(csv());

    for await (const row of stream) {
      const handle = row['Handle'];
      const title = row['Title'] || '';
      const originalSKU = row['Variant SKU'];
      const colour = row['Option1 Value'];
      const size = row['Option2 Value'];

      const styleGuessMatch = (originalSKU || title).match(/(AM|BB|TS)\d{3}/i);
      const styleCode = styleGuessMatch ? styleGuessMatch[0].toUpperCase() : null;

      const cleaned = {
        style: clean(styleCode),
        colour: clean(colour),
        size: clean(size)
      };

      let result = {
        handle,
        original_sku: originalSKU,
        suggested_sku: null,
        confidence: 'low',
        reason: ''
      };

      // Log what we’re trying to match
      console.log(`🔍 Row:`, {
        raw: { styleCode, colour, size },
        cleaned
      });

      if (!styleCode) {
        result.reason = 'Style code not found';
      } else if (!colour || !size) {
        result.reason = 'Missing colour or size';
      } else {
        const match = await findMatchingSKU(styleCode, colour, size);

        if (match) {
          result.suggested_sku = match.sku_code;
          result.confidence = 'high';
          result.reason = 'Exact match';
        } else {
          result.reason = '❌ No match in DB for normalized values';
          console.log('❌ No match found in DB for:', cleaned);
        }
      }

      results.push(result);
    }

    fs.unlinkSync(filePath);
    res.json(results);
  } catch (err) {
    console.error('❌ Error processing CSV:', err);
    res.status(500).json({ error: 'Failed to process file' });
  }
});

export default router;
