import type { EventCode, PhaseId, Player, RandomEvent, Vibe } from "./types";
import { pick, weightedPick, type Rand } from "./rng";

interface EventTemplate {
  code: EventCode;
  title: string;
  desc: string;
  emoji: string;
  appliesFrom: PhaseId;
  minPlayers: number;
  weight: number;
}

const TEMPLATES: EventTemplate[] = [
  {
    code: "DEVILS_ADVOCATE", title: "악마의 변호인", emoji: "😈",
    desc: "지금부터 당신은 자기 의견의 반대편을 주장해야 합니다. 방금까지 한 말은 잊으세요.",
    appliesFrom: "REBUTTAL", minPlayers: 2, weight: 3,
  },
  {
    code: "DOUBLE_TIME", title: "더블 타임", emoji: "⏳",
    desc: "이번 라운드의 발언 시간이 2배가 됩니다. 할 말 없으면 그것도 재미겠네요.",
    appliesFrom: "SPEECH", minPlayers: 2, weight: 2,
  },
  {
    code: "ONE_WORD", title: "한 문장", emoji: "✂️",
    desc: "반박은 딱 한 문장으로만. 길게 말하는 순간 무효입니다.",
    appliesFrom: "REBUTTAL", minPlayers: 2, weight: 3,
  },
  {
    code: "TARGET", title: "타겟 지정", emoji: "🎯",
    desc: "이번 라운드는 지정된 한 명에게만 반박할 수 있습니다.",
    appliesFrom: "REBUTTAL", minPlayers: 3, weight: 3,
  },
  {
    code: "SILENT", title: "침묵의 30초", emoji: "🤫",
    desc: "지금부터 30초간 아무도 말할 수 없습니다. 눈으로만 싸우세요.",
    appliesFrom: "PREPARATION", minPlayers: 2, weight: 2,
  },
  {
    code: "CHAOS_SWAP", title: "주제 전환", emoji: "🌀",
    desc: "주제가 완전히 바뀝니다. 방금 준비한 건 전부 버리세요.",
    appliesFrom: "PREPARATION", minPlayers: 2, weight: 1,
  },
];

/** 분위기와 라운드 번호에 따라 이벤트 발생 확률을 정한다 */
export function eventChance(vibe: Vibe, roundNo: number): number {
  const base: Record<Vibe, number> = {
    CHILL: 0.12, FUN: 0.24, SPICY: 0.3, DEEP: 0.14, CHAOS: 0.55, AUTO: 0.24,
  };
  // 라운드가 쌓일수록 조금씩 자주 — 지루해질 때쯤 흔들어준다
  return Math.min(0.7, base[vibe] + Math.max(0, roundNo - 2) * 0.04);
}

export function rollEvent(
  vibe: Vibe,
  roundNo: number,
  players: Player[],
  rand: Rand
): RandomEvent | undefined {
  if (rand() > eventChance(vibe, roundNo)) return undefined;
  const pool = TEMPLATES.filter((t) => t.minPlayers <= players.length);
  if (!pool.length) return undefined;
  const t = weightedPick(pool, pool.map((x) => x.weight), rand);

  const ev: RandomEvent = {
    code: t.code, title: t.title, desc: t.desc, emoji: t.emoji, appliesFrom: t.appliesFrom,
  };
  if (t.code === "TARGET") {
    ev.payload = { targetId: pick(players, rand).id };
  }
  if (t.code === "DOUBLE_TIME") {
    ev.payload = { multiplier: 2 };
  }
  return ev;
}

/** 이벤트가 특정 페이즈의 시간을 늘리는지 */
export function timeMultiplier(ev: RandomEvent | undefined, phase: PhaseId): number {
  if (!ev) return 1;
  if (ev.code === "DOUBLE_TIME" && (phase === "SPEECH" || phase === "FINAL_ARGUMENT")) {
    return ev.payload?.multiplier ?? 2;
  }
  return 1;
}
