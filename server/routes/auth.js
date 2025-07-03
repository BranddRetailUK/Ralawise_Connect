// server/routes/auth.js
import express from 'express';
import axios from 'axios';
import { storeAccessToken } from '../db.js';

const router = express.Router();

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
const SCOPES = 'read_products,write_inventory';
const REDIRECT_URI = process.env.SHOPIFY_REDIRECT_URI;

// STEP 1: Redirect to Shopify
router.get('/', (req, res) => {
  const shop = req.query.shop;
  if (!shop) return res.status(400).send('Missing shop param');

  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${SCOPES}&redirect_uri=${REDIRECT_URI}`;
  console.log("🟡 Redirecting to Shopify install URL:", installUrl);

  res.redirect(installUrl);
});

// STEP 2: OAuth Callback
router.get('/callback', async (req, res) => {
  const { shop, code } = req.query;
  console.log("📦 Callback query:", req.query);

  if (!shop || !code) {
    console.error("❌ Missing shop or code in callback");
    return res.status(400).send('Invalid OAuth callback');
  }

  try {
    console.log("🟡 Exchanging token for:", {
      shop,
      code,
      client_id: SHOPIFY_API_KEY,
      client_secret: SHOPIFY_API_SECRET
    });

    const tokenRes = await axios.post(`https://${shop}/admin/oauth/access_token`, {
      client_id: SHOPIFY_API_KEY,
      client_secret: SHOPIFY_API_SECRET,
      code,
    });

    const accessToken = tokenRes.data.access_token;
    console.log("✅ Access token received:", accessToken ? "Yes" : "No");

    // Store the token in DB
    await storeAccessToken(shop, accessToken);

    // Encode host param for frontend
    const host = Buffer.from(shop, 'utf8').toString('base64');

    res.redirect(`/app/dashboard.html?shop=${shop}&host=${host}`);
  } catch (err) {
    console.error('❌ OAuth error:', err.response?.data || err.message);
    res.status(500).send('OAuth failed');
  }
});

export default router;
