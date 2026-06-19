import React, { useState } from 'react';
import type { Match, MatchResult, Prediction, DualPrediction } from '../../types';
import { getResultName, calculateNormalizedProbabilities } from '../../utils/oddsCalculator';
import { Clock } from 'lucide-react';
import { MatchDetailModal } from './MatchDetailModal';
import { Flag } from './Flag';

interface MatchCardProps {
  match: Match;
  prediction?: DualPrediction;
}

const OUTCOME_STYLE: Record<MatchResult, string> = {
  home: 'bg-blue-100 text-blue-700',
  draw: 'bg-yellow-100 text-yellow-700',
  away: 'bg-purple-100 text-purple-700',
};

const SEG_BAR: Record<MatchResult, string> = {
  home: 'bg-blue-500',
  draw: 'bg-gray-400',
  away: 'bg-purple-500',
};

interface EngineCardData {
  label: 'A' | 'B';
  name: string;
  badge: string;          // engine label badge bg
  cardBorder: string;     // card border tint
  pred?: Prediction;
  scoreText: string;
  outcomeCorrect: boolean | null;
  scoreCorrect: boolean | null;
}

/** Result mark — colored ✓/✗ (green/red) or gray dash when unknown */
function Mark({ correct }: { correct: boolean | null }) {
  if (correct === null) return <span className="text-gray-300">—</span>;
  return (
    <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
      correct ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
    }`}>
      {correct ? '✓' : '✗'}
    </span>
  );
}

/** Unified per-engine prediction card. Same structure for upcoming & finished. */
const EnginePredictionCard: React.FC<{ data: EngineCardData; isFinished: boolean }> = ({ data, isFinished }) => {
  const { label, name, badge, cardBorder, pred, scoreText, outcomeCorrect, scoreCorrect } = data;
  if (!pred) {
    return (
      <div className={`rounded-lg border ${cardBorder} p-2.5 text-center text-[11px] text-gray-400`}>
        引擎{label} 无预测
      </div>
    );
  }
  const probs = pred.probabilities;
  const segs: { key: MatchResult; v: number }[] = [
    { key: 'home', v: probs.home },
    { key: 'draw', v: probs.draw },
    { key: 'away', v: probs.away },
  ];

  return (
    <div className={`rounded-lg border ${cardBorder} p-2.5 flex flex-col gap-2`}>
      {/* header */}
      <div className="flex items-center gap-1.5">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badge}`}>{label}</span>
        <span className="text-[11px] text-gray-500 truncate">{name}</span>
        {!isFinished && (
          <span className="ml-auto text-[10px] text-gray-400">置信 {Math.round(pred.confidence ?? 0)}%</span>
        )}
      </div>

      {/* prediction + result together: correctness mark follows its item when finished */}
      <div className="flex items-center justify-between flex-wrap gap-y-1">
        <span className="text-[11px] text-gray-400">{isFinished ? '预测 / 结果' : '预测'}</span>
        <div className="flex items-center gap-1.5">
          {scoreText && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-700">
              {scoreText}
              {isFinished && scoreCorrect !== null && <Mark correct={scoreCorrect} />}
            </span>
          )}
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${OUTCOME_STYLE[pred.predictedOutcome]}`}>
            {getResultName(pred.predictedOutcome)}
            {isFinished && outcomeCorrect !== null && <Mark correct={outcomeCorrect} />}
          </span>
        </div>
      </div>

      {/* probabilities */}
      <div>
        <div className="flex h-1.5 rounded-full overflow-hidden">
          {segs.map((s) => (
            <div key={s.key} style={{ width: `${Math.max(s.v, 0) * 100}%` }} className={SEG_BAR[s.key]} />
          ))}
        </div>
        <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
          <span>主{Math.round(probs.home * 100)}%</span>
          <span>平{Math.round(probs.draw * 100)}%</span>
          <span>客{Math.round(probs.away * 100)}%</span>
        </div>
      </div>
    </div>
  );
};

export const MatchCard: React.FC<MatchCardProps> = ({ match, prediction }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const mainOdds = match.odds[0];

  const getStageName = (stage: string): string => {
    const names: Record<string, string> = {
      group: '小组赛', round_of_32: '1/32决赛', round_of_16: '1/16决赛',
      quarter: '1/4决赛', semi: '半决赛', final: '决赛',
    };
    return names[stage] || stage;
  };

  const isFinished = match.status === 'completed';
  const isLive = match.status === 'live';
  const actualScoreText = match.score ? `${match.score.home}:${match.score.away}` : '-';

  const isOutcomeCorrect = (predicted: MatchResult): boolean | null => {
    if (!isFinished || !match.result) return null;
    return predicted === match.result;
  };
  const isScoreCorrect = (h: number, a: number): boolean | null => {
    if (!isFinished || !match.score) return null;
    return h === match.score.home && a === match.score.away;
  };

  const predA = prediction?.engineA;
  const predAScore = predA?.scorePredictions?.find((s) => s.isMostLikely) ?? predA?.scorePredictions?.[0];
  const predAScoreText = predAScore ? `${predAScore.homeScore}:${predAScore.awayScore}` : '';
  const predB = prediction?.engineB;
  const predBScore = predB?.scorePredictions?.find((s) => s.isMostLikely) ?? predB?.scorePredictions?.[0];
  const predBScoreText = predBScore ? `${predBScore.homeScore}:${predBScore.awayScore}` : '';

  const engineAData: EngineCardData = {
    label: 'A', name: 'Elo+Dixon',
    badge: 'bg-blue-100 text-blue-600', cardBorder: 'border-blue-100',
    pred: predA, scoreText: predAScoreText,
    outcomeCorrect: predA ? isOutcomeCorrect(predA.predictedOutcome) : null,
    scoreCorrect: predAScore ? isScoreCorrect(predAScore.homeScore, predAScore.awayScore) : null,
  };
  const engineBData: EngineCardData = {
    label: 'B', name: '赔率+实力',
    badge: 'bg-amber-100 text-amber-600', cardBorder: 'border-amber-100',
    pred: predB, scoreText: predBScoreText,
    outcomeCorrect: predB ? isOutcomeCorrect(predB.predictedOutcome) : null,
    scoreCorrect: predBScore ? isScoreCorrect(predBScore.homeScore, predBScore.awayScore) : null,
  };

  return (
    <>
      <div
        onClick={() => setIsModalOpen(true)}
        className={`bg-white rounded-xl shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-shadow ${
          isLive ? 'ring-2 ring-danger' : ''} ${isFinished ? 'border-l-4 border-gray-300' : ''}`}
      >
        {/* Header */}
        <div className="p-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500 truncate">
              {match.stage === 'group' ? `${match.group}组 · ${getStageName(match.stage)}` : getStageName(match.stage)}
            </span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs font-medium text-gray-600">{match.time}</span>
              {isLive && (
                <span className="bg-danger text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold animate-pulse">LIVE</span>
              )}
              {isFinished && (
                <span className="bg-gray-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">已结束</span>
              )}
            </div>
          </div>

          {/* Teams + score */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
              <Flag teamId={match.homeTeam.id} emoji={match.homeTeam.flag} className="text-3xl" />
              <span className="font-bold text-sm truncate w-full text-center">{match.homeTeam.nameCn}</span>
              <span className="text-[10px] text-gray-400">#{match.homeTeam.fifaRank}</span>
            </div>

            <div className="flex flex-col items-center gap-1 px-2">
              {isFinished || isLive ? (
                <div className="text-2xl font-bold text-gray-900 whitespace-nowrap">{actualScoreText}</div>
              ) : (
                <div className="text-base font-bold text-gray-400">VS</div>
              )}
              {isFinished && match.result && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${OUTCOME_STYLE[match.result]}`}>
                  {getResultName(match.result)}
                </span>
              )}
            </div>

            <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
              <Flag teamId={match.awayTeam.id} emoji={match.awayTeam.flag} className="text-3xl" />
              <span className="font-bold text-sm truncate w-full text-center">{match.awayTeam.nameCn}</span>
              <span className="text-[10px] text-gray-400">#{match.awayTeam.fifaRank}</span>
            </div>
          </div>
        </div>

        {/* Dual engine prediction cards (unified for all states) */}
        {prediction && (
          <div className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-2.5">
              <EnginePredictionCard data={engineAData} isFinished={isFinished} />
              <EnginePredictionCard data={engineBData} isFinished={isFinished} />
            </div>
            {!mainOdds ? null : null}
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
