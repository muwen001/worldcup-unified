/**
 * 引擎B: 赔率+球队实力混合预测模型
 * 来源: worldcup-predictor
 * 特点: 综合赔率、球队攻防能力、FIFA排名、近期状态、
 *       主场优势、阵容完整性、旅途疲劳等多维度因素
 */
import type { Match, Prediction, MatchResult, ScorePrediction, Team, Odds } from '../types';

// ── Team Comparison ────────────────────────────────────────────

interface TeamComparison {
  attackAdvantage: number;
  defenseAdvantage: number;
  formAdvantage: number;
  rankAdvantage: number;
  overallStrengthDiff: number;
  squadAdvantage: number;
  travelAdvantage: number;
}

function compareTeams(home: Team, away: Team): TeamComparison {
  const attackAdvantage = home.stats.attackRating - away.stats.attackRating;
  const defenseAdvantage = home.stats.defenseRating - away.stats.defenseRating;
  const formAdvantage = home.stats.recentForm - away.stats.recentForm;
  const rankAdvantage = (away.fifaRank - home.fifaRank) / 100;

  const homeStrength = calculateOverallStrength(home);
  const awayStrength = calculateOverallStrength(away);
  const overallStrengthDiff = homeStrength - awayStrength;

  const squadAdvantage = getKeyPlayersImpact(home) - getKeyPlayersImpact(away);
  const travelAdvantage = calculateTravelFatigue(away) - calculateTravelFatigue(home);

  return {
    attackAdvantage,
    defenseAdvantage,
    formAdvantage,
    rankAdvantage,
    overallStrengthDiff,
    squadAdvantage,
    travelAdvantage,
  };
}

function calculateOverallStrength(team: Team): number {
  const rankFactor = (200 - team.fifaRank) / 200;
  const attackFactor = team.stats.attackRating / 100;
  const defenseFactor = team.stats.defenseRating / 100;
  const formFactor = team.stats.recentForm / 100;
  const historyFactor = team.stats.worldCupHistory.titles * 0.05 + team.stats.worldCupHistory.appearances * 0.01;
  const squadFactor = getKeyPlayersImpact(team);

  return (
    rankFactor * 0.30 +
    attackFactor * 0.25 +
    defenseFactor * 0.20 +
    formFactor * 0.15 +
    Math.min(historyFactor, 0.3) * 0.05 +
    squadFactor * 0.05
  );
}

function getKeyPlayersImpact(team: Team): number {
  const availability = team.stats.keyPlayersAvailable;
  if (availability >= 90) return 1.0;
  if (availability >= 80) return 0.95;
  if (availability >= 70) return 0.88;
  if (availability >= 60) return 0.78;
  return 0.70;
}

function calculateTravelFatigue(team: Team): number {
  if (team.stats.isHostNation) return 0.0;
  if (team.fifaRank <= 30) return 0.12;
  if (team.fifaRank <= 60) return 0.08;
  return 0.04;
}

// ── Odds Processing ────────────────────────────────────────────

function oddsToProbability(odds: number): number {
  return 1 / odds;
}

function calculateNormalizedProbabilities(homeWin: number, draw: number, awayWin: number) {
  const margin = oddsToProbability(homeWin) + oddsToProbability(draw) + oddsToProbability(awayWin) - 1;
  const total = 1 + margin;
  return {
    home: oddsToProbability(homeWin) / total,
    draw: oddsToProbability(draw) / total,
    away: oddsToProbability(awayWin) / total,
  };
}

function calculateWeightedProbabilities(oddsList: Odds[]) {
  const baseWeights: Record<string, number> = {
    bet365: 0.35,
    williamhill: 0.35,
    betfair: 0.30,
  };

  let totalWeight = 0;
  const weightedSum = { home: 0, draw: 0, away: 0 };

  oddsList.forEach((odds) => {
    const weight = baseWeights[odds.source] || 0.25;
    const probs = calculateNormalizedProbabilities(odds.homeWin, odds.draw, odds.awayWin);

    weightedSum.home += probs.home * weight;
    weightedSum.draw += probs.draw * weight;
    weightedSum.away += probs.away * weight;
    totalWeight += weight;
  });

  if (totalWeight === 0) return { home: 0.33, draw: 0.34, away: 0.33 };

  return {
    home: weightedSum.home / totalWeight,
    draw: weightedSum.draw / totalWeight,
    away: weightedSum.away / totalWeight,
  };
}

