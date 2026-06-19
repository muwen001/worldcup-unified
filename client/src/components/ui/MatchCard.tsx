import React, { useState } from 'react';
import type { Match, MatchResult, DualPrediction } from '../../types';
import { formatOdds, getResultName } from '../../utils/oddsCalculator';
import { Clock } from 'lucide-react';
import { MatchDetailModal } from './MatchDetailModal';

interface MatchCardProps {
  match: Match;
  prediction?: DualPrediction;
}

export const MatchCard: React.FC<MatchCardProps> = ({ match, prediction }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const mainOdds = match.odds[0];

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

  const isFinished = match.status === 'completed';
  const isLive = match.status === 'live';

  const actualScoreText = match.score ? `${match.score.home}:${match.score.away}` : '-';

  // 判断预测是否正确
  const isOutcomeCorrect = (predicted: MatchResult): boolean | null => {
    if (!isFinished || !match.result) return null;
    return predicted === match.result;
  };

  const isScoreCorrect = (predHome: number, predAway: number): boolean | null => {
    if (!isFinished || !match.score) return null;
    return predHome === match.score.home && predAway === match.score.away;
  };

  // Engine A prediction
  const predA = prediction?.engineA;
  const predAScore = predA?.scorePredictions?.[0];
  const predAScoreText = predAScore ? `${predAScore.homeScore}:${predAScore.awayScore}` : '';
  const predAOutcomeCorrect = predA ? isOutcomeCorrect(predA.predictedOutcome) : null;
  const predAScoreCorrect = predAScore ? isScoreCorrect(predAScore.homeScore, predAScore.awayScore) : null;

  // Engine B prediction
  const predB = prediction?.engineB;
  const predBScore = predB?.scorePredictions?.[0];
  const predBScoreText = predBScore ? `${predBScore.homeScore}:${predBScore.awayScore}` : '';
  const predBOutcomeCorrect = predB ? isOutcomeCorrect(predB.predictedOutcome) : null;
  const predBScoreCorrect = predBScore ? isScoreCorrect(predBScore.homeScore, predBScore.awayScore) : null;

  // 获取胜平负预测的样式
  const getOutcomeStyle = (isCorrect: boolean | null): string => {
    if (isCorrect === null) return 'bg-gray-100 text-gray-600'; // 未结束
    if (isCorrect) return 'bg-green-500 text-white'; // 正确 - 绿色
    return 'bg-red-500 text-white'; // 错误 - 红色
  };

  // 获取比分预测的样式
  const getScoreStyle = (isCorrect: boolean | null): string => {
    if (isCorrect === null) return 'text-gray-600'; // 未结束
    if (isCorrect) return 'text-green-600 font-bold'; // 正确 - 绿色
    return 'text-red-500 line-through'; // 错误 - 红色+删除线
  };



  // 渲染引擎预测行
  const renderEnginePrediction = (
    engineLabel: string,
    engineName: string,
    bgColor: string,
    predOutcome: MatchResult | undefined,
    predScoreText: string,
    outcomeCorrect: boolean | null,
    scoreCorrect: boolean | null
  ) => {
    if (!predOutcome) return null;

    return (
      <div className={`flex items-center justify-between p-2.5 rounded-lg border ${
        isFinished
          ? (outcomeCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')
          : `${bgColor}`
      }`}>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
            engineLabel === 'A' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'
          }`}>
            {engineLabel}
          </span>
          <span className="text-xs text-gray-500">{engineName}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* 比分预测 */}
          {predScoreText && (
            <span className={`text-xs ${getScoreStyle(scoreCorrect)}`}>
              {predScoreText}
            </span>
          )}
          {/* 胜平负预测 */}
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getOutcomeStyle(outcomeCorrect)}`}>
            {getResultName(predOutcome)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <>
      <div
        onClick={() => setIsModalOpen(true)}
        className={`bg-white rounded-xl shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-shadow ${
          isLive ? 'ring-2 ring-danger' : ''
        } ${isFinished ? 'border-l-4 border-gray-400' : ''}`}
      >
        {/* Match header */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">
              {match.stage === 'group' ? `${match.group}组 · ${getStageName(match.stage)}` : getStageName(match.stage)}
            </span>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-sm font-medium text-gray-600">{match.time}</span>
              {isLive && (
                <span className="bg-danger text-white text-xs px-2 py-0.5 rounded-full font-bold animate-pulse">
                  LIVE
                </span>
              )}
              {isFinished && (
                <span className="bg-gray-600 text-white text-xs px-2 py-0.5 rounded-full font-medium">
                  已结束
                </span>
              )}
            </div>
          </div>

          {/* Teams + Score */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
              <span className="text-3xl">{match.homeTeam.flag}</span>
              <span className="font-bold text-sm truncate">{match.homeTeam.nameCn}</span>
              <span className="text-xs text-gray-400">#{match.homeTeam.fifaRank}</span>
            </div>

            <div className="flex flex-col items-center gap-1 px-4">
              {isFinished || isLive ? (
                <div className="text-2xl font-bold text-gray-900">{actualScoreText}</div>
              ) : (
                <div className="text-lg font-bold text-gray-400">VS</div>
              )}
              {/* 实际结果标签 */}
              {isFinished && match.result && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 ${
                  match.result === 'home' ? 'bg-blue-100 text-blue-700' :
                  match.result === 'draw' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-purple-100 text-purple-700'
                }`}>
                  {match.result === 'home' ? '主胜' : match.result === 'draw' ? '平局' : '客胜'}
                </span>
              )}
            </div>

            <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
              <span className="text-3xl">{match.awayTeam.flag}</span>
              <span className="font-bold text-sm truncate">{match.awayTeam.nameCn}</span>
              <span className="text-xs text-gray-400">#{match.awayTeam.fifaRank}</span>
            </div>
          </div>
        </div>

        {/* Odds */}
        {mainOdds && (
          <div className="px-4 pb-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500">主胜</div>
                <div className="font-bold text-sm">{formatOdds(mainOdds.homeWin)}</div>
              </div>
              <div className="text-center p-2 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500">平局</div>
                <div className="font-bold text-sm">{formatOdds(mainOdds.draw)}</div>
              </div>
              <div className="text-center p-2 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500">客胜</div>
                <div className="font-bold text-sm">{formatOdds(mainOdds.awayWin)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Dual Predictions */}
        {prediction && (
          <div className="px-4 pb-4 space-y-2">
            {/* 已结束比赛的结果概览 */}
            {isFinished && (
              <div className="flex items-center justify-center gap-4 py-2 mb-2 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-1">胜平负</div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${predAOutcomeCorrect === true ? 'text-green-600' : predAOutcomeCorrect === false ? 'text-red-500' : 'text-gray-400'}`}>
                      A: {predAOutcomeCorrect === true ? '✓' : predAOutcomeCorrect === false ? '✗' : '-'}
                    </span>
                    <span className={`text-xs font-medium ${predBOutcomeCorrect === true ? 'text-green-600' : predBOutcomeCorrect === false ? 'text-red-500' : 'text-gray-400'}`}>
                      B: {predBOutcomeCorrect === true ? '✓' : predBOutcomeCorrect === false ? '✗' : '-'}
                    </span>
                  </div>
                </div>
                <div className="w-px h-8 bg-gray-300" />
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-1">比分</div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${predAScoreCorrect === true ? 'text-green-600' : predAScoreCorrect === false ? 'text-red-500' : 'text-gray-400'}`}>
                      A: {predAScoreCorrect === true ? '✓' : predAScoreCorrect === false ? '✗' : '-'}
                    </span>
                    <span className={`text-xs font-medium ${predBScoreCorrect === true ? 'text-green-600' : predBScoreCorrect === false ? 'text-red-500' : 'text-gray-400'}`}>
                      B: {predBScoreCorrect === true ? '✓' : predBScoreCorrect === false ? '✗' : '-'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Engine A */}
            {renderEnginePrediction(
              'A',
              'Elo+Dixon',
              'bg-blue-50 border-blue-100',
              predA?.predictedOutcome,
              predAScoreText,
              predAOutcomeCorrect,
              predAScoreCorrect
            )}

            {/* Engine B */}
            {renderEnginePrediction(
              'B',
              '赔率+实力',
              'bg-amber-50 border-amber-100',
              predB?.predictedOutcome,
              predBScoreText,
              predBOutcomeCorrect,
              predBScoreCorrect
            )}
          </div>
        )}
      </div>

      <MatchDetailModal
        match={match}
        prediction={prediction}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
};
