import type {
  Action, Announcement, DebateMode, FinalSummary, Player, RoomSettings,
  RoomState, Round, Stance, Step, Topic,
} from "./types";
import { DEFAULT_SETTINGS, EMPTY_STATS, MODE_META } from "./types";
import { hashString, mulberry32, pick, type Rand } from "./rng";
import { activePlayers, buildBody, buildHead, hasBody, makeOrder, assignStances, topPicked } from "./steps";
import { rollEvent, timeMultiplier } from "./events";
import { rollMission } from "./missions";
import { recommendMode, recommendTopics } from "./recommend";
import { computeResult, applyRoundToStats, aggregateRatings, persuasionScore, sideOf } from "./scoring";
import { computeTitles } from "./titles";
import { nextAvatar, nextColor } from "./avatars";

export const OFFLINE_MS = 45_000;
/** 로비에서 이 시간 넘게 안 보이면 자리를 비워준다 */
export const LOBBY_DROP_MS = 5 * 60_000;
const MAX_ANNOUNCEMENTS = 14;

/* ── 유틸 ─────────────────────────────────────────────────────────────── */

function randFor(state: RoomState, salt: string): Rand {
  return mulberry32(hashString(`${state.code}:${state.roundNo}:${state.phaseToken}:${salt}`));
}

function say(state: RoomState, text: string, tone: Announcement["tone"] = "info") {
  const last = state.announcements[0];
  if (last && last.text === text) return;
  state.announcements = [
    { id: `${state.phaseToken}-${state.announcements.length}-${text.length}`, at: state.updatedAt, text, tone },
    ...state.announcements,
  ].slice(0, MAX_ANNOUNCEMENTS);
}

export function nameOf(state: RoomState, id?: string | null) {
  return state.players.find((p) => p.id === id)?.nickname ?? "누군가";
}

function isHost(state: RoomState, playerId: string) {
  return state.hostId === playerId;
}

/* ── 방 생성 / 참가 ───────────────────────────────────────────────────── */

export function createRoom(code: string, settings: Partial<RoomSettings>, now: number): RoomState {
  return {
    code,
    createdAt: now,
    updatedAt: now,
    hostId: "",
    status: "LOBBY",
    settings: { ...DEFAULT_SETTINGS, ...settings },
    players: [],
    phase: "LOBBY",
    phaseEndsAt: null,
    phaseStartedAt: now,
    phaseToken: 1,
    round: null,
    history: [],
    usedTopicIds: [],
    topicCandidates: [],
    topicVotes: {},
    announcements: [],
    funVotes: {},
    pendingMode: null,
    roundNo: 1,
    modeHistory: [],
    startedAt: null,
  };
}

export function uniqueNickname(state: RoomState, wanted: string, selfId: string): string {
  const base = wanted.trim().slice(0, 12) || "익명";
  const taken = state.players.filter((p) => p.id !== selfId).map((p) => p.nickname);
  if (!taken.includes(base)) return base;
  for (let i = 2; i < 50; i++) {
    const cand = `${base}${i}`;
    if (!taken.includes(cand)) return cand;
  }
  return `${base}${Math.floor(Math.random() * 900 + 100)}`;
}

export type JoinRejection = "NOT_FOUND" | "FULL" | "FINISHED";

export function canJoin(state: RoomState, playerId: string): JoinRejection | null {
  const existing = state.players.find((p) => p.id === playerId);
  if (existing) return null;                       // 재접속은 항상 허용
  if (state.status === "FINISHED") return "FINISHED";
  if (state.players.length >= state.settings.maxPlayers) return "FULL";
  return null;
}

/* ── 커넥션 관리 ──────────────────────────────────────────────────────── */

export function sweep(state: RoomState, now: number): boolean {
  let changed = false;
  for (const p of state.players) {
    const online = now - p.lastSeen < OFFLINE_MS;
    if (p.connected !== online) {
      p.connected = online;
      changed = true;
      if (!online) say(state, `${p.nickname} 님의 연결이 끊겼습니다`, "alert");
    }
  }
  if (ensureHost(state)) changed = true;
  // 로비에서 아주 오래 끊긴 사람만 정리한다 (폰을 잠깐 잠갔다고 빠지면 안 된다)
  if (state.status === "LOBBY") {
    const before = state.players.length;
    state.players = state.players.filter((p) => p.connected || now - p.lastSeen < LOBBY_DROP_MS);
    if (state.players.length !== before) changed = true;
  }
  return changed;
}

