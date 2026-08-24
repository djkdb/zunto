import type { Category, DebateMode, Difficulty, Topic, Vibe } from "./types";
import { ALL_TOPICS } from "@/lib/data/topics";
import { shuffle, weightedPick, type Rand } from "./rng";

export interface RecommendInput {
  playerCount: number;
  vibe: Vibe;
  categories: Category[];      // 빈 배열 = 전체
  mode: DebateMode;
  difficulty: Difficulty;
  hour: number;                // 0~23 (현지 시각)
  usedTopicIds: string[];
  /** 라운드 번호 (1부터) */
  roundNo: number;
  /** 직전 라운드들의 재미도 1~5 */
  funHistory: number[];
  rand: Rand;
  pool?: Topic[];
}

/** 분위기별 목표치 */
const VIBE_TARGET: Record<Exclude<Vibe, "AUTO">, {
  intensity: number; difficulty: number; boost: Category[]; personBias: number;
}> = {
  CHILL: { intensity: 1.6, difficulty: 2.2, boost: ["FUN", "TRAVEL", "LIFE"], personBias: 0.7 },
  FUN:   { intensity: 2.4, difficulty: 2.0, boost: ["FUN", "TRAVEL", "FRIENDSHIP"], personBias: 1.1 },
  SPICY: { intensity: 4.2, difficulty: 2.8, boost: ["CHAOS", "FRIENDSHIP", "LOVE"], personBias: 1.9 },
  DEEP:  { intensity: 2.6, difficulty: 4.4, boost: ["DEEP", "LIFE", "MONEY", "WORK"], personBias: 0.4 },
  CHAOS: { intensity: 3.6, difficulty: 3.0, boost: ["CHAOS", "FUN", "LOVE"], personBias: 1.5 },
};

/** 오늘 분위기 앱이 골라줌 — 시간대 · 라운드 · 인원으로 결정 */
export function resolveAutoVibe(input: {
  hour: number; roundNo: number; playerCount: number; funHistory: number[]; rand: Rand;
}): Exclude<Vibe, "AUTO"> {
  const { hour, roundNo, playerCount, funHistory, rand } = input;
  const w: Record<Exclude<Vibe, "AUTO">, number> = {
    CHILL: 1, FUN: 1, SPICY: 1, DEEP: 1, CHAOS: 0.6,
  };

  // 초반은 가볍게 시작해서 뒤로 갈수록 진해진다
  if (roundNo <= 1) { w.CHILL += 1.8; w.FUN += 1.4; w.SPICY -= 0.5; w.DEEP -= 0.4; }
  else if (roundNo <= 3) { w.FUN += 1.2; w.SPICY += 0.6; }
  else { w.SPICY += 1.2; w.DEEP += 0.9; w.CHAOS += 0.7; }

  // 새벽에는 사람들이 진지해지거나 이상해진다
  if (hour >= 23 || hour < 4) { w.DEEP += 1.4; w.CHAOS += 0.9; w.CHILL -= 0.5; }
  else if (hour >= 19) { w.FUN += 0.8; w.SPICY += 0.6; }
  else if (hour >= 12) { w.CHILL += 0.5; w.FUN += 0.5; }
  else { w.CHILL += 1.0; w.DEEP += 0.3; }

  // 인원이 적으면 지목/평가류가 재미없다
  if (playerCount <= 2) { w.SPICY -= 1.2; w.DEEP += 0.6; }
  if (playerCount >= 6) { w.FUN += 0.6; w.SPICY += 0.4; }

  // 직전이 재미없었으면 판을 흔든다
  const lastFun = funHistory.at(-1);
  if (lastFun !== undefined && lastFun <= 2) { w.CHAOS += 1.5; w.SPICY += 1.0; w.DEEP -= 0.8; }
  if (lastFun !== undefined && lastFun >= 5) { w.DEEP += 0.4; }

  const keys = Object.keys(w) as Exclude<Vibe, "AUTO">[];
  return weightedPick(keys, keys.map((k) => Math.max(0.05, w[k])), rand);
}

function gaussian(x: number, target: number, sigma: number) {
  const d = x - target;
  return Math.exp(-(d * d) / (2 * sigma * sigma));
}

export interface ScoredTopic { topic: Topic; score: number }

