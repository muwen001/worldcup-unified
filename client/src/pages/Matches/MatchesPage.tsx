import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  const autoSelectedRef = useRef(false);
  const dateScrollRef = useRef<HTMLDivElement>(null);

  // 日期按阶段区分：淘汰赛阶段只展示淘汰赛日期，小组赛阶段只展示小组赛日期
  const stageMatches = useMemo(
    () => matches.filter(m => stageFilter === 'all' ? true : (stageFilter === 'group' ? m.stage === 'group' : m.stage !== 'group')),
    [matches, stageFilter],
  );
  const visibleDates = useMemo(() => Array.from(new Set(stageMatches.map(m => m.date))).sort(), [stageMatches]);

  // 阶段默认：小组赛全部结束（6/28 最后一场完赛后）且有淘汰赛 → 默认「淘汰赛」
  const defaultStage: StageFilter = useMemo(() => {
    if (matches.length === 0) return 'all';
    const hasKnockout = matches.some(m => m.stage !== 'group');
    const groupStillActive = matches.some(m => m.stage === 'group' && m.status !== 'completed');
    return hasKnockout && !groupStillActive ? 'knockout' : 'all';
  }, [matches]);

  // Smart default: today; if all matches done, jump to next day with action
  const smartDefaultDate = useMemo(() => {
    if (visibleDates.length === 0) return 'all';
    const todayMatches = stageMatches.filter(m => m.date === today);
    // No matches today → find nearest future date
    if (todayMatches.length === 0) {
      const future = visibleDates.filter(d => d >= today);
      return future.length > 0 ? future[0] : visibleDates[visibleDates.length - 1];
    }
    // All matches today are completed → find next date with non-completed matches
    if (todayMatches.every(m => m.status === 'completed')) {
      for (const d of visibleDates) {
        if (d <= today) continue;
        const dayMatches = stageMatches.filter(m => m.date === d);
        if (dayMatches.some(m => m.status !== 'completed')) return d;
      }
      // All future dates also completed → show today anyway
      return today;
    }
    return today;
  }, [stageMatches, visibleDates]);

  // Auto-select smart default on first data load
  useEffect(() => {
    if (!autoSelectedRef.current && matches.length > 0 && smartDefaultDate !== 'all') {
      autoSelectedRef.current = true;
      setSelectedDate(smartDefaultDate);
    }
  }, [smartDefaultDate, matches.length]);

  // 小组赛结束后自动把阶段筛选切到「淘汰赛」（仅触发一次，之后尊重用户手动选择）
  const stageInitRef = useRef(false);
  useEffect(() => {
    if (stageInitRef.current) return;
    if (defaultStage !== 'all') {
      stageInitRef.current = true;
      setStageFilter(defaultStage);
      // 阶段切换后让日期智能默认在新阶段范围内重新选取
      autoSelectedRef.current = false;
    }
  }, [defaultStage]);

  // 切换阶段筛选后，若当前选中日期已不在可见日期中，重置为「全部」
  useEffect(() => {
    if (selectedDate !== 'all' && !visibleDates.includes(selectedDate)) {
      setSelectedDate('all');
    }
  }, [visibleDates, selectedDate]);

  // Scroll selected date into view
  useEffect(() => {
    if (selectedDate === 'all' || !dateScrollRef.current) return;
    const el = dateScrollRef.current.querySelector(`[data-date="${selectedDate}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [selectedDate]);

  // Pre-build prediction map for O(1) lookup
  const predictionMap = useMemo(() => {
    const map = new Map<string, typeof predictions[number]>();
    predictions.forEach(p => map.set(p.matchId, p));
    return map;
  }, [predictions]);

  const filteredMatches = useMemo(() => {
    return matches.filter((match) => {
      if (selectedDate !== 'all' && match.date !== selectedDate) return false;
      if (statusFilter !== 'all' && match.status !== statusFilter) return false;
      if (stageFilter === 'group' && match.stage !== 'group') return false;
      if (stageFilter === 'knockout' && match.stage === 'group') return false;
      return true;
    });
  }, [matches, selectedDate, statusFilter, stageFilter]);

  const effectiveDate = selectedDate !== 'all' ? selectedDate : null;

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
              prediction={predictionMap.get(match.id)}
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
        <div ref={dateScrollRef} className="flex gap-1.5 overflow-x-auto pb-2">
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
          {visibleDates.map((date) => {
            const isToday = date === today;
            const isSelected = selectedDate === date;
            return (
              <button
                key={date}
                data-date={date}
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
                prediction={predictionMap.get(match.id)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">{visibleDates.map(renderDateSection)}</div>
      )}
    </div>
  );
};
