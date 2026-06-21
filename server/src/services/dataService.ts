import { Match, Team, Group, Standing, DataSourceStatus } from '../types/index.js';
import { TEAMS, GROUPS } from '../data/staticData.js';
import { fetchCctvMatches } from './cctvApi.js';
import { fetchSportteryData } from './sportteryApi.js';
import fs from 'fs';
import path from 'path';

export class DataService {
  private matches: Match[] = [];
  private teams: Map<string, Team> = new Map();
  private groups: Map<string, Group> = new Map();
  private standings: Map<string, Standing[]> = new Map();
  private h2hData: Map<string, any> = new Map();
  private lastUpdate: Date = new Date();
  private updating = false;
  private sourceStatus: DataSourceStatus = {
    cctv: { connected: false, lastFetch: null, error: null },
    sporttery: { connected: false, lastFetch: null, error: null },
  };

  constructor() {
    // Initialize teams
    TEAMS.forEach(team => {
      this.teams.set(team.id, team);
    });

    // Initialize groups
    Object.entries(GROUPS).forEach(([letter, teamIds]) => {
      this.groups.set(letter, {
        letter,
        teams: teamIds.map(id => this.teams.get(id)!).filter(Boolean),
      });
    });
  }

  async initialize(): Promise<void> {
    console.log('[DataService] Initializing...');
    await this.updateData();
    console.log('[DataService] Initialization complete');
  }

  async updateData(): Promise<void> {
    // Prevent overlapping concurrent updates
    if (this.updating) {
      console.log('[DataService] Skipping update — previous update still in progress');
      return;
    }
    this.updating = true;

    try {
      console.log('[DataService] Updating data...');

      // Fetch CCTV and Sporttery in parallel
      const [cctvResult, sportteryResult] = await Promise.allSettled([
        fetchCctvMatches(),
        fetchSportteryData(),
      ]);

      // Process CCTV
      if (cctvResult.status === 'fulfilled' && cctvResult.value.connected && cctvResult.value.matches.length > 0) {
        this.matches = cctvResult.value.matches;
        this.sourceStatus.cctv = {
          connected: true,
          lastFetch: new Date().toISOString(),
          error: null,
        };
        console.log(`[DataService] CCTV: Loaded ${cctvResult.value.matches.length} matches`);
      } else if (cctvResult.status === 'rejected') {
        console.error('[DataService] CCTV fetch failed:', cctvResult.reason);
        this.sourceStatus.cctv = {
          connected: false,
          lastFetch: this.sourceStatus.cctv.lastFetch,
          error: String(cctvResult.reason),
        };
      } else {
        const err = cctvResult.status === 'fulfilled' ? cctvResult.value.errors.join('; ') : '';
        console.error('[DataService] CCTV fetch returned no data:', err);
        this.sourceStatus.cctv = {
          connected: false,
          lastFetch: this.sourceStatus.cctv.lastFetch,
          error: err || 'No matches returned',
        };
      }

      // Process Sporttery
      if (sportteryResult.status === 'fulfilled' && sportteryResult.value.connected) {
        this.mergeOdds(sportteryResult.value.odds);
        this.sourceStatus.sporttery = {
          connected: true,
          lastFetch: new Date().toISOString(),
          error: null,
        };
        console.log('[DataService] Sporttery: Odds data merged');
      } else if (sportteryResult.status === 'rejected') {
        console.error('[DataService] Sporttery fetch failed:', sportteryResult.reason);
        this.sourceStatus.sporttery = {
          connected: false,
          lastFetch: this.sourceStatus.sporttery.lastFetch,
          error: String(sportteryResult.reason),
        };
      } else {
        const err = sportteryResult.status === 'fulfilled' ? sportteryResult.value.error : '';
        this.sourceStatus.sporttery = {
          connected: false,
          lastFetch: this.sourceStatus.sporttery.lastFetch,
          error: err || 'No odds data',
        };
      }

      // Fallback: load static odds from local file (when Sporttery API is blocked)
      this.loadStaticOdds();

      // Calculate standings
      this.calculateStandings();

      this.lastUpdate = new Date();
      console.log(`[DataService] Update complete. Total matches: ${this.matches.length}`);
    } finally {
      this.updating = false;
    }
  }

