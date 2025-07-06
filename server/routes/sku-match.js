// server/routes/sku-match.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
const db = require("../db");

const upload = multer({ dest: "uploads/" });

// Normalize colour & size
function normalize(value) {
  return value ? value.trim().toLowerCase().replace(/\s+/g, "") : "";
}

// Match logic against ralawise_skus table
async function findMatchingSKU(styleGuess, colour, size) {
  const colourNorm = normalize(colour);
  const sizeNorm = normalize(size);

  const query = `
    SELECT * FROM ralawise_skus
    WHERE LOWER(REPLACE(colour_name, ' ', '')) = $1
      AND LOWER(REPLACE(size_code, ' ', '')) = $2
      AND style_code = $3
    LIMIT 1
  `;
  const values = [colourNorm, sizeNorm, styleGuess];
  const result = await db.query(query, values);
  return result.rows[0] || null;
}

// POST /api/match-skus
router.post("/match-skus", upload.single("file"), async (req, res) => {
  const results = [];
  const filePath = path.resolve(req.file.path);

  try {
    const stream = fs.createReadStream(filePath).pipe(csv());

    for await (const row of stream) {
      const handle = row["Handle"];
      const title = row["Title"] || "";
      const colour = row["Option1 Value"];
      const size = row["Option2 Value"];
      const originalSKU = row["Variant SKU"];

      // Try to infer style code from SKU or title
      const styleGuessMatch = originalSKU?.match(/AM\d{3}|TS\d{3}|BB\d{3}/i);
      const styleCode = styleGuessMatch ? styleGuessMatch[0].toUpperCase() : null;

      let result = {
        handle,
        original_sku: originalSKU,
        suggested_sku: null,
        confidence: "low",
        reason: "Style code not found"
      };

      if (styleCode) {
        const match = await findMatchingSKU(styleCode, colour, size);
        if (match) {
          result.suggested_sku = match.sku_code;
          result.confidence = "high";
          result.reason = "Exact match";
        } else {
          result.reason = "No match for style/colour/size";
        }
      }

      results.push(result);
    }

    fs.unlinkSync(filePath); // Clean up
    res.json(results);
  } catch (err) {
    console.error("Error matching SKUs:", err);
    res.status(500).json({ error: "Failed to process file." });
  }
});

module.exports = router;
