/**
 * 小组赛真实表现统计（服务端副本）
 * 客户端版本见 client/src/services/tournamentForm.ts。
 * 注意：服务端 Match.homeTeam/awayTeam 是 string（球队 ID），直接用作 key。
 */
import type { Match } from '../types/index.js';

export interface TournamentForm {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  ppg: number;
  attackStrength: number;
  defenseVulnerability: number;
  formRating: number;
}

const NEUTRAL: Omit<TournamentForm, 'teamId'> = {
  played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0,
  points: 0, ppg: 1.0, attackStrength: 1, defenseVulnerability: 1, formRating: 50,
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function computeTournamentForm(matches: Match[]): Map<string, TournamentForm> {
  const completed = matches.filter(
    (m) => m.status === 'completed' && m.score && m.stage === 'group',
  );

  interface Acc { played: number; won: number; drawn: number; lost: number; gf: number; ga: number; pts: number }
  const acc = new Map<string, Acc>();
  const ensure = (id: string): Acc => {
    let a = acc.get(id);
    if (!a) { a = { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 }; acc.set(id, a); }
    return a;
  };

  let totalGoals = 0;
  let totalTeamGames = 0;

  for (const m of completed) {
    const hid = m.homeTeam;
    const aid = m.awayTeam;
    const hs = m.score!.home;
    const as = m.score!.away;
    const h = ensure(hid);
    const a = ensure(aid);
    h.played++; a.played++;
    h.gf += hs; h.ga += as;
    a.gf += as; a.ga += hs;
    totalGoals += hs + as;
    totalTeamGames += 2;
    if (hs > as) { h.won++; h.pts += 3; a.lost++; }
    else if (hs < as) { a.won++; a.pts += 3; h.lost++; }
    else { h.drawn++; a.drawn++; h.pts++; a.pts++; }
  }

  const avgGpg = totalTeamGames > 0 ? totalGoals / totalTeamGames : 1.35;

  const formMap = new Map<string, TournamentForm>();
  for (const [teamId, s] of acc) {
    const ppg = s.pts / s.played;
    const attackStrength = avgGpg > 0 ? s.gf / s.played / avgGpg : 1;
    const defenseVulnerability = avgGpg > 0 ? s.ga / s.played / avgGpg : 1;
    const gdPerGame = (s.gf - s.ga) / s.played;
    const formRating = clamp(
      5, 95,
      50 + (ppg - 1.5) * 15 + (attackStrength - 1) * 22 - (defenseVulnerability - 1) * 22 + gdPerGame * 4,
    );
    formMap.set(teamId, {
      teamId, played: s.played, won: s.won, drawn: s.drawn, lost: s.lost,
      goalsFor: s.gf, goalsAgainst: s.ga, points: s.pts, ppg,
      attackStrength, defenseVulnerability, formRating,
    });
  }
  return formMap;
}

export function getForm(formMap: Map<string, TournamentForm> | undefined, teamId: string): TournamentForm {
  if (formMap) {
    const f = formMap.get(teamId);
    if (f) return f;
  }
  return { teamId, ...NEUTRAL };
}
