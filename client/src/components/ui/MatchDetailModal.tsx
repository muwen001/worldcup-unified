import React from 'react';
import type { Match, MatchResult, Prediction, DualPrediction } from '../../types';
import { formatOdds, getResultName } from '../../utils/oddsCalculator';
import { TrendingUp, Target, BarChart3, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Modal } from './Modal';

interface MatchDetailModalProps {
  match: Match;
  prediction?: DualPrediction;
  isOpen: boolean;
  onClose: () => void;
}

const getResultLabel = (result: MatchResult): string => {
  const labels: Record<string, string> = { home: '主胜', draw: '平局', away: '客胜' };
  return labels[result];
};

const getResultColor = (result: MatchResult) => {
  if (result === 'home') return 'bg-success/20 text-success';
  if (result === 'draw') return 'bg-warning/20 text-warning';
  return 'bg-danger/20 text-danger';
};

const getConfidenceColor = (confidence: number) => {
  if (confidence >= 70) return 'text-success';
  if (confidence >= 50) return 'text-warning';
  return 'text-gray-500';
};

const getStageName = (stage: string): string => {
  const names: Record<string, string> = {
    group: '小组赛',
    round_of_32: '1/32决赛',
    round_of_16: '1/16决赛',
    quarter: '1/4决赛',
    semi: '半决赛',
    final: '决赛',
  };
  return names[stage] || stage;
};

