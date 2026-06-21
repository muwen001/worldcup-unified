import React from 'react';
import { RefreshCw, Clock, Wifi, WifiOff, AlertCircle, CalendarDays, Shield, History } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface HeaderProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentPage, onPageChange }) => {
  const { refreshData, state } = useApp();
  const hasErrors = state.dataErrors.length > 0;

  const navItems = [
    { id: 'matches', label: '比赛', icon: <CalendarDays className="w-4 h-4" /> },
    { id: 'teams', label: '球队', icon: <Shield className="w-4 h-4" /> },
    { id: 'history', label: '历史', icon: <History className="w-4 h-4" /> },
  ];

  return (
    <header className="sticky top-0 z-50">
      {/* Top bar - Brand & Status */}
      <div className="bg-gradient-to-r from-[#0a1628] via-[#152a45] to-[#0a1628] border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* Brand */}
            <div className="flex items-center">
              <svg viewBox="0 0 280 56" style={{ height: '40px' }} xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="hlg" x1="0" y1="0" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f5d77a"/>
                    <stop offset="30%" stopColor="#fdf0a6"/>
                    <stop offset="60%" stopColor="#e8b830"/>
                    <stop offset="100%" stopColor="#c99818"/>
                  </linearGradient>
                </defs>
                <path d="M16 22 L16 14 Q16 6 30 6 Q44 6 44 14 L44 22" fill="url(#hlg)" stroke="#a88420" strokeWidth="1"/>
                <ellipse cx="30" cy="22" rx="14" ry="2.5" fill="url(#hlg)" stroke="#a88420" strokeWidth="0.8"/>
                <path d="M16 22 L18 34 Q18 42 30 48 Q42 42 42 34 L44 22" fill="url(#hlg)" stroke="#a88420" strokeWidth="1"/>
                <path d="M16 17 Q12 17 10 22 Q8 28 14 34" fill="none" stroke="url(#hlg)" strokeWidth="3.5" strokeLinecap="round"/>
                <path d="M44 17 Q48 17 50 22 Q52 28 46 34" fill="none" stroke="url(#hlg)" strokeWidth="3.5" strokeLinecap="round"/>
                <circle cx="30" cy="14" r="4.5" fill="#4a90d9" stroke="#2c5f8a" strokeWidth="0.6"/>
                <rect x="28" y="48" width="4" height="8" rx="1.5" fill="url(#hlg)" stroke="#a88420" strokeWidth="0.6"/>
                <rect x="22" y="55" width="16" height="2.5" rx="1" fill="#2d8a4e"/>
                <text x="60" y="30" fontFamily="Arial,Helvetica,sans-serif" fontWeight="900" fontSize="16" fill="#f5d77a" letterSpacing="1">FIFA WORLD CUP</text>
                <text x="60" y="46" fontFamily="Arial,Helvetica,sans-serif" fontWeight="700" fontSize="13" fill="#4a90d9" letterSpacing="3">2026</text>
              </svg>
            </div>

            {/* Status & Actions */}
            <div className="flex items-center gap-3">
              {/* Data Status */}
              <div className="hidden sm:flex items-center gap-2">
                {state.isRealTime ? (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
                    <Wifi className="w-3 h-3 text-green-400" />
                    <span className="text-xs font-medium text-green-400">LIVE</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-500/10 border border-gray-500/20 rounded-full">
                    <WifiOff className="w-3 h-3 text-gray-400" />
                    <span className="text-xs font-medium text-gray-400">OFFLINE</span>
                  </div>
                )}

                {hasErrors && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-full">
                    <AlertCircle className="w-3 h-3 text-red-400" />
                    <span className="text-xs text-red-400">{state.dataErrors.length}</span>
                  </div>
                )}
              </div>

              {/* Last Update */}
              <div className="hidden md:flex items-center gap-1.5 text-gray-500">
                <Clock className="w-3 h-3" />
                <span className="text-xs">
                  {new Date(state.lastUpdated).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Refresh Button */}
              <button
                onClick={() => refreshData()}
                disabled={state.isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg text-white text-sm font-medium transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${state.isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">刷新</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation bar */}
      <div className="bg-[#0f1f38] border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onPageChange(item.id)}
                  className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? 'text-amber-400'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {isActive && (
                    <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-amber-400 to-amber-600 rounded-full" />
                  )}
                </button>
              );
            })}

            {/* Right side - Engine badge */}
            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded text-[10px] font-bold text-blue-400">
                A
              </div>
              <div className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-[10px] font-bold text-amber-400">
                B
              </div>
              <span className="text-[10px] text-gray-500">双引擎</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
