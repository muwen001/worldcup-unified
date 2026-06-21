/**
 * 双引擎预测系统
 * 同时使用两个独立的预测引擎，为每场比赛提供两种视角的预测
 */
import type { Match, DualPrediction, Prediction, MatchResult } from '../types';
import { predictWithEngineA } from './predictionEngineA';
import { predictWithEngineB } from './predictionEngineB';

/** Empirical draw rate from 2026 WC completed matches (fallback if too few). */
const DEFAULT_DRAW_RATE = 0.30;
const MIN_SAMPLE = 3;

function computeEmpiricalDrawRate(matches: Match[]): number {
  const done = matches.filter((m) => m.status === 'completed' && m.score);
  if (done.length < MIN_SAMPLE) return DEFAULT_DRAW_RATE;
  const draws = done.filter((m) => m.score!.home === m.score!.away).length;
  return draws / done.length;
}

/**
 * Calibrate the win/draw/away probabilities toward the empirical draw rate.
 * Pulls the model's draw probability part-way toward reality, redistributing
 * the delta onto home/away proportionally, then renormalizes and recomputes
 * the predicted outcome.
 */
function calibrateDraw(pred: Prediction, empiricalDraw: number): Prediction {
  const probs = { ...pred.probabilities };
  const modelDraw = probs.draw;

  // Blend model toward empirical draw (capped to a sane band).
  const BLEND = 0.50;
  const newDraw = Math.min(0.48, Math.max(0.18, modelDraw + BLEND * (empiricalDraw - modelDraw)));
  const delta = newDraw - modelDraw;

  const otherTotal = probs.home + probs.away;
  if (otherTotal > 0) {
    probs.home = Math.max(0.02, probs.home - delta * (probs.home / otherTotal));
    probs.away = Math.max(0.02, probs.away - delta * (probs.away / otherTotal));
  }

  const total = probs.home + probs.draw + probs.away;
  probs.home /= total;
  probs.draw /= total;
  probs.away /= total;

  const predictedOutcome: MatchResult =
    probs.draw >= probs.home && probs.draw >= probs.away
      ? 'draw'
      : probs.home >= probs.away
      ? 'home'
      : 'away';

  return { ...pred, probabilities: probs, predictedOutcome };
}

function build(match: Match, empiricalDraw: number): DualPrediction {
  return {
    matchId: match.id,
    engineA: calibrateDraw(predictWithEngineA(match), empiricalDraw),
    engineB: calibrateDraw(predictWithEngineB(match), empiricalDraw),
  };
}

export function generateDualPrediction(match: Match, empiricalDraw: number = DEFAULT_DRAW_RATE): DualPrediction {
  return build(match, empiricalDraw);
}

export function generateDualPredictions(matches: Match[]): DualPrediction[] {
  const empiricalDraw = computeEmpiricalDrawRate(matches);
  return matches.map((match) => build(match, empiricalDraw));
}
