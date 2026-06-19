import { Odds } from '../types/index.js';
import { TEAMS } from '../data/staticData.js';

const SPORTTERY_API_URL = 'https://webapi.sporttery.cn/gateway/uniform/football/getMatchCalculatorV1.qry?channel=c';

// Sporttery Chinese team name to team ID mapping
const TEAM_NAME_ZH_TO_ID: Record<string, string> = {};
TEAMS.forEach(t => {
  TEAM_NAME_ZH_TO_ID[t.nameCn] = t.id;
});

export interface SportteryFetchResult {
  odds: Map<string, Odds>;
  connected: boolean;
  error: string | null;
}

export async function fetchSportteryData(): Promise<SportteryFetchResult> {
  const odds = new Map<string, Odds>();
  let connected = false;
  let error: string | null = null;

  try {
    const response = await fetch(SPORTTERY_API_URL, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.106 Mobile Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Referer': 'https://m.sporttery.cn/',
        'Origin': 'https://m.sporttery.cn',
      },
    });

    if (!response.ok) {
      error = `Sporttery HTTP ${response.status}`;
      return { odds, connected, error };
    }

    const data = await response.json();
    if (data.errorCode !== '0') {
      error = `Sporttery API error: ${data.errorMessage || 'Unknown'}`;
      return { odds, connected, error };
    }

    connected = true;

    // Process match data
    if (data.value && data.value.matchInfoList) {
      data.value.matchInfoList.forEach((group: any) => {
        if (!group.subMatchList) return;

        group.subMatchList.forEach((match: any) => {
          const homeName = match.homeTeamAllName;
          const awayName = match.awayTeamAllName;

          const homeId = TEAM_NAME_ZH_TO_ID[homeName];
          const awayId = TEAM_NAME_ZH_TO_ID[awayName];

          if (!homeId || !awayId) return;

          const had = match.had || {};
          if (!had.h || !had.d || !had.a) return;

          const hPrice = parseFloat(had.h);
          const dPrice = parseFloat(had.d);
          const aPrice = parseFloat(had.a);

          if (isNaN(hPrice) || isNaN(dPrice) || isNaN(aPrice)) return;

          const key = `${homeId}-${awayId}`;
          odds.set(key, {
            home: hPrice,
            draw: dPrice,
            away: aPrice,
          });
        });
      });
    }
  } catch (err) {
    error = `Sporttery fetch error: ${err instanceof Error ? err.message : String(err)}`;
  }

  return { odds, connected, error };
}
