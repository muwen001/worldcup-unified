import React, { useState, useMemo } from 'react';
import { MatchCard } from '../../components/ui/MatchCard';
import { useApp } from '../../context/AppContext';
import { Calendar, Filter } from 'lucide-react';

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

type StatusFilter = 'all' | 'upcoming' | 'live' | 'completed';
type StageFilter = 'all' | 'group' | 'knockout';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '全部状态' },
  { value: 'upcoming', label: '未开始' },
  { value: 'live', label: '进行中' },
  { value: 'completed', label: '已结束' },
];

const STAGE_OPTIONS: { value: StageFilter; label: string }[] = [
  { value: 'all', label: '全部赛程' },
  { value: 'group', label: '小组赛' },
  { value: 'knockout', label: '淘汰赛' },
];

export const MatchesPage: React.FC = () => {
  const { state } = useApp();
  const { matches, predictions } = state;
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [stageFilter, setStageFilter] = useState<StageFilter>('all');

  const allDates = Array.from(new Set(matches.map(m => m.date))).sort();

  const effectiveDate = useMemo(() => {
    if (selectedDate !== 'all') return selectedDate;
    if (matches.length === 0) return null;
    return allDates.includes(today) ? today : allDates[0];
  }, [selectedDate, matches.length, allDates]);

  const filteredMatches = matches.filter((match) => {
    if (effectiveDate && match.date !== effectiveDate) return false;
    if (statusFilter !== 'all' && match.status !== statusFilter) return false;
    if (stageFilter === 'group' && match.stage !== 'group') return false;
    if (stageFilter === 'knockout' && match.stage === 'group') return false;
    return true;
  });

  const renderDateSection = (date: string) => {
    const dateMatches = filteredMatches.filter((m) => m.date === date);
    if (dateMatches.length === 0) return null;
    const isToday = date === today;
    return (
      <div key={date} className="space-y-3">
        <div className={`text-sm font-medium py-1.5 px-2 rounded-lg flex items-center gap-2 ${
          isToday ? 'text-[#a88420] bg-[#c9a227]/10' : 'text-gray-500 bg-white'
        }`}>
          {isToday && <span className="bg-[#c9a227] text-white text-xs px-1.5 py-0.5 rounded-full">今天</span>}
          {formatDateHeader(date)} · {dateMatches.length} 场比赛
        </div>
        <div className="grid grid-cols-1 gap-4">
          {dateMatches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              prediction={predictions.find((p) => p.matchId === match.id)}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">比赛列表</h2>
        <div className="text-sm text-gray-500">
          共 {filteredMatches.length} 场 · 双引擎预测
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

      {/* Filter tags */}
      <div className="bg-white rounded-xl shadow-md p-4 space-y-3">
        <div className="flex items-center gap-2 text-gray-700">
          <Filter className="w-4 h-4" />
          <span className="font-medium text-sm">筛选</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                statusFilter === opt.value
                  ? 'bg-[#1e3a5f] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <span className="w-px self-stretch bg-gray-200 mx-1" />
          {STAGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStageFilter(opt.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                stageFilter === opt.value
                  ? 'bg-[#c9a227] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Match list */}
      {filteredMatches.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-400">
          没有符合条件的比赛
        </div>
      ) : selectedDate !== 'all' ? (
        <div className="space-y-3">
          <div className={`text-sm font-medium py-1.5 px-2 rounded-lg flex items-center gap-2 ${
            effectiveDate === today ? 'text-[#a88420] bg-[#c9a227]/10' : 'text-gray-500 bg-white'
          }`}>
            {effectiveDate === today && <span className="bg-[#c9a227] text-white text-xs px-1.5 py-0.5 rounded-full">今天</span>}
            {effectiveDate ? formatDateHeader(effectiveDate) : ''} · {filteredMatches.length} 场比赛
          </div>
          <div className="grid grid-cols-1 gap-4">
            {filteredMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                prediction={predictions.find((p) => p.matchId === match.id)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">{allDates.map(renderDateSection)}</div>
      )}
    </div>
  );
};