// Single engine prediction section
const EnginePredictionSection: React.FC<{
  engineLabel: string;
  engineName: string;
  engineColor: string;
  pred: Prediction;
  match: Match;
}> = ({ engineLabel, engineName, engineColor, pred, match }) => {
  const isFinished = match.status === 'completed';
  const isOutcomeCorrect = isFinished && match.result === pred.predictedOutcome;
  const isScoreCorrect = isFinished && match.score && pred.scorePredictions.length > 0
    && pred.scorePredictions[0].homeScore === match.score.home
    && pred.scorePredictions[0].awayScore === match.score.away;

  const bgColor = engineColor === 'blue' ? 'bg-blue-50' : 'bg-amber-50';
  const borderColor = engineColor === 'blue' ? 'border-blue-200' : 'border-amber-200';
  const textColor = engineColor === 'blue' ? 'text-blue-700' : 'text-amber-700';
  const badgeBg = engineColor === 'blue' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600';

  return (
    <div className={`${bgColor} rounded-xl p-5 border ${borderColor}`}>
      {/* Engine header */}
      <div className="flex items-center gap-2 mb-4">
        <span className={`text-sm font-bold ${badgeBg} px-2 py-0.5 rounded`}>{engineLabel}</span>
        <span className={`font-bold ${textColor}`}>{engineName}</span>
      </div>

      {/* Predicted outcome */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-sm text-gray-500">预测结果</span>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${getResultColor(pred.predictedOutcome)}`}>
              {getResultName(pred.predictedOutcome)}
            </span>
            {pred.scorePredictions.length > 0 && (
              <span className="text-lg font-bold text-gray-700">
                {pred.scorePredictions[0].homeScore}:{pred.scorePredictions[0].awayScore}
              </span>
            )}
            {isFinished && (
              isOutcomeCorrect
                ? <CheckCircle className="w-5 h-5 text-success" />
                : <XCircle className="w-5 h-5 text-danger" />
            )}
          </div>
        </div>
        <div className="text-right">
          <span className="text-sm text-gray-500">置信度</span>
          <div className={`text-2xl font-bold ${getConfidenceColor(pred.confidence)}`}>
            {pred.confidence}%
          </div>
        </div>
      </div>

      {/* Probability bars */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2">
          <span className="w-10 text-xs text-gray-500">主胜</span>
          <div className="flex-1 h-3 bg-white rounded-full overflow-hidden">
            <div className="h-full bg-success rounded-full" style={{ width: `${pred.probabilities.home * 100}%` }} />
          </div>
          <span className="w-12 text-right text-xs font-medium">{(pred.probabilities.home * 100).toFixed(1)}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-10 text-xs text-gray-500">平局</span>
          <div className="flex-1 h-3 bg-white rounded-full overflow-hidden">
            <div className="h-full bg-warning rounded-full" style={{ width: `${pred.probabilities.draw * 100}%` }} />
          </div>
          <span className="w-12 text-right text-xs font-medium">{(pred.probabilities.draw * 100).toFixed(1)}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-10 text-xs text-gray-500">客胜</span>
          <div className="flex-1 h-3 bg-white rounded-full overflow-hidden">
            <div className="h-full bg-danger rounded-full" style={{ width: `${pred.probabilities.away * 100}%` }} />
          </div>
          <span className="w-12 text-right text-xs font-medium">{(pred.probabilities.away * 100).toFixed(1)}%</span>
        </div>
      </div>

      {/* Score predictions */}
      {pred.scorePredictions.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-gray-500 mb-2">比分预测 (预期进球: {pred.expectedGoals.home} : {pred.expectedGoals.away})</div>
          <div className="grid grid-cols-5 gap-2">
            {pred.scorePredictions.map((score, idx) => (
              <div
                key={idx}
                className={`text-center p-2 rounded-lg border ${
                  score.isMostLikely ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white'
                }`}
              >
                <div className={`text-sm font-bold ${score.isMostLikely ? 'text-primary' : 'text-gray-700'}`}>
                  {score.homeScore}:{score.awayScore}
                </div>
                <div className="text-xs text-gray-400">{score.probability.toFixed(1)}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reasoning */}
      {pred.reasoning.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 mb-1">预测理由：</div>
          {pred.reasoning.map((reason, idx) => (
            <div key={idx} className="text-xs text-gray-600 flex items-start gap-1 mb-1">
              <span className="text-success">✓</span>
              <span>{reason}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const MatchDetailModal: React.FC<MatchDetailModalProps> = ({ match, prediction, isOpen, onClose }) => {
  const isFinished = match.status === 'completed';
  const isLive = match.status === 'live';

  const actualScoreText = match.score ? `${match.score.home}:${match.score.away}` : '-';

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {/* Match basic info */}
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="text-sm text-gray-500">
            {match.stage === 'group' ? `${match.group}组 · ${getStageName(match.stage)}` : getStageName(match.stage)}
          </span>
          <span className="text-gray-300">|</span>
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-sm text-gray-600">{match.time}</span>
          </div>
          {isLive && (
            <span className="bg-danger text-white text-xs px-2 py-0.5 rounded-full font-bold animate-pulse">LIVE</span>
          )}
          {isFinished && (
            <span className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full font-medium">已结束</span>
          )}
        </div>

        <div className="flex items-center justify-between px-4">
          <div className="flex-1 text-center">
            <div className="text-4xl mb-2">{match.homeTeam.flag}</div>
            <div className="font-bold text-lg">{match.homeTeam.nameCn}</div>
            <div className="text-xs text-gray-400">FIFA #{match.homeTeam.fifaRank}</div>
          </div>
          <div className="px-6">
            <div className="text-4xl font-bold text-primary tracking-wider">{actualScoreText}</div>
            {isFinished && match.result && (
              <div className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${getResultColor(match.result)}`}>
                {getResultLabel(match.result)}
              </div>
            )}
          </div>
          <div className="flex-1 text-center">
            <div className="text-4xl mb-2">{match.awayTeam.flag}</div>
            <div className="font-bold text-lg">{match.awayTeam.nameCn}</div>
            <div className="text-xs text-gray-400">FIFA #{match.awayTeam.fifaRank}</div>
          </div>
        </div>
      </div>

      {/* Dual Predictions */}
      {prediction && (
        <div className="space-y-4 mb-6">
          <h3 className="font-bold flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            双引擎预测对比
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EnginePredictionSection
              engineLabel="A"
              engineName="Elo + Dixon-Coles"
              engineColor="blue"
              pred={prediction.engineA}
              match={match}
            />
            <EnginePredictionSection
              engineLabel="B"
              engineName="赔率 + 球队实力"
              engineColor="amber"
              pred={prediction.engineB}
              match={match}
            />
          </div>
        </div>
      )}

      {/* Odds comparison */}
      {match.odds.length > 0 && (
        <div>
          <h3 className="font-bold mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            主流博彩公司赔率
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="text-left py-2 px-3">博彩公司</th>
                  <th className="text-center py-2 px-3">{match.homeTeam.nameCn} 胜</th>
                  <th className="text-center py-2 px-3">平局</th>
                  <th className="text-center py-2 px-3">{match.awayTeam.nameCn} 胜</th>
                </tr>
              </thead>
              <tbody>
                {match.odds.map((odds, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium">{odds.sourceName}</td>
                    <td className="text-center py-2 px-3">{formatOdds(odds.homeWin)}</td>
                    <td className="text-center py-2 px-3">{formatOdds(odds.draw)}</td>
                    <td className="text-center py-2 px-3">{formatOdds(odds.awayWin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
};