// ── Strength-based Probabilities ───────────────────────────────

function calculateStrengthBasedProbabilities(comparison: TeamComparison): { home: number; draw: number; away: number } {
  const strengthDiff = comparison.overallStrengthDiff;
  const sigmoidDiff = Math.tanh(strengthDiff * 3) * 0.5;

  const homeBase = 0.38 + sigmoidDiff;
  const awayBase = 0.38 - sigmoidDiff;
  const drawBase = Math.max(0.22, 0.28 - Math.abs(sigmoidDiff) * 0.20);

  const squadShift = comparison.squadAdvantage * 0.02;

  const home = Math.max(0.1, Math.min(0.65, homeBase + squadShift));
  const away = Math.max(0.1, Math.min(0.65, awayBase - squadShift));
  const draw = Math.max(0.20, Math.min(0.38, drawBase));

  const total = home + draw + away;
  return { home: home / total, draw: draw / total, away: away / total };
}

// ── Host Advantage ─────────────────────────────────────────────

function calculateHostAdvantage(homeTeam: Team, awayTeam: Team): number {
  const hostTeams = ['mex', 'usa', 'can'];
  const homeIsHost = hostTeams.includes(homeTeam.id);
  const awayIsHost = hostTeams.includes(awayTeam.id);
  if (homeIsHost && !awayIsHost) return 0.08;
  if (!homeIsHost && awayIsHost) return -0.08;
  return 0;
}

// ── Knockout Adjustments ───────────────────────────────────────

function calculateKnockoutDrawFactor(stage: string): number {
  if (stage === 'group') return 1.0;
  if (stage === 'round_of_32') return 0.95;
  if (stage === 'round_of_16') return 0.92;
  if (stage === 'quarter') return 0.90;
  if (stage === 'semi') return 0.88;
  if (stage === 'final') return 0.85;
  return 1.0;
}

// ── Expected Goals ─────────────────────────────────────────────

function estimateGoalExpectation(team: Team, opponent: Team, isHome: boolean): number {
  const baseGoals = isHome ? 1.40 : 1.05;
  const attackBonus = Math.max(0, (team.stats.attackRating - 50) / 100 * 0.6);
  const defenseSuppression = Math.min(0, -(opponent.stats.defenseRating - 50) / 100 * 0.35);
  const rankDiff = opponent.fifaRank - team.fifaRank;
  const rankBonus = Math.max(-0.2, Math.min(0.4, rankDiff / 100 * 0.4));
  const formBonus = Math.max(0, (team.stats.recentForm - 50) / 100 * 0.25);
  const squadImpact = getKeyPlayersImpact(team);
  const squadBonus = (squadImpact - 0.85) * 0.3;

  let goals = baseGoals + attackBonus + defenseSuppression + rankBonus + formBonus + squadBonus;
  return Math.max(0.5, Math.min(2.8, goals));
}

// ── Poisson Distribution ───────────────────────────────────────

