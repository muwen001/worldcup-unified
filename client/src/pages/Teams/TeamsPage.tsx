import React, { useState } from 'react';
import { TEAMS } from '../../services/staticData';
import { useApp } from '../../context/AppContext';
import { Search, Shield, TrendingUp, BarChart3 } from 'lucide-react';

export const TeamsPage: React.FC = () => {
  const { state } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');

  const groups = Array.from(new Set(TEAMS.filter((t) => t.group).map((t) => t.group!))).sort();

  const filteredTeams = TEAMS.filter((team) => {
    if (selectedGroup !== 'all' && team.group !== selectedGroup) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        team.name.toLowerCase().includes(query) ||
        team.nameCn.includes(query)
      );
    }
    return true;
  });

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
              selectedGroup === 'all'
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            全部
          </button>
          {groups.map((group) => (
            <button
              key={group}
              onClick={() => setSelectedGroup(group)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedGroup === group
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {group}组
            </button>
          ))}
        </div>
      </div>

      {/* Team list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTeams.map((team) => (
          <div
            key={team.id}
            className="bg-white rounded-xl shadow-md p-4 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center gap-4">
              <span className="text-4xl">{team.flag}</span>
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
    </div>
  );
};
