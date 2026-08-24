import type {
  AwardCode, Player, Rating, Round, RoundResult, Stance,
} from "./types";
import { AWARD_META, AWARDS } from "./types";

const P = {
  WIN: 3,
  MVP: 5,
  AWARD: 1,
  MISSION: 3,
  UNDERDOG_BONUS: 2,   // 소수편이 이겼을 때
  PICK_TOP: 2,
  FLIP_CAUSE: 1,       // 내 쪽으로 넘어온 사람 1명당
  PARTICIPATE: 1,
};

function tally(map: Record<string, string | undefined>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of Object.values(map)) if (v) out[v] = (out[v] ?? 0) + 1;
  return out;
}

function topKeys(t: Record<string, number>): { ids: string[]; n: number } {
  let n = 0;
  for (const v of Object.values(t)) n = Math.max(n, v);
  return { ids: Object.entries(t).filter(([, v]) => v === n).map(([k]) => k), n };
}

/** 라운드에서 쓰인 실제 진영 (밸런스=본인 선택, 찬반/변론=배정) */
export function sideOf(round: Round, playerId: string): Stance | undefined {
  if (round.mode === "PRO_CON" || round.mode === "ADVOCATE") {
    return round.assigned[playerId] ?? round.initialStances[playerId];
  }
  if (round.mode === "PERSUADE_ONE") {
    return round.assigned[playerId] ?? round.initialStances[playerId];
  }
  return round.initialStances[playerId];
}

/** 상세/빠른 평가를 하나의 Rating 합계로 환산 */
export function aggregateRatings(round: Round): Record<string, Rating & { count: number }> {
  const out: Record<string, Rating & { count: number }> = {};
  const ensure = (id: string) => {
    out[id] ??= { logic: 0, persuasion: 0, creativity: 0, humor: 0, punch: 0, count: 0 };
    return out[id];
  };

  for (const byRater of Object.values(round.ratings)) {
    for (const [rateeId, r] of Object.entries(byRater)) {
      const acc = ensure(rateeId);
      acc.logic += r.logic; acc.persuasion += r.persuasion;
      acc.creativity += r.creativity; acc.humor += r.humor; acc.punch += r.punch;
      acc.count += 1;
    }
  }
  for (const a of Object.values(round.quickAwards)) {
    const acc = ensure(a.rateeId);
    acc[AWARD_META[a.code].key] += 5;
    acc.count += 1;
  }
  return out;
}

/** 설득력 점수: 논리 0.3 · 설득 0.3 · 창의 0.2 · 웃음 0.2 (+한 방 보너스) */
export function persuasionScore(r: Rating, count: number): number {
  if (!count) return 0;
  const avg = (v: number) => v / count;
  return (
    avg(r.logic) * 0.3 + avg(r.persuasion) * 0.3 +
    avg(r.creativity) * 0.2 + avg(r.humor) * 0.2 +
    avg(r.punch) * 0.1
  );
}

function awardWinners(round: Round): Partial<Record<AwardCode, string>> {
  const out: Partial<Record<AwardCode, string>> = {};
  // 빠른 평가
  for (const code of AWARDS) {
    const t: Record<string, number> = {};
    for (const a of Object.values(round.quickAwards)) {
      if (a.code === code) t[a.rateeId] = (t[a.rateeId] ?? 0) + 1;
    }
    const { ids, n } = topKeys(t);
    if (n > 0 && ids.length) out[code] = ids[0];
  }
  // 상세 평가 — 항목별 최고 평균
  const agg = aggregateRatings(round);
  const entries = Object.entries(agg).filter(([, v]) => v.count > 0);
  if (entries.length && Object.keys(round.ratings).length) {
    for (const code of AWARDS) {
      if (out[code]) continue;
      const key = AWARD_META[code].key;
      let best: string | null = null; let bestV = -1;
      for (const [id, v] of entries) {
        const val = v[key] / v.count;
        if (val > bestV) { bestV = val; best = id; }
      }
      if (best && bestV > 0) out[code] = best;
    }
  }
  return out;
}

function headlineFor(
  round: Round,
  res: Omit<RoundResult, "headline">,
  players: Player[]
): string {
  const name = (id?: string | null) => players.find((p) => p.id === id)?.nickname ?? "???";
  const flips = res.flippers.length;

  if (round.mode === "FRIEND_RATING" || round.mode === "POINT") {
    const top = res.pickWinnerIds[0];
    if (!top) return "아무도 지목받지 못했습니다";
    const n = res.pickTally[top] ?? 0;
    if (res.pickWinnerIds.length > 1) return `공동 1위 ${res.pickWinnerIds.map(name).join(" · ")}`;
    return `${name(top)} — ${n}표로 압도적 지목`;
  }
  if (round.mode === "PERSUADE_ONE") {
    const flipped = res.flippers.includes(round.targetId ?? "");
    return flipped
      ? `${name(round.targetId)}의 마음이 돌아섰습니다`
      : `${name(round.targetId)}, 끝까지 버텼습니다`;
  }
  if (round.mode === "ADVOCATE") {
    return res.mvpId ? `${name(res.mvpId)}의 뻔뻔함이 승리했습니다` : "모두가 어색했던 라운드";
  }
  if (!res.winningStance) return "완벽한 동률. 아무도 못 이겼습니다";
  if (flips === 0) return "아무도 의견을 바꾸지 않았습니다";
  if (flips === 1) return `${name(res.flippers[0])} 한 명이 넘어갔습니다`;
  return `이번 토론에서 ${flips}명이 의견을 바꿨습니다`;
}

