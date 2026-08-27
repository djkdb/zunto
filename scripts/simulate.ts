/* 전체 게임을 헤드리스로 돌려보는 시뮬레이터. npm run simulate */
import {
  createRoom, reduce, tick, stepOf, canJoin,
} from "../lib/game/machine";
import { MODES, type Action, type DebateMode, type RoomState, type RoomSettings } from "../lib/game/types";
import { MODE_META } from "../lib/game/types";

let now = Date.now();
const advanceClock = (ms: number) => { now += ms; };

function apply(state: RoomState, a: Action) {
  reduce(state, a, now);
}

function activeIds(s: RoomState) {
  return s.players.filter((p) => p.active && p.connected).map((p) => p.id);
}

function heartbeatAll(s: RoomState) {
  s.players.forEach((p) => { if (p.connected) p.lastSeen = now; });
}

interface SimOpts {
  players: number;
  rounds: number;
  mode?: DebateMode;
  settings?: Partial<RoomSettings>;
  /** 라운드 중간에 한 명이 나가는가 */
  dropout?: boolean;
  verbose?: boolean;
}

function simulate(opts: SimOpts) {
  const log: string[] = [];
  const say = (s: string) => { if (opts.verbose) console.log("   " + s); log.push(s); };

  const state = createRoom("SIMU01", {
    totalRounds: opts.rounds,
    maxPlayers: 8,
    speechMs: 30_000,
    modePolicy: opts.mode ? "HOST" : "RANDOM",
    topicPolicy: "RANDOM",
    peerRating: "QUICK",
    randomEvents: true,
    secretMissions: true,
    ...opts.settings,
  }, now);

  for (let i = 0; i < opts.players; i++) {
    const id = `p${i}`;
    if (canJoin(state, id) === null) {
      apply(state, { type: "JOIN", playerId: id, nickname: `P${i}`, avatar: "" });
    }
  }
  if (state.players.length !== opts.players) throw new Error("참가자 수 불일치");

  apply(state, { type: "START_GAME", playerId: state.hostId });

  let guard = 0;
  const seenPhases = new Set<string>();
  let droppedAt = -1;

  while (state.phase !== "FINISHED" && guard++ < 4000) {
    heartbeatAll(state);
    const host = state.hostId;
    const step = stepOf(state);
    seenPhases.add(state.phase);

    switch (state.phase) {
      case "MODE_SELECT": {
        const count = activeIds(state).length;
        const pool = MODES.filter((m) => MODE_META[m].minPlayers <= count);
        const m = opts.mode && pool.includes(opts.mode) ? opts.mode : pool[guard % pool.length];
        apply(state, { type: "CHOOSE_MODE", playerId: host, mode: m });
        break;
      }
      case "TOPIC_SELECT": {
        if (state.settings.topicPolicy === "VOTE") {
          for (const id of activeIds(state)) {
            apply(state, { type: "VOTE_TOPIC", playerId: id, topicId: state.topicCandidates[0].id });
          }
        } else {
          apply(state, { type: "CHOOSE_TOPIC", playerId: host, topic: state.topicCandidates[0] });
        }
        break;
      }
      case "POSITION_SELECT": {
        const r = state.round!;
        const ids = activeIds(state);
        for (const id of ids) {
          if (MODE_META[r.mode].isPickPerson) {
            const others = ids.filter((x) => x !== id);
            if (others.length) {
              apply(state, { type: "PICK_PLAYER", playerId: id, targetId: others[guard % others.length] });
            }
          } else {
            apply(state, { type: "CHOOSE_STANCE", playerId: id, stance: guard % 3 === 0 ? "A" : "B" });
          }
        }
        break;
      }
      case "REBUTTAL_PICK": {
        const actor = step?.actorId;
        if (actor) apply(state, { type: "CHOOSE_REBUTTAL", playerId: actor, kind: "LOGIC" });
        else { advanceClock((step?.ms ?? 1000) + 300); apply(state, { type: "TIMEOUT", phaseToken: state.phaseToken }); }
        break;
      }
      case "VOTING": {
        const r = state.round!;
        const ids = activeIds(state);
        for (const id of ids) {
          const others = ids.filter((x) => x !== id);
          apply(state, {
            type: "SUBMIT_VOTE",
            playerId: id,
            vote: {
              stance: guard % 2 === 0 ? "A" : "B",
              mvpId: others[0],
            },
          });
          if (id === ids[0]) {
            apply(state, { type: "SUBMIT_QUOTE", playerId: id, text: `라운드 ${r.no}의 명언입니다` });
          }
        }
        break;
      }
      case "RATING": {
        const ids = activeIds(state);
        for (const id of ids) {
          const others = ids.filter((x) => x !== id);
          if (!others.length) {
            advanceClock((step?.ms ?? 1000) + 300);
            apply(state, { type: "TIMEOUT", phaseToken: state.phaseToken });
            break;
          }
          if (state.settings.peerRating === "DETAILED") {
            const ratings = Object.fromEntries(
              others.map((o) => [o, { logic: 4, persuasion: 3, creativity: 5, humor: 2, punch: 4 }])
            );
            apply(state, { type: "SUBMIT_RATING", playerId: id, ratings });
          } else {
            apply(state, { type: "SUBMIT_QUICK_AWARD", playerId: id, code: "LOGIC", rateeId: others[0] });
          }
        }
        break;
      }
      case "RESULT": {
        const r = state.round!;
        if (r.mission) {
          for (const id of activeIds(state)) {
            if (id !== r.mission.playerId) {
              apply(state, { type: "MISSION_VOTE", playerId: id, success: true });
            }
          }
        }
        apply(state, { type: "FUN_VOTE", playerId: host, score: 4 });

        // 중간에 한 명 이탈시켜 보기
        if (opts.dropout && droppedAt < 0 && state.roundNo === 2) {
          const victim = state.players.find((p) => p.id !== host && p.connected);
          if (victim) {
            droppedAt = state.roundNo;
            apply(state, { type: "LEAVE", playerId: victim.id });
            say(`  ⚠︎ ${victim.nickname} 이탈`);
          }
        }
        apply(state, { type: "NEXT_ROUND", playerId: host });
        break;
      }
      default: {
        // 시간 기반 페이즈 — 시계를 돌려서 타임아웃
        const ms = state.phaseEndsAt !== null ? state.phaseEndsAt - now : 1000;
        advanceClock(Math.max(50, ms) + 200);
        heartbeatAll(state);
        const before = state.phaseToken;
        apply(state, { type: "TIMEOUT", phaseToken: before });
        if (state.phaseToken === before) {
          // 타임아웃이 안 먹으면 서버 tick 으로 밀어본다
          tick(state, now);
        }
        if (state.phaseToken === before) {
          throw new Error(`페이즈가 진행되지 않음: ${state.phase} (step ${state.round?.stepIndex})`);
        }
        break;
      }
    }
    advanceClock(120);
  }

  if (guard >= 4000) throw new Error("무한 루프 감지");
  if (state.phase !== "FINISHED") throw new Error("게임이 끝나지 않음");
  if (!state.finalSummary) throw new Error("최종 요약 없음");
  if (state.history.length !== opts.rounds) {
    throw new Error(`라운드 수 불일치: ${state.history.length} !== ${opts.rounds}`);
  }
  return { state, seenPhases, log };
}

