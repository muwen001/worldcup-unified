/**
 * 引擎A: Elo + Dixon-Coles 预测模型
 * 来源: world-cup-guest
 * 特点: 基于Elo评分系统 + Dixon-Coles双变量泊松分布
 *       使用H2H历史记录、主客场优势、球队近期状态
 */
import type { Match, Prediction, MatchResult, ScorePrediction, Team } from '../types';

// ── Elo Rating System ──────────────────────────────────────────

const MODEL_PARAMS = {
  eloK: 40,
  eloKKnockout: 60,
  eloHomeAdvantage: 20,
  h2hWeight: 0.15,
  eloScale: 400,
  avgGoals: 1.35,
  rho: -0.13,
  eloWeight: 0.40,
  oddsWeight: 0.60,
  formWeight: 0.12,
  drawDiffThresh: 0.12,
  drawProbThresh: 0.32,
  formMatches: 5,
  formDecay: 0.85,
};

function getInitialRating(team: Team): number {
  return Math.max(800, 2100 - (team.fifaRank - 1) * 10);
}

function eloToExpectedGoals(homeElo: number, awayElo: number, homeTeam: Team, awayTeam: Team): { homeLambda: number; awayLambda: number } {
  const { eloHomeAdvantage, eloScale, avgGoals, formWeight } = MODEL_PARAMS;

  let eloDiff = homeElo - awayElo + eloHomeAdvantage;

  // Host nation bonus
  const hostTeams = ['mex', 'usa', 'can'];
  if (hostTeams.includes(homeTeam.id)) eloDiff += 10;
  if (hostTeams.includes(awayTeam.id)) eloDiff -= 10;

  const ratio = Math.exp(eloDiff / eloScale);
  let homeLambda = avgGoals * Math.sqrt(ratio);
  let awayLambda = avgGoals / Math.sqrt(ratio);

  // Form factor
  const homeForm = homeTeam.stats.recentForm;
  const awayForm = awayTeam.stats.recentForm;
  const formDiff = (homeForm - awayForm) / 100;
  homeLambda *= (1 + formWeight * formDiff);
  awayLambda *= (1 - formWeight * formDiff);

  // Clamp
  homeLambda = Math.max(0.3, Math.min(4.0, homeLambda));
  awayLambda = Math.max(0.3, Math.min(4.0, awayLambda));

  return { homeLambda, awayLambda };
}

function eloToOutcomeProb(homeElo: number, awayElo: number): { home: number; draw: number; away: number } {
  const { eloHomeAdvantage, eloScale } = MODEL_PARAMS;
  const eloDiff = homeElo - awayElo + eloHomeAdvantage;

  const expectedHome = 1 / (1 + Math.pow(10, -eloDiff / eloScale));

  const eloAbsDiff = Math.abs(eloDiff);
  const drawBase = 0.32;
  const drawBoost = Math.max(0, 0.18 - eloAbsDiff / 1500);
  let pDraw = Math.min(0.42, drawBase + drawBoost);

  const remaining = 1 - pDraw;
  const pHome = remaining * expectedHome;
  const pAway = remaining * (1 - expectedHome);

  return { home: pHome, draw: pDraw, away: pAway };
}

// ── Dixon-Coles Bivariate Poisson ──────────────────────────────