export function computeResult(round: Round, players: Player[]): RoundResult {
  const active = players.filter((p) => round.order.includes(p.id));
  const ids = active.map((p) => p.id);

  const initialTally = { A: 0, B: 0 };
  for (const id of ids) {
    const s = round.initialStances[id];
    if (s) initialTally[s] += 1;
  }

  const finalTally = { A: 0, B: 0 };
  for (const id of ids) {
    const s = round.votes[id]?.stance;
    if (s) finalTally[s] += 1;
  }

  const flippers = ids.filter((id) => {
    const before = round.initialStances[id];
    const after = round.votes[id]?.stance;
    return before && after && before !== after;
  });

  const winningStance: Stance | null =
    finalTally.A === finalTally.B ? null : finalTally.A > finalTally.B ? "A" : "B";

  const mvpTally = tally(Object.fromEntries(ids.map((id) => [id, round.votes[id]?.mvpId])));
  const mvpTop = topKeys(mvpTally);
  const mvpId = mvpTop.n > 0 ? mvpTop.ids[0] : null;

  const pickTally = tally(round.picks);
  const pickTop = topKeys(pickTally);
  const pickWinnerIds = pickTop.n > 0 ? pickTop.ids : [];

  const awards = awardWinners(round);

  // 승자 판정
  let winnerIds: string[] = [];
  switch (round.mode) {
    case "BALANCE":
    case "PRO_CON":
    case "MINORITY": {
      if (winningStance) winnerIds = ids.filter((id) => sideOf(round, id) === winningStance);
      break;
    }
    case "PERSUADE_ONE": {
      const t = round.targetId;
      const flipped = t ? flippers.includes(t) : false;
      winnerIds = flipped ? ids.filter((id) => id !== t) : t ? [t] : [];
      break;
    }
    case "ADVOCATE": {
      winnerIds = mvpId ? [mvpId] : [];
      break;
    }
    case "POINT":
    case "FRIEND_RATING": {
      winnerIds = pickWinnerIds;
      break;
    }
  }

  // 미션 판정
  let mission: RoundResult["mission"];
  if (round.mission) {
    const voters = Object.values(round.missionVotes);
    const yes = voters.filter(Boolean).length;
    const succeeded = voters.length === 0 ? null : yes * 2 >= voters.length;
    mission = { ...round.mission, succeeded };
  }

  // 점수
  const deltas: Record<string, number> = {};
  const add = (id: string, n: number) => { deltas[id] = (deltas[id] ?? 0) + n; };
  for (const id of ids) add(id, P.PARTICIPATE);
  for (const id of winnerIds) add(id, P.WIN);
  if (mvpId) add(mvpId, P.MVP);
  for (const id of Object.values(awards)) if (id) add(id, P.AWARD);
  if (mission?.succeeded) add(mission.playerId, P.MISSION);
  for (const id of pickWinnerIds) if (round.mode === "FRIEND_RATING") add(id, P.PICK_TOP);

  // 소수편이 이겼으면 언더독 보너스
  if (round.mode === "MINORITY" && round.minorityStance && winningStance === round.minorityStance) {
    for (const id of ids) {
      if (round.initialStances[id] === round.minorityStance) add(id, P.UNDERDOG_BONUS);
    }
  }
  // 내 쪽으로 넘어오게 만든 사람들에게 보너스
  if (winningStance && flippers.length) {
    const gained = flippers.filter((id) => round.votes[id]?.stance === winningStance).length;
    if (gained > 0) {
      for (const id of ids) {
        if (sideOf(round, id) === winningStance && !flippers.includes(id)) {
          add(id, gained * P.FLIP_CAUSE);
        }
      }
    }
  }

  const partial = {
    finalTally, initialTally, flippers, winningStance, winnerIds,
    mvpId, mvpVotes: mvpTop.n, pickTally, pickWinnerIds,
    awardWinners: awards, mission, deltas,
  };

  return { ...partial, headline: headlineFor(round, partial, players) };
}

/** 라운드 결과를 플레이어 통계에 반영 */
export function applyRoundToStats(players: Player[], round: Round, res: RoundResult): void {
  const agg = aggregateRatings(round);
  for (const p of players) {
    if (!round.order.includes(p.id)) continue;
    const s = p.stats;
    s.rounds += 1;
    if (res.winnerIds.includes(p.id)) s.wins += 1;
    if (res.mvpId === p.id) s.mvp += 1;
    if (res.flippers.includes(p.id)) s.flips += 1;
    else if (round.votes[p.id]?.stance) s.neverFlipped += 1;

    const side = sideOf(round, p.id);
    if (side === "A") s.stanceA += 1;
    else if (side === "B") s.stanceB += 1;

    s.picked += res.pickTally[p.id] ?? 0;

    if (res.mission?.playerId === p.id) {
      if (res.mission.succeeded) s.missionsDone += 1;
      else if (res.mission.succeeded === false) s.missionsFailed += 1;
    }

    const a = agg[p.id];
    if (a && a.count) {
      s.ratingSum.logic += a.logic;
      s.ratingSum.persuasion += a.persuasion;
      s.ratingSum.creativity += a.creativity;
      s.ratingSum.humor += a.humor;
      s.ratingSum.punch += a.punch;
      s.ratingCount += a.count;
    }
    for (const [code, id] of Object.entries(res.awardWinners)) {
      if (id === p.id) s.awards.push(code);
    }
    p.score += res.deltas[p.id] ?? 0;
  }
}