/* ── 실행 ─────────────────────────────────────────────────────────────── */

const results: string[] = [];
let failures = 0;

function run(name: string, fn: () => void) {
  now = Date.now();
  try {
    fn();
    results.push(`✅ ${name}`);
  } catch (e) {
    failures++;
    results.push(`❌ ${name} — ${(e as Error).message}`);
  }
}

// 인원 2~8명 전부
for (let n = 2; n <= 8; n++) {
  run(`플레이어 ${n}명 · 3라운드 · 랜덤 모드`, () => {
    const { state } = simulate({ players: n, rounds: 3 });
    if (state.finalSummary!.standings.length !== n) throw new Error("최종 순위 인원 불일치");
  });
}

// 모드별
for (const mode of MODES) {
  const need = MODE_META[mode].minPlayers;
  run(`모드 ${mode} (${need}인 이상)`, () => {
    const { state, seenPhases } = simulate({ players: Math.max(4, need), rounds: 2, mode });
    if (!seenPhases.has("RESULT")) throw new Error("RESULT 미도달");
    if (state.history.some((h) => !h.headline)) throw new Error("헤드라인 없음");
  });
}

// 이탈 / 예외
run("라운드 중 이탈해도 계속 진행", () => {
  simulate({ players: 5, rounds: 4, dropout: true });
});

run("주제 투표 방식", () => {
  simulate({ players: 4, rounds: 2, settings: { topicPolicy: "VOTE", modePolicy: "RANDOM" } });
});

