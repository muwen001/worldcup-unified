import React from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle, XCircle, TrendingUp, Target } from 'lucide-react';

export const HistoryPage: React.FC = () => {
  const { state } = useApp();
  const { matches, predictions } = state;

  const completedMatches = matches.filter(m => m.status === 'completed');

  // Engine A stats
  const engineAPredictions = predictions.filter(p => {
    const match = matches.find(m => m.id === p.matchId);
    return match && match.status === 'completed' && match.result;
  });
  const engineACorrect = engineAPredictions.filter(p => {
    const match = matches.find(m => m.id === p.matchId);
    return match && match.result === p.engineA.predictedOutcome;
  }).length;
  const engineAAccuracy = engineAPredictions.length > 0 ? (engineACorrect / engineAPredictions.length) * 100 : 0;

  // Engine B stats
  const engineBCorrect = engineAPredictions.filter(p => {
    const match = matches.find(m => m.id === p.matchId);
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
              const match = matches.find((m) => m.id === pred.matchId);
              if (!match) return null;

              const isACorrect = match.result === pred.engineA.predictedOutcome;
              const isBCorrect = match.result === pred.engineB.predictedOutcome;

              return (
                <div key={pred.matchId} className="p-4 rounded-lg bg-gray-50 border">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{match.homeTeam.flag}</span>
                      <span className="font-medium">{match.homeTeam.nameCn}</span>
                      <span className="text-gray-400">vs</span>
                      <span className="font-medium">{match.awayTeam.nameCn}</span>
                      <span className="text-2xl">{match.awayTeam.flag}</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      实际: {match.result === 'home' ? '主胜' : match.result === 'away' ? '客胜' : '平局'}
                      {match.score && ` (${match.score.home}:${match.score.away})`}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Engine A result */}
                    <div className={`flex items-center justify-between p-2 rounded ${isACorrect ? 'bg-success/10' : 'bg-danger/10'}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">A</span>
                        <span className="text-sm">
                          {pred.engineA.predictedOutcome === 'home' ? '主胜' : pred.engineA.predictedOutcome === 'away' ? '客胜' : '平局'}
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
                          {pred.engineB.predictedOutcome === 'home' ? '主胜' : pred.engineB.predictedOutcome === 'away' ? '客胜' : '平局'}
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