function ensureHost(state: RoomState): boolean {
  const host = state.players.find((p) => p.id === state.hostId);
  if (host?.connected) return false;
  const next = state.players.find((p) => p.connected) ?? state.players[0];
  if (!next) return false;
  if (next.id === state.hostId) return false;
  state.players.forEach((p) => { p.isHost = p.id === next.id; });
  state.hostId = next.id;
  say(state, `${next.nickname} 님이 새로운 방장이 되었습니다`, "alert");
  return true;
}

/* ── 페이즈 진입 ──────────────────────────────────────────────────────── */

function currentStep(state: RoomState): Step | null {
  const r = state.round;
  if (!r) return null;
  return r.steps[r.stepIndex] ?? null;
}

export function stepOf(state: RoomState): Step | null {
  return currentStep(state);
}

function enterStep(state: RoomState, index: number, now: number) {
  const r = state.round;
  if (!r) return;

  // 입장 선택 단계를 벗어나는 순간 배정/소수편을 확정한다
  if (state.phase === "POSITION_SELECT") finalizeStances(state, now);

  // 본론이 아직 없으면 만든다 (입장이 확정된 직후)
  if (index >= r.steps.length && !hasBody(r.steps)) {
    finalizeStances(state, now);
    const body = buildBody({
      mode: r.mode, players: state.players, settings: state.settings,
      round: r, rand: randFor(state, "body"),
    });
    r.steps = [...r.steps, ...body];
  }

  // 오프라인 발언자는 건너뛴다
  let i = index;
  let guard = 0;
  while (i < r.steps.length && guard++ < 200) {
    const s = r.steps[i];
    if (!s.actorId) break;
    const p = state.players.find((x) => x.id === s.actorId);
    if (p?.connected) break;
    i += 1;
  }

  if (i >= r.steps.length) {
    // 스텝이 끝났는데 RESULT 가 없었다면 결과로
    r.stepIndex = r.steps.length - 1;
    enterResult(state, now);
    return;
  }

  r.stepIndex = i;
  const step = r.steps[i];

  if (step.phase === "RESULT") {
    enterResult(state, now);
    return;
  }

  state.phase = step.phase;
  state.phaseStartedAt = now;
  state.phaseToken += 1;

  const mult = timeMultiplier(r.event, step.phase);
  state.phaseEndsAt = step.ms > 0 ? now + Math.round(step.ms * mult) : null;

  onPhaseEnter(state, step, now);
}

function onPhaseEnter(state: RoomState, step: Step, now: number) {
  const r = state.round!;
  const actor = nameOf(state, step.actorId);

  switch (step.phase) {
    case "POSITION_SELECT":
      if (step.note === "PICK" || step.note === "PICK_SECRET")
        say(state, "질문을 보고 한 명을 선택하세요", "action");
      else if (step.note === "REAL_OPINION")
        say(state, "먼저 당신의 진짜 생각부터. 아무도 못 봅니다", "action");
      else if (step.note === "SECRET")
        say(state, "비밀리에 입장을 선택하세요. 동시에 공개됩니다", "action");
      else say(state, "입장을 선택하세요", "action");
      break;
    case "ASSIGN_REVEAL":
      if (r.mode === "PERSUADE_ONE")
        say(state, `표적은 ${nameOf(state, r.targetId)} 님입니다`, "celebrate");
      else say(state, "입장이 배정되었습니다. 내 생각과 반대여도 그 편에서 말해보세요", "celebrate");
      break;
    case "REVEAL":
      if (step.note === "MINORITY_REVEAL") say(state, "결과 공개! 적은 쪽이 오늘의 주인공입니다", "celebrate");
      else if (step.note === "PICK_REVEAL") say(state, "모두의 선택을 공개합니다", "celebrate");
      else say(state, "투표 결과를 공개합니다", "celebrate");
      break;
    case "PREPARATION":
      applyEventAtPhase(state, "PREPARATION", now);
      say(state, "생각할 시간입니다. 뭘 말할지 정리하세요", "info");
      break;
    case "SPEECH":
      applyEventAtPhase(state, "SPEECH", now);
      if (step.note === "TARGET_OPENING") say(state, `${actor} 님, 왜 그렇게 생각하는지 말해주세요`, "action");
      else if (step.note === "PERSUADE") say(state, `${actor} 님, 설득을 시작하세요`, "action");
      else if (step.note === "DEFEND_SELF") say(state, `${actor} 님, 해명할 기회입니다`, "action");
      else if (step.note === "WHY_PICKED") say(state, `${actor} 님, 왜 그 사람을 골랐나요?`, "action");
      else if (step.note === "ACCEPTANCE") say(state, `${actor} 님의 소감을 들어봅시다`, "celebrate");
      else say(state, `지금은 ${actor} 님의 발언 시간입니다`, "action");
      break;
    case "REBUTTAL_PICK":
      applyEventAtPhase(state, "REBUTTAL", now);
      say(state, `${actor} 님, 반박 방식을 고르세요`, "action");
      break;
    case "REBUTTAL":
      say(state, `${actor} 님의 반박입니다`, "action");
      break;
    case "FINAL_ARGUMENT":
      say(state, step.actorId ? `${actor} 님의 최종 주장입니다` : "다 같이 마무리 한 마디씩", "action");
      break;
    case "VOTING":
      say(state, "이제 최종 투표입니다. 아무도 당신의 선택을 볼 수 없습니다", "action");
      break;
    case "RATING":
      say(state, "오늘의 어워드를 골라주세요", "action");
      break;
    default:
      break;
  }
}

