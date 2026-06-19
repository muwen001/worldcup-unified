import { Router, Request, Response } from 'express';
import { DataService } from '../services/dataService.js';

export const dataRouter = Router();

// Get teams data
dataRouter.get('/teams', async (req: Request, res: Response) => {
  try {
    const dataService: DataService = req.app.locals.dataService;
    const teams = dataService.getTeams();
    res.json(teams);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Get groups data
dataRouter.get('/groups', async (req: Request, res: Response) => {
  try {
    const dataService: DataService = req.app.locals.dataService;
    const groups = dataService.getGroups();
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// Get standings
dataRouter.get('/standings', async (req: Request, res: Response) => {
  try {
    const dataService: DataService = req.app.locals.dataService;
    const standings = dataService.getStandings();
    res.json(standings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch standings' });
  }
});

// Get standings for a specific group
dataRouter.get('/standings/:group', async (req: Request, res: Response) => {
  try {
    const dataService: DataService = req.app.locals.dataService;
    const standings = dataService.getStandingsByGroup(req.params.group);
    res.json(standings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch standings for group' });
  }
});

// Get H2H data
dataRouter.get('/h2h/:team1/:team2', async (req: Request, res: Response) => {
  try {
    const dataService: DataService = req.app.locals.dataService;
    const h2h = dataService.getH2H(req.params.team1, req.params.team2);
    res.json(h2h);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch H2H data' });
  }
});

// Get data source status
dataRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const dataService: DataService = req.app.locals.dataService;
    const status = dataService.getDataSourceStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch data source status' });
  }
});

// Trigger manual data update
dataRouter.post('/update', async (req: Request, res: Response) => {
  try {
    const dataService: DataService = req.app.locals.dataService;
    await dataService.updateData();
    res.json({ success: true, message: 'Data update triggered' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to trigger data update' });
  }
});

// Get last update time
dataRouter.get('/last-update', async (req: Request, res: Response) => {
  try {
    const dataService: DataService = req.app.locals.dataService;
    const lastUpdate = dataService.getLastUpdate();
    res.json({ lastUpdate });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get last update time' });
  }
});
