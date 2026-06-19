import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
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