/** 이벤트의 실제 효과를 적용 */
function applyEventAtPhase(state: RoomState, phase: "PREPARATION" | "SPEECH" | "REBUTTAL", now: number) {
  const r = state.round;
  if (!r?.event || r.event.appliesFrom !== phase) return;
  const ev = r.event;
  if (!state.announcements.some((a) => a.text.includes(ev.title))) {
    say(state, `${ev.emoji} ${ev.title} — ${ev.desc}`, "alert");
  }
  if (ev.code === "CHAOS_SWAP" && !ev.payload?.targetId) {
    const rand = randFor(state, "chaos-swap");
    const cands = recommendTopics(
      {
        playerCount: activePlayers(state.players).length,
        vibe: "CHAOS",
        categories: [],
        mode: r.mode,
        difficulty: state.settings.difficulty,
        hour: new Date(now).getHours(),
        usedTopicIds: [...state.usedTopicIds, r.topic.id],
        roundNo: state.roundNo,
        funHistory: Object.values(state.funVotes),
        rand,
      },
      1
    );
    if (cands[0]) {
      r.topic = cands[0];
      state.usedTopicIds.push(cands[0].id);
      ev.payload = { targetId: "done" };
      say(state, `주제가 바뀌었습니다 → ${cands[0].text}`, "alert");
    }
  }
}

/** 입장 선택이 끝난 시점에 배정/소수/표적을 확정 */
function finalizeStances(state: RoomState, now: number) {
  const r = state.round;
  if (!r) return;
  const act = activePlayers(state.players);
  const ids = act.map((p) => p.id);
  const rand = randFor(state, "stance");

  // 선택 안 한 사람은 랜덤으로 채운다 (게임이 멈추면 안 된다)
  for (const id of ids) {
    if (MODE_META[r.mode].isPickPerson) {
      if (!r.picks[id]) {
        const others = ids.filter((x) => x !== id);
        if (others.length) r.picks[id] = pick(others, rand);
      }
    } else if (!r.initialStances[id]) {
      r.initialStances[id] = rand() < 0.5 ? "A" : "B";
    }
  }

  if (r.mode === "MINORITY" && !r.minorityStance) {
    const a = ids.filter((id) => r.initialStances[id] === "A").length;
    const b = ids.length - a;
    // 아무도 없는 쪽을 소수로 잡으면 안 된다. 그러면 반박할 상대가 없어서
    // 전원이 자기 자신을 반박하는 스텝이 만들어진다.
    // 전원이 한쪽이면 그 쪽이 곧 전부다 — 반박 없이 각자 말하고 넘어간다.
    r.minorityStance =
      a === 0 ? "B" : b === 0 ? "A" : a === b ? (rand() < 0.5 ? "A" : "B") : a < b ? "A" : "B";
  }

  // 표적의 입장이 정해지면 나머지 전원은 자동으로 반대편이 된다
  if (r.mode === "PERSUADE_ONE" && r.targetId && !Object.keys(r.assigned).length) {
    const targetStance = r.initialStances[r.targetId] ?? "A";
    const opposite: Stance = targetStance === "A" ? "B" : "A";
    for (const id of ids) {
      r.assigned[id] = id === r.targetId ? targetStance : opposite;
    }
  }

  void now;
}

/**
 * 투표를 못 한 사람은 "의견이 안 바뀐 것"으로 본다.
 * 표가 증발해서 집계 총합이 줄어드는 걸 막는다. (MVP 표는 채우지 않는다)
 */
