# DEBATENIGHT — 설계 문서

> "술자리에서 시작해서 새벽까지 가는 토론 게임"

---

## 1. 전체 기능 목록

### PHASE 1 — MVP (필수)
| # | 기능 | 설명 |
|---|---|---|
| F01 | 홈 | 3초 안에 뭘 할지 이해되는 첫 화면 |
| F02 | 방 생성 | 방 이름/닉네임/인원/분위기/라운드/시간/난이도 |
| F03 | 방 참가 | 6자리 코드 · 링크 · QR |
| F04 | 실시간 로비 | 입퇴장·준비상태 실시간 동기화, 호스트 위임 |
| F05 | 주제 선택 | 카테고리 선택 / 랜덤 / 직접 입력 / 투표 |
| F06 | 라운드 상태머신 | 서버 권위 phase 전이 |
| F07 | 타이머 | 서버 timestamp 기준, 클럭 오프셋 보정 |
| F08 | 발언 순서 | 랜덤 셔플, 내 차례/경청 모드 |
| F09 | 익명 투표 | 남의 선택 안 보임, 전원 완료 후 공개 |
| F10 | 결과 | 승리·MVP·의견 변화 |

### PHASE 2
F11 토론 모드 7종(A~G) · F12 카테고리 9종 · F13 300+ 주제 DB · F14 상황 기반 추천 알고리즘 · F15 지목 토론 · F16 친구 평가 · F17 라운드/개인 통계

### PHASE 3
F18 랜덤 이벤트 6종 · F19 비밀 미션 · F20 칭호 시스템 · F21 설득력 점수 · F22 공유 카드(PNG) · F23 사운드(WebAudio, 무파일) · F24 QR 참가 · F25 지난 기록(localStorage)

### PHASE 4 (확장 지점만 확보)
F26 AI 주제 생성 (`TopicProvider` 인터페이스 + `/api/topics/generate` 스텁) · F27 개인화 추천 · F28 지난 토론 분석

---

## 2. 페이지 구조

```
/                     홈
/create               방 만들기
/join                 코드로 참가 (?code= 프리필)
/room/[code]          게임 셸 — 단계별 화면 스위칭 (로비~결과 전부)
/topics               오늘의 랜덤 주제 (오프라인 브라우징)
/rules                토론 규칙 / 모드 설명
/history              지난 토론 기록 (로컬)
/api/rooms                     POST 방 생성
/api/rooms/[code]              GET  스냅샷 (+serverNow)
/api/rooms/[code]/action       POST 액션 디스패치
/api/rooms/[code]/stream       GET  SSE 실시간 스트림
/api/topics                    GET  주제 조회/추천
/api/topics/generate           POST AI 주제 생성 (Provider 추상화)
```

---

## 3. 컴포넌트 구조

```
components/
  ui/            shadcn 스타일 프리미티브 (button card input select slider switch
                 dialog tabs progress badge avatar separator label sonner)
  brand/         Logo, PhaseHeader, NightBackground, Announcer
  room/          PlayerCard, PlayerGrid, RoomCodeCard, ShareSheet(QR)
  game/          Timer, TurnIndicator, StanceButtons, TopicCard,
                 EventBanner, MissionCard, VoteSheet, RatingSheet, ResultBoard,
                 ShareCard
  phases/        LobbyPhase, ModeSelectPhase, TopicSelectPhase, PositionPhase,
                 AssignRevealPhase, PreparationPhase, SpeechPhase, RebuttalPhase,
                 FinalArgumentPhase, VotingPhase, RevealPhase, RatingPhase,
                 ResultPhase, IntermissionPhase, FinishedPhase
```

---

## 4. DB ERD (PostgreSQL / Supabase)

