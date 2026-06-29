import { Match, Prediction, Team, ChampionOdds } from '../types/index.js';
import { TEAMS } from '../data/staticData.js';
import { computeTournamentForm, getForm, type TournamentForm } from './tournamentForm.js';

// 小组赛权重：3 场样本，不超过静态 Elo 主信号
const TOURNAMENT_WEIGHT = 0.40;
// 淘汰赛阶段提升 form 权重
const TOURNAMENT_WEIGHT_KO = 0.55;
function tournamentElo(form: TournamentForm): number {
  return 1500 + (form.formRating - 50) * 12;
}

/** 淘汰赛平局衰减系数 */
function knockoutDrawFactor(stage: string): number {
  if (stage === 'group') return 1.0;
  if (stage === 'round_of_32') return 0.93;
  if (stage === 'round_of_16') return 0.90;
  if (stage === 'quarter') return 0.87;
  if (stage === 'semi') return 0.85;
  if (stage === 'final') return 0.82;
  return 1.0;
}

/** 淘汰赛期望进球衰减系数 */
function knockoutGoalsFactor(stage: string): number {
  if (stage === 'group') return 1.0;
  if (stage === 'round_of_32') return 0.95;
  if (stage === 'round_of_16') return 0.93;
  if (stage === 'quarter') return 0.91;
  if (stage === 'semi') return 0.90;
  if (stage === 'final') return 0.90;
  return 1.0;
}

export class PredictionEngine {
  private teamRatings: Map<string, number> = new Map();
  private championOdds: ChampionOdds[] = [];

  constructor() {
    this.initializeRatings();
    this.initializeChampionOdds();
  }

  private initializeRatings(): void {
    // Initialize team ratings based on FIFA rankings
    TEAMS.forEach(team => {
      // Convert FIFA ranking to Elo-like rating
      // Rank 1 ≈ 2000, Rank 50 ≈ 1500, Rank 100 ≈ 1000
      const rating = Math.max(800, 2000 - team.fifaRank * 12);
      this.teamRatings.set(team.id, rating);
    });
  }

  private initializeChampionOdds(): void {
    // Initialize champion odds based on team strength
    const topTeams = TEAMS
      .sort((a, b) => a.fifaRank - b.fifaRank)
      .slice(0, 10);

    this.championOdds = topTeams.map((team, index) => ({
      team: team.id,
      odds: this.calculateChampionOdds(team, index),
      trend: 'stable' as const,
    }));
  }

  private calculateChampionOdds(team: Team, rank: number): number {
    // Simple odds calculation based on FIFA ranking
    const baseOdds = 4.0 + (rank * 2.5);
    return Math.round(baseOdds * 100) / 100;
  }