function fillMissingVotes(state: RoomState, now: number) {
  const r = state.round;
  if (!r) return;
  if (MODE_META[r.mode].isPickPerson) return;
  for (const id of r.order) {
    const p = state.players.find((x) => x.id === id);
    if (!p?.connected) continue;
    if (r.votes[id]?.stance) continue;
    const fallback = sideOf(r, id) ?? r.initialStances[id];
    if (!fallback) continue;
    r.votes[id] = { ...r.votes[id], stance: fallback, at: r.votes[id]?.at ?? now };
  }
}

function enterResult(state: RoomState, now: number) {
  const r = state.round;
  if (!r) return;
  if (!r.result) {
    // 아직 못 뽑은 선택/투표는 채워서 결과가 비지 않게 한다
    finalizeStances(state, now);
    fillMissingVotes(state, now);
    r.result = computeResult(r, state.players);
    applyRoundToStats(state.players, r, r.result);
    state.history.push(r.result);
    r.endedAt = now;
  }
  const resultIdx = r.steps.findIndex((s) => s.phase === "RESULT");
  if (resultIdx >= 0) r.stepIndex = resultIdx;
  state.phase = "RESULT";
  state.phaseEndsAt = null;
  state.phaseStartedAt = now;
  state.phaseToken += 1;
  say(state, r.result.headline, "celebrate");
}

/* ── 라운드 시작 ──────────────────────────────────────────────────────── */

function beginRoundSetup(state: RoomState, now: number) {
  state.round = null;
  state.topicCandidates = [];
  state.topicVotes = {};
  state.pendingMode = null;
  state.phaseStartedAt = now;
  state.phaseToken += 1;
  state.phaseEndsAt = null;

  const rand = randFor(state, "setup");
  const count = activePlayers(state.players).length;

  if (state.settings.modePolicy === "HOST") {
    state.phase = "MODE_SELECT";
    say(state, `라운드 ${state.roundNo} — 방장이 모드를 고르는 중입니다`, "info");
    return;
  }

  const mode = recommendMode({
    playerCount: count,
    vibe: state.settings.vibe,
    roundNo: state.roundNo,
    lastModes: state.modeHistory,
    rand,
  });
  applyMode(state, mode, now);
}

function applyMode(state: RoomState, mode: DebateMode, now: number) {
  state.pendingMode = mode;
  const rand = randFor(state, `topic-${mode}`);
  const count = activePlayers(state.players).length;
  const cands = recommendTopics(
    {
      playerCount: count,
      vibe: state.settings.vibe,
      categories: state.settings.categories,
      mode,
      difficulty: state.settings.difficulty,
      hour: new Date(now).getHours(),
      usedTopicIds: state.usedTopicIds,
      roundNo: state.roundNo,
      funHistory: Object.values(state.funVotes),
      rand,
    },
    state.settings.topicPolicy === "RANDOM" ? 1 : 3
  );

  if (state.settings.topicPolicy === "RANDOM") {
    if (cands[0]) { startRound(state, mode, cands[0], now); return; }
  }

  state.topicCandidates = cands;
  state.topicVotes = {};
  state.phase = "TOPIC_SELECT";
  state.phaseStartedAt = now;
  state.phaseToken += 1;
  state.phaseEndsAt = state.settings.topicPolicy === "VOTE" ? now + 20_000 : null;
  say(
    state,
    state.settings.topicPolicy === "VOTE"
      ? "오늘의 주제를 투표로 정합니다"
      : `${MODE_META[mode].ko} — 방장이 주제를 고르는 중입니다`,
    "info"
  );
}

export function startRound(state: RoomState, mode: DebateMode, topic: Topic, now: number) {
  const rand = randFor(state, `round-${state.roundNo}`);
  const act = activePlayers(state.players);
  const order = makeOrder(state.players, rand);
  const ids = act.map((p) => p.id);

  const round: Round = {
    no: state.roundNo,
    mode,
    topic,
    order,
    steps: buildHead(mode, state.settings),
    stepIndex: -1,
    initialStances: {},
    assigned: {},
    picks: {},
    rebuttals: {},
    votes: {},
    ratings: {},
    quickAwards: {},
    missionVotes: {},
    quotes: {},
    startedAt: now,
  };

  if (mode === "PRO_CON" || mode === "ADVOCATE") {
    round.assigned = assignStances(ids, rand);
  }
  if (mode === "PERSUADE_ONE") {
    round.targetId = pick(ids, rand);
  }
  if (state.settings.randomEvents) {
    round.event = rollEvent(state.settings.vibe, state.roundNo, act, rand);
  }
  if (state.settings.secretMissions) {
    round.mission = rollMission(ids, mode, rand);
  }

  // TARGET 이벤트는 반박 대상을 고정한다
  state.round = round;
  state.usedTopicIds.push(topic.id);
  state.status = "PLAYING";
  state.startedAt ??= now;
  state.pendingMode = null;
  state.topicCandidates = [];
  state.topicVotes = {};

  say(state, `라운드 ${round.no} — ${MODE_META[mode].ko}`, "celebrate");
  enterStep(state, 0, now);
}

