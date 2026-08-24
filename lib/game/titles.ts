import type { Player, PlayerStats } from "./types";

export interface Title {
  code: string;
  emoji: string;
  ko: string;
  desc: string;
  /** 클수록 우선 표시 */
  priority: number;
  test: (s: PlayerStats, ctx: TitleContext) => boolean;
}

export interface TitleContext {
  totalRounds: number;
  /** 모든 플레이어 통계 (상대 비교용) */
  all: { id: string; stats: PlayerStats }[];
  selfId: string;
}

function avg(sum: number, count: number) {
  return count > 0 ? sum / count : 0;
}
function isTopIn(ctx: TitleContext, get: (s: PlayerStats) => number, min = 1): boolean {
  const mine = get(ctx.all.find((a) => a.id === ctx.selfId)!.stats);
  if (mine < min) return false;
  return ctx.all.every((a) => get(a.stats) <= mine) &&
    ctx.all.some((a) => a.id !== ctx.selfId && get(a.stats) < mine);
}

export const TITLES: Title[] = [
  {
    code: "LOGIC_KING", emoji: "🏆", ko: "논리왕", priority: 90,
    desc: "논리력 평가를 가장 많이 받았다",
    test: (s, c) => isTopIn(c, (x) => avg(x.ratingSum.logic, x.ratingCount)),
  },
  {
    code: "SILVER_TONGUE", emoji: "🔥", ko: "말빨왕", priority: 88,
    desc: "설득력 평가를 가장 많이 받았다",
    test: (s, c) => isTopIn(c, (x) => avg(x.ratingSum.persuasion, x.ratingCount)),
  },
  {
    code: "MOOD_MAKER", emoji: "😂", ko: "분위기메이커", priority: 80,
    desc: "웃음 평가를 가장 많이 받았다",
    test: (s, c) => isTopIn(c, (x) => avg(x.ratingSum.humor, x.ratingCount)),
  },
  {
    code: "PHILOSOPHER", emoji: "🧠", ko: "철학자", priority: 70,
    desc: "창의성 평가를 가장 많이 받았다",
    test: (s, c) => isTopIn(c, (x) => avg(x.ratingSum.creativity, x.ratingCount)),
  },
  {
    code: "DEVILS_ADVOCATE", emoji: "💀", ko: "악마의 변호인", priority: 75,
    desc: "말도 안 되는 입장을 가장 잘 방어했다",
    test: (s, c) => isTopIn(c, (x) => x.ratingSum.punch, 1) && s.mvp >= 1,
  },
  {
    code: "PERSUADER", emoji: "🎯", ko: "설득의 신", priority: 95,
    desc: "MVP를 가장 많이 받았다",
    test: (s, c) => isTopIn(c, (x) => x.mvp, 2),
  },
  {
    code: "OVERTHINKER", emoji: "🤡", ko: "뇌절 담당", priority: 40,
    desc: "말은 제일 많이 했는데 표는 못 받았다",
    test: (s) => s.rounds >= 3 && s.mvp === 0 && s.ratingCount >= 3,
  },
  {
    code: "IMMOVABLE", emoji: "🗿", ko: "끝까지 안 바뀜", priority: 65,
    desc: "한 번도 의견을 바꾸지 않았다",
    test: (s) => s.rounds >= 3 && s.flips === 0,
  },
  {
    code: "WEATHERVANE", emoji: "🌪️", ko: "갈대", priority: 60,
    desc: "의견을 가장 많이 바꿨다",
    test: (s, c) => isTopIn(c, (x) => x.flips, 2),
  },
  {
    code: "MOST_WANTED", emoji: "👑", ko: "지목 1순위", priority: 72,
    desc: "친구들에게 가장 많이 지목당했다",
    test: (s, c) => isTopIn(c, (x) => x.picked, 2),
  },
  {
    code: "AGENT", emoji: "🕶️", ko: "비밀요원", priority: 68,
    desc: "비밀 미션을 전부 성공시켰다",
    test: (s) => s.missionsDone >= 2 && s.missionsFailed === 0,
  },
  {
    code: "CHAMPION", emoji: "⚔️", ko: "토론 챔피언", priority: 100,
    desc: "가장 많은 라운드에서 이겼다",
    test: (s, c) => isTopIn(c, (x) => x.wins, 2),
  },
  {
    code: "UNDERDOG", emoji: "🐺", ko: "언더독", priority: 55,
    desc: "소수 의견을 자주 택하고도 살아남았다",
    test: (s) => s.rounds >= 3 && s.wins >= 1 && Math.abs(s.stanceA - s.stanceB) >= 2,
  },
  {
    code: "SURVIVOR", emoji: "🫡", ko: "완주자", priority: 20,
    desc: "끝까지 자리를 지켰다",
    test: (s, c) => s.rounds >= c.totalRounds,
  },
];

export function computeTitles(players: Player[], totalRounds: number): Record<string, string[]> {
  const all = players.map((p) => ({ id: p.id, stats: p.stats }));
  const out: Record<string, string[]> = {};
  for (const p of players) {
    const ctx: TitleContext = { totalRounds, all, selfId: p.id };
    const earned = TITLES.filter((t) => {
      try { return t.test(p.stats, ctx); } catch { return false; }
    })
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3)
      .map((t) => t.code);
    out[p.id] = earned.length ? earned : ["SURVIVOR"];
  }
  return out;
}

export const TITLE_INDEX = new Map(TITLES.map((t) => [t.code, t]));

export function titleOf(code: string) {
  return TITLE_INDEX.get(code) ?? { code, emoji: "🎖️", ko: code, desc: "", priority: 0 };
}
