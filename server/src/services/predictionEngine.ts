import { Match, Prediction, Team, ChampionOdds } from '../types/index.js';
import { TEAMS } from '../data/staticData.js';
import { computeTournamentForm, getForm, type TournamentForm } from './tournamentForm.js';

// 小组赛权重：3 场样本，不超过静态 Elo 主信号
const TOURNAMENT_WEIGHT = 0.40;
function tournamentElo(form: TournamentForm): number {
  return 1500 + (form.formRating - 50) * 12;
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
    const homeForm = getForm(formMap, match.homeTeam);
    const awayForm = getForm(formMap, match.awayTeam);
    const homeRating = homeForm.played > 0
      ? homeFifa * (1 - TOURNAMENT_WEIGHT) + tournamentElo(homeForm) * TOURNAMENT_WEIGHT
      : homeFifa;
    const awayRating = awayForm.played > 0
      ? awayFifa * (1 - TOURNAMENT_WEIGHT) + tournamentElo(awayForm) * TOURNAMENT_WEIGHT
      : awayFifa;

    // Calculate probabilities using Elo-based model
    const probabilities = this.calculateProbabilities(homeRating, awayRating, homeTeam, awayTeam, homeForm, awayForm);

    // Knockout matches always produce a winner (extra time / penalties):
    // drop the draw probability and redistribute it onto home/away so the
    // outcome is never 'draw'.
    const knockout = match.stage !== 'group';
    if (knockout) {
      const draw = probabilities.draw;
      probabilities.draw = 0;
      const other = probabilities.home + probabilities.away;
      if (other > 0) {
        probabilities.home += draw * (probabilities.home / other);
        probabilities.away += draw * (probabilities.away / other);
      } else {
        probabilities.home += draw / 2;
        probabilities.away += draw / 2;
      }
    }

    // Calculate expected goals
    const expectedGoals = this.calculateExpectedGoals(homeRating, awayRating, homeTeam, awayTeam, homeForm, awayForm);

    // Calculate score predictions
    const scorePredictions = this.calculateScorePredictions(expectedGoals);

    // Determine predicted outcome
    const predictedOutcome = this.determineOutcome(probabilities);

    // Calculate confidence
    const confidence = this.calculateConfidence(probabilities);

    // Generate reasoning
    let reasoning = this.generateReasoning(probabilities, homeTeam, awayTeam, predictedOutcome);
    if (knockout) {
      reasoning = [...reasoning, '淘汰赛不产生平局，平局概率折算为胜负'];
    }
    if (homeForm.played > 0) {
      reasoning = [...reasoning, `${homeTeam.nameCn}小组赛${homeForm.won}胜${homeForm.drawn}平${homeForm.lost}负 进${homeForm.goalsFor}失${homeForm.goalsAgainst}`];
    }
    if (awayForm.played > 0) {
      reasoning = [...reasoning, `${awayTeam.nameCn}小组赛${awayForm.won}胜${awayForm.drawn}平${awayForm.lost}负 进${awayForm.goalsFor}失${awayForm.goalsAgainst}`];
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
    awayForm: TournamentForm
  ): { home: number; draw: number; away: number } {
    // Elo-based probability calculation
    const eloDiff = homeRating - awayRating + 100; // Home advantage
    const expectedHome = 1 / (1 + Math.pow(10, -eloDiff / 400));

    // Adjust for team form and other factors
    const formAdjustment = this.getFormAdjustment(homeTeam, awayTeam);
    const hostAdvantage = this.getHostAdvantage(homeTeam, awayTeam);

    let homeProb = expectedHome + formAdjustment + hostAdvantage;
    let awayProb = 1 - expectedHome - formAdjustment - hostAdvantage;

    // 小组赛真实表现微调（进攻/防守/综合 form 差）
    if (homeForm.played > 0 && awayForm.played > 0) {
      const tNudge =
        ((homeForm.formRating - awayForm.formRating) / 100) * 0.10 +
        (homeForm.attackStrength - awayForm.attackStrength) * 0.06 +
        (awayForm.defenseVulnerability - homeForm.defenseVulnerability) * 0.06;
      homeProb += tNudge;
      awayProb -= tNudge;
    }

    // Draw probability based on rating difference
    const drawBase = 0.28;
    const drawAdjustment = Math.abs(eloDiff) < 200 ? 0.05 : -0.05;
    let drawProb = drawBase + drawAdjustment;

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
    awayForm: TournamentForm
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
