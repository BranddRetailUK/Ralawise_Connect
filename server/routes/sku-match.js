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
    .replace(/-/g, ' ')
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function normalizeSize(input) {
  const raw = (input || '').toLowerCase().trim();

  const sizeMap = {
    'xxs': '2xsmall', '2xs': '2xsmall',
    'xs': 'xsmall', 's': 'small',
    'm': 'medium', 'med': 'medium',
    'l': 'large', 'lrg': 'large',
    'xl': 'xlarge', 'x-large': 'xlarge', 'x large': 'xlarge',
    '2xl': '2xlarge', 'xxl': '2xlarge',
    '3xl': '3xlarge', 'xxxl': '3xlarge',
    '4xl': '4xlarge', '5xl': '5xlarge', '6xl': '6xlarge'
  };

  return sizeMap[raw] || raw;
}

function normalizeColour(input) {
  if (!input) return '';

  // Map known abbreviations
  const colourMap = {
    'blk': 'black',
    'wht': 'white',
    'gry': 'grey',
    'grn': 'green',
    'navy': 'navyblue'
  };

  let normalized = input.toLowerCase().trim();

  // Convert slashes and sort multiple colours for consistency
  if (normalized.includes('/')) {
    normalized = normalized
      .split('/')
      .map(c => colourMap[c.trim()] || c.trim())
      .sort()
      .join('/');
  } else {
    normalized = colourMap[normalized] || normalized;
  }

  return normalized;
}

// === Match SKU from DB ===
async function findMatchingSKU(styleCode, colour, size) {
  const query = `
    SELECT * FROM ralawise_skus
    WHERE LOWER(REPLACE(REPLACE(colour_name, ' ', ''), '-', '')) = $1
      AND LOWER(REPLACE(REPLACE(size_code, ' ', ''), '-', '')) = $2
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
      const colourRaw = row['Option1 Value'];
      const sizeRaw = row['Option2 Value'];

      const styleGuessMatch = (originalSKU || title).match(/(AM|BB|TS|JH|GD|SS)\d{3}/i);
      const styleCode = styleGuessMatch ? styleGuessMatch[0].toUpperCase() : null;

      const cleaned = {
        style: clean(styleCode),
        colour: clean(normalizeColour(colourRaw)),
        size: clean(normalizeSize(sizeRaw))
      };

      let result = {
        handle,
        original_sku: originalSKU,
        suggested_sku: null,
        confidence: 'low',
        reason: ''
      };

      console.log(`🔍 Row:`, {
        raw: { styleCode, colour: colourRaw, size: sizeRaw },
        cleaned
      });

      if (!styleCode) {
        result.reason = 'Style code not found';
      } else if (!colourRaw || !sizeRaw) {
        result.reason = 'Missing colour or size';
      } else {
        const match = await findMatchingSKU(styleCode, cleaned.colour, cleaned.size);

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