  predict(match: Match, formMap?: Map<string, TournamentForm>): Prediction {
    const homeTeam = TEAMS.find(t => t.id === match.homeTeam);
    const awayTeam = TEAMS.find(t => t.id === match.awayTeam);

    if (!homeTeam || !awayTeam) {
      return this.createDefaultPrediction(match);
    }

    const homeFifa = this.teamRatings.get(match.homeTeam) || 1500;
    const awayFifa = this.teamRatings.get(match.awayTeam) || 1500;

    // 融入小组赛真实战绩：FIFA Elo 与小组赛表现 Elo 混合
    // 淘汰赛阶段提升 form 权重
    const isKnockout = match.stage !== 'group';
    const tWeight = isKnockout ? TOURNAMENT_WEIGHT_KO : TOURNAMENT_WEIGHT;
    const homeForm = getForm(formMap, match.homeTeam);
    const awayForm = getForm(formMap, match.awayTeam);
    // Momentum 加成：走势向上的球队在淘汰赛获得额外 Elo 提升
    const momentumBonus = (form: TournamentForm) => isKnockout ? form.momentum * 25 : form.momentum * 10;
    const homeRating = homeForm.played > 0
      ? homeFifa * (1 - tWeight) + tournamentElo(homeForm) * tWeight + momentumBonus(homeForm)
      : homeFifa;
    const awayRating = awayForm.played > 0
      ? awayFifa * (1 - tWeight) + tournamentElo(awayForm) * tWeight + momentumBonus(awayForm)
      : awayFifa;

    // Calculate probabilities using Elo-based model
    const probabilities = this.calculateProbabilities(homeRating, awayRating, homeTeam, awayTeam, homeForm, awayForm, match.stage);

    // Calculate expected goals
    const expectedGoals = this.calculateExpectedGoals(homeRating, awayRating, homeTeam, awayTeam, homeForm, awayForm, match.stage);

    // Calculate score predictions
    const scorePredictions = this.calculateScorePredictions(expectedGoals);

    // Determine predicted outcome
    const predictedOutcome = this.determineOutcome(probabilities);

    // Calculate confidence
    const confidence = this.calculateConfidence(probabilities);

    // Generate reasoning
    let reasoning = this.generateReasoning(probabilities, homeTeam, awayTeam, predictedOutcome);
    if (homeForm.played > 0) {
      reasoning = [...reasoning, `${homeTeam.nameCn}小组赛${homeForm.won}胜${homeForm.drawn}平${homeForm.lost}负 进${homeForm.goalsFor}失${homeForm.goalsAgainst}`];
    }
    if (awayForm.played > 0) {
      reasoning = [...reasoning, `${awayTeam.nameCn}小组赛${awayForm.won}胜${awayForm.drawn}平${awayForm.lost}负 进${awayForm.goalsFor}失${awayForm.goalsAgainst}`];
    }
    if (isKnockout) {
      reasoning = [...reasoning, '淘汰赛阶段：进球率更低、平局概率下调'];
      if (homeForm.momentum > 0.3 || awayForm.momentum > 0.3) {
        const rising = homeForm.momentum > awayForm.momentum ? homeTeam.nameCn : awayTeam.nameCn;
        reasoning = [...reasoning, `${rising}小组赛走势上扬，淘汰赛表现可期`];
      }
    }

    return {
      matchId: match.id,
      predictedOutcome,
      confidence,
      probabilities,
      scorePredictions,
      expectedGoals,
      reasoning,
      timestamp: new Date().toISOString(),
    };
  }

  private calculateProbabilities(
    homeRating: number,
    awayRating: number,
    homeTeam: Team,
    awayTeam: Team,
    homeForm: TournamentForm,
    awayForm: TournamentForm,
    stage: string = 'group'
  ): { home: number; draw: number; away: number } {
    // Elo-based probability calculation
    const eloDiff = homeRating - awayRating + 100; // Home advantage
    const expectedHome = 1 / (1 + Math.pow(10, -eloDiff / 400));

    // Adjust for team form and other factors
    const formAdjustment = this.getFormAdjustment(homeTeam, awayTeam);
    const hostAdvantage = this.getHostAdvantage(homeTeam, awayTeam);

    let homeProb = expectedHome + formAdjustment + hostAdvantage;
    let awayProb = 1 - expectedHome - formAdjustment - hostAdvantage;

    // 小组赛真实表现微调（进攻/防守/综合 form 差）。系数较小且整体限幅，避免概率越界
    if (homeForm.played > 0 && awayForm.played > 0) {
      const tNudge = Math.max(-0.10, Math.min(0.10,
        ((homeForm.formRating - awayForm.formRating) / 100) * 0.05 +
        (homeForm.attackStrength - awayForm.attackStrength) * 0.025 +
        (awayForm.defenseVulnerability - homeForm.defenseVulnerability) * 0.025,
      ));
      homeProb += tNudge;
      awayProb -= tNudge;
    }

    // Draw probability based on rating difference
    const drawBase = 0.28;
    const drawAdjustment = Math.abs(eloDiff) < 200 ? 0.05 : -0.05;
    let drawProb = drawBase + drawAdjustment;

    // 淘汰赛平局概率衰减
    drawProb *= knockoutDrawFactor(stage);

    // Clamp to non-negative before normalize (form nudge / host advantage can overshoot)
    homeProb = Math.max(0, homeProb);
    awayProb = Math.max(0, awayProb);

    // Normalize
    const total = homeProb + drawProb + awayProb;
    homeProb /= total;
    drawProb /= total;
    awayProb /= total;

    return {
      home: Math.round(homeProb * 1000) / 1000,
      draw: Math.round(drawProb * 1000) / 1000,
      away: Math.round(awayProb * 1000) / 1000,
    };
  }

