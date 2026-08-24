import type { Category, DebateMode, Difficulty, Intensity, Topic } from "@/lib/game/types";

export interface Seed {
  /** 주제 문장 */
  q: string;
  /** 선택지 A / B — 있으면 밸런스형 */
  a?: string;
  b?: string;
  /** 어울리는 모드 (생략 시 자동 추론) */
  m?: DebateMode[];
  d?: Difficulty;
  i?: Intensity;
  /** 후속 질문 */
  f?: string[];
  /** 최소 인원 */
  min?: number;
  tags?: string[];
}

const PERSON_MODES: DebateMode[] = ["POINT", "FRIEND_RATING"];
const BALANCE_MODES: DebateMode[] = ["BALANCE", "MINORITY", "PERSUADE_ONE"];
const STATEMENT_MODES: DebateMode[] = ["PRO_CON", "MINORITY", "ADVOCATE", "PERSUADE_ONE"];

/** 사람을 고르는 질문인지 휴리스틱으로 판별 */
function looksLikePersonQuestion(q: string) {
  return /사람|친구|누구|누가|멤버/.test(q) && /\?$/.test(q) && !/vs/i.test(q);
}

export function buildTopics(category: Category, prefix: string, seeds: Seed[]): Topic[] {
  return seeds.map((s, idx) => {
    const isBalance = Boolean(s.a && s.b);
    const isPerson = !isBalance && looksLikePersonQuestion(s.q);
    const modes =
      s.m ?? (isBalance ? BALANCE_MODES : isPerson ? PERSON_MODES : STATEMENT_MODES);
    return {
      id: `${prefix}-${String(idx + 1).padStart(3, "0")}`,
      text: s.q,
      category,
      modes,
      difficulty: (s.d ?? 3) as Difficulty,
      intensity: (s.i ?? 2) as Intensity,
      optionA: s.a,
      optionB: s.b,
      followUps: s.f,
      minPlayers: s.min ?? (isPerson ? 3 : 2),
      source: "builtin" as const,
      tags: s.tags,
    };
  });
}
