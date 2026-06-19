import React, { useState, useMemo } from 'react';
import { MatchCard } from '../../components/ui/MatchCard';
import { useApp } from '../../context/AppContext';
import { Calendar } from 'lucide-react';

function formatDateLabel(dateStr: string): string {
  const parts = dateStr.split('-');
  return `${parseInt(parts[1])}月${parseInt(parts[2])}日`;
}

function formatDateHeader(dateStr: string): string {
  const parts = dateStr.split('-');
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const dayOfWeek = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])).getDay();
  return `${parseInt(parts[1])}月${parseInt(parts[2])}日 ${weekdays[dayOfWeek]}`;
}

const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];

export const MatchesPage: React.FC = () => {
  const { state } = useApp();
  const { matches, predictions } = state;
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const allDates = Array.from(new Set(matches.map(m => m.date))).sort();

  const effectiveDate = useMemo(() => {
    if (selectedDate !== 'all') return selectedDate;
    if (matches.length === 0) return null;
    return allDates.includes(today) ? today : allDates[0];
  }, [selectedDate, matches.length, allDates]);

  const filteredMatches = matches.filter((match) => {
    if (effectiveDate && match.date !== effectiveDate) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">比赛列表</h2>
        <div className="text-sm text-gray-500">
          共 {filteredMatches.length} 场比赛 · 双引擎预测
        </div>
      </div>

      {/* Date selector */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="flex items-center gap-2 text-gray-700 mb-3">
          <Calendar className="w-5 h-5" />
          <span className="font-medium">比赛日期</span>
          <span className="text-sm text-gray-400 ml-auto">
            {effectiveDate ? `${formatDateHeader(effectiveDate)} · ${filteredMatches.length} 场` : '全部日期'}
          </span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedDate('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
              selectedDate === 'all'
                ? 'bg-[#1e3a5f] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            全部
          </button>
          {allDates.map((date) => {
            const isToday = date === today;
            const isSelected = selectedDate === date;
            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                  isSelected
                    ? 'bg-[#1e3a5f] text-white'
                    : isToday
                    ? 'bg-[#c9a227]/10 text-[#a88420] border border-[#c9a227]/30'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {formatDateLabel(date)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Match list */}
      <div className="grid grid-cols-1 gap-4">
        {effectiveDate === null ? (
          allDates.map(date => {
            const dateMatches = filteredMatches.filter(m => m.date === date);
            if (dateMatches.length === 0) return null;
            const isToday = date === today;
            return (
              <div key={date}>
                <div className={`text-sm font-medium py-2 sticky top-0 z-10 flex items-center gap-2 ${
                  isToday ? 'text-[#a88420] bg-[#c9a227]/5' : 'text-gray-500 bg-gray-50'
                }`}>
                  {isToday && <span className="bg-[#c9a227] text-white text-xs px-1.5 py-0.5 rounded-full">今天</span>}
                  {formatDateHeader(date)} · {dateMatches.length} 场比赛
                </div>
                {dateMatches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    prediction={predictions.find((p) => p.matchId === match.id)}
                  />
                ))}
              </div>
            );
          })
        ) : (
          <>
            <div className={`text-sm font-medium py-2 flex items-center gap-2 ${
              effectiveDate === today ? 'text-[#a88420]' : 'text-gray-500'
            }`}>
              {effectiveDate === today && <span className="bg-[#c9a227] text-white text-xs px-1.5 py-0.5 rounded-full">今天</span>}
              {formatDateHeader(effectiveDate)} · {filteredMatches.length} 场比赛
            </div>
            {filteredMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                prediction={predictions.find((p) => p.matchId === match.id)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
};
