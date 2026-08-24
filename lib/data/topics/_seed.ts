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

/**
 * id 가 배열 인덱스에서 만들어진다 (`money-007` 처럼).
 * 그래서 새 주제는 반드시 배열 끝에 붙여야 한다. 중간에 끼워넣거나 순서를 바꾸면
 * 그 뒤 주제들의 id 가 전부 밀려서, 이미 저장된 기록의 usedTopicIds 가 엉뚱한
 * 주제를 가리키게 된다. 주제를 빼야 한다면 지우지 말고 문장만 바꿔라.
 */
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
