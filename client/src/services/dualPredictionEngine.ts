/**
 * 双引擎预测系统
 * 同时使用两个独立的预测引擎，为每场比赛提供两种视角的预测
 */
import type { Match, DualPrediction, Prediction, MatchResult } from '../types';
import { predictWithEngineA } from './predictionEngineA';
import { predictWithEngineB } from './predictionEngineB';
import { computeTournamentForm, type TournamentForm } from './tournamentForm';

/** Empirical draw rate from 2026 WC completed matches (fallback if too few). */
const DEFAULT_DRAW_RATE = 0.30;
const MIN_SAMPLE = 3;

/** Knockout stages — a winner must emerge (extra time / penalties), so the
 *  final outcome is never a draw. */
function isKnockout(stage: string): boolean {
  return stage !== 'group';
}

function computeEmpiricalDrawRate(matches: Match[]): number {
  // Only group-stage completed matches carry draw signal; knockouts always
  // produce a winner, so exclude them from the draw-rate baseline.
  const done = matches.filter((m) => m.stage === 'group' && m.status === 'completed' && m.score);
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

/**
 * Knockout matches cannot end in a draw — a winner always emerges after
 * extra time / penalties. Drop the model's draw probability entirely and
 * redistribute it onto home/away proportionally, then force a home/away
 * prediction. Bypasses the empirical-draw calibration (which would otherwise
 * re-introduce a draw outcome that can never occur).
 */
function eliminateDraw(pred: Prediction): Prediction {
  const probs = { ...pred.probabilities };
  const draw = probs.draw;
  probs.draw = 0;
  const otherTotal = probs.home + probs.away;
  if (otherTotal > 0) {
    probs.home += draw * (probs.home / otherTotal);
    probs.away += draw * (probs.away / otherTotal);
  } else {
    probs.home += draw / 2;
    probs.away += draw / 2;
  }
  const total = probs.home + probs.draw + probs.away;
  probs.home /= total;
  probs.draw /= total;
  probs.away /= total;

  const predictedOutcome: MatchResult = probs.home >= probs.away ? 'home' : 'away';

  const reasoning = [...pred.reasoning, '淘汰赛不产生平局，平局概率折算为胜负'];
  return { ...pred, probabilities: probs, predictedOutcome, reasoning };
}

function build(match: Match, formMap: Map<string, TournamentForm> | undefined, empiricalDraw: number): DualPrediction {
  const knockout = isKnockout(match.stage);
  const apply = (p: Prediction) => (knockout ? eliminateDraw(p) : calibrateDraw(p, empiricalDraw));
  return {
    matchId: match.id,
    engineA: apply(predictWithEngineA(match, formMap)),
    engineB: apply(predictWithEngineB(match, formMap)),
  };
}

export function generateDualPrediction(
  match: Match,
  formMap?: Map<string, TournamentForm>,
  empiricalDraw: number = DEFAULT_DRAW_RATE,
): DualPrediction {
  return build(match, formMap, empiricalDraw);
}

export function generateDualPredictions(matches: Match[]): DualPrediction[] {
  const empiricalDraw = computeEmpiricalDrawRate(matches);
  const formMap = computeTournamentForm(matches);
  return matches.map((match) => build(match, formMap, empiricalDraw));
}
