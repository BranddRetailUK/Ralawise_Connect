// server/index.js

console.log("🟡 Starting Express server...");

import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import syncRoutes from './routes/sync.js';
import webhookRoutes from './routes/webhooks.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 8080;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend assets (CSS, JS)
app.use('/assets', express.static(path.join(__dirname, '../frontend/assets')));

// Serve script and style files directly (legacy support)
app.use('/script.js', express.static(path.join(__dirname, '../frontend/script.js')));
app.use('/styles.css', express.static(path.join(__dirname, '../frontend/styles.css')));

// Serve dashboard.html at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dashboard.html'));
});

// API Routes
app.use('/auth', authRoutes);               // ✅ Public Shopify auth route
app.use('/api/auth', authRoutes);           // ✅ Optional if used in frontend app logic
app.use('/api/products', productRoutes);
app.use('/api', syncRoutes);
app.use('/api/webhooks', webhookRoutes);


// 404 fallback
app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

