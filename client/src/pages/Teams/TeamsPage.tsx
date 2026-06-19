import React, { useState, useMemo } from 'react';
import { TEAMS } from '../../services/staticData';
import { useApp } from '../../context/AppContext';
import type { Match, Team } from '../../types';
import { Search, Shield, TrendingUp, BarChart3 } from 'lucide-react';
import { Flag } from '../../components/ui/Flag';

interface StandingRow {
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

/** Compute group standings from completed matches (same algorithm as server). */
function computeStandings(matches: Match[]): Record<string, StandingRow[]> {
  const byGroup: Record<string, Record<string, StandingRow>> = {};

  TEAMS.forEach((t) => {
    if (!t.group) return;
    byGroup[t.group] ??= {};
    byGroup[t.group][t.id] = {
      team: t, played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0,
    };
  });

  matches
    .filter((m) => m.status === 'completed' && m.group && m.score && m.homeTeam && m.awayTeam)
    .forEach((m) => {
      const grp = byGroup[m.group!];
      const h = grp?.[m.homeTeam.id];
      const a = grp?.[m.awayTeam.id];
      if (!h || !a) return;
      const hs = m.score!.home;
      const as = m.score!.away;
      h.played++; a.played++;
      h.goalsFor += hs; h.goalsAgainst += as;
      a.goalsFor += as; a.goalsAgainst += hs;
      if (hs > as) { h.won++; h.points += 3; a.lost++; }
      else if (hs < as) { a.won++; a.points += 3; h.lost++; }
      else { h.drawn++; a.drawn++; h.points++; a.points++; }
    });

  const result: Record<string, StandingRow[]> = {};
  Object.entries(byGroup).forEach(([letter, map]) => {
    result[letter] = Object.values(map)
      .map((r) => ({ ...r, goalDiff: r.goalsFor - r.goalsAgainst }))
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
        return b.goalsFor - a.goalsFor;
      });
  });
  return result;
}

export const TeamsPage: React.FC = () => {
  const { state } = useApp();
  const { matches } = state;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');

  const groups = Array.from(new Set(TEAMS.filter((t) => t.group).map((t) => t.group!))).sort();
  const standings = useMemo(() => computeStandings(matches), [matches]);

  const filteredTeams = TEAMS.filter((team) => {
    if (selectedGroup !== 'all' && team.group !== selectedGroup) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return team.name.toLowerCase().includes(query) || team.nameCn.includes(query);
    }
    return true;
  });

  const matchesForGroup = (letter: string) =>
    matches.filter((m) => m.group === letter).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  const showStandings = selectedGroup !== 'all' || searchQuery === '';

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">参赛球队</h2>

      {/* Search and filter */}
      <div className="bg-white rounded-xl shadow-md p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="搜索球队..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedGroup('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selectedGroup === 'all' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            全部
          </button>
          {groups.map((group) => (
            <button
              key={group}
              onClick={() => setSelectedGroup(group)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedGroup === group ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {group}组
            </button>
          ))}
        </div>
      </div>

      {/* Standings + fixtures when a single group is selected */}
      {showStandings && (selectedGroup !== 'all'
        ? (
          <div className="space-y-6">
            <StandingsCard letter={selectedGroup} rows={standings[selectedGroup] ?? []} />
            <FixturesCard matches={matchesForGroup(selectedGroup)} />
            <TeamGrid teams={filteredTeams} />
          </div>
        )
        : (
          <div className="space-y-6">
            {groups.map((g) => (
              <StandingsCard key={g} letter={g} rows={standings[g] ?? []} />
            ))}
            {searchQuery && <TeamGrid teams={filteredTeams} />}
          </div>
        )
      )}
    </div>
  );
};

