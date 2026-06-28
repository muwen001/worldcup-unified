import { Match, MatchStatus, MatchStage } from '../types/index.js';
import { TEAMS } from '../data/staticData.js';

const CCTV_API_URL = 'https://cbs-i.sports.cctv.com/cache/f26a37123b56df9205cf3948f7a3e316';
const FETCH_TIMEOUT_MS = 10_000; // 10 seconds

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

/**
 * Map CCTV roundType/gameRound to our MatchStage.
 * Group stage: roundType like 'A组'..'L组'.
 * Knockout: roundType === '淘汰赛'; gameRound names the round using the
 * Chinese convention — 1/16决赛 = Round of 32 (16 matches, 32 teams),
 * 1/8决赛 = Round of 16, 1/4决赛 = quarter, 半决赛 = semi, 决赛 = final.
 */
function mapStage(roundType: string, gameRound: string): MatchStage {
  if (/[A-L]组/.test(roundType)) return 'group';
  // Order matters: '1/8' is not a substring of '1/16', but '决' appears in
  // every compound name, so check 半/决 last.
  if (gameRound.includes('1/16')) return 'round_of_32';
  if (gameRound.includes('1/8')) return 'round_of_16';
  if (gameRound.includes('1/4')) return 'quarter';
  if (gameRound.includes('半')) return 'semi';
  if (gameRound.includes('决')) return 'final';
  return 'round_of_16'; // unknown knockout round → treat as Round of 16
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(CCTV_API_URL, { signal: controller.signal });
    clearTimeout(timeoutId);
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
      const stage = mapStage(cctv.roundType, cctv.gameRound);
      const group = stage === 'group' ? mapRoundType(cctv.roundType) : undefined;

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
        stage,
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
