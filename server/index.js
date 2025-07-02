// server/index.js
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
const PORT = process.env.PORT || 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend
app.use('/app', express.static(path.join(__dirname, '../frontend')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/webhooks', webhookRoutes);

// Root health check
app.get('/', (req, res) => {
  res.send('✅ Ralawise Public App API is running.');
});

app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