  private getFormAdjustment(homeTeam: Team, awayTeam: Team): number {
    // Simple form adjustment based on recent performance
    // In a real implementation, this would use recent match results
    return 0;
  }

  private getHostAdvantage(homeTeam: Team, awayTeam: Team): number {
    // Check if team is host nation
    const hostTeams = ['mex', 'usa', 'can'];
    if (hostTeams.includes(homeTeam.id)) return 0.05;
    if (hostTeams.includes(awayTeam.id)) return -0.05;
    return 0;
  }

  private calculateExpectedGoals(
    homeRating: number,
    awayRating: number,
    homeTeam: Team,
    awayTeam: Team,
    homeForm: TournamentForm,
    awayForm: TournamentForm,
    stage: string = 'group'
  ): { home: number; away: number } {
    // Base expected goals
    const baseHome = 1.4;
    const baseAway = 1.1;

    // Rating adjustment
    const ratingDiff = (homeRating - awayRating) / 400;
    const homeAdj = ratingDiff * 0.3;
    const awayAdj = -ratingDiff * 0.3;

    // Team strength adjustment
    const homeStrength = (homeTeam.stats.attackRating + (100 - homeTeam.stats.defenseRating)) / 200;
    const awayStrength = (awayTeam.stats.attackRating + (100 - awayTeam.stats.defenseRating)) / 200;

    let homeGoals = Math.max(0.5, Math.min(3.0, baseHome + homeAdj + (homeStrength - 0.5) * 0.5));
    let awayGoals = Math.max(0.5, Math.min(3.0, baseAway + awayAdj + (awayStrength - 0.5) * 0.5));

    // 真实进/失球能力乘性修正（中性 form=1 不变）
    if (homeForm.played > 0 && awayForm.played > 0) {
      const homeFactor = Math.max(0.5, Math.min(2.0, homeForm.attackStrength * awayForm.defenseVulnerability));
      const awayFactor = Math.max(0.5, Math.min(2.0, awayForm.attackStrength * homeForm.defenseVulnerability));
      homeGoals = Math.max(0.5, Math.min(3.0, homeGoals * homeFactor));
      awayGoals = Math.max(0.5, Math.min(3.0, awayGoals * awayFactor));
    }

    // 淘汰赛保守化：降低期望进球
    const koFactor = knockoutGoalsFactor(stage);
    homeGoals *= koFactor;
    awayGoals *= koFactor;

    return {
      home: Math.round(homeGoals * 100) / 100,
      away: Math.round(awayGoals * 100) / 100,
    };
  }

  private calculateScorePredictions(
    expectedGoals: { home: number; away: number }
  ): Array<{ homeScore: number; awayScore: number; probability: number; isMostLikely: boolean }> {
    const scores: Array<{ homeScore: number; awayScore: number; probability: number; isMostLikely: boolean }> = [];

    // Calculate probabilities for scores 0-5
    for (let home = 0; home <= 5; home++) {
      for (let away = 0; away <= 5; away++) {
        const homeProb = this.poissonProbability(expectedGoals.home, home);
        const awayProb = this.poissonProbability(expectedGoals.away, away);
        const probability = homeProb * awayProb;

        scores.push({
          homeScore: home,
          awayScore: away,
          probability: Math.round(probability * 1000) / 10,
          isMostLikely: false,
        });
      }
    }

    // Sort by probability and mark most likely
    scores.sort((a, b) => b.probability - a.probability);
    if (scores.length > 0) {
      scores[0].isMostLikely = true;
    }

    // Return top 5
    return scores.slice(0, 5);
  }

