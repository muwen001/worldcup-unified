import { Router, Request, Response } from 'express';
import { PredictionEngine } from '../services/predictionEngine.js';
import { DataService } from '../services/dataService.js';

export const predictionRouter = Router();

// Get all predictions
predictionRouter.get('/', async (req: Request, res: Response) => {
  try {
    const predictionEngine: PredictionEngine = req.app.locals.predictionEngine;
    const dataService: DataService = req.app.locals.dataService;
    const matches = dataService.getMatches();
    const predictions = predictionEngine.predictBatch(matches);
    res.json(predictions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate predictions' });
  }
});

// Get prediction for a specific match
predictionRouter.get('/:matchId', async (req: Request, res: Response) => {
  try {
    const predictionEngine: PredictionEngine = req.app.locals.predictionEngine;
    const dataService: DataService = req.app.locals.dataService;
    const match = dataService.getMatchById(req.params.matchId);
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }
    const prediction = predictionEngine.predict(match);
    res.json(prediction);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate prediction' });
  }
});

// Get predictions for matches on a specific date
predictionRouter.get('/date/:date', async (req: Request, res: Response) => {
  try {
    const predictionEngine: PredictionEngine = req.app.locals.predictionEngine;
    const dataService: DataService = req.app.locals.dataService;
    const matches = dataService.getMatchesByDate(req.params.date);
    const predictions = predictionEngine.predictBatch(matches);
    res.json(predictions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate predictions for date' });
  }
});

// Get predictions for matches in a specific group
predictionRouter.get('/group/:group', async (req: Request, res: Response) => {
  try {
    const predictionEngine: PredictionEngine = req.app.locals.predictionEngine;
    const dataService: DataService = req.app.locals.dataService;
    const matches = dataService.getMatchesByGroup(req.params.group);
    const predictions = predictionEngine.predictBatch(matches);
    res.json(predictions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate predictions for group' });
  }
});

// Get champion odds
predictionRouter.get('/champion/odds', async (req: Request, res: Response) => {
  try {
    const predictionEngine: PredictionEngine = req.app.locals.predictionEngine;
    const championOdds = predictionEngine.getChampionOdds();
    res.json(championOdds);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get champion odds' });
  }
});

// Get team ratings
predictionRouter.get('/ratings/teams', async (req: Request, res: Response) => {
  try {
    const predictionEngine: PredictionEngine = req.app.locals.predictionEngine;
    const ratings = predictionEngine.getTeamRatings();
    res.json(ratings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get team ratings' });
  }
});
