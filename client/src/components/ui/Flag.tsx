import React from 'react';

/**
 * Renders a team flag. Uses inline SVG for UK subdivision teams
 * (Scotland / England) because their subdivision-flag emoji does not render
 * on most platforms (Windows, many Android/Linux). All other teams use emoji.
 */
const SUBDIVISION_SVG: Record<string, React.ReactNode> = {
  // Scotland — Saltire (white diagonal cross on blue)
  sco: (
    <svg viewBox="0 0 60 36" className="w-full h-full" preserveAspectRatio="none">
      <rect width="60" height="36" fill="#0065BD" />
      <line x1="0" y1="0" x2="60" y2="36" stroke="#ffffff" strokeWidth="7" />
      <line x1="60" y1="0" x2="0" y2="36" stroke="#ffffff" strokeWidth="7" />
    </svg>
  ),
  // England — St George's Cross (red cross on white)
  eng: (
    <svg viewBox="0 0 60 36" className="w-full h-full" preserveAspectRatio="none">
      <rect width="60" height="36" fill="#ffffff" />
      <line x1="30" y1="0" x2="30" y2="36" stroke="#CF142B" strokeWidth="7" />
      <line x1="0" y1="18" x2="60" y2="18" stroke="#CF142B" strokeWidth="7" />
    </svg>
  ),
};

export const Flag: React.FC<{ teamId: string; emoji: string; className?: string }> = ({
  teamId,
  emoji,
  className,
}) => {
  const svg = SUBDIVISION_SVG[teamId];
  if (svg) {
    return (
      <span className={`inline-flex items-center justify-center align-middle ${className ?? ''}`}>
        <span className="inline-block overflow-hidden rounded-[2px]" style={{ width: '1.3em', height: '0.85em' }}>
          {svg}
        </span>
      </span>
    );
  }
  return <span className={className}>{emoji}</span>;
};