  private poissonProbability(lambda: number, k: number): number {
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / this.factorial(k);
  }

  private factorial(n: number): number {
    if (n <= 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
  }

  private determineOutcome(
    probabilities: { home: number; draw: number; away: number }
  ): 'home' | 'draw' | 'away' {
    if (probabilities.home > probabilities.draw && probabilities.home > probabilities.away) {
      return 'home';
    } else if (probabilities.away > probabilities.draw && probabilities.away > probabilities.home) {
      return 'away';
    } else {
      return 'draw';
    }
  }

  private calculateConfidence(probabilities: { home: number; draw: number; away: number }): number {
    const maxProb = Math.max(probabilities.home, probabilities.draw, probabilities.away);
    const minProb = Math.min(probabilities.home, probabilities.draw, probabilities.away);
    const concentration = (maxProb - minProb) * 100;

    // Confidence based on probability concentration
    if (concentration > 30) return Math.round(70 + concentration * 0.5);
    if (concentration > 15) return Math.round(50 + concentration * 1.0);
    return Math.round(30 + concentration * 1.5);
  }

  private generateReasoning(
    probabilities: { home: number; draw: number; away: number },
    homeTeam: Team,
    awayTeam: Team,
    predictedOutcome: 'home' | 'draw' | 'away'
  ): string[] {
    const reasons: string[] = [];
    const maxProb = Math.max(probabilities.home, probabilities.draw, probabilities.away);

    // Probability-based reasoning
    if (maxProb > 0.55) {
      reasons.push(`概率优势明显（${(maxProb * 100).toFixed(1)}%），预测可信度高`);
    } else if (maxProb > 0.40) {
      reasons.push(`概率相对领先（${(maxProb * 100).toFixed(1)}%），预测可信度中等`);
    } else {
      reasons.push(`双方实力接近（${(maxProb * 100).toFixed(1)}%），比赛结果不确定性较高`);
    }

    // Team strength reasoning
    const rankDiff = awayTeam.fifaRank - homeTeam.fifaRank;
    if (Math.abs(rankDiff) > 20) {
      const strongerTeam = rankDiff > 0 ? homeTeam : awayTeam;
      reasons.push(`${strongerTeam.nameCn}整体实力明显更强`);
    }

    // Host advantage reasoning
    const hostTeams = ['mex', 'usa', 'can'];
    if (hostTeams.includes(homeTeam.id)) {
      reasons.push(`${homeTeam.nameCn}作为东道主享有主场优势`);
    } else if (hostTeams.includes(awayTeam.id)) {
      reasons.push(`${awayTeam.nameCn}作为东道主享有主场优势`);
    }

    return reasons;
  }

  private createDefaultPrediction(match: Match): Prediction {
    return {
      matchId: match.id,
      predictedOutcome: 'draw',
      confidence: 33,
      probabilities: { home: 0.33, draw: 0.34, away: 0.33 },
      scorePredictions: [
        { homeScore: 1, awayScore: 1, probability: 12.0, isMostLikely: true },
        { homeScore: 1, awayScore: 0, probability: 10.0, isMostLikely: false },
        { homeScore: 0, awayScore: 1, probability: 10.0, isMostLikely: false },
        { homeScore: 2, awayScore: 1, probability: 8.0, isMostLikely: false },
        { homeScore: 1, awayScore: 2, probability: 8.0, isMostLikely: false },
      ],
      expectedGoals: { home: 1.2, away: 1.1 },
      reasoning: ['数据不足，使用默认预测模型'],
      timestamp: new Date().toISOString(),
    };
  }

  predictBatch(matches: Match[]): Prediction[] {
    const formMap = computeTournamentForm(matches);
    return matches.map(match => this.predict(match, formMap));
  }

  getChampionOdds(): ChampionOdds[] {
    return this.championOdds;
  }

  getTeamRatings(): Map<string, number> {
    return this.teamRatings;
  }

  updateTeamRating(teamId: string, newRating: number): void {
    this.teamRatings.set(teamId, newRating);
  }
}
