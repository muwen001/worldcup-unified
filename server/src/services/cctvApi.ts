import { Match, MatchStatus } from '../types/index.js';
import { TEAMS } from '../data/staticData.js';

const CCTV_API_URL = 'https://cbs-i.sports.cctv.com/cache/f26a37123b56df9205cf3948f7a3e316';

interface CctvMatch {
  id: number;
  homeId: number;
  guestId: number;
  homeName: string;
  guestName: string;
  gameName: string;
  startTime: string;
  endTime: string;
  gameStatus: number;
  statusDesc: string;
  homeScore: number;
  guestScore: number;
  homeHalfScore: number;
  guestHalfScore: number;
  roundType: string;
  gameRound: string;
  scores: Record<string, { team1: number; team2: number }>;
}

// Build team lookup by Chinese name
const teamByNameCn = new Map<string, string>();
TEAMS.forEach(t => {
  teamByNameCn.set(t.nameCn, t.id);
});

// Name normalization: CCTV uses slightly different names for some teams
const NAME_ALIASES: Record<string, string> = {
  '刚果（金）': '刚果民主',
  '韩国': '韩国',
};

function resolveTeam(cctvName: string): string | undefined {
  const alias = NAME_ALIASES[cctvName];
  if (alias) return teamByNameCn.get(alias);
  return teamByNameCn.get(cctvName);
}

function parseCctvTime(startTime: string): { date: string; time: string } {
  const date = startTime.slice(0, 10);
  const time = startTime.slice(11, 16);
  return { date, time };
}

function mapStatus(gameStatus: number): MatchStatus {
  if (gameStatus === 3) return 'completed';
  if (gameStatus === 2) return 'live';
  return 'upcoming';
}

function mapRoundType(roundType: string): string | undefined {
  const match = roundType.match(/([A-L])组/);
  return match ? match[1] : undefined;
}

export interface CctvFetchResult {
  matches: Match[];
  errors: string[];
  connected: boolean;
}

export async function fetchCctvMatches(): Promise<CctvFetchResult> {
  const errors: string[] = [];
  const matches: Match[] = [];
  let connected = false;

  try {
    const response = await fetch(CCTV_API_URL);
    if (!response.ok) {
      errors.push(`CCTV API HTTP ${response.status}`);
      return { matches, errors, connected };
    }

    const data = await response.json();
    if (!data.success || !data.results) {
      errors.push('CCTV API returned unsuccessful response');
      return { matches, errors, connected };
    }

    connected = true;
    const cctvMatches: CctvMatch[] = data.results;

    for (const cctv of cctvMatches) {
      const homeTeamId = resolveTeam(cctv.homeName);
      const awayTeamId = resolveTeam(cctv.guestName);

      if (!homeTeamId || !awayTeamId) {
        errors.push(`Unknown team: ${cctv.homeName} or ${cctv.guestName}`);
        continue;
      }

      const { date, time } = parseCctvTime(cctv.startTime);
      const status = mapStatus(cctv.gameStatus);
      const group = mapRoundType(cctv.roundType);

      const score = (status === 'completed' || status === 'live')
        ? { home: cctv.homeScore, away: cctv.guestScore }
        : undefined;

      const result = score
        ? (score.home > score.away ? 'home' : score.home < score.away ? 'away' : 'draw')
        : undefined;

      matches.push({
        id: `cctv_${cctv.id}`,
        homeTeam: homeTeamId,
        awayTeam: awayTeamId,
        date,
        time,
        stage: 'group',
        group,
        odds: [],
        status,
        result,
        score,
      });
    }
  } catch (err) {
    errors.push(`CCTV fetch error: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { matches, errors, connected };
}
