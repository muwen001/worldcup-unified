import { Router, Request, Response } from 'express';
import { DataService } from '../services/dataService.js';

export const matchRouter = Router();

// Get all matches
matchRouter.get('/', async (req: Request, res: Response) => {
  try {
    const dataService: DataService = req.app.locals.dataService;
    const matches = dataService.getMatches();
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// Get match by ID
matchRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const dataService: DataService = req.app.locals.dataService;
    const match = dataService.getMatchById(req.params.id);
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }
    res.json(match);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch match' });
  }
});

// Get matches by date
matchRouter.get('/date/:date', async (req: Request, res: Response) => {
  try {
    const dataService: DataService = req.app.locals.dataService;
    const matches = dataService.getMatchesByDate(req.params.date);
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch matches by date' });
  }
});

// Get matches by group
matchRouter.get('/group/:group', async (req: Request, res: Response) => {
  try {
    const dataService: DataService = req.app.locals.dataService;
    const matches = dataService.getMatchesByGroup(req.params.group);
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch matches by group' });
  }
});

// Get live matches
matchRouter.get('/status/live', async (req: Request, res: Response) => {
  try {
    const dataService: DataService = req.app.locals.dataService;
    const matches = dataService.getLiveMatches();
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch live matches' });
  }
});

// Get completed matches
matchRouter.get('/status/completed', async (req: Request, res: Response) => {
  try {
    const dataService: DataService = req.app.locals.dataService;
    const matches = dataService.getCompletedMatches();
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch completed matches' });
  }
});

// Get upcoming matches
matchRouter.get('/status/upcoming', async (req: Request, res: Response) => {
  try {
    const dataService: DataService = req.app.locals.dataService;
    const matches = dataService.getUpcomingMatches();
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch upcoming matches' });
  }
});
