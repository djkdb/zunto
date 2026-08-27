import type {
  DebateMode, Player, RoomSettings, Round, Stance, Step,
} from "./types";
import { shuffle, type Rand } from "./rng";

/* 기본 시간(ms) — 설정으로 스케일된다 */
export const T = {
  POSITION: 15_000,
  POSITION_PICK: 20_000,   // 사람 지목은 조금 더
  REAL_OPINION: 12_000,
  ASSIGN_REVEAL: 9_000,
  REVEAL: 11_000,
  PREPARATION: 30_000,
  REBUTTAL_PICK: 10_000,
  REBUTTAL: 30_000,
  FINAL: 20_000,
  GROUP_FINAL: 35_000,
  VOTING: 25_000,
  RATING: 30_000,
  EXPLAIN: 40_000,
  REASON: 25_000,
} as const;

export function activePlayers(players: Player[]): Player[] {
  return players.filter((p) => p.active && p.connected);
}

/** 라운드가 시작될 때의 앞부분(입장 선택/배정)만 만든다. 본론은 입장이 정해진 뒤 계산. */
export function buildHead(mode: DebateMode, settings: RoomSettings): Step[] {
  switch (mode) {
    case "BALANCE":
      return [
        { phase: "POSITION_SELECT", ms: T.POSITION, gate: "ALL_CHOSE" },
        { phase: "PREPARATION", ms: T.PREPARATION, gate: "NONE" },
      ];
    case "PRO_CON":
      return [
        { phase: "POSITION_SELECT", ms: T.REAL_OPINION, gate: "ALL_CHOSE", note: "REAL_OPINION" },
        { phase: "ASSIGN_REVEAL", ms: T.ASSIGN_REVEAL, gate: "NONE" },
        { phase: "PREPARATION", ms: T.PREPARATION, gate: "NONE" },
      ];
    case "PERSUADE_ONE":
      return [
        { phase: "POSITION_SELECT", ms: T.POSITION, gate: "ALL_CHOSE" },
        { phase: "ASSIGN_REVEAL", ms: T.ASSIGN_REVEAL, gate: "NONE" },
        { phase: "PREPARATION", ms: 20_000, gate: "NONE" },
      ];
    case "MINORITY":
      return [
        { phase: "POSITION_SELECT", ms: T.POSITION, gate: "ALL_CHOSE", note: "SECRET" },
        { phase: "REVEAL", ms: T.REVEAL, gate: "NONE", note: "MINORITY_REVEAL" },
        { phase: "PREPARATION", ms: 20_000, gate: "NONE" },
      ];
    case "ADVOCATE":
      return [
        { phase: "POSITION_SELECT", ms: T.REAL_OPINION, gate: "ALL_CHOSE", note: "REAL_OPINION" },
        { phase: "ASSIGN_REVEAL", ms: T.ASSIGN_REVEAL, gate: "NONE" },
        { phase: "PREPARATION", ms: 20_000, gate: "NONE" },
      ];
    case "POINT":
      return [
        { phase: "POSITION_SELECT", ms: T.POSITION_PICK, gate: "ALL_CHOSE", note: "PICK" },
        { phase: "REVEAL", ms: T.REVEAL, gate: "NONE", note: "PICK_REVEAL" },
      ];
    case "FRIEND_RATING":
      return [
        { phase: "POSITION_SELECT", ms: T.POSITION_PICK, gate: "ALL_CHOSE", note: "PICK_SECRET" },
        { phase: "REVEAL", ms: T.REVEAL + 2000, gate: "NONE", note: "PICK_REVEAL" },
      ];
  }
  void settings;
  return [];
}

/** 본론이 이미 만들어졌는가 */
export function hasBody(steps: Step[]) {
  return steps.some((s) => s.phase === "RESULT");
}