/* ── 게이트 판정 ──────────────────────────────────────────────────────── */

export function gateSatisfied(state: RoomState): boolean {
  const step = currentStep(state);
  const r = state.round;

  if (state.phase === "TOPIC_SELECT" && state.settings.topicPolicy === "VOTE") {
    const act = activePlayers(state.players);
    return act.length > 0 && act.every((p) => state.topicVotes[p.id]);
  }
  if (!step || !r) return false;

  const act = activePlayers(state.players).filter((p) => r.order.includes(p.id));
  if (!act.length) return false;

  switch (step.gate) {
    case "ALL_CHOSE":
      return MODE_META[r.mode].isPickPerson
        ? act.every((p) => r.picks[p.id])
        : act.every((p) => r.initialStances[p.id]);
    case "ALL_VOTED":
      return act.every((p) => {
        const v = r.votes[p.id];
        if (!v) return false;
        const needStance = !MODE_META[r.mode].isPickPerson && r.mode !== "ADVOCATE";
        if (needStance && !v.stance) return false;
        return Boolean(v.mvpId) || act.length < 2;
      });
    case "ALL_RATED":
      if (state.settings.peerRating === "DETAILED") {
        return act.every((p) => Object.keys(r.ratings[p.id] ?? {}).length >= Math.max(1, act.length - 1));
      }
      return act.every((p) => Boolean(r.quickAwards[p.id]));
    default:
      return false;
  }
}

function maybeAdvanceOnGate(state: RoomState, now: number) {
  if (state.phase === "TOPIC_SELECT") {
    if (gateSatisfied(state)) resolveTopicVote(state, now);
    return;
  }
  const step = currentStep(state);
  if (!step || step.gate === "NONE" || step.gate === "HOST") return;
  if (gateSatisfied(state)) {
    say(state, gateMessage(step.gate), "celebrate");
    advance(state, now);
  }
}

function gateMessage(gate: string) {
  switch (gate) {
    case "ALL_CHOSE": return "전원 선택 완료";
    case "ALL_VOTED": return "모두 투표했습니다";
    case "ALL_RATED": return "평가가 모두 끝났습니다";
    default: return "";
  }
}

function resolveTopicVote(state: RoomState, now: number) {
  const best = topPicked(state.topicVotes) ?? state.topicCandidates[0]?.id;
  const topic = state.topicCandidates.find((t) => t.id === best) ?? state.topicCandidates[0];
  if (topic && state.pendingMode) startRound(state, state.pendingMode, topic, now);
}

/* ── 진행 ─────────────────────────────────────────────────────────────── */

export function advance(state: RoomState, now: number) {
  const r = state.round;
  if (!r) {
    if (state.phase === "TOPIC_SELECT") { resolveTopicVote(state, now); }
    return;
  }
  if (state.phase === "RESULT") return;
  enterStep(state, r.stepIndex + 1, now);
}

function finishGame(state: RoomState, now: number) {
  state.status = "FINISHED";
  state.phase = "FINISHED";
  state.phaseEndsAt = null;
  state.phaseStartedAt = now;
  state.phaseToken += 1;
  state.finalSummary = buildFinalSummary(state, now);
  say(state, "DEBATE NIGHT COMPLETE", "celebrate");
}

