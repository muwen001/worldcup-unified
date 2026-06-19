import type { Match, Team, DataSourceStatus } from '../types';
import { TEAMS } from './staticData';

const API_BASE_URL = '/api';

export interface DataFetchResult {
  matches: Match[];
  sourceStatus: DataSourceStatus[];
  errors: string[];
  isRealTime: boolean;
  lastUpdated: string;
}

class DataService {
  async fetchMatches(): Promise<DataFetchResult> {
    const errors: string[] = [];
    const sourceStatus: DataSourceStatus[] = [];
    let matches: Match[] = [];
    let isRealTime = false;

    try {
      const response = await fetch(`${API_BASE_URL}/matches`);
      if (response.ok) {
        const backendMatches = await response.json();
        if (backendMatches.length > 0) {
          matches = this.convertBackendMatches(backendMatches);
          isRealTime = true;
          sourceStatus.push({
            source: 'cctv-sporttery',
            connected: true,
            lastFetch: new Date().toISOString(),
            error: null,
            matchesAvailable: true,
            oddsAvailable: true,
          });
        }
      } else {
        errors.push(`Backend API error: HTTP ${response.status}`);
      }
    } catch (err) {
      errors.push(`Backend fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    return {
      matches,
      sourceStatus,
      errors,
      isRealTime,
      lastUpdated: new Date().toISOString(),
    };
  }

  private convertBackendMatches(backendMatches: any[]): Match[] {
    const teamsMap = new Map<string, Team>();
    TEAMS.forEach(t => teamsMap.set(t.id, t));

    const converted: Match[] = [];

    for (const backendMatch of backendMatches) {
      const homeTeam = teamsMap.get(backendMatch.homeTeam);
      const awayTeam = teamsMap.get(backendMatch.awayTeam);

      if (!homeTeam || !awayTeam) {
        console.warn(`Unknown team: ${backendMatch.homeTeam} or ${backendMatch.awayTeam}`);
        continue;
      }

      // Convert odds format
      let odds = [];
      if (backendMatch.odds && !Array.isArray(backendMatch.odds)) {
        odds = [{
          source: 'sporttery',
          sourceName: 'Sporttery',
          homeWin: backendMatch.odds.home || 2.0,
          draw: backendMatch.odds.draw || 3.0,
          awayWin: backendMatch.odds.away || 2.0,
          timestamp: new Date().toISOString(),
          history: [],
        }];
      } else if (Array.isArray(backendMatch.odds) && backendMatch.odds.length > 0) {
        odds = backendMatch.odds;
      }

      converted.push({
        id: backendMatch.id,
        homeTeam,
        awayTeam,
        date: backendMatch.date,
        time: backendMatch.time,
        stage: backendMatch.stage || 'group',
        group: backendMatch.group,
        odds,
        status: backendMatch.status || 'upcoming',
        result: backendMatch.result,
        score: backendMatch.score,
      });
    }

    return converted;
  }
}

export const dataService = new DataService();