function tail(settings: RoomSettings, withVoting: boolean): Step[] {
  const out: Step[] = [];
  if (withVoting) {
    out.push({ phase: "VOTING", ms: T.VOTING, gate: "ALL_VOTED" });
    out.push({ phase: "REVEAL", ms: T.REVEAL, gate: "NONE", note: "VOTE_REVEAL" });
  }
  if (settings.peerRating !== "OFF") {
    out.push({
      phase: "RATING",
      ms: settings.peerRating === "DETAILED" ? T.RATING + 20_000 : T.RATING,
      gate: "ALL_RATED",
    });
  }
  out.push({ phase: "RESULT", ms: 0, gate: "HOST" });
  return out;
}

/** 발언 → 반박 → 최종 주장 블록 */
function debateBlock(
  order: string[],
  settings: RoomSettings,
  stances: Record<string, Stance | undefined> = {}
): Step[] {
  const out: Step[] = [];
  const n = order.length;

  for (const id of order) {
    out.push({ phase: "SPEECH", actorId: id, ms: settings.speechMs, gate: "NONE" });
  }

  if (n >= 2) {
    // 반박은 반드시 반대편에게 간다.
    // A/B 를 번갈아 세워도 인원이 한쪽으로 쏠리면 꼬리에서 순서가 깨져서,
    // "바로 앞 사람" 을 고르면 같은 편끼리 반박하게 된다.
    // 편마다 커서를 따로 돌려서 반대편 사람들에게 고르게 분배한다.
    const cursor = new Map<string, number>();
    order.forEach((id, i) => {
      const mine = stances[id];
      const foes = mine ? order.filter((o) => o !== id && stances[o] && stances[o] !== mine) : [];
      let target: string;
      if (foes.length) {
        const k = cursor.get(mine!) ?? 0;
        target = foes[k % foes.length];
        cursor.set(mine!, k + 1);
      } else {
        // 전원이 같은 편이라 반대편이 없다 — 바로 앞 사람을 반박한다
        target = order[(i - 1 + n) % n];
      }
      out.push({ phase: "REBUTTAL_PICK", actorId: id, targetId: target, ms: T.REBUTTAL_PICK, gate: "NONE" });
      out.push({ phase: "REBUTTAL", actorId: id, targetId: target, ms: T.REBUTTAL, gate: "NONE" });
    });
  }

  if (n <= 5) {
    for (const id of order) {
      out.push({ phase: "FINAL_ARGUMENT", actorId: id, ms: T.FINAL, gate: "NONE" });
    }
  } else {
    // 인원이 많으면 라운드가 길어지므로 공동 마무리 한 번
    out.push({ phase: "FINAL_ARGUMENT", ms: T.GROUP_FINAL, gate: "NONE", note: "GROUP" });
  }
  return out;
}

export interface BodyContext {
  mode: DebateMode;
  players: Player[];
  settings: RoomSettings;
  round: Round;
  rand: Rand;
}