```
users(id pk, nickname, avatar, created_at)                  ← 익명 디바이스 아이덴티티
rooms(id pk, code uniq, name, host_id→users, status,
      settings jsonb, state jsonb, current_session_id, created_at, updated_at)
room_players(id pk, room_id→rooms, user_id→users, nickname, avatar,
      is_host, is_connected, score, joined_at,  UNIQUE(room_id,user_id))
debate_topics(id pk, text, mode, category, difficulty, intensity,
      option_a, option_b, follow_ups text[], source, tags text[])
debate_sessions(id pk, room_id→rooms, total_rounds, started_at, ended_at, summary jsonb)
debate_rounds(id pk, session_id→sessions, round_no, mode, topic_id→topics,
      topic_snapshot jsonb, event_code, speaking_order uuid[],
      started_at, ended_at, result jsonb)
speeches(id pk, round_id→rounds, user_id→users, kind, rebuttal_type,
      target_user_id, started_at, duration_ms, order_no)
votes(id pk, round_id→rounds, voter_id→users, stance, mvp_id, pick_id, created_at,
      UNIQUE(round_id, voter_id))
ratings(id pk, round_id→rounds, rater_id, ratee_id, logic, persuasion,
      creativity, humor, punch,  UNIQUE(round_id,rater_id,ratee_id))
missions(id pk, round_id→rounds, user_id→users, code, text, succeeded)
player_stats(user_id pk→users, rounds, wins, mvp_count, flips, picked_count,
      avg_logic, avg_persuasion, avg_creativity, avg_humor, titles jsonb)
```
인덱스: `rooms(code)`, `room_players(room_id)`, `debate_rounds(session_id, round_no)`,
`votes(round_id)`, `ratings(round_id)`, `debate_topics(mode, category, intensity)`.

---

## 5. 실시간 상태 머신

**단일 권위 = 서버.** 클라이언트는 액션만 보내고 스냅샷을 렌더한다.

```
LOBBY
 └▶ MODE_SELECT ▶ TOPIC_SELECT ▶ [POSITION_SELECT | ASSIGN_REVEAL]
    ▶ PREPARATION ▶ SPEECH×N ▶ (REBUTTAL_PICK ▶ REBUTTAL)×N
    ▶ FINAL_ARGUMENT×N ▶ VOTING ▶ REVEAL ▶ RATING ▶ RESULT
    ▶ ROUND_INTERMISSION ─(라운드 남음)─▶ MODE_SELECT
                          └(마지막)────▶ FINISHED
```

라운드 시작 시 `buildRoundSteps(mode, players, settings)` 가 **Step[]** 를 통째로 계산한다.
전이 = `stepIndex + 1`. 덕분에 모드별 흐름이 데이터가 되고 상태머신은 단순해진다.

```ts
type Step = { phase: PhaseId; actorId?: string; targetId?: string;
              ms: number; gate: 'NONE'|'ALL_CHOSE'|'ALL_VOTED'|'ALL_RATED'|'HOST' }
```

**전이 조건**
- 시간 만료: `now >= phaseEndsAt` (서버 시계)
- 게이트 충족: 활성·접속 플레이어 전원이 선택/투표/평가 완료
- 호스트 강제 진행: `SKIP` 액션
- 액터 이탈: 발언자가 오프라인이면 즉시 스킵

**경합 방지**: 모든 전이 액션은 `phaseToken`(단조 증가)을 동봉. 토큰 불일치 → 무시.
**타이머 구동**: ①메모리 어댑터의 서버 `setTimeout` ②모든 클라이언트의 워치독(만료 후 POST `TIMEOUT`) — 둘 다 멱등이라 중복 안전.

---

## 6. 폴더 구조

```
app/            라우트 + API
components/     UI · 게임 · 페이즈
lib/
  game/         types · machine(reducer) · steps · modes · scoring · events
                missions · titles · recommend · avatars · rng
  data/topics/  money love friendship life fun travel work deep chaos + index
  server/       store(interface) · memory-store · supabase-store · hub(SSE) · codes
  client/       transport(SSE|Supabase) · useRoom(zustand) · identity · sound · clock
  ai/           topic-provider (DB | AI 스텁)
supabase/       schema.sql · seed 스크립트
```

---

## 7. MVP 개발 순서

1. 디자인 시스템(다크 나이트 팔레트, ui 프리미티브)
2. 타입 + 상태머신 + 스텝 플래너 (순수 함수, 테스트 가능)
3. 주제 DB 300+ & 추천 알고리즘
4. 서버 스토어(Memory) + SSE 허브 + API 라우트
5. 클라이언트 트랜스포트 + zustand + 클럭 오프셋
6. 홈 → 생성 → 참가 → 로비
7. 페이즈 화면 전부 + 타이머 + 아나운서
8. 투표 → 결과 → 통계 → 다음 라운드 → 최종 결과
9. 이벤트/미션/칭호/공유카드/사운드/QR
10. Supabase 어댑터 + schema.sql (프로덕션 경로)
11. 예외 처리(새로고침·이탈·호스트 위임·중복 닉네임·없는 방)
12. 빌드/배포 점검

### 환경 전략
`NEXT_PUBLIC_SUPABASE_URL` 이 **없으면** 메모리 스토어 + SSE 로 즉시 동작(제로 컨피그, 같은 와이파이면 친구 참가 가능).
**있으면** Supabase Postgres + Realtime 으로 자동 전환 → Vercel 배포 가능.
