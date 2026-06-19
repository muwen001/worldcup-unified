import React from 'react';
import { RefreshCw, Clock, Wifi, WifiOff, AlertCircle, CalendarDays, Shield, History } from 'lucide-react';
import { useApp } from '../../context/AppContext';

// 大力神杯 SVG 图标 - FIFA World Cup Trophy
const WorldCupTrophy: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="trophyGold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFD700" />
        <stop offset="30%" stopColor="#FFC125" />
        <stop offset="70%" stopColor="#FF8C00" />
        <stop offset="100%" stopColor="#FFD700" />
      </linearGradient>
      <linearGradient id="trophyHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFEC8B" />
        <stop offset="100%" stopColor="#FFD700" />
      </linearGradient>
      <linearGradient id="baseGreen" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#2E8B57" />
        <stop offset="100%" stopColor="#006400" />
      </linearGradient>
    </defs>
    
    {/* 地球仪 - 顶部圆形 */}
    <circle cx="16" cy="5" r="3.5" fill="url(#trophyGold)" stroke="#B8860B" strokeWidth="0.3"/>
    {/* 地球上的经线 */}
    <ellipse cx="16" cy="5" rx="1.5" ry="3.2" fill="none" stroke="#B8860B" strokeWidth="0.2" opacity="0.6"/>
    <line x1="12.5" y1="5" x2="19.5" y2="5" stroke="#B8860B" strokeWidth="0.2" opacity="0.6"/>
    
    {/* 杯身上部 - 倒梯形 */}
    <path d="M12.5 8.5 L19.5 8.5 L18 14 L14 14 Z" fill="url(#trophyGold)"/>
    
    {/* 杯身中部 - 最宽处 */}
    <path d="M14 14 L18 14 L17.5 18 L14.5 18 Z" fill="url(#trophyHighlight)"/>
    
    {/* 杯身下部 - 收窄 */}
    <path d="M14.5 18 L17.5 18 L17 21 L15 21 Z" fill="url(#trophyGold)"/>
    
    {/* 左侧把手 - 大力神左臂 */}
    <path d="M12.5 9 C10 9 8 10 7.5 12 C7 14 8 16 10 16.5 L12 16" fill="none" stroke="url(#trophyGold)" strokeWidth="1.5" strokeLinecap="round"/>
    
    {/* 右侧把手 - 大力神右臂 */}
    <path d="M19.5 9 C22 9 24 10 24.5 12 C25 14 24 16 22 16.5 L20 16" fill="none" stroke="url(#trophyGold)" strokeWidth="1.5" strokeLinecap="round"/>
    
    {/* 杯身装饰线 */}
    <line x1="13.5" y1="11" x2="18.5" y2="11" stroke="#B8860B" strokeWidth="0.3" opacity="0.7"/>
    <line x1="14" y1="15" x2="18" y2="15" stroke="#B8860B" strokeWidth="0.3" opacity="0.7"/>
    
    {/* 底座连接 */}
    <rect x="14" y="21" width="4" height="1.5" rx="0.3" fill="#B8860B"/>
    
    {/* 底座 - 绿色孔雀石 */}
    <rect x="11" y="22.5" width="10" height="2" rx="0.5" fill="url(#baseGreen)"/>
    
    {/* 底座底部 */}
    <rect x="10" y="24.5" width="12" height="1" rx="0.3" fill="#8B7355"/>
    
    {/* 高光效果 */}
    <path d="M14 9 L15 9 L14.5 13 L13.5 13 Z" fill="white" opacity="0.2"/>
  </svg>
);

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
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-500/20 to-amber-600/20 rounded-xl flex items-center justify-center border border-amber-500/30 shadow-lg shadow-amber-500/10">
                  <WorldCupTrophy className="w-7 h-7" />
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#0a1628] animate-pulse" />
              </div>
              <div>
                <h1 className="text-base font-bold text-white tracking-wide">
                  <span className="text-amber-400">FIFA</span> WORLD CUP 2026
                </h1>
                <p className="text-[10px] text-gray-400 tracking-widest uppercase">
                  AI Prediction System
                </p>
              </div>
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
