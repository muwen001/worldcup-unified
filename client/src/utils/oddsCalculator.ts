import type { MatchResult, ScorePrediction } from '../types';

/**
 * Convert odds to implied probability
 */
export function oddsToProbability(odds: number): number {
  return 1 / odds;
}

/**
 * Calculate bookmaker margin
 */
export function calculateBookmakerMargin(homeWin: number, draw: number, awayWin: number): number {
  return oddsToProbability(homeWin) + oddsToProbability(draw) + oddsToProbability(awayWin) - 1;
}

/**
 * Calculate normalized probabilities (remove bookmaker margin)
 */
export function calculateNormalizedProbabilities(homeWin: number, draw: number, awayWin: number) {
  const margin = calculateBookmakerMargin(homeWin, draw, awayWin);
  const total = 1 + margin;

  return {
    home: oddsToProbability(homeWin) / total,
    draw: oddsToProbability(draw) / total,
    away: oddsToProbability(awayWin) / total,
  };
}

/**
 * Format probability as percentage
 */
export function formatProbability(probability: number): string {
  return `${(probability * 100).toFixed(1)}%`;
}

/**
 * Format odds
 */
export function formatOdds(odds: number): string {
  return odds.toFixed(2);
}

/**
 * Get result Chinese name
 */
export function getResultName(result: MatchResult): string {
  const names = { home: '主胜', draw: '平局', away: '客胜' };
  return names[result];
}

/**
 * Get stage Chinese name
 */
const STAGE_NAMES: Record<string, string> = {
  group: '小组赛', round_of_32: '1/16决赛', round_of_16: '1/8决赛',
  quarter: '1/4决赛', semi: '半决赛', final: '决赛',
};

export function getStageName(stage: string): string {
  return STAGE_NAMES[stage] || stage;
}

/**
 * Get score prediction text
 */
export function getScorePredictionText(score: ScorePrediction): string {
  return `${score.homeScore} - ${score.awayScore}`;
}
