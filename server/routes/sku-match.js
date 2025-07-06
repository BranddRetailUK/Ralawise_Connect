import express from "express";
import multer from "multer";
import fs from "fs";
import csv from "csv-parser";
import db from "../db.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

function clean(str) {
  return (str || "")
    .toString()
    .trim()
    .replace(/-/g, " ")             // replace dashes with spaces
    .replace(/\s+/g, "")            // remove all whitespace
    .replace(/[^a-zA-Z0-9]/g, "")   // remove special characters
    .toLowerCase();
}

async function findMatchingSKU(styleCode, colour, size) {
  const cleanedColour = clean(colour);
  const cleanedSize = clean(size);
  const cleanedStyle = styleCode.trim();

  const query = `
    SELECT * FROM ralawise_skus
    WHERE LOWER(REGEXP_REPLACE(colour_name, '[^a-zA-Z0-9]', '', 'g')) = $1
      AND LOWER(REGEXP_REPLACE(size_code, '[^a-zA-Z0-9]', '', 'g')) = $2
      AND style_code = $3
    LIMIT 1
  `;

  const values = [cleanedColour, cleanedSize, cleanedStyle];
  const result = await db.query(query, values);
  return result.rows[0];
}

router.post("/api/match-skus", upload.single("file"), async (req, res) => {
  const filePath = req.file?.path;
  if (!filePath) return res.status(400).json({ error: "No file uploaded" });

  const matches = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on("data", async (row) => {
      try {
        const handle = row["Handle"];
        const title = row["Title"];
        const rawSKU = row["Variant SKU"];
        const colour = row["Option1 Value"];
        const size = row["Option2 Value"];
        const styleCode = (rawSKU || "").split("-").pop(); // Assume last part is style

        const cleaned = {
          style: clean(styleCode),
          colour: clean(colour),
          size: clean(size),
        };

        console.log("🔍 Row:", {
          raw: { styleCode, colour, size },
          cleaned,
        });

        const match = await findMatchingSKU(styleCode, colour, size);

        if (match) {
          matches.push({
            handle,
            original_sku: rawSKU,
            suggested_sku: match.sku_code,
            confidence: "high",
            reason: "Exact match",
          });
        } else {
          matches.push({
            handle,
            original_sku: rawSKU,
            suggested_sku: null,
            confidence: "low",
            reason: "No match for style/colour/size",
          });
        }
      } catch (err) {
        console.error("❌ Error processing row:", err);
      }
    })
    .on("end", () => {
      fs.unlink(filePath, () => {}); // Clean up temp file
      res.json(matches);
    })
    .on("error", (err) => {
      console.error("❌ CSV parse error:", err);
      res.status(500).json({ error: "Failed to parse CSV" });
    });
});

export default router;
