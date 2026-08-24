import type { DebateMode } from "./types";
import { pick, type Rand } from "./rng";

export interface MissionTemplate {
  code: string;
  text: string;
  hint: string;
  minPlayers: number;
  modes?: DebateMode[];
}

export const MISSIONS: MissionTemplate[] = [
  { code: "MAKE_LAUGH", text: "상대방을 웃게 만들어라", hint: "누구든 한 명만 빵 터뜨리면 성공", minPlayers: 2 },
  { code: "FLIP_ONE", text: "반대편 사람의 의견을 바꾸게 만들어라", hint: "최종 투표에서 넘어오면 성공", minPlayers: 2 },
  { code: "ASK_TWICE", text: "최소 2번 질문하라", hint: "반박 대신 질문을 던져라", minPlayers: 2 },
  { code: "GET_AGREEMENT", text: "누군가 내 의견에 동의하게 만들어라", hint: "그래 맞아 소리를 들으면 성공", minPlayers: 2 },
  { code: "SELF_BETRAY", text: "마지막 발언에서 첫 주장과 반대되는 말을 해라", hint: "아무도 눈치채지 못하게", minPlayers: 2 },
  { code: "NAME_DROP", text: "다른 참가자의 이름을 3번 이상 불러라", hint: "자연스럽게 섞어야 한다", minPlayers: 3 },
  { code: "NO_BECAUSE", text: "왜냐하면 이라는 말을 한 번도 쓰지 마라", hint: "생각보다 어렵다", minPlayers: 2 },
  { code: "QUOTE_SOMEONE", text: "유명한 사람의 말을 인용해라", hint: "지어내도 아무도 모른다", minPlayers: 2 },
  { code: "STORY", text: "개인적인 경험담을 하나 풀어라", hint: "진짜일 필요는 없다", minPlayers: 2 },
  { code: "SHORT", text: "모든 발언을 10초 안에 끝내라", hint: "짧고 강하게", minPlayers: 2 },
  { code: "COMPLIMENT", text: "반대편 사람을 한 번 칭찬한 뒤 반박해라", hint: "칭찬 먼저, 칼은 나중에", minPlayers: 3 },
  { code: "NUMBER", text: "구체적인 숫자나 통계를 하나 말해라", hint: "출처는 묻지 않는다", minPlayers: 2 },
  { code: "REPEAT_KEY", text: "내 핵심 문장을 3번 반복해라", hint: "세뇌는 반복에서 온다", minPlayers: 2 },
  { code: "NEVER_YES", text: "상대 말에 절대 동의하지 마라", hint: "그래도 하지만 도 안 된다", minPlayers: 2 },
  { code: "LAST_WORD", text: "마지막 발언자가 되어라", hint: "순서를 눈치껏 잡아라", minPlayers: 3 },
];

export function rollMission(
  playerIds: string[],
  mode: DebateMode,
  rand: Rand
): { playerId: string; code: string; text: string } | undefined {
  if (!playerIds.length) return undefined;
  const pool = MISSIONS.filter(
    (m) => m.minPlayers <= playerIds.length && (!m.modes || m.modes.includes(mode))
  );
  if (!pool.length) return undefined;
  const m = pick(pool, rand);
  return { playerId: pick(playerIds, rand), code: m.code, text: m.text };
}

export function missionHint(code: string): string {
  return MISSIONS.find((m) => m.code === code)?.hint ?? "";
}