const TeamGrid: React.FC<{ teams: Team[] }> = ({ teams }) => {
  if (teams.length === 0) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {teams.map((team) => (
        <div key={team.id} className="bg-white rounded-xl shadow-md p-4 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-4">
            <Flag teamId={team.id} emoji={team.flag} className="text-4xl" />
            <div className="flex-1">
              <div className="font-bold text-lg">{team.nameCn}</div>
              <div className="text-sm text-gray-500">{team.name}</div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-4 text-sm flex-wrap">
            <div className="flex items-center gap-1">
              <Shield className="w-4 h-4 text-primary" />
              <span>{team.group ? `${team.group}组` : '淘汰赛'}</span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-4 h-4 text-accent-dark" />
              <span>FIFA排名: {team.fifaRank}</span>
            </div>
            <div className="flex items-center gap-1">
              <BarChart3 className="w-4 h-4 text-success" />
              <span>进攻: {team.stats.attackRating}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const StandingsCard: React.FC<{ letter: string; rows: StandingRow[] }> = ({ letter, rows }) => (
  <div className="bg-white rounded-xl shadow-md overflow-hidden">
    <div className="px-4 py-2.5 border-b border-gray-100 font-medium text-sm flex items-center gap-2">
      <span className="bg-primary text-white w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold">{letter}</span>
      {letter}组积分榜
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-xs sm:text-sm">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            <th className="text-left px-3 py-2 font-medium">#</th>
            <th className="text-left px-2 py-2 font-medium">球队</th>
            <th className="px-2 py-2 font-medium" title="场次">赛</th>
            <th className="px-2 py-2 font-medium" title="胜">胜</th>
            <th className="px-2 py-2 font-medium" title="平">平</th>
            <th className="px-2 py-2 font-medium" title="负">负</th>
            <th className="px-2 py-2 font-medium" title="净胜球">净</th>
            <th className="px-3 py-2 font-medium" title="积分">积分</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.team.id} className={`border-t border-gray-50 ${i < 2 ? 'bg-green-50/40' : ''}`}>
              <td className="px-3 py-2 text-gray-400">{i + 1}</td>
              <td className="px-2 py-2">
                <span className="inline-flex items-center gap-1.5">
                  <Flag teamId={r.team.id} emoji={r.team.flag} />
                  <span className="font-medium truncate">{r.team.nameCn}</span>
                </span>
              </td>
              <td className="px-2 py-2 text-center text-gray-600">{r.played}</td>
              <td className="px-2 py-2 text-center text-gray-600">{r.won}</td>
              <td className="px-2 py-2 text-center text-gray-600">{r.drawn}</td>
              <td className="px-2 py-2 text-center text-gray-600">{r.lost}</td>
              <td className="px-2 py-2 text-center text-gray-600">{r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}</td>
              <td className="px-3 py-2 text-center font-bold text-primary">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const FixturesCard: React.FC<{ matches: Match[] }> = ({ matches }) => {
  if (matches.length === 0) {
    return <div className="bg-white rounded-xl shadow-md p-6 text-center text-sm text-gray-400">暂无该组比赛数据</div>;
  }
  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 font-medium text-sm">小组对局</div>
      <div className="divide-y divide-gray-50">
        {matches.map((m) => {
          const played = m.status === 'completed';
          return (
            <div key={m.id} className="px-4 py-2 flex items-center justify-between text-sm">
              <div className="text-xs text-gray-400 w-20 flex-shrink-0">{m.date} {m.time}</div>
              <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                <span className="truncate">{m.homeTeam.nameCn}</span>
                <Flag teamId={m.homeTeam.id} emoji={m.homeTeam.flag} className="text-lg" />
              </div>
              <div className="px-3 font-bold text-gray-700">
                {played && m.score ? `${m.score.home} : ${m.score.away}` : <span className="text-gray-300 font-normal">vs</span>}
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Flag teamId={m.awayTeam.id} emoji={m.awayTeam.flag} className="text-lg" />
                <span className="truncate">{m.awayTeam.nameCn}</span>
              </div>
              <div className="w-12 flex-shrink-0 text-right">
                {m.status === 'live' && <span className="text-[10px] text-danger font-bold">LIVE</span>}
                {played && <span className="text-[10px] text-gray-400">已结束</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
