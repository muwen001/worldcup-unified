/**
 * 双引擎预测系统
 * 同时使用两个独立的预测引擎，为每场比赛提供两种视角的预测
 */
import type { Match, DualPrediction } from '../types';
import { predictWithEngineA } from './predictionEngineA';
import { predictWithEngineB } from './predictionEngineB';

export function generateDualPrediction(match: Match): DualPrediction {
  return {
    matchId: match.id,
    engineA: predictWithEngineA(match),
    engineB: predictWithEngineB(match),
  };
}

export function generateDualPredictions(matches: Match[]): DualPrediction[] {
  return matches.map(match => generateDualPrediction(match));
}
