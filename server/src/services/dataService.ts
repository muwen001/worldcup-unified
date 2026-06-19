import { Match, Team, Group, Standing, DataSourceStatus } from '../types/index.js';
import { TEAMS, GROUPS } from '../data/staticData.js';
import { fetchCctvMatches } from './cctvApi.js';
import { fetchSportteryData } from './sportteryApi.js';

export class DataService {
  private matches: Match[] = [];
  private teams: Map<string, Team> = new Map();
  private groups: Map<string, Group> = new Map();
  private standings: Map<string, Standing[]> = new Map();
  private h2hData: Map<string, any> = new Map();
  private lastUpdate: Date = new Date();
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
    console.log('[DataService] Updating data...');

    // Fetch CCTV data
    try {
      const cctvResult = await fetchCctvMatches();
      if (cctvResult.connected && cctvResult.matches.length > 0) {
        this.matches = cctvResult.matches;
        this.sourceStatus.cctv = {
          connected: true,
          lastFetch: new Date().toISOString(),
          error: null,
        };
        console.log(`[DataService] CCTV: Loaded ${cctvResult.matches.length} matches`);
      }
    } catch (error) {
      console.error('[DataService] CCTV fetch failed:', error);
      this.sourceStatus.cctv.error = String(error);
    }

    // Fetch Sporttery data (odds)
    try {
      const sportteryResult = await fetchSportteryData();
      if (sportteryResult.connected) {
        this.mergeOdds(sportteryResult.odds);
        this.sourceStatus.sporttery = {
          connected: true,
          lastFetch: new Date().toISOString(),
          error: null,
        };
        console.log('[DataService] Sporttery: Odds data merged');
      }
    } catch (error) {
      console.error('[DataService] Sporttery fetch failed:', error);
      this.sourceStatus.sporttery.error = String(error);
    }

    // Calculate standings
    this.calculateStandings();

    this.lastUpdate = new Date();
    console.log(`[DataService] Update complete. Total matches: ${this.matches.length}`);
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

      groupMatches.forEach(match => {
        const homeStanding = standings.find(s => s.team.id === match.homeTeam);
        const awayStanding = standings.find(s => s.team.id === match.awayTeam);

        if (homeStanding && awayStanding && match.homeScore !== null && match.awayScore !== null) {
          homeStanding.played++;
          awayStanding.played++;
          homeStanding.goalsFor += match.homeScore;
          homeStanding.goalsAgainst += match.awayScore;
          awayStanding.goalsFor += match.awayScore;
          awayStanding.goalsAgainst += match.homeScore;

          if (match.homeScore > match.awayScore) {
            homeStanding.won++;
            homeStanding.points += 3;
            awayStanding.lost++;
          } else if (match.homeScore < match.awayScore) {
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
