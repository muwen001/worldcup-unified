import React, { useState } from 'react';

/**
 * Renders a team flag.
 *
 * Why images instead of emoji: flag emoji (regional-indicator sequences
 * like 🇲🇽) do NOT render on most Linux distros — Noto Color Emoji omits
 * flag glyphs (Google dropped them for neutrality), so they show as letter
 * pairs ("MX") or tofu on Arch/other Linux. Rendering an <img> works
 * consistently across all platforms.
 *
 * Flags are bundled locally (client/public/flags/<iso2>.png) and served
 * from the app's own origin — no external CDN, so adblockers / network
 * blocks / DNS issues can't break them.
 *
 * - UK subdivisions (Scotland/England) have no standard flag emoji and use
 *   inline SVG.
 * - All other teams: derive the ISO alpha-2 code directly from the emoji's
 *   two regional-indicator code points (they ARE the ISO2 letters) and load
 *   the local PNG. Falls back to the emoji if the image fails.
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

/** Convert a regional-indicator flag emoji (🇲🇽) to ISO alpha-2 ("mx"). */
function emojiToIso2(emoji: string): string | null {
  const chars = [...emoji];
  if (chars.length < 2) return null;
  const A = 0x1f1e6; // U+1F1E6 = regional indicator A
  const c0 = chars[0].codePointAt(0);
  const c1 = chars[1].codePointAt(0);
  if (c0 === undefined || c1 === undefined) return null;
  if (c0 < A || c0 > A + 25 || c1 < A || c1 > A + 25) return null;
  return String.fromCharCode(65 + (c0 - A), 65 + (c1 - A));
}

export const Flag: React.FC<{ teamId: string; emoji: string; className?: string }> = ({
  teamId,
  emoji,
  className,
}) => {
  const [imgFailed, setImgFailed] = useState(false);

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

  const iso2 = emojiToIso2(emoji);
  if (iso2 && !imgFailed) {
    return (
      <span className={`inline-flex items-center justify-center align-middle ${className ?? ''}`}>
        <img
          src={`${import.meta.env.BASE_URL}flags/${iso2}.png`}
          alt={iso2}
          loading="lazy"
          decoding="async"
          onError={() => setImgFailed(true)}
          style={{
            width: '1.5em',
            height: '1em',
            objectFit: 'cover',
            borderRadius: '2px',
            verticalAlign: 'middle',
            display: 'inline-block',
          }}
        />
      </span>
    );
  }

  // Fallback: raw emoji (e.g. if flagcdn unreachable or non-country emoji)
  return <span className={className}>{emoji}</span>;
};