run("상세 평가 방식", () => {
  const { state } = simulate({ players: 4, rounds: 2, settings: { peerRating: "DETAILED" } });
  if (!state.players.some((p) => p.stats.ratingCount > 0)) throw new Error("평가가 집계되지 않음");
});

run("평가 끄기", () => {
  simulate({ players: 3, rounds: 2, settings: { peerRating: "OFF" } });
});

run("이벤트/미션 끄기", () => {
  simulate({ players: 4, rounds: 2, settings: { randomEvents: false, secretMissions: false } });
});

run("긴 게임 · 8라운드", () => {
  const { state } = simulate({ players: 4, rounds: 8 });
  const total = state.players.reduce((a, p) => a + p.score, 0);
  if (total <= 0) throw new Error("점수가 전혀 오르지 않음");
});

run("칭호가 부여된다", () => {
  const { state } = simulate({ players: 4, rounds: 5 });
  const titles = state.finalSummary!.titles;
  if (Object.values(titles).some((t) => t.length === 0)) throw new Error("칭호 없는 플레이어 존재");
});

run("호스트가 나가면 위임된다", () => {
  now = Date.now();
  const s = createRoom("HOST01", { totalRounds: 2 }, now);
  reduce(s, { type: "JOIN", playerId: "a", nickname: "A", avatar: "" }, now);
  reduce(s, { type: "JOIN", playerId: "b", nickname: "B", avatar: "" }, now);
  reduce(s, { type: "JOIN", playerId: "c", nickname: "C", avatar: "" }, now);
  reduce(s, { type: "START_GAME", playerId: "a" }, now);
  if (s.hostId !== "a") throw new Error("초기 호스트 오류");
  reduce(s, { type: "LEAVE", playerId: "a" }, now);
  if (s.hostId === "a") throw new Error("호스트가 위임되지 않음");
  if (!s.players.find((p) => p.id === s.hostId)?.isHost) throw new Error("isHost 플래그 불일치");
});

run("중복 닉네임은 자동으로 구분된다", () => {
  now = Date.now();
  const s = createRoom("NICK01", {}, now);
  reduce(s, { type: "JOIN", playerId: "a", nickname: "성준", avatar: "" }, now);
  reduce(s, { type: "JOIN", playerId: "b", nickname: "성준", avatar: "" }, now);
  const names = s.players.map((p) => p.nickname);
  if (new Set(names).size !== 2) throw new Error(`닉네임 충돌: ${names.join(",")}`);
});

run("가득 찬 방은 거절된다", () => {
  now = Date.now();
  const s = createRoom("FULL01", { maxPlayers: 2 }, now);
  reduce(s, { type: "JOIN", playerId: "a", nickname: "A", avatar: "" }, now);
  reduce(s, { type: "JOIN", playerId: "b", nickname: "B", avatar: "" }, now);
  if (canJoin(s, "c") !== "FULL") throw new Error("FULL 판정 실패");
  if (canJoin(s, "a") !== null) throw new Error("재접속이 막힘");
});

run("늦게 들어온 사람은 다음 라운드부터", () => {
  now = Date.now();
  const s = createRoom("LATE01", { totalRounds: 3, modePolicy: "RANDOM", topicPolicy: "RANDOM" }, now);
  reduce(s, { type: "JOIN", playerId: "a", nickname: "A", avatar: "" }, now);
  reduce(s, { type: "JOIN", playerId: "b", nickname: "B", avatar: "" }, now);
  reduce(s, { type: "START_GAME", playerId: "a" }, now);
  reduce(s, { type: "JOIN", playerId: "c", nickname: "C", avatar: "" }, now);
  const late = s.players.find((p) => p.id === "c")!;
  if (late.active) throw new Error("늦은 참가자가 즉시 활성화됨");
  if (s.round?.order.includes("c")) throw new Error("늦은 참가자가 발언 순서에 포함됨");
});

run("타임아웃 토큰이 다르면 무시된다", () => {
  now = Date.now();
  const s = createRoom("TOK001", { modePolicy: "RANDOM", topicPolicy: "RANDOM" }, now);
  reduce(s, { type: "JOIN", playerId: "a", nickname: "A", avatar: "" }, now);
  reduce(s, { type: "JOIN", playerId: "b", nickname: "B", avatar: "" }, now);
  reduce(s, { type: "START_GAME", playerId: "a" }, now);
  const token = s.phaseToken;
  now += 999_999;
  reduce(s, { type: "TIMEOUT", phaseToken: token - 5 }, now);
  if (s.phaseToken !== token) throw new Error("잘못된 토큰으로 전이됨");
  reduce(s, { type: "TIMEOUT", phaseToken: token }, now);
  if (s.phaseToken === token) throw new Error("올바른 토큰인데 전이 안 됨");
});

