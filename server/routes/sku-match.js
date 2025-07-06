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
  // Step 1: get all matching colour codes for the cleaned colour
  const colourRes = await db.query(
    `SELECT sku_code FROM colour_map WHERE input_name = $1`,
    [colour]
  );

  if (colourRes.rows.length === 0) return null;

  // Step 2: try matching each colour code with size and style
  for (const row of colourRes.rows) {
    const colourCode = row.sku_code;
    const matchRes = await db.query(
      `
      SELECT * FROM ralawise_skus
      WHERE sku_code ILIKE $1
        AND style_code = $2
        AND size_code = $3
      LIMIT 1
      `,
      [`%-${colourCode}-%`, styleCode, size.toUpperCase()]
    );

    if (matchRes.rows.length > 0) {
      return matchRes.rows[0];
    }
  }

  return null;
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
      let sizeRaw = null;
let colourRaw = null;

// Look through option name/value pairs and assign accordingly
for (let i = 1; i <= 3; i++) {
  const name = (row[`Option${i} Name`] || '').toLowerCase().trim();
  const value = row[`Option${i} Value`];

  if (!value) continue;

  if (name.includes('size') && !sizeRaw) {
    sizeRaw = value;
  } else if ((name.includes('colour') || name.includes('color')) && !colourRaw) {
    colourRaw = value;
  }
}

// Fallback: if only 2 values present and we still can’t tell which is which,
// try using heuristics (e.g. size values are short or in known size list)
if (!sizeRaw || !colourRaw) {
  const val1 = row['Option1 Value'] || '';
  const val2 = row['Option2 Value'] || '';

  const knownSizes = ['xs', 's', 'm', 'l', 'xl', 'xxl', '2xl', '3xl', '4xl', '5xl', '6xl', 'medium', 'large', 'small', 'xlarge', '2xlarge', '3xlarge', '4xlarge', '5xlarge'];

  const v1 = val1.toLowerCase().trim();
  const v2 = val2.toLowerCase().trim();

  if (knownSizes.includes(v1) && !sizeRaw) sizeRaw = val1;
  if (knownSizes.includes(v2) && !sizeRaw) sizeRaw = val2;

  if (!colourRaw && sizeRaw === val1) colourRaw = val2;
  else if (!colourRaw && sizeRaw === val2) colourRaw = val1;
}


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
