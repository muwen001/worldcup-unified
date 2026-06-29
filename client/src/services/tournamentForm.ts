/**
 * 小组赛真实表现统计
 * 用已完成的小组赛比赛（战绩 W/D/L、进球 GF、失球 GA）计算每队的攻防强度，
 * 作为额外信号叠加进预测引擎（不替换原有 FIFA 排名 / 赔率 / H2H）。
 *
 * - attackStrength:       (GF/场) / 联赛平均每队每场进球  >1 进攻强于平均
 * - defenseVulnerability: (GA/场) / 联赛平均每队每场进球  >1 防守差于平均（易失球）
 * - formRating: 0-100 综合分（积分、净胜球、攻防强度）
 * - momentum: -1~+1 走势信号（正值=越打越好，负值=走下坡路）
 */
import type { Match } from '../types';

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
  /** 走势动量 -1~+1：正值=状态上升（越打越好），负值=状态下滑 */
  momentum: number;
}

const NEUTRAL: Omit<TournamentForm, 'teamId'> = {
  played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0,
  points: 0, ppg: 1.0, attackStrength: 1, defenseVulnerability: 1, formRating: 50,
  momentum: 0,
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * 计算单队的走势动量 (momentum)。
 * 按比赛日期排序，越近的比赛权重越高（指数衰减 decay=0.7），
 * 计算加权 PPG 与实际 PPG 的差值，映射到 [-1, +1]。
 * 例：先输后连胜 → momentum > 0（上升趋势）
 */
function computeMomentum(teamMatches: { date: string; pts: number }[]): number {
  if (teamMatches.length < 2) return 0;
  // 按日期升序排列
  const sorted = [...teamMatches].sort((a, b) => a.date.localeCompare(b.date));
  const DECAY = 0.7;
  let weightedPts = 0;
  let totalWeight = 0;
  for (let i = 0; i < sorted.length; i++) {
    // 越近的比赛 i 越大，权重越高
    const w = Math.pow(1 / DECAY, i);
    weightedPts += sorted[i].pts * w;
    totalWeight += w;
  }
  const weightedPpg = weightedPts / totalWeight;
  const actualPpg = sorted.reduce((s, m) => s + m.pts, 0) / sorted.length;
  // 差值归一化：最大理论差值 ≈ 2（全输→全胜场景），映射到 [-1, 1]
  return clamp(weightedPpg - actualPpg, -1, 1);
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

  // 记录每队每场比赛的积分与日期，用于计算 momentum
  const teamMatchPts = new Map<string, { date: string; pts: number }[]>();
  const ensurePts = (id: string) => {
    if (!teamMatchPts.has(id)) teamMatchPts.set(id, []);
    return teamMatchPts.get(id)!;
  };

  let totalGoals = 0;
  let totalTeamGames = 0;

  for (const m of completed) {
    const hid = m.homeTeam.id;
    const aid = m.awayTeam.id;
    const hs = m.score!.home;
    const as = m.score!.away;
    const h = ensure(hid);
    const a = ensure(aid);
    h.played++; a.played++;
    h.gf += hs; h.ga += as;
    a.gf += as; a.ga += hs;
    totalGoals += hs + as;
    totalTeamGames += 2;
    const matchDate = m.date;
    if (hs > as) {
      h.won++; h.pts += 3; a.lost++;
      ensurePts(hid).push({ date: matchDate, pts: 3 });
      ensurePts(aid).push({ date: matchDate, pts: 0 });
    } else if (hs < as) {
      a.won++; a.pts += 3; h.lost++;
      ensurePts(hid).push({ date: matchDate, pts: 0 });
      ensurePts(aid).push({ date: matchDate, pts: 3 });
    } else {
      h.drawn++; a.drawn++; h.pts++; a.pts++;
      ensurePts(hid).push({ date: matchDate, pts: 1 });
      ensurePts(aid).push({ date: matchDate, pts: 1 });
    }
  }

  // 平均每队每场进球 = 总进球 / 总队次（总GF=总GA，单一基准）
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
    const momentum = computeMomentum(teamMatchPts.get(teamId) || []);
    formMap.set(teamId, {
      teamId, played: s.played, won: s.won, drawn: s.drawn, lost: s.lost,
      goalsFor: s.gf, goalsAgainst: s.ga, points: s.pts, ppg,
      attackStrength, defenseVulnerability, formRating, momentum,
    });
  }
  return formMap;
}

/** 查询某队 form；无小组赛记录时返回中性值（引擎回退原行为）。 */
export function getForm(formMap: Map<string, TournamentForm> | undefined, teamId: string): TournamentForm {
  if (formMap) {
    const f = formMap.get(teamId);
    if (f) return f;
  }
  return { teamId, ...NEUTRAL };
}