run("RESTART 로 로비로 돌아간다", () => {
  const { state } = simulate({ players: 3, rounds: 2 });
  reduce(state, { type: "RESTART", playerId: state.hostId }, now);
  if (state.phase !== "LOBBY") throw new Error("로비로 안 돌아감");
  if (state.players.some((p) => p.score !== 0)) throw new Error("점수가 초기화되지 않음");
  if (state.history.length !== 0) throw new Error("기록이 초기화되지 않음");
});


/* ── 예외 상황 스트레스 테스트 ────────────────────────────────────────── */

function bootstrap(players: number, settings: Partial<RoomSettings> = {}) {
  now = Date.now();
  const s = createRoom("EDGE01", {
    totalRounds: 3, maxPlayers: 8, speechMs: 20_000,
    modePolicy: "HOST", topicPolicy: "RANDOM", peerRating: "QUICK", ...settings,
  }, now);
  for (let i = 0; i < players; i++) {
    apply(s, { type: "JOIN", playerId: `p${i}`, nickname: `P${i}`, avatar: "" });
  }
  apply(s, { type: "START_GAME", playerId: s.hostId });
  return s;
}

/** 좁혀진 리터럴 타입을 피하기 위한 헬퍼 */
const phaseOf = (s: RoomState): string => s.phase;

/** 아무 입력 없이 시간만 흘려 페이즈를 강제로 넘긴다 */
function timeoutOnce(s: RoomState) {
  const before = s.phaseToken;
  now = (s.phaseEndsAt ?? now + 500) + 400;
  heartbeatAll(s);   // 실제 클라이언트는 8초마다 PING 을 보낸다
  reduce(s, { type: "TIMEOUT", phaseToken: before }, now);
  if (s.phaseToken === before) tick(s, now);
  return s.phaseToken !== before;
}

run("아무도 입장을 안 골라도 진행된다", () => {
  const s = bootstrap(4);
  apply(s, { type: "CHOOSE_MODE", playerId: s.hostId, mode: "BALANCE" });
  if (phaseOf(s) !== "POSITION_SELECT") throw new Error(`예상과 다른 페이즈: ${s.phase}`);
  heartbeatAll(s);
  if (!timeoutOnce(s)) throw new Error("선택 없이 타임아웃이 진행되지 않음");
  heartbeatAll(s);
  timeoutOnce(s);   // PREPARATION 통과 → 본론 생성
  const r = s.round!;
  const missing = activeIds(s).filter((id) => !r.initialStances[id]);
  if (missing.length) throw new Error(`입장이 안 채워진 사람: ${missing.join(",")}`);
  if (r.steps.length <= 2) throw new Error("본론이 생성되지 않음");
});

run("발언자가 나가면 즉시 다음 순서로 넘어간다", () => {
  const s = bootstrap(4);
  apply(s, { type: "CHOOSE_MODE", playerId: s.hostId, mode: "BALANCE" });
  for (const id of activeIds(s)) apply(s, { type: "CHOOSE_STANCE", playerId: id, stance: "A" });
  heartbeatAll(s); timeoutOnce(s);            // PREPARATION → SPEECH
  heartbeatAll(s);
  let guard = 0;
  while (phaseOf(s) !== "SPEECH" && guard++ < 6) { heartbeatAll(s); timeoutOnce(s); }
  if (phaseOf(s) !== "SPEECH") throw new Error(`SPEECH 에 도달 못함: ${s.phase}`);
  const speaker = stepOf(s)!.actorId!;
  apply(s, { type: "LEAVE", playerId: speaker });
  if (stepOf(s)?.actorId === speaker) throw new Error("나간 발언자에서 멈춰 있음");
});

