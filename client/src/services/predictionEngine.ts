import type { Match, Prediction, MatchResult } from '../types';

export class PredictionEngine {
  static predict(match: Match): Prediction {
    const probabilities = this.calculateProbabilities(match);
    const predictedOutcome = this.selectOutcome(probabilities);
    const confidence = this.calculateConfidence(probabilities);
    const reasoning = this.generateReasoning(probabilities, match, predictedOutcome);
    const scorePredictions = this.calculateScorePredictions(probabilities, match);
    const expectedGoals = this.calculateExpectedGoals(probabilities, match);

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

  private static calculateProbabilities(match: Match): { home: number; draw: number; away: number } {
    // Use odds if available
    if (match.odds.length > 0) {
      const mainOdds = match.odds[0];
      const homeProb = 1 / mainOdds.home;
      const drawProb = 1 / mainOdds.draw;
      const awayProb = 1 / mainOdds.away;
      const total = homeProb + drawProb + awayProb;
      return {
        home: homeProb / total,
        draw: drawProb / total,
        away: awayProb / total,
      };
    }

    // Fallback to team strength
    const homeStrength = this.calculateTeamStrength(match.homeTeam);
    const awayStrength = this.calculateTeamStrength(match.awayTeam);
    const diff = homeStrength - awayStrength;

    const homeBase = 0.38 + diff * 0.3;
    const awayBase = 0.38 - diff * 0.3;
    const drawBase = 0.24;

    const total = homeBase + drawBase + awayBase;
    return {
      home: homeBase / total,
      draw: drawBase / total,
      away: awayBase / total,
    };
  }

  private static calculateTeamStrength(team: any): number {
    const rankFactor = (100 - team.fifaRank) / 100;
    const attackFactor = team.stats.attackRating / 100;
    const defenseFactor = team.stats.defenseRating / 100;
    const formFactor = team.stats.recentForm / 100;

    return (rankFactor * 0.3 + attackFactor * 0.3 + defenseFactor * 0.2 + formFactor * 0.2);
  }

  private static selectOutcome(probabilities: { home: number; draw: number; away: number }): MatchResult {
    const { home, draw, away } = probabilities;
    const diff = Math.abs(home - away);

    // Draw window mechanism
    if (draw >= 0.22 && diff <= 0.15) {
      return 'draw';
    }

    if (home >= away && home >= draw) return 'home';
    if (away >= home && away >= draw) return 'away';
    return 'draw';
  }

  private static calculateConfidence(probabilities: { home: number; draw: number; away: number }): number {
    const maxProb = Math.max(probabilities.home, probabilities.draw, probabilities.away);
    const minProb = Math.min(probabilities.home, probabilities.draw, probabilities.away);
    const concentration = (maxProb - minProb) * 100;

    if (concentration > 30) return Math.round(70 + concentration * 0.5);
    if (concentration > 15) return Math.round(50 + concentration * 1.0);
    return Math.round(30 + concentration * 1.5);
  }

  private static generateReasoning(
    probabilities: { home: number; draw: number; away: number },
    match: Match,
    predictedOutcome: MatchResult
  ): string[] {
    const reasons: string[] = [];
    const maxProb = Math.max(probabilities.home, probabilities.draw, probabilities.away);

    if (maxProb > 0.55) {
      reasons.push(`概率优势明显（${(maxProb * 100).toFixed(1)}%），预测可信度高`);
    } else if (maxProb > 0.40) {
      reasons.push(`概率相对领先（${(maxProb * 100).toFixed(1)}%），预测可信度中等`);
    } else {
      reasons.push(`双方实力接近（${(maxProb * 100).toFixed(1)}%），比赛结果不确定性较高`);
    }

    // Team strength reasoning
    const rankDiff = match.awayTeam.fifaRank - match.homeTeam.fifaRank;
    if (Math.abs(rankDiff) > 20) {
      const strongerTeam = rankDiff > 0 ? match.homeTeam : match.awayTeam;
      reasons.push(`${strongerTeam.nameCn}整体实力明显更强`);
    }

    return reasons;
  }

  private static calculateScorePredictions(
    probabilities: { home: number; draw: number; away: number },
    match: Match
  ): Array<{ homeScore: number; awayScore: number; probability: number; isMostLikely: boolean }> {
    const scores: Array<{ homeScore: number; awayScore: number; probability: number; isMostLikely: boolean }> = [];

    // Simple score prediction based on probabilities
    const homeGoals = 1.2 + (probabilities.home - 0.33) * 2;
    const awayGoals = 1.0 + (probabilities.away - 0.33) * 2;

    // Generate top 5 scores
    const possibleScores = [
      { home: Math.round(homeGoals), away: Math.round(awayGoals) },
      { home: Math.round(homeGoals) + 1, away: Math.round(awayGoals) },
      { home: Math.round(homeGoals), away: Math.round(awayGoals) + 1 },
      { home: Math.round(homeGoals) - 1, away: Math.round(awayGoals) },
      { home: Math.round(homeGoals), away: Math.round(awayGoals) - 1 },
    ];

    possibleScores.forEach((score, index) => {
      scores.push({
        homeScore: Math.max(0, score.home),
        awayScore: Math.max(0, score.away),
        probability: Math.round((20 - index * 3) * 10) / 10,
        isMostLikely: index === 0,
      });
    });

    return scores;
  }

  private static calculateExpectedGoals(
    probabilities: { home: number; draw: number; away: number },
    match: Match
  ): { home: number; away: number } {
    const homeGoals = 1.2 + (probabilities.home - 0.33) * 2;
    const awayGoals = 1.0 + (probabilities.away - 0.33) * 2;

    return {
      home: Math.round(Math.max(0.5, Math.min(3.0, homeGoals)) * 100) / 100,
      away: Math.round(Math.max(0.5, Math.min(3.0, awayGoals)) * 100) / 100,
    };
  }
}