/** 입장이 확정된 뒤 본론 스텝을 만든다 */
export function buildBody(ctx: BodyContext): Step[] {
  const { mode, players, settings, round, rand } = ctx;
  const act = activePlayers(players);
  const ids = round.order.filter((id) => act.some((p) => p.id === id));
  const out: Step[] = [];

  switch (mode) {
    case "BALANCE":
    case "PRO_CON":
    case "ADVOCATE": {
      // A/B 가 번갈아 말하도록 지그재그 정렬 — 대결 구도가 살아난다
      const stances = mode === "BALANCE" ? round.initialStances : round.assigned;
      const a = ids.filter((id) => stances[id] === "A");
      const b = ids.filter((id) => stances[id] !== "A");
      const zig: string[] = [];
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if (a[i]) zig.push(a[i]);
        if (b[i]) zig.push(b[i]);
      }
      const order = zig.length ? zig : ids;
      if (mode === "ADVOCATE") {
        for (const id of order) {
          out.push({ phase: "SPEECH", actorId: id, ms: settings.speechMs, gate: "NONE" });
        }
      } else {
        out.push(...debateBlock(order, settings, stances));
      }
      out.push(...tail(settings, true));
      break;
    }

    case "MINORITY": {
      const minority = round.minorityStance ?? "A";
      const few = ids.filter((id) => round.initialStances[id] === minority);
      const many = ids.filter((id) => round.initialStances[id] !== minority);
      // 소수가 먼저 변론
      for (const id of few) {
        out.push({ phase: "SPEECH", actorId: id, ms: settings.speechMs, gate: "NONE" });
      }
      // 다수가 반박
      for (const id of many) {
        const target = few[0] ?? id;
        out.push({ phase: "REBUTTAL_PICK", actorId: id, targetId: target, ms: T.REBUTTAL_PICK, gate: "NONE" });
        out.push({ phase: "REBUTTAL", actorId: id, targetId: target, ms: T.REBUTTAL, gate: "NONE" });
      }
      // 소수의 최후 변론
      for (const id of few) {
        out.push({ phase: "FINAL_ARGUMENT", actorId: id, ms: T.FINAL + 10_000, gate: "NONE" });
      }
      out.push(...tail(settings, true));
      break;
    }

    case "PERSUADE_ONE": {
      const target = round.targetId ?? ids[0];
      const others = shuffle(ids.filter((id) => id !== target), rand);
      out.push({ phase: "SPEECH", actorId: target, ms: settings.speechMs, gate: "NONE", note: "TARGET_OPENING" });
      for (const id of others) {
        out.push({ phase: "SPEECH", actorId: id, ms: settings.speechMs, gate: "NONE", note: "PERSUADE" });
      }
      out.push({ phase: "REBUTTAL_PICK", actorId: target, ms: T.REBUTTAL_PICK, gate: "NONE", note: "TARGET_DEFENSE" });
      out.push({ phase: "REBUTTAL", actorId: target, ms: T.REBUTTAL + 15_000, gate: "NONE", note: "TARGET_DEFENSE" });
      for (const id of others) {
        out.push({ phase: "FINAL_ARGUMENT", actorId: id, ms: T.FINAL, gate: "NONE", note: "LAST_PUSH" });
      }
      out.push(...tail(settings, true));
      break;
    }

    case "POINT": {
      const top = round.result?.pickWinnerIds?.[0] ?? topPicked(round.picks) ?? ids[0];
      out.push({ phase: "SPEECH", actorId: top, ms: T.EXPLAIN, gate: "NONE", note: "DEFEND_SELF" });
      for (const id of ids.filter((i) => i !== top)) {
        out.push({ phase: "SPEECH", actorId: id, ms: T.REASON, gate: "NONE", note: "WHY_PICKED" });
      }
      out.push(...tail(settings, false));
      break;
    }

    case "FRIEND_RATING": {
      const top = topPicked(round.picks) ?? ids[0];
      out.push({ phase: "SPEECH", actorId: top, ms: T.REASON + 5_000, gate: "NONE", note: "ACCEPTANCE" });
      out.push(...tail(settings, false));
      break;
    }
  }

  return out;
}

export function topPicked(picks: Record<string, string>): string | null {
  const tally: Record<string, number> = {};
  for (const t of Object.values(picks)) tally[t] = (tally[t] ?? 0) + 1;
  let best: string | null = null;
  let bestN = -1;
  for (const [id, n] of Object.entries(tally)) {
    if (n > bestN) { best = id; bestN = n; }
  }
  return best;
}

export function makeOrder(players: Player[], rand: Rand): string[] {
  return shuffle(activePlayers(players).map((p) => p.id), rand);
}

export function assignStances(ids: string[], rand: Rand): Record<string, Stance> {
  const shuffled = shuffle(ids, rand);
  const out: Record<string, Stance> = {};
  shuffled.forEach((id, i) => { out[id] = i % 2 === 0 ? "A" : "B"; });
  return out;
}