run("전원 연결이 끊겨도 상태가 깨지지 않는다", () => {
  const s = bootstrap(4);
  apply(s, { type: "CHOOSE_MODE", playerId: s.hostId, mode: "BALANCE" });
  now += 120_000;                       // 모두 하트비트 중단
  tick(s, now);
  if (s.players.some((p) => p.connected)) throw new Error("연결 상태가 갱신되지 않음");
  tick(s, now + 1000);                  // 다시 돌려도 예외가 없어야 한다
  // 한 명이 돌아온다
  now += 1000;
  apply(s, { type: "JOIN", playerId: "p1", nickname: "P1", avatar: "" });
  if (!s.players.find((p) => p.id === "p1")?.connected) throw new Error("재접속 실패");
  if (s.hostId !== "p1") throw new Error("연결된 사람에게 방장이 넘어가지 않음");
});

run("새로고침(재JOIN)해도 점수와 자리가 유지된다", () => {
  const s = bootstrap(4);
  const before = s.players.find((p) => p.id === "p2")!;
  before.score = 17;
  apply(s, { type: "JOIN", playerId: "p2", nickname: "P2", avatar: "" });
  const after = s.players.find((p) => p.id === "p2")!;
  if (after.score !== 17) throw new Error("점수가 초기화됨");
  if (s.players.length !== 4) throw new Error("중복 플레이어 생성");
});

run("투표를 일부만 해도 시간이 끝나면 결과가 나온다", () => {
  const s = bootstrap(4);
  apply(s, { type: "CHOOSE_MODE", playerId: s.hostId, mode: "BALANCE" });
  let guard = 0;
  while (phaseOf(s) !== "VOTING" && guard++ < 80) {
    heartbeatAll(s);
    if (phaseOf(s) === "POSITION_SELECT") {
      for (const id of activeIds(s)) apply(s, { type: "CHOOSE_STANCE", playerId: id, stance: "A" });
      continue;
    }
    if (phaseOf(s) === "REBUTTAL_PICK") {
      const a = stepOf(s)?.actorId;
      if (a) { apply(s, { type: "CHOOSE_REBUTTAL", playerId: a, kind: "LOGIC" }); continue; }
    }
    timeoutOnce(s);
  }
  if (phaseOf(s) !== "VOTING") throw new Error(`VOTING 도달 실패: ${s.phase}`);
  apply(s, { type: "SUBMIT_VOTE", playerId: "p0", vote: { stance: "B", mvpId: "p1" } });
  heartbeatAll(s);
  timeoutOnce(s);   // 나머지는 투표 안 함
  guard = 0;
  while (phaseOf(s) !== "RESULT" && guard++ < 12) {
    heartbeatAll(s);
    if (phaseOf(s) === "RATING") {
      for (const id of activeIds(s)) {
        const o = activeIds(s).filter((x) => x !== id);
        if (o.length) apply(s, { type: "SUBMIT_QUICK_AWARD", playerId: id, code: "HUMOR", rateeId: o[0] });
      }
      continue;
    }
    timeoutOnce(s);
  }
  if (phaseOf(s) !== "RESULT") throw new Error(`RESULT 도달 실패: ${s.phase}`);
  if (!s.round?.result) throw new Error("결과가 계산되지 않음");
  if (s.history.length !== 1) throw new Error("기록에 남지 않음");
});

run("소수 의견 모드는 공개 시점에 소수편이 정해진다", () => {
  const s = bootstrap(5);
  apply(s, { type: "CHOOSE_MODE", playerId: s.hostId, mode: "MINORITY" });
  const ids = activeIds(s);
  apply(s, { type: "CHOOSE_STANCE", playerId: ids[0], stance: "A" });
  for (const id of ids.slice(1)) apply(s, { type: "CHOOSE_STANCE", playerId: id, stance: "B" });
  if (phaseOf(s) !== "REVEAL") throw new Error(`REVEAL 로 안 넘어감: ${s.phase}`);
  if (s.round?.minorityStance !== "A") throw new Error(`소수편 판정 오류: ${s.round?.minorityStance}`);
});

run("한 명 설득 모드는 표적 외 전원이 반대편이 된다", () => {
  const s = bootstrap(4);
  apply(s, { type: "CHOOSE_MODE", playerId: s.hostId, mode: "PERSUADE_ONE" });
  for (const id of activeIds(s)) apply(s, { type: "CHOOSE_STANCE", playerId: id, stance: "A" });
  const r = s.round!;
  const target = r.targetId!;
  if (r.assigned[target] !== "A") throw new Error("표적의 입장이 유지되지 않음");
  const others = activeIds(s).filter((id) => id !== target);
  if (others.some((id) => r.assigned[id] !== "B")) throw new Error("설득팀이 반대편으로 배정되지 않음");
});

