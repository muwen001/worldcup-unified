/**
 * 引擎B: 赔率+球队实力混合预测模型
 * 来源: worldcup-predictor
 * 特点: 综合赔率、球队攻防能力、FIFA排名、近期状态、
 *       主场优势、阵容完整性、旅途疲劳等多维度因素
 */
import type { Match, Prediction, MatchResult, ScorePrediction, Team, Odds } from '../types';
import { getForm, type TournamentForm } from './tournamentForm';

// ── Team Comparison ────────────────────────────────────────────

interface TeamComparison {
  attackAdvantage: number;
  defenseAdvantage: number;
  formAdvantage: number;
  rankAdvantage: number;
  overallStrengthDiff: number;
  squadAdvantage: number;
  travelAdvantage: number;
  tournamentAttackAdv: number;
  tournamentDefenseAdv: number;
  tournamentFormAdv: number;
  hasTournamentForm: boolean;
}

function compareTeams(home: Team, away: Team, formMap?: Map<string, TournamentForm>): TeamComparison {
  const attackAdvantage = home.stats.attackRating - away.stats.attackRating;
  const defenseAdvantage = home.stats.defenseRating - away.stats.defenseRating;
  const formAdvantage = home.stats.recentForm - away.stats.recentForm;
  const rankAdvantage = (away.fifaRank - home.fifaRank) / 100;

  const homeStrength = calculateOverallStrength(home);
  const awayStrength = calculateOverallStrength(away);
  let overallStrengthDiff = homeStrength - awayStrength;

  // 小组赛真实表现叠加：进攻强度差、防守稳固度差、综合 form 差
  const hf = getForm(formMap, home.id);
  const af = getForm(formMap, away.id);
  const tournamentAttackAdv = hf.attackStrength - af.attackStrength;
  const tournamentDefenseAdv = af.defenseVulnerability - hf.defenseVulnerability; // 正=主队防守更稳
  const tournamentFormAdv = hf.formRating - af.formRating;
  const hasTournamentForm = hf.played > 0 && af.played > 0;
  if (hasTournamentForm) {
    overallStrengthDiff +=
      (tournamentFormAdv / 100) * 0.15 +
      tournamentAttackAdv * 0.10 +
      tournamentDefenseAdv * 0.10;
  }

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
    tournamentAttackAdv,
    tournamentDefenseAdv,
    tournamentFormAdv,
    hasTournamentForm,
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
  const sigmoidDiff = Math.tanh(strengthDiff * 2.5) * 0.45;

  const homeBase = 0.36 + sigmoidDiff;
  const awayBase = 0.36 - sigmoidDiff;
  // Higher draw base — WC group stage has ~31% draw rate
  const drawBase = Math.max(0.26, 0.34 - Math.abs(sigmoidDiff) * 0.12);

  const squadShift = comparison.squadAdvantage * 0.015;

  const home = Math.max(0.08, Math.min(0.60, homeBase + squadShift));
  const away = Math.max(0.08, Math.min(0.60, awayBase - squadShift));
  const draw = Math.max(0.22, Math.min(0.42, drawBase));

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

function estimateGoalExpectation(team: Team, opponent: Team, isHome: boolean, formMap?: Map<string, TournamentForm>): number {
  const baseGoals = isHome ? 1.40 : 1.05;
  // 有小组赛真实数据时，下调赛前静态攻防评分的权重（避免与真实进失球双重计权）
  const tf = getForm(formMap, team.id);
  const of = getForm(formMap, opponent.id);
  const hasForm = tf.played > 0 && of.played > 0;
  const staticScale = hasForm ? 0.5 : 1.0;
  const attackBonus = Math.max(0, (team.stats.attackRating - 50) / 100 * 0.6) * staticScale;
  const defenseSuppression = Math.min(0, -(opponent.stats.defenseRating - 50) / 100 * 0.35) * staticScale;
  const rankDiff = opponent.fifaRank - team.fifaRank;
  const rankBonus = Math.max(-0.2, Math.min(0.4, rankDiff / 100 * 0.4));
  const formBonus = Math.max(0, (team.stats.recentForm - 50) / 100 * 0.25);
  const squadImpact = getKeyPlayersImpact(team);
  const squadBonus = (squadImpact - 0.85) * 0.3;

  let goals = baseGoals + attackBonus + defenseSuppression + rankBonus + formBonus + squadBonus;
  // 真实进/失球能力乘性修正：进球期望 ∝ 本队进攻强度 × 对手防守脆弱度（中性=1，不变）
  if (hasForm) {
    const formFactor = Math.max(0.5, Math.min(2.0, tf.attackStrength * of.defenseVulnerability));
    goals *= formFactor;
  }
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

export function predictWithEngineB(match: Match, formMap?: Map<string, TournamentForm>): Prediction {
  const homeTeam = match.homeTeam;
  const awayTeam = match.awayTeam;

  const comparison = compareTeams(homeTeam, awayTeam, formMap);
  const hostAdvantage = calculateHostAdvantage(homeTeam, awayTeam);
  const knockoutDrawFactor = calculateKnockoutDrawFactor(match.stage);

  // Get probabilities from odds and strength
  const oddsProbs = match.odds.length > 0 ? calculateWeightedProbabilities(match.odds) : null;
  const strengthProb = calculateStrengthBasedProbabilities(comparison);

  // Weight allocation — odds-primary with strength augmentation
  const hasOdds = oddsProbs !== null;
  const oddsWeight = hasOdds ? 0.55 : 0;
  const strengthWeight = hasOdds ? 0.30 : 0.85;
  // When no odds, give draw less weight since strength model overestimates draws
  const drawStrengthMultiplier = hasOdds ? 1.1 : 0.8;
  const formShift = comparison.formAdvantage / 100 * 0.10;
  const squadShift = comparison.squadAdvantage * 0.06;
  const travelShift = (comparison.travelAdvantage - 0) * 0.15;

  // Base probabilities — draw from odds is NOT discounted
  let homeProb = (hasOdds ? oddsProbs.home * oddsWeight : 0) + strengthProb.home * strengthWeight;
  let awayProb = (hasOdds ? oddsProbs.away * oddsWeight : 0) + strengthProb.away * strengthWeight;
  let drawProb = (hasOdds ? oddsProbs.draw * oddsWeight : 0) + strengthProb.draw * (strengthWeight * drawStrengthMultiplier);

  // Adjustments — split between home/away, don't touch draw
  homeProb += formShift + squadShift + travelShift;
  awayProb -= formShift + squadShift + travelShift;

  // Host advantage — boosts home, reduces away, minimal draw impact
  if (hostAdvantage > 0) {
    homeProb += hostAdvantage * 0.5;
    awayProb -= hostAdvantage * 0.5;
  } else if (hostAdvantage < 0) {
    awayProb += Math.abs(hostAdvantage) * 0.5;
    homeProb -= Math.abs(hostAdvantage) * 0.5;
  }

  // Knockout adjustment
  drawProb *= knockoutDrawFactor;

  // Normalize
  homeProb = Math.max(0.03, homeProb);
  awayProb = Math.max(0.03, awayProb);
  drawProb = Math.max(0.03, drawProb);

  const total = homeProb + drawProb + awayProb;
  const probabilities = {
    home: homeProb / total,
    draw: drawProb / total,
    away: awayProb / total,
  };

  // Determine prediction — draw-aware with lower threshold
  const diff = Math.abs(probabilities.home - probabilities.away);
  let predictedOutcome: MatchResult;
  if (probabilities.draw >= 0.24 && diff <= 0.20) {
    predictedOutcome = 'draw';
  } else if (probabilities.draw >= probabilities.home && probabilities.draw >= probabilities.away) {
    predictedOutcome = 'draw';
  } else if (probabilities.home >= probabilities.away) {
    predictedOutcome = 'home';
  } else {
    predictedOutcome = 'away';
  }

  // Expected goals
  const homeGoals = estimateGoalExpectation(homeTeam, awayTeam, true, formMap);
  const awayGoals = estimateGoalExpectation(awayTeam, homeTeam, false, formMap);
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
    // Mark the highest-probability score as most likely (index 0 after sort)
    scorePredictions[0].isMostLikely = true;
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

  if (comparison.hasTournamentForm) {
    const hf = getForm(formMap, homeTeam.id);
    const af = getForm(formMap, awayTeam.id);
    reasoning.push(`${homeTeam.nameCn}小组赛${hf.won}胜${hf.drawn}平${hf.lost}负 进${hf.goalsFor}失${hf.goalsAgainst}`);
    reasoning.push(`${awayTeam.nameCn}小组赛${af.won}胜${af.drawn}平${af.lost}负 进${af.goalsFor}失${af.goalsAgainst}`);
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