export function buildFinalSummary(state: RoomState, now: number): FinalSummary {
  const players = [...state.players].sort((a, b) => b.score - a.score);
  const best = (get: (p: Player) => number): string | null => {
    let top: Player | null = null;
    for (const p of state.players) {
      if (get(p) <= 0) continue;
      if (!top || get(p) > get(top)) top = p;
    }
    return top?.id ?? null;
  };
  const avgOf = (p: Player, k: keyof Player["stats"]["ratingSum"]) =>
    p.stats.ratingCount ? p.stats.ratingSum[k] / p.stats.ratingCount : 0;

  // 가장 강한 한마디 — 가장 많이 회자될 만한(길고 또렷한) 문장
  let bestQuote: FinalSummary["bestQuote"];
  const quotes = [...(state.allQuotes ?? [])];
  if (quotes.length) {
    quotes.sort((a, b) => b.score - a.score);
    bestQuote = { playerId: quotes[0].playerId, text: quotes[0].text };
  }

  return {
    totalRounds: state.history.length,
    playedAt: now,
    durationMs: state.startedAt ? now - state.startedAt : 0,
    standings: players.map((p) => ({
      playerId: p.id, nickname: p.nickname, avatar: p.avatar, score: p.score,
    })),
    champion: players[0]?.id ?? null,
    mostPersuasive: best((p) => p.stats.mvp) ?? best((p) => avgOf(p, "persuasion")),
    funniest: best((p) => avgOf(p, "humor")),
    mostLogical: best((p) => avgOf(p, "logic")),
    mostFlips: best((p) => p.stats.flips),
    stubborn: best((p) => (p.stats.flips === 0 ? p.stats.rounds : 0)),
    titles: computeTitles(state.players, state.history.length),
    bestQuote,
  };
}

/* ── 리듀서 ───────────────────────────────────────────────────────────── */