run("주제는 라운드마다 겹치지 않는다", () => {
  const { state } = simulate({ players: 4, rounds: 8 });
  const ids = state.usedTopicIds;
  if (new Set(ids).size !== ids.length) throw new Error("같은 주제가 두 번 나왔다");
});

run("방장 강퇴 후에도 진행된다", () => {
  const s = bootstrap(4);
  apply(s, { type: "KICK", playerId: s.hostId, targetId: "p3" });
  if (s.players.length !== 3) throw new Error("강퇴가 반영되지 않음");
  apply(s, { type: "CHOOSE_MODE", playerId: s.hostId, mode: "BALANCE" });
  if (phaseOf(s) !== "POSITION_SELECT") throw new Error("진행이 멈춤");
});

run("방장이 아니면 진행을 바꿀 수 없다", () => {
  const s = bootstrap(4);
  const notHost = s.players.find((p) => p.id !== s.hostId)!.id;
  const phase = s.phase;
  apply(s, { type: "CHOOSE_MODE", playerId: notHost, mode: "BALANCE" });
  if (s.phase !== phase) throw new Error("비방장이 모드를 정했다");
  apply(s, { type: "END_GAME", playerId: notHost });
  if (s.status === "FINISHED") throw new Error("비방장이 게임을 끝냈다");
});

run("EXTEND_TIME 은 발언자와 방장만 쓸 수 있다", () => {
  const s = bootstrap(4);
  apply(s, { type: "CHOOSE_MODE", playerId: s.hostId, mode: "BALANCE" });
  const endsAt = s.phaseEndsAt!;
  const notHost = s.players.find((p) => p.id !== s.hostId)!.id;
  apply(s, { type: "EXTEND_TIME", playerId: notHost, ms: 60_000 });
  if (s.phaseEndsAt !== endsAt) throw new Error("아무나 시간을 늘렸다");
  apply(s, { type: "EXTEND_TIME", playerId: s.hostId, ms: 30_000 });
  if (s.phaseEndsAt! <= endsAt) throw new Error("방장이 시간을 못 늘렸다");
});

run("2명일 때도 반박까지 전부 돈다", () => {
  const { state, seenPhases } = simulate({ players: 2, rounds: 2, mode: "BALANCE" });
  for (const p of ["POSITION_SELECT", "PREPARATION", "SPEECH", "REBUTTAL", "VOTING", "RESULT"]) {
    if (!seenPhases.has(p)) throw new Error(`${p} 페이즈가 없었다`);
  }
  if (state.history.length !== 2) throw new Error("라운드 수 불일치");
});

run("반박은 반대편에게만 간다", () => {
  // A/B 를 번갈아 세워도 인원이 쏠리면 순서가 꼬리에서 깨진다.
  // 그때 "바로 앞 사람" 을 고르면 같은 편끼리 반박하게 된다 — 그걸 막는다.
  let bad = 0;
  let selfHit = 0;
  for (let players = 2; players <= 8; players++) {
    for (let aCount = 0; aCount <= players; aCount++) {
      const s = bootstrap(players, { peerRating: "OFF" });
      apply(s, { type: "CHOOSE_MODE", playerId: s.hostId, mode: "BALANCE" });
      const ids = s.players.map((p) => p.id);
      ids.forEach((id, i) =>
        apply(s, { type: "CHOOSE_STANCE", playerId: id, stance: i < aCount ? "A" : "B" })
      );
      for (let k = 0; k < 8 && !s.round?.steps.some((x) => x.phase === "RESULT"); k++) timeoutOnce(s);
      const r = s.round;
      if (!r) continue;
      for (const step of r.steps) {
        if (step.phase !== "REBUTTAL" || !step.actorId || !step.targetId) continue;
        if (step.actorId === step.targetId) { selfHit++; continue; }
        const mine = r.initialStances[step.actorId];
        if (!mine || r.initialStances[step.targetId] !== mine) continue;
        // 반대편이 아예 없으면 어쩔 수 없다
        if (r.order.some((o) => r.initialStances[o] && r.initialStances[o] !== mine)) bad++;
      }
    }
  }
  if (selfHit) throw new Error(`자기 자신을 반박하는 배정 ${selfHit}건`);
  if (bad) throw new Error(`반대편이 있는데 같은 편을 반박하는 배정 ${bad}건`);
});

console.log("\n" + results.join("\n"));
console.log(`\n${results.length - failures}/${results.length} 통과`);
if (failures) process.exit(1);