function poissonProbability(lambda: number, k: number): number {
  if (k < 0) return 0;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function factorial(n: number): number {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

function adaptiveRho(probabilities: { home: number; draw: number; away: number }, stage: string): number {
  const probGap = Math.abs(probabilities.home - probabilities.away);
  const baseRho = stage !== 'group' ? -0.15 : -0.12;
  const gapReduction = Math.min(0.10, probGap * 0.10);
  return baseRho + gapReduction;
}

function dixonColesCorrection(homeGoals: number, awayGoals: number, lambdaHome: number, lambdaAway: number, rho: number): number {
  const isLowScore = homeGoals <= 1 && awayGoals <= 1;
  if (!isLowScore) return 1.0;

  const tau = homeGoals === 0 && awayGoals === 0 ? 1 + rho * lambdaHome * lambdaAway :
    homeGoals === 0 && awayGoals === 1 ? 1 - rho * lambdaHome :
    homeGoals === 1 && awayGoals === 0 ? 1 - rho * lambdaAway :
    homeGoals === 1 && awayGoals === 1 ? 1 + rho :
    1.0;

  return Math.max(0.5, tau);
}

// ── Main Prediction ────────────────────────────────────────────

export function predictWithEngineB(match: Match): Prediction {
  const homeTeam = match.homeTeam;
  const awayTeam = match.awayTeam;

  const comparison = compareTeams(homeTeam, awayTeam);
  const hostAdvantage = calculateHostAdvantage(homeTeam, awayTeam);
  const knockoutDrawFactor = calculateKnockoutDrawFactor(match.stage);

  // Get probabilities from odds and strength
  const oddsProbs = match.odds.length > 0 ? calculateWeightedProbabilities(match.odds) : null;
  const strengthProb = calculateStrengthBasedProbabilities(comparison);

  // Weight allocation
  const oddsWeight = oddsProbs ? 0.50 : 0;
  const strengthWeight = oddsProbs ? 0.35 : 0.85;
  const formShift = comparison.formAdvantage / 100 * 0.15;
  const squadShift = comparison.squadAdvantage * 0.10;
  const travelShift = (comparison.travelAdvantage - 0) * 0.35;

  // Base probabilities
  let homeProb = (oddsProbs ? oddsProbs.home * oddsWeight : 0) + strengthProb.home * strengthWeight;
  let awayProb = (oddsProbs ? oddsProbs.away * oddsWeight : 0) + strengthProb.away * strengthWeight;
  let drawProb = (oddsProbs ? oddsProbs.draw * (oddsWeight * 0.75) : 0) + strengthProb.draw * (strengthWeight * 1.25);

  // Adjustments
  homeProb += formShift + squadShift + travelShift;
  awayProb -= formShift + squadShift + travelShift;

  // Host advantage
  if (hostAdvantage > 0) {
    homeProb += hostAdvantage * 0.6;
    awayProb -= hostAdvantage * 0.4;
    drawProb -= hostAdvantage * 0.2;
  } else if (hostAdvantage < 0) {
    awayProb += Math.abs(hostAdvantage) * 0.6;
    homeProb -= Math.abs(hostAdvantage) * 0.4;
    drawProb -= Math.abs(hostAdvantage) * 0.2;
  }

  // Knockout adjustment
  drawProb *= knockoutDrawFactor;

  // Normalize
  homeProb = Math.max(0.02, homeProb);
  awayProb = Math.max(0.02, awayProb);
  drawProb = Math.max(0.02, drawProb);

  const total = homeProb + drawProb + awayProb;
  const probabilities = {
    home: homeProb / total,
    draw: drawProb / total,
    away: awayProb / total,
  };

  // Determine prediction with draw window
  const diff = Math.abs(probabilities.home - probabilities.away);
  let predictedOutcome: MatchResult;
  if (probabilities.draw >= 0.22 && diff <= 0.15) {
    predictedOutcome = 'draw';
  } else if (probabilities.home >= probabilities.away) {
    predictedOutcome = 'home';
  } else {
    predictedOutcome = 'away';
  }

  // Expected goals
  const homeGoals = estimateGoalExpectation(homeTeam, awayTeam, true);
  const awayGoals = estimateGoalExpectation(awayTeam, homeTeam, false);
  const lambdaHome = Math.max(0.5, Math.min(3.0, homeGoals));
  const lambdaAway = Math.max(0.5, Math.min(3.0, awayGoals));

  // Score predictions with Dixon-Coles
  const rho = adaptiveRho(probabilities, match.stage);
  const scores: ScorePrediction[] = [];

  for (let h = 0; h <= 5; h++) {
    for (let a = 0; a <= 5; a++) {
      let prob = poissonProbability(lambdaHome, h) * poissonProbability(lambdaAway, a);
      prob *= dixonColesCorrection(h, a, lambdaHome, lambdaAway, rho);
      scores.push({ homeScore: h, awayScore: a, probability: prob, isMostLikely: false });
    }
  }

  // Normalize and get top 5
  const scoreTotal = scores.reduce((sum, s) => sum + s.probability, 0);
  scores.forEach(s => s.probability /= scoreTotal);
  scores.sort((a, b) => b.probability - a.probability);
  const scorePredictions = scores.slice(0, 5);
  if (scorePredictions.length > 0) {
    // Smart recommendation
    const probGap = Math.abs(probabilities.home - probabilities.away);
    const favoredSide = probabilities.home > probabilities.away ? 'home' : 'away';
    let recommendedIdx = 0;

    if (probGap > 0.15) {
      const multiGoalScores = scorePredictions.filter(s => {
        const scoreDiff = Math.abs(s.homeScore - s.awayScore);
        const winnerCorrect = (favoredSide === 'home' && s.homeScore > s.awayScore) ||
                              (favoredSide === 'away' && s.awayScore > s.homeScore);
        return scoreDiff >= 2 && winnerCorrect;
      });
      if (multiGoalScores.length > 0) {
        recommendedIdx = scorePredictions.indexOf(multiGoalScores[0]);
      }
    } else if (probGap < 0.08) {
      const drawScores = scorePredictions.filter(s => s.homeScore === s.awayScore);
      if (drawScores.length > 0) {
        recommendedIdx = scorePredictions.indexOf(drawScores[0]);
      }
    }

    scorePredictions[recommendedIdx].isMostLikely = true;
    scorePredictions.forEach(s => s.probability = Math.round(s.probability * 1000) / 10);
  }

  // Confidence
  const maxProb = Math.max(probabilities.home, probabilities.draw, probabilities.away);
  const minProb = Math.min(probabilities.home, probabilities.draw, probabilities.away);
  const concentration = (maxProb - minProb) * 100;
  const strengthClarity = Math.abs(comparison.overallStrengthDiff) * 50;
  let confidence = Math.round(Math.min(95, concentration * 0.4 + strengthClarity * 0.3 + 30));
  confidence = Math.max(30, Math.min(95, confidence));

  // Reasoning
  const reasoning: string[] = [];
  reasoning.push('引擎B: 赔率+球队实力混合模型');
  if (maxProb > 0.55) {
    reasoning.push(`综合分析显示明显优势（${(maxProb * 100).toFixed(1)}%）`);
  } else if (maxProb > 0.40) {
    reasoning.push(`综合分析显示相对优势（${(maxProb * 100).toFixed(1)}%）`);
  } else {
    reasoning.push(`双方实力接近（${(maxProb * 100).toFixed(1)}%）`);
  }

  if (Math.abs(comparison.overallStrengthDiff) > 0.15) {
    const stronger = comparison.overallStrengthDiff > 0 ? homeTeam.nameCn : awayTeam.nameCn;
    reasoning.push(`${stronger}整体实力更强`);
  }

  if (comparison.formAdvantage > 0.05) {
    reasoning.push(`${homeTeam.nameCn}近期状态更佳`);
  } else if (comparison.formAdvantage < -0.05) {
    reasoning.push(`${awayTeam.nameCn}近期状态更佳`);
  }

  if (hostAdvantage > 0) {
    reasoning.push(`${homeTeam.nameCn}作为东道主享有主场优势`);
  } else if (hostAdvantage < 0) {
    reasoning.push(`${awayTeam.nameCn}作为东道主享有主场优势`);
  }

  if (match.stage !== 'group') {
    reasoning.push('淘汰赛阶段比赛更保守');
  }

  return {
    matchId: match.id,
    predictedOutcome,
    confidence,
    probabilities,
    scorePredictions,
    expectedGoals: { home: lambdaHome, away: lambdaAway },
    reasoning,
    timestamp: new Date().toISOString(),
  };
}
