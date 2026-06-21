import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle, XCircle } from 'lucide-react';
import { Flag } from '../../components/ui/Flag';
import { getResultName } from '../../utils/oddsCalculator';

export const HistoryPage: React.FC = () => {
  const { state } = useApp();
  const { matches, predictions } = state;

  // Pre-build match map for O(1) lookup
  const matchMap = useMemo(() => {
    const map = new Map(matches.map(m => [m.id, m]));
    return map;
  }, [matches]);

  const engineAPredictions = useMemo(() => {
    return predictions.filter(p => {
      const match = matchMap.get(p.matchId);
      return match && match.status === 'completed' && match.result;
    });
  }, [predictions, matchMap]);

  const engineACorrect = engineAPredictions.filter(p => {
    const match = matchMap.get(p.matchId);
    return match && match.result === p.engineA.predictedOutcome;
  }).length;
  const engineAAccuracy = engineAPredictions.length > 0 ? (engineACorrect / engineAPredictions.length) * 100 : 0;

  const engineBCorrect = engineAPredictions.filter(p => {
    const match = matchMap.get(p.matchId);
    return match && match.result === p.engineB.predictedOutcome;
  }).length;
  const engineBAccuracy = engineAPredictions.length > 0 ? (engineBCorrect / engineAPredictions.length) * 100 : 0;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">预测历史</h2>

      {/* Dual Engine Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Engine A Stats */}
        <div className="bg-blue-50 rounded-xl shadow-md p-6 border border-blue-100">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded">A</span>
            <span className="font-bold text-blue-700">Elo + Dixon-Coles</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{engineAPredictions.length}</div>
              <div className="text-xs text-gray-500">总预测</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-success">{engineACorrect}</div>
              <div className="text-xs text-gray-500">正确</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{engineAAccuracy.toFixed(1)}%</div>
              <div className="text-xs text-gray-500">准确率</div>
            </div>
          </div>
        </div>

        {/* Engine B Stats */}
        <div className="bg-amber-50 rounded-xl shadow-md p-6 border border-amber-100">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-bold bg-amber-100 text-amber-600 px-2 py-0.5 rounded">B</span>
            <span className="font-bold text-amber-700">赔率 + 球队实力</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{engineAPredictions.length}</div>
              <div className="text-xs text-gray-500">总预测</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-success">{engineBCorrect}</div>
              <div className="text-xs text-gray-500">正确</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600">{engineBAccuracy.toFixed(1)}%</div>
              <div className="text-xs text-gray-500">准确率</div>
            </div>
          </div>
        </div>
      </div>

      {/* Prediction records */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h3 className="text-lg font-bold mb-4">预测记录</h3>
        <div className="space-y-3">
          {engineAPredictions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              暂无已完成的预测记录
            </div>
          ) : (
            engineAPredictions.map((pred) => {
              const match = matchMap.get(pred.matchId);
              if (!match) return null;

              const isACorrect = match.result === pred.engineA.predictedOutcome;
              const isBCorrect = match.result === pred.engineB.predictedOutcome;

              return (
                <div key={pred.matchId} className="p-4 rounded-lg bg-gray-50 border">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Flag teamId={match.homeTeam.id} emoji={match.homeTeam.flag} className="text-2xl" />
                      <span className="font-medium">{match.homeTeam.nameCn}</span>
                      <span className="text-gray-400">vs</span>
                      <span className="font-medium">{match.awayTeam.nameCn}</span>
                      <Flag teamId={match.awayTeam.id} emoji={match.awayTeam.flag} className="text-2xl" />
                    </div>
                    <div className="text-sm text-gray-500">
                      实际: {match.result ? getResultName(match.result) : '—'}
                      {match.score && ` (${match.score.home}:${match.score.away})`}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Engine A result */}
                    <div className={`flex items-center justify-between p-2 rounded ${isACorrect ? 'bg-success/10' : 'bg-danger/10'}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">A</span>
                        <span className="text-sm">
                          {getResultName(pred.engineA.predictedOutcome)}
                        </span>
                      </div>
                      {isACorrect ? (
                        <CheckCircle className="w-4 h-4 text-success" />
                      ) : (
                        <XCircle className="w-4 h-4 text-danger" />
                      )}
                    </div>

                    {/* Engine B result */}
                    <div className={`flex items-center justify-between p-2 rounded ${isBCorrect ? 'bg-success/10' : 'bg-danger/10'}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded">B</span>
                        <span className="text-sm">
                          {getResultName(pred.engineB.predictedOutcome)}
                        </span>
                      </div>
                      {isBCorrect ? (
                        <CheckCircle className="w-4 h-4 text-success" />
                      ) : (
                        <XCircle className="w-4 h-4 text-danger" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
