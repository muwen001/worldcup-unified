export interface Team {
  id: string;
  name: string;
  nameCn: string;
  flag: string;
  group?: string;
  fifaRank: number;
  stats: TeamStats;
}

export interface TeamStats {
  attackRating: number;
  defenseRating: number;
  recentForm: number;
  worldCupHistory: {
    appearances: number;
    bestResult: string;
    titles: number;
  };
  avgGoalsScored: number;
  avgGoalsConceded: number;
  keyPlayersAvailable: number;
  isHostNation: boolean;
}

export interface Odds {
  home: number;
  draw: number;
  away: number;
}

export type MatchStage = 'group' | 'round_of_32' | 'round_of_16' | 'quarter' | 'semi' | 'final';
export type MatchStatus = 'upcoming' | 'live' | 'completed';
export type MatchResult = 'home' | 'draw' | 'away';

export interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  date: string;
  time: string;
  stage: MatchStage;
  group?: string;
  odds: Odds;
  status: MatchStatus;
  result?: MatchResult;
  score?: { home: number; away: number };
}

export interface ScorePrediction {
  homeScore: number;
  awayScore: number;
  probability: number;
  isMostLikely: boolean;
}

export interface Prediction {
  matchId: string;
  predictedOutcome: MatchResult;
  confidence: number;
  probabilities: {
    home: number;
    draw: number;
    away: number;
  };
  scorePredictions: ScorePrediction[];
  expectedGoals: {
    home: number;
    away: number;
  };
  reasoning: string[];
  timestamp: string;
}

export interface Group {
  letter: string;
  teams: Team[];
}

export interface Standing {
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface ChampionOdds {
  team: string;
  odds: number;
  trend: 'up' | 'down' | 'stable';
}

export interface DataSourceStatus {
  cctv: {
    connected: boolean;
    lastFetch: string | null;
    error: string | null;
  };
  sporttery: {
    connected: boolean;
    lastFetch: string | null;
    error: string | null;
  };
}