export function reduce(state: RoomState, action: Action, now: number): RoomState {
  state.updatedAt = now;

  // 하트비트
  if ("playerId" in action && action.playerId) {
    const me = state.players.find((p) => p.id === action.playerId);
    if (me) { me.lastSeen = now; me.connected = true; }
  }
  sweep(state, now);

  switch (action.type) {
    /* ── 로비 ── */
    case "JOIN": {
      const existing = state.players.find((p) => p.id === action.playerId);
      if (existing) {
        existing.connected = true;
        existing.lastSeen = now;
        if (action.nickname && action.nickname !== existing.nickname) {
          existing.nickname = uniqueNickname(state, action.nickname, existing.id);
        }
        if (action.avatar) existing.avatar = action.avatar;
        ensureHost(state);
        break;
      }
      const nickname = uniqueNickname(state, action.nickname, action.playerId);
      const player: Player = {
        id: action.playerId,
        nickname,
        avatar: action.avatar || nextAvatar(state.players.map((p) => p.avatar)),
        color: nextColor(state.players.map((p) => p.color)),
        isHost: state.players.length === 0,
        connected: true,
        lastSeen: now,
        ready: false,
        score: 0,
        active: state.status === "LOBBY",
        joinedAt: now,
        stats: structuredClone(EMPTY_STATS),
      };
      state.players.push(player);
      if (!state.hostId || state.players.length === 1) state.hostId = player.id;
      ensureHost(state);
      say(
        state,
        state.status === "LOBBY"
          ? `${nickname} 님이 입장했습니다`
          : `${nickname} 님이 입장했습니다 — 다음 라운드부터 참여합니다`,
        "info"
      );
      break;
    }

    case "PING": break;

    case "LEAVE": {
      const p = state.players.find((x) => x.id === action.playerId);
      if (!p) break;
      p.connected = false;
      p.lastSeen = 0;
      say(state, `${p.nickname} 님이 나갔습니다`, "alert");
      if (state.status === "LOBBY") {
        state.players = state.players.filter((x) => x.id !== action.playerId);
      }
      ensureHost(state);
      // 발언 중이던 사람이 나가면 즉시 넘어간다
      const step = currentStep(state);
      if (step?.actorId === action.playerId) advance(state, now);
      else maybeAdvanceOnGate(state, now);
      break;
    }

    case "SET_READY": {
      const p = state.players.find((x) => x.id === action.playerId);
      if (p) p.ready = action.ready;
      break;
    }

    case "KICK": {
      if (!isHost(state, action.playerId)) break;
      const t = state.players.find((x) => x.id === action.targetId);
      if (!t || t.id === state.hostId) break;
      state.players = state.players.filter((x) => x.id !== action.targetId);
      say(state, `${t.nickname} 님이 방에서 나갔습니다`, "alert");
      ensureHost(state);
      break;
    }

    case "UPDATE_SETTINGS": {
      if (!isHost(state, action.playerId)) break;
      const s = action.settings;
      const merged: RoomSettings = { ...state.settings, ...s };
      merged.maxPlayers = Math.min(8, Math.max(2, Math.max(merged.maxPlayers, state.players.length)));
      merged.totalRounds = Math.min(12, Math.max(1, merged.totalRounds));
      merged.speechMs = Math.min(180_000, Math.max(20_000, merged.speechMs));
      state.settings = merged;
      break;
    }

    case "START_GAME": {
      if (!isHost(state, action.playerId)) break;
      if (state.status !== "LOBBY") break;
      const act = state.players.filter((p) => p.connected);
      if (act.length < 2) break;
      state.players.forEach((p) => { p.active = p.connected; });
      state.status = "PLAYING";
      state.roundNo = 1;
      state.startedAt = now;
      say(state, "게임을 시작합니다", "celebrate");
      beginRoundSetup(state, now);
      break;
    }

    /* ── 라운드 세팅 ── */
    case "CHOOSE_MODE": {
      if (!isHost(state, action.playerId)) break;
      if (state.phase !== "MODE_SELECT") break;
      const count = activePlayers(state.players).length;
      if (MODE_META[action.mode].minPlayers > count) break;
      applyMode(state, action.mode, now);
      break;
    }

    case "REROLL_TOPICS": {
      if (!isHost(state, action.playerId)) break;
      if (state.phase !== "TOPIC_SELECT" || !state.pendingMode) break;
      state.phaseToken += 1;
      const rand = randFor(state, `reroll-${Date.now()}`);
      state.topicCandidates = recommendTopics(
        {
          playerCount: activePlayers(state.players).length,
          vibe: state.settings.vibe,
          categories: state.settings.categories,
          mode: state.pendingMode,
          difficulty: state.settings.difficulty,
          hour: new Date(now).getHours(),
          usedTopicIds: [...state.usedTopicIds, ...state.topicCandidates.map((t) => t.id)],
          roundNo: state.roundNo,
          funHistory: Object.values(state.funVotes),
          rand,
        },
        3
      );
      state.topicVotes = {};
      break;
    }

    case "CHOOSE_TOPIC": {
      if (state.phase !== "TOPIC_SELECT") break;
      if (state.settings.topicPolicy === "VOTE") break;
      if (!isHost(state, action.playerId)) break;
      const mode = state.pendingMode ?? "BALANCE";
      startRound(state, mode, action.topic, now);
      break;
    }

    case "VOTE_TOPIC": {
      if (state.phase !== "TOPIC_SELECT") break;
      state.topicVotes[action.playerId] = action.topicId;
      maybeAdvanceOnGate(state, now);
      break;
    }

    /* ── 플레이 ── */
    case "CHOOSE_STANCE": {
      const r = state.round;
      if (!r || state.phase !== "POSITION_SELECT") break;
      r.initialStances[action.playerId] = action.stance;
      maybeAdvanceOnGate(state, now);
      break;
    }

    case "PICK_PLAYER": {
      const r = state.round;
      if (!r || state.phase !== "POSITION_SELECT") break;
      if (action.targetId === action.playerId) break;
      r.picks[action.playerId] = action.targetId;
      maybeAdvanceOnGate(state, now);
      break;
    }

    case "CHOOSE_REBUTTAL": {
      const r = state.round;
      const step = currentStep(state);
      if (!r || state.phase !== "REBUTTAL_PICK") break;
      if (step?.actorId !== action.playerId) break;
      r.rebuttals[action.playerId] = action.kind;
      advance(state, now);
      break;
    }

    case "SUBMIT_VOTE": {
      const r = state.round;
      if (!r || state.phase !== "VOTING") break;
      r.votes[action.playerId] = { ...action.vote, at: now };
      maybeAdvanceOnGate(state, now);
      break;
    }

    case "SUBMIT_QUICK_AWARD": {
      const r = state.round;
      if (!r || state.phase !== "RATING") break;
      if (action.rateeId === action.playerId) break;
      r.quickAwards[action.playerId] = { code: action.code, rateeId: action.rateeId };
      maybeAdvanceOnGate(state, now);
      break;
    }

    case "SUBMIT_RATING": {
      const r = state.round;
      if (!r || state.phase !== "RATING") break;
      r.ratings[action.playerId] = action.ratings;
      maybeAdvanceOnGate(state, now);
      break;
    }

    case "SUBMIT_QUOTE": {
      const r = state.round;
      if (!r) break;
      const text = action.text.trim().slice(0, 90);
      if (text) {
        r.quotes[action.playerId] = text;
        state.allQuotes = [
          ...(state.allQuotes ?? []).filter(
            (q) => !(q.playerId === action.playerId && q.round === r.no)
          ),
          { playerId: action.playerId, text, score: text.length, round: r.no },
        ];
      }
      break;
    }

    case "MISSION_VOTE": {
      const r = state.round;
      if (!r?.mission) break;
      if (action.playerId === r.mission.playerId) break;
      r.missionVotes[action.playerId] = action.success;
      if (r.result) {
        const voters = Object.values(r.missionVotes);
        const yes = voters.filter(Boolean).length;
        r.result.mission = {
          ...r.mission,
          succeeded: voters.length === 0 ? null : yes * 2 >= voters.length,
        };
      }
      break;
    }

    case "FUN_VOTE": {
      const no = state.round?.no ?? state.roundNo;
      const prev = state.funVotes[no] ?? 0;
      const count = state.funVoteCounts?.[no] ?? 0;
      state.funVoteCounts = { ...(state.funVoteCounts ?? {}), [no]: count + 1 };
      state.funVotes[no] = (prev * count + action.score) / (count + 1);
      break;
    }

    /* ── 전이 ── */
    case "ADVANCE": {
      if (action.phaseToken !== state.phaseToken) break;
      const step = currentStep(state);
      const allowed =
        isHost(state, action.playerId) ||
        (step?.actorId ? step.actorId === action.playerId : false);
      if (!allowed) break;
      if (state.phase === "RESULT") break;
      advance(state, now);
      break;
    }

    case "TIMEOUT": {
      if (action.phaseToken !== state.phaseToken) break;
      if (state.phaseEndsAt === null) break;
      if (now < state.phaseEndsAt - 250) break;
      if (state.phase === "TOPIC_SELECT") { resolveTopicVote(state, now); break; }
      // 시간이 끝났는데 선택을 안 한 사람은 랜덤으로 채우고 진행
      advance(state, now);
      break;
    }

    case "EXTEND_TIME": {
      const step = currentStep(state);
      const allowed = isHost(state, action.playerId) || step?.actorId === action.playerId;
      if (!allowed || state.phaseEndsAt === null) break;
      const delta = Math.max(-60_000, Math.min(120_000, action.ms));
      state.phaseEndsAt = Math.max(now + 3_000, state.phaseEndsAt + delta);
      say(state, delta > 0 ? `시간이 ${Math.round(delta / 1000)}초 늘어났습니다` : "시간을 단축했습니다", "alert");
      break;
    }

    case "NEXT_ROUND": {
      if (!isHost(state, action.playerId)) break;
      if (state.phase !== "RESULT") break;
      if (state.round) state.modeHistory.push(state.round.mode);
      // 대기 중이던 늦은 참가자를 합류시킨다
      state.players.forEach((p) => { if (p.connected) p.active = true; });
      if (state.roundNo >= state.settings.totalRounds) {
        finishGame(state, now);
      } else {
        state.roundNo += 1;
        state.phase = "ROUND_INTERMISSION";
        beginRoundSetup(state, now);
      }
      break;
    }

    case "END_GAME": {
      if (!isHost(state, action.playerId)) break;
      if (state.round && state.phase !== "RESULT" && !state.round.result) {
        enterResult(state, now);
      }
      if (state.round) state.modeHistory.push(state.round.mode);
      finishGame(state, now);
      break;
    }

    case "RESTART": {
      if (!isHost(state, action.playerId)) break;
      state.status = "LOBBY";
      state.phase = "LOBBY";
      state.phaseEndsAt = null;
      state.phaseToken += 1;
      state.round = null;
      state.history = [];
      state.usedTopicIds = [];
      state.roundNo = 1;
      state.modeHistory = [];
      state.funVotes = {};
      state.funVoteCounts = {};
      state.allQuotes = [];
      state.finalSummary = undefined;
      state.startedAt = null;
      state.players.forEach((p) => {
        p.score = 0;
        p.ready = false;
        p.active = p.connected;
        p.stats = structuredClone(EMPTY_STATS);
      });
      say(state, "새 게임 준비 완료", "celebrate");
      break;
    }
  }

  return state;
}

/** 타이머 만료를 서버에서 직접 처리 */
export function tick(state: RoomState, now: number): boolean {
  const before = state.phaseToken;
  const changed = sweep(state, now);
  if (state.phaseEndsAt !== null && now >= state.phaseEndsAt) {
    if (state.phase === "TOPIC_SELECT") resolveTopicVote(state, now);
    else advance(state, now);
  } else {
    // 발언자가 오프라인이면 기다리지 않는다
    const step = currentStep(state);
    if (step?.actorId) {
      const p = state.players.find((x) => x.id === step.actorId);
      if (p && !p.connected) advance(state, now);
    }
    maybeAdvanceOnGate(state, now);
  }
  return changed || state.phaseToken !== before;
}

export { aggregateRatings, persuasionScore };