function getPoissonProbability(lambda: number, k: number): number {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

function buildDixonColesMatrix(homeLambda: number, awayLambda: number) {
  const RHO = MODEL_PARAMS.rho;
  const matrix = [];
  let pHomeWin = 0, pDraw = 0, pAwayWin = 0;
  let bestScore = { home: 0, away: 0 };
  let maxP = -1;

  for (let i = 0; i <= 6; i++) {
    for (let j = 0; j <= 6; j++) {
      let p = getPoissonProbability(homeLambda, i) * getPoissonProbability(awayLambda, j);

      if (i === 0 && j === 0) p *= (1 - homeLambda * awayLambda * RHO);
      else if (i === 0 && j === 1) p *= (1 + homeLambda * RHO);
      else if (i === 1 && j === 0) p *= (1 + awayLambda * RHO);
      else if (i === 1 && j === 1) p *= (1 - RHO);

      p = Math.max(0, p);
      matrix.push({ home: i, away: j, p });

      if (i > j) pHomeWin += p;
      else if (i < j) pAwayWin += p;
      else pDraw += p;

      if (p > maxP) {
        maxP = p;
        bestScore = { home: i, away: j };
      }
    }
  }

  const total = pHomeWin + pDraw + pAwayWin;
  const composite = total > 0 ? {
    home: pHomeWin / total,
    draw: pDraw / total,
    away: pAwayWin / total,
  } : { home: 0.33, draw: 0.34, away: 0.33 };

  return { matrix, composite, bestScore };
}

// ── Main Prediction ────────────────────────────────────────────

export function predictWithEngineA(match: Match): Prediction {
  const homeTeam = match.homeTeam;
  const awayTeam = match.awayTeam;

  const homeElo = getInitialRating(homeTeam);
  const awayElo = getInitialRating(awayTeam);

  // Elo-based expected goals
  const { homeLambda, awayLambda } = eloToExpectedGoals(homeElo, awayElo, homeTeam, awayTeam);

  // Dixon-Coles matrix
  const { composite: dcComposite, bestScore } = buildDixonColesMatrix(homeLambda, awayLambda);

  // Elo-based outcome probabilities
  const eloProb = eloToOutcomeProb(homeElo, awayElo);

  // Blend with odds if available
  let prob: { home: number; draw: number; away: number };
  let method: string;

  const mainOdds = match.odds[0];
  if (mainOdds && typeof mainOdds.homeWin === 'number') {
    const rawHome = 1 / mainOdds.homeWin;
    const rawDraw = 1 / mainOdds.draw;
    const rawAway = 1 / mainOdds.awayWin;
    const overround = rawHome + rawDraw + rawAway;
    const oddsProb = {
      home: rawHome / overround,
      draw: rawDraw / overround,
      away: rawAway / overround,
    };

    const { eloWeight, oddsWeight } = MODEL_PARAMS;
    prob = {
      home: eloProb.home * eloWeight + oddsProb.home * oddsWeight,
      draw: eloProb.draw * eloWeight + oddsProb.draw * oddsWeight,
      away: eloProb.away * eloWeight + oddsProb.away * oddsWeight,
    };
    method = 'elo-odds-blend';
  } else {
    prob = eloProb;
    method = 'elo-only';
  }

  // Blend DC matrix with model probabilities
  const composite = {
    home: dcComposite.home * 0.6 + prob.home * 0.4,
    draw: dcComposite.draw * 0.6 + prob.draw * 0.4,
    away: dcComposite.away * 0.6 + prob.away * 0.4,
  };

  // Normalize
  const total = composite.home + composite.draw + composite.away;
  composite.home /= total;
  composite.draw /= total;
  composite.away /= total;

  // Determine prediction
  const maxProb = Math.max(composite.home, composite.draw, composite.away);
  const diff = Math.abs(composite.home - composite.away);

  let predictedOutcome: MatchResult;
  if (diff < MODEL_PARAMS.drawDiffThresh && composite.draw > MODEL_PARAMS.drawProbThresh) {
    predictedOutcome = 'draw';
  } else if (composite.home > composite.away) {
    predictedOutcome = 'home';
  } else {
    predictedOutcome = 'away';
  }

  // Confidence
  let confidence: number;
  if (maxProb > 0.55 && diff > 0.15) confidence = 85;
  else if (maxProb > 0.40 && diff > 0.08) confidence = 65;
  else confidence = 45;

  // Score predictions - top 5 from DC matrix
  const allScores: ScorePrediction[] = [];
  for (let i = 0; i <= 5; i++) {
    for (let j = 0; j <= 5; j++) {
      let p = getPoissonProbability(homeLambda, i) * getPoissonProbability(awayLambda, j);
      if (i === 0 && j === 0) p *= (1 - homeLambda * awayLambda * MODEL_PARAMS.rho);
      else if (i === 0 && j === 1) p *= (1 + homeLambda * MODEL_PARAMS.rho);
      else if (i === 1 && j === 0) p *= (1 + awayLambda * MODEL_PARAMS.rho);
      else if (i === 1 && j === 1) p *= (1 - MODEL_PARAMS.rho);
      p = Math.max(0, p);
      allScores.push({ homeScore: i, awayScore: j, probability: p, isMostLikely: false });
    }
  }
  allScores.sort((a, b) => b.probability - a.probability);
  const scorePredictions = allScores.slice(0, 5);
  if (scorePredictions.length > 0) {
    scorePredictions[0].isMostLikely = true;
    // Normalize
    const scoreTotal = scorePredictions.reduce((s, sc) => s + sc.probability, 0);
    scorePredictions.forEach(s => s.probability = Math.round((s.probability / scoreTotal) * 1000) / 10);
  }

  // Reasoning
  const reasoning: string[] = [];
  reasoning.push(`引擎A: Elo+Dixon-Coles (${method})`);
  if (maxProb > 0.5) {
    reasoning.push(`概率优势明显（${(maxProb * 100).toFixed(1)}%）`);
  } else if (maxProb > 0.4) {
    reasoning.push(`概率相对领先（${(maxProb * 100).toFixed(1)}%）`);
  } else {
    reasoning.push(`双方实力接近（${(maxProb * 100).toFixed(1)}%）`);
  }

  const rankDiff = awayTeam.fifaRank - homeTeam.fifaRank;
  if (Math.abs(rankDiff) > 20) {
    const stronger = rankDiff > 0 ? homeTeam.nameCn : awayTeam.nameCn;
    reasoning.push(`${stronger}整体实力明显更强`);
  }

  return {
    matchId: match.id,
    predictedOutcome,
    confidence,
    probabilities: composite,
    scorePredictions,
    expectedGoals: { home: homeLambda, away: awayLambda },
    reasoning,
    timestamp: new Date().toISOString(),
  };
}