export function scoreTopics(input: RecommendInput): ScoredTopic[] {
  const {
    playerCount, categories, mode, difficulty, hour, usedTopicIds, roundNo, funHistory, rand,
  } = input;

  const vibe: Exclude<Vibe, "AUTO"> =
    input.vibe === "AUTO"
      ? resolveAutoVibe({ hour, roundNo, playerCount, funHistory, rand })
      : input.vibe;

  const target = VIBE_TARGET[vibe];
  const used = new Set(usedTopicIds);
  const pool = input.pool ?? ALL_TOPICS;

  const out: ScoredTopic[] = [];
  for (const t of pool) {
    if (used.has(t.id)) continue;
    if ((t.minPlayers ?? 2) > playerCount) continue;
    if (!t.modes.includes(mode)) continue;

    let s = 1;

    // 카테고리 선호 (하드 필터가 아니라 강한 가중치)
    if (categories.length) {
      s *= categories.includes(t.category) ? 3.2 : 0.12;
    }
    // 분위기가 밀어주는 카테고리
    if (target.boost.includes(t.category)) s *= 1.7;

    // 강도 / 난이도 근접도
    s *= 0.25 + gaussian(t.intensity, target.intensity, 1.25);
    const diffTarget = (target.difficulty + difficulty) / 2;
    s *= 0.3 + gaussian(t.difficulty, diffTarget, 1.35);

    // 사람 지목형 편향
    const isPerson = !t.optionA && /사람|누구|누가/.test(t.text);
    if (isPerson) s *= target.personBias;

    // 새벽 보정 — 수위와 깊이가 올라간다
    if (hour >= 23 || hour < 4) {
      s *= 1 + (t.intensity - 2) * 0.09 + (t.difficulty - 3) * 0.07;
    }

    // 라운드 초반에는 센 주제를 뒤로 미룬다
    if (roundNo <= 1 && t.intensity >= 4) s *= 0.35;
    if (roundNo <= 2 && t.difficulty >= 5) s *= 0.5;

    // 인원이 적으면 지목형 감점
    if (playerCount <= 3 && isPerson) s *= 0.55;

    out.push({ topic: t, score: Math.max(0.0001, s) });
  }

  out.sort((a, b) => b.score - a.score);
  return out;
}

/** 상위 후보군에서 가중치 추첨 — 매번 똑같은 주제가 나오지 않게 */
export function recommendTopics(input: RecommendInput, count: number): Topic[] {
  const scored = scoreTopics(input);
  if (!scored.length) {
    // 조건이 너무 빡세면 모드만 맞춰서 아무거나
    const fallback = ALL_TOPICS.filter(
      (t) => t.modes.includes(input.mode) && (t.minPlayers ?? 2) <= input.playerCount
    );
    return shuffle(fallback, input.rand).slice(0, count);
  }
  const head = scored.slice(0, Math.max(count * 6, 24));
  const chosen: Topic[] = [];
  const remaining = head.slice();
  while (chosen.length < count && remaining.length) {
    const t = weightedPick(remaining, remaining.map((x) => x.score), input.rand);
    chosen.push(t.topic);
    const i = remaining.indexOf(t);
    remaining.splice(i, 1);
  }
  return chosen;
}

/** 모드 자동 선택 — 인원과 분위기, 직전 모드를 고려 */
export function recommendMode(input: {
  playerCount: number; vibe: Vibe; roundNo: number; lastModes: DebateMode[]; rand: Rand;
}): DebateMode {
  const { playerCount, vibe, roundNo, lastModes, rand } = input;
  const w: Record<DebateMode, number> = {
    BALANCE: 2.2, PRO_CON: 1.6, PERSUADE_ONE: 1.0,
    POINT: 1.0, MINORITY: 1.1, ADVOCATE: 1.0, FRIEND_RATING: 1.0,
  };

  if (playerCount < 3) {
    w.PERSUADE_ONE = 0; w.POINT = 0; w.FRIEND_RATING = 0; w.MINORITY = 0;
    w.BALANCE += 1.5; w.PRO_CON += 1.0; w.ADVOCATE += 0.8;
  }
  if (vibe === "SPICY") { w.POINT += 2.0; w.FRIEND_RATING += 1.8; w.PERSUADE_ONE += 0.6; }
  if (vibe === "DEEP") { w.PRO_CON += 1.4; w.MINORITY += 1.0; w.BALANCE += 0.6; w.POINT -= 0.6; }
  if (vibe === "FUN") { w.BALANCE += 1.4; w.ADVOCATE += 1.0; w.FRIEND_RATING += 0.8; }
  if (vibe === "CHAOS") { w.ADVOCATE += 1.6; w.MINORITY += 1.0; w.POINT += 0.8; }
  if (vibe === "CHILL") { w.BALANCE += 1.6; w.FRIEND_RATING += 0.6; w.PERSUADE_ONE -= 0.4; }

  // 첫 라운드는 무조건 쉬운 밸런스로 시작 (규칙 설명이 필요 없다)
  if (roundNo <= 1) { w.BALANCE += 3.5; w.POINT -= 0.5; w.PERSUADE_ONE -= 0.5; }

  // 직전 2라운드에 나온 모드는 피한다
  lastModes.slice(-2).forEach((m, i) => { w[m] *= i === 1 ? 0.15 : 0.4; });

  const keys = Object.keys(w) as DebateMode[];
  const weights = keys.map((k) => Math.max(0, w[k]));
  if (weights.every((x) => x <= 0)) return "BALANCE";
  return weightedPick(keys, weights, rand);
}