  private mergeOdds(oddsData: Map<string, any>): void {
    // Merge odds from Sporttery into matches
    this.matches.forEach(match => {
      const key = `${match.homeTeam}-${match.awayTeam}`;
      const odds = oddsData.get(key);
      if (odds) {
        match.odds = odds;
      }
    });
  }

  private loadStaticOdds(): void {
    try {
      const oddsPath = path.resolve(process.cwd(), 'src/data/odds.json');
      if (!fs.existsSync(oddsPath)) return;
      const raw = fs.readFileSync(oddsPath, 'utf-8');
      const oddsList: Array<{ homeTeam: string; awayTeam: string; homeWin: number; draw: number; awayWin: number }> = JSON.parse(raw);
      let merged = 0;
      for (const entry of oddsList) {
        const match = this.matches.find(m => m.homeTeam === entry.homeTeam && m.awayTeam === entry.awayTeam);
        if (match && (!match.odds || (Array.isArray(match.odds) && match.odds.length === 0))) {
          match.odds = { home: entry.homeWin, draw: entry.draw, away: entry.awayWin };
          merged++;
        }
      }
      if (merged > 0) {
        console.log(`[DataService] Static odds: Loaded ${merged} entries from odds.json`);
      }
    } catch (err) {
      console.error('[DataService] Failed to load static odds:', err);
    }
  }

  private calculateStandings(): void {
    // Calculate standings for each group
    this.groups.forEach((group, letter) => {
      const groupMatches = this.matches.filter(m => m.group === letter && m.status === 'completed');
      const standings: Standing[] = group.teams.map(team => ({
        team,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        points: 0,
      }));

      // Build lookup map for O(1) access
      const standingMap = new Map<string, Standing>();
      standings.forEach(s => standingMap.set(s.team.id, s));

      groupMatches.forEach(match => {
        const homeStanding = standingMap.get(match.homeTeam);
        const awayStanding = standingMap.get(match.awayTeam);

        if (homeStanding && awayStanding && match.score) {
          const homeScore = match.score.home;
          const awayScore = match.score.away;
          homeStanding.played++;
          awayStanding.played++;
          homeStanding.goalsFor += homeScore;
          homeStanding.goalsAgainst += awayScore;
          awayStanding.goalsFor += awayScore;
          awayStanding.goalsAgainst += homeScore;

          if (homeScore > awayScore) {
            homeStanding.won++;
            homeStanding.points += 3;
            awayStanding.lost++;
          } else if (homeScore < awayScore) {
            awayStanding.won++;
            awayStanding.points += 3;
            homeStanding.lost++;
          } else {
            homeStanding.drawn++;
            awayStanding.drawn++;
            homeStanding.points++;
            awayStanding.points++;
          }
        }
      });

      // Sort by points, then goal difference, then goals scored
      standings.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        const gdA = a.goalsFor - a.goalsAgainst;
        const gdB = b.goalsFor - b.goalsAgainst;
        if (gdB !== gdA) return gdB - gdA;
        return b.goalsFor - a.goalsFor;
      });

      this.standings.set(letter, standings);
    });
  }

  getMatches(): Match[] {
    return this.matches;
  }

  getMatchById(id: string): Match | undefined {
    return this.matches.find(m => m.id === id);
  }

  getMatchesByDate(date: string): Match[] {
    return this.matches.filter(m => m.date === date);
  }

  getMatchesByGroup(group: string): Match[] {
    return this.matches.filter(m => m.group === group);
  }

  getLiveMatches(): Match[] {
    return this.matches.filter(m => m.status === 'live');
  }

  getCompletedMatches(): Match[] {
    return this.matches.filter(m => m.status === 'completed');
  }

  getUpcomingMatches(): Match[] {
    return this.matches.filter(m => m.status === 'upcoming');
  }

  getTeams(): Team[] {
    return Array.from(this.teams.values());
  }

  getGroups(): Group[] {
    return Array.from(this.groups.values());
  }

  getStandings(): Map<string, Standing[]> {
    return this.standings;
  }

  getStandingsByGroup(group: string): Standing[] {
    return this.standings.get(group) || [];
  }

  getH2H(team1: string, team2: string): any {
    const key = `${team1}-${team2}`;
    return this.h2hData.get(key) || null;
  }

  getDataSourceStatus(): DataSourceStatus {
    return this.sourceStatus;
  }

  getLastUpdate(): Date {
    return this.lastUpdate;
  }
}
