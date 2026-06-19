import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import path from 'path';
import fs from 'fs';
import { matchRouter } from './api/matchRoutes.js';
import { predictionRouter } from './api/predictionRoutes.js';
import { dataRouter } from './api/dataRoutes.js';
import { DataService } from './services/dataService.js';
import { PredictionEngine } from './services/predictionEngine.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services
const dataService = new DataService();
const predictionEngine = new PredictionEngine();

// Make services available to routes
app.locals.dataService = dataService;
app.locals.predictionEngine = predictionEngine;

// Routes
app.use('/api/matches', matchRouter);
app.use('/api/predictions', predictionRouter);
app.use('/api/data', dataRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve built client (static + SPA fallback) when configured (production / Docker).
// BASE_PATH = '/worldcup', STATIC_DIR = '/app/public' in container.
const STATIC_DIR = process.env.STATIC_DIR;
const BASE_PATH = process.env.BASE_PATH;
if (STATIC_DIR && BASE_PATH && fs.existsSync(STATIC_DIR)) {
  const indexPath = path.join(STATIC_DIR, 'index.html');
  app.use(BASE_PATH, express.static(STATIC_DIR));
  // SPA fallback: any sub-path under BASE_PATH returns index.html
  app.get(BASE_PATH, (_req, res) => res.sendFile(indexPath));
  app.get(`${BASE_PATH}/*`, (_req, res) => res.sendFile(indexPath));
  console.log(`[INFO] Serving static client at ${BASE_PATH} from ${STATIC_DIR}`);
}

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log('[INFO] Data Sources:');
  console.log('  - CCTV Sports API: Schedule, scores, match status');
  console.log('  - Sporttery.cn API: Live odds');
  console.log('[INFO] Prediction engine: Dixon-Coles model with 3-hour lock');

  // Initial data fetch
  dataService.initialize();
});

export default app;
