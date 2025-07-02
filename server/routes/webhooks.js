// server/routes/webhooks.js
import express from 'express';
const router = express.Router();

// Placeholder webhook handler
router.post('/', (req, res) => {
  console.log('📦 Incoming webhook received');
  res.status(200).send('Webhook received');
});

export default router;
