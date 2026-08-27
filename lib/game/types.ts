/* ============================================================================
 * DEBATENIGHT — 코어 타입
 * 서버가 유일한 권위. 클라이언트는 RoomState 를 받아 렌더하고 Action 만 보낸다.
 * ==========================================================================*/

/* ── 주제 ─────────────────────────────────────────────────────────────── */

export const CATEGORIES = [
  "MONEY", "LOVE", "FRIENDSHIP", "LIFE", "FUN", "TRAVEL", "WORK", "DEEP", "CHAOS",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_META: Record<Category, { ko: string; emoji: string; desc: string; hue: string }> = {
  MONEY:      { ko: "돈",   emoji: "💰", desc: "돈 · 직업 · 성공 · 소비 · 투자", hue: "#FFC94B" },
  LOVE:       { ko: "연애",  emoji: "💘", desc: "연애 · 결혼 · 질투 · 전애인",    hue: "#FF6B8B" },
  FRIENDSHIP: { ko: "우정",  emoji: "🤝", desc: "친구 · 의리 · 배신 · 질투",      hue: "#4CC9F0" },
  LIFE:       { ko: "인생",  emoji: "🌱", desc: "행복 · 가족 · 미래 · 가치관",    hue: "#3DDC97" },
  FUN:        { ko: "밸런스", emoji: "🎲", desc: "황당한 선택 · 극단적 가정",      hue: "#9B87FF" },
  TRAVEL:     { ko: "여행",  emoji: "✈️", desc: "여행 · 해외생활 · 한국 vs 외국",  hue: "#59D3FF" },
  WORK:       { ko: "일",   emoji: "💼", desc: "회사 · 창업 · 워라밸",           hue: "#FFA36B" },
  DEEP:       { ko: "심연",  emoji: "🌌", desc: "인생 · 죽음 · 기억 · 후회",      hue: "#8B93FF" },
  CHAOS:      { ko: "카오스", emoji: "🔥", desc: "수위 높은 질문 · 각오하고 눌러",  hue: "#FF5468" },
};

/** 1 = 가볍게 던져도 되는 질문, 5 = 진지하게 붙어야 하는 질문 */
export type Difficulty = 1 | 2 | 3 | 4 | 5;
/** 1 = 무해함, 5 = 친구 사이 험해질 수 있음 */
export type Intensity = 1 | 2 | 3 | 4 | 5;

export interface Topic {
  id: string;
  text: string;
  category: Category;
  /** 이 주제가 가장 잘 어울리는 모드들 */
  modes: DebateMode[];
  difficulty: Difficulty;
  intensity: Intensity;
  optionA?: string;
  optionB?: string;
  followUps?: string[];
  /** 최소/최대 인원 제약 (없으면 2~8 전부) */
  minPlayers?: number;
  source?: "builtin" | "custom" | "ai";
  tags?: string[];
}

/* ── 모드 ─────────────────────────────────────────────────────────────── */

export const MODES = [
  "BALANCE", "PRO_CON", "PERSUADE_ONE", "POINT", "MINORITY", "ADVOCATE", "FRIEND_RATING",
] as const;
export type DebateMode = (typeof MODES)[number];

export interface ModeMeta {
  id: DebateMode;
  letter: string;
  ko: string;
  tagline: string;
  how: string[];
  emoji: string;
  minPlayers: number;
  /** 사람을 지목하는 모드인가 (주제에 optionA/B 가 없음) */
  isPickPerson: boolean;
  /** 입장이 랜덤 배정되는가 */
  randomAssign: boolean;
  estimatedMin: number;
}

export const MODE_META: Record<DebateMode, ModeMeta> = {
  BALANCE: {
    id: "BALANCE", letter: "A", ko: "밸런스 토론", emoji: "⚖️",
    tagline: "둘 중 하나. 고른 쪽을 끝까지 방어합니다.",
    how: ["각자 A 또는 B 를 고른다", "고른 쪽의 이유를 주장한다", "반박하고 최종 투표", "표를 더 받은 쪽이 승리"],
    minPlayers: 2, isPickPerson: false, randomAssign: false, estimatedMin: 6,
  },
  PRO_CON: {
    id: "PRO_CON", letter: "B", ko: "찬반 토론", emoji: "🥊",
    tagline: "편은 앱이 정합니다. 내 생각과 반대일 수도 있습니다.",
    how: ["앱이 찬성/반대를 랜덤 배정", "내 진짜 생각과 상관없이 방어한다", "가장 잘 방어한 사람이 MVP"],
    minPlayers: 2, isPickPerson: false, randomAssign: true, estimatedMin: 7,
  },
  PERSUADE_ONE: {
    id: "PERSUADE_ONE", letter: "C", ko: "한 명을 설득하라", emoji: "🎯",
    tagline: "표적 한 명. 나머지 전원이 달려든다.",
    how: ["앱이 표적 한 명을 지목", "표적이 먼저 자기 입장을 말한다", "나머지가 전부 반대편에서 설득", "표적이 마음을 바꾸면 설득팀 승리"],
    minPlayers: 3, isPickPerson: false, randomAssign: false, estimatedMin: 6,
  },
  POINT: {
    id: "POINT", letter: "D", ko: "지목 토론", emoji: "👉",
    tagline: "여기 있는 사람 중에서 고릅니다. 익명 아닙니다.",
    how: ["질문을 보고 한 명을 지목", "전원 공개", "가장 많이 지목된 사람이 해명 발언", "왜 골랐는지 서로 캐묻는다"],
    minPlayers: 3, isPickPerson: true, randomAssign: false, estimatedMin: 4,
  },
  MINORITY: {
    id: "MINORITY", letter: "E", ko: "소수 의견", emoji: "🕵️",
    tagline: "적은 쪽이 무대에 오른다.",
    how: ["비밀리에 찬반 선택", "동시에 공개", "적은 쪽이 오늘의 주인공", "소수가 먼저 변론, 다수가 반박"],
    minPlayers: 3, isPickPerson: false, randomAssign: false, estimatedMin: 6,
  },
  ADVOCATE: {
    id: "ADVOCATE", letter: "F", ko: "변론 게임", emoji: "😈",
    tagline: "악마의 변호인. 말도 안 되는 쪽을 맡습니다.",
    how: ["앱이 입장을 정해준다", "60초 동안 그 입장을 방어한다", "평소 생각은 잠시 접어둔다", "가장 뻔뻔했던 사람이 승리"],
    minPlayers: 2, isPickPerson: false, randomAssign: true, estimatedMin: 5,
  },
  FRIEND_RATING: {
    id: "FRIEND_RATING", letter: "G", ko: "친구 평가", emoji: "🔮",
    tagline: "익명 투표. 결과 보고 다 같이 웃자.",
    how: ["질문에 맞는 사람을 익명으로 지목", "전원 투표 후 결과 공개", "1위가 소감 발표", "누가 누굴 찍었는지는 비밀"],
    minPlayers: 3, isPickPerson: true, randomAssign: false, estimatedMin: 3,
  },
};

/* ── 분위기 ────────────────────────────────────────────────────────────── */

export const VIBES = ["CHILL", "FUN", "SPICY", "DEEP", "CHAOS", "AUTO"] as const;
export type Vibe = (typeof VIBES)[number];

export const VIBE_META: Record<Vibe, { ko: string; emoji: string; desc: string }> = {
  CHILL: { ko: "가볍게",   emoji: "🌙", desc: "부담 없는 질문 위주" },
  FUN:   { ko: "웃기게",   emoji: "😂", desc: "웃긴 질문, 밸런스 게임" },
  SPICY: { ko: "맵게",     emoji: "🌶️", desc: "서로 지목하고 놀리는 질문" },
  DEEP:  { ko: "진지하게", emoji: "🧠", desc: "가치관을 파고드는 토론" },
  CHAOS: { ko: "카오스",   emoji: "🌀", desc: "예측 불가. 이벤트 자주 발생" },
  AUTO:  { ko: "알아서",   emoji: "🎰", desc: "오늘 분위기 앱이 골라줌" },
};

/* ── 페이즈 / 스텝 ─────────────────────────────────────────────────────── */

export const PHASES = [
  "LOBBY",
  "MODE_SELECT",
  "TOPIC_SELECT",
  "POSITION_SELECT",
  "ASSIGN_REVEAL",
  "PREPARATION",
  "SPEECH",
  "REBUTTAL_PICK",
  "REBUTTAL",
  "FINAL_ARGUMENT",
  "VOTING",
  "REVEAL",
  "RATING",
  "RESULT",
  "ROUND_INTERMISSION",
  "FINISHED",
] as const;
export type PhaseId = (typeof PHASES)[number];

export type Gate = "NONE" | "ALL_CHOSE" | "ALL_VOTED" | "ALL_RATED" | "HOST";

export interface Step {
  phase: PhaseId;
  /** 이 스텝의 주인공 (발언자 등) */
  actorId?: string;
  /** 반박 대상 */
  targetId?: string;
  /** 밀리초. 0 이면 시간 제한 없음 */
  ms: number;
  gate: Gate;
  /** 아나운서가 읽어줄 문구 (동적 생성용 키) */
  note?: string;
}

/* ── 플레이어 ─────────────────────────────────────────────────────────── */

export interface Player {
  id: string;
  nickname: string;
  avatar: string;      // 이모지
  color: string;       // hex
  isHost: boolean;
  connected: boolean;
  lastSeen: number;
  ready: boolean;
  score: number;
  /** 현재 라운드에 참여 중인가 (늦게 들어오면 false → 다음 라운드부터) */
  active: boolean;
  joinedAt: number;
  stats: PlayerStats;
}

export interface PlayerStats {
  rounds: number;
  wins: number;          // 이긴 쪽에 있던 횟수
  mvp: number;           // 최고 설득가 선정 횟수
  flips: number;         // 의견을 바꾼 횟수
  neverFlipped: number;  // 끝까지 안 바뀐 횟수
  picked: number;        // 남에게 지목당한 횟수
  stanceA: number;
  stanceB: number;
  missionsDone: number;
  missionsFailed: number;
  ratingSum: { logic: number; persuasion: number; creativity: number; humor: number; punch: number };
  ratingCount: number;
  awards: string[];      // 라운드마다 받은 어워드 코드 누적
}

export const EMPTY_STATS: PlayerStats = {
  rounds: 0, wins: 0, mvp: 0, flips: 0, neverFlipped: 0, picked: 0,
  stanceA: 0, stanceB: 0, missionsDone: 0, missionsFailed: 0,
  ratingSum: { logic: 0, persuasion: 0, creativity: 0, humor: 0, punch: 0 },
  ratingCount: 0, awards: [],
};

/* ── 라운드 ───────────────────────────────────────────────────────────── */

export type Stance = "A" | "B";

export type RebuttalKind = "LOGIC" | "EXPERIENCE" | "QUESTION" | "CONCEDE" | "KNOCKOUT";

export const REBUTTAL_META: Record<RebuttalKind, { ko: string; emoji: string; hint: string }> = {
  LOGIC:      { ko: "논리 반박",  emoji: "🧠", hint: "앞 사람 주장의 허점을 짚는다" },
  EXPERIENCE: { ko: "경험 반박",  emoji: "📖", hint: "내 실제 경험으로 반박한다" },
  QUESTION:   { ko: "질문",      emoji: "❓", hint: "대답하기 곤란한 질문을 던진다" },
  CONCEDE:    { ko: "그냥 인정",  emoji: "🙏", hint: "인정하고 다른 각도로 튼다" },
  KNOCKOUT:   { ko: "한 방",     emoji: "💥", hint: "한 문장으로 끝낸다" },
};

export interface Vote {
  /** 밸런스/찬반/소수 — 토론 후 최종 입장 */
  stance?: Stance;
  /** 가장 설득력 있었던 사람 */
  mvpId?: string;
  /** 지목 모드 — 고른 사람 */
  pickId?: string;
  at: number;
}

export interface Rating {
  logic: number;
  persuasion: number;
  creativity: number;
  humor: number;
  punch: number;
}

/** 빠른 평가 — 한 명에게 어워드 하나만 준다 */
export const AWARDS = ["LOGIC", "PERSUASION", "CREATIVITY", "HUMOR", "PUNCH"] as const;
export type AwardCode = (typeof AWARDS)[number];
export const AWARD_META: Record<AwardCode, { ko: string; emoji: string; key: keyof Rating }> = {
  LOGIC:      { ko: "제일 논리적", emoji: "🧠", key: "logic" },
  PERSUASION: { ko: "제일 설득력", emoji: "🎯", key: "persuasion" },
  CREATIVITY: { ko: "제일 신박",   emoji: "✨", key: "creativity" },
  HUMOR:      { ko: "제일 웃김",   emoji: "😂", key: "humor" },
  PUNCH:      { ko: "한 방 있었음", emoji: "💥", key: "punch" },
};

export interface RoundResult {
  /** 스탠스 최종 집계 */
  finalTally: { A: number; B: number };
  initialTally: { A: number; B: number };
  /** 의견 바꾼 플레이어 id */
  flippers: string[];
  /** 승리 스탠스 (동률이면 null) */
  winningStance: Stance | null;
  /** 라운드 승자 (토론 승리) */
  winnerIds: string[];
  /** MVP */
  mvpId: string | null;
  mvpVotes: number;
  /** 지목 모드 집계 */
  pickTally: Record<string, number>;
  pickWinnerIds: string[];
  /** 어워드 */
  awardWinners: Partial<Record<AwardCode, string>>;
  /** 미션 결과 */
  mission?: { playerId: string; code: string; text: string; succeeded: boolean | null };
  /** 점수 변동 */
  deltas: Record<string, number>;
  headline: string;
}

export interface Round {
  no: number;
  mode: DebateMode;
  topic: Topic;
  /** 발언 순서 (플레이어 id) */
  order: string[];
  /** 스텝 플랜 */
  steps: Step[];
  stepIndex: number;
  /** 최초 입장 선택 */
  initialStances: Record<string, Stance>;
  /** 랜덤 배정된 입장 (PRO_CON / ADVOCATE) */
  assigned: Record<string, Stance>;
  /** 지목 모드 — 누가 누굴 골랐나 */
  picks: Record<string, string>;
  /** 반박 선택 */
  rebuttals: Record<string, RebuttalKind>;
  /** 최종 투표 */
  votes: Record<string, Vote>;
  /** 상세 평가 */
  ratings: Record<string, Record<string, Rating>>;
  /** 빠른 평가 — rater -> {award, rateeId} */
  quickAwards: Record<string, { code: AwardCode; rateeId: string }>;
  /** 이번 라운드 랜덤 이벤트 */
  event?: RandomEvent;
  /** 비밀 미션 */
  mission?: { playerId: string; code: string; text: string };
  /** 미션 성공 투표 */
  missionVotes: Record<string, boolean>;
  /** PERSUADE_ONE 표적 */
  targetId?: string;
  /** MINORITY 소수편 */
  minorityStance?: Stance;
  result?: RoundResult;
  startedAt: number;
  endedAt?: number;
  /** 명언 후보 (플레이어가 남긴 한 마디) */
  quotes: Record<string, string>;
}

/* ── 랜덤 이벤트 ──────────────────────────────────────────────────────── */

export const EVENT_CODES = [
  "DEVILS_ADVOCATE", "DOUBLE_TIME", "ONE_WORD", "TARGET", "SILENT", "CHAOS_SWAP",
] as const;
export type EventCode = (typeof EVENT_CODES)[number];

export interface RandomEvent {
  code: EventCode;
  title: string;
  desc: string;
  emoji: string;
  /** 어느 페이즈부터 적용되는가 */
  appliesFrom: PhaseId;
  payload?: { targetId?: string; multiplier?: number };
}

/* ── 방 ───────────────────────────────────────────────────────────────── */

export interface RoomSettings {
  name: string;
  maxPlayers: number;         // 2~8
  totalRounds: number;        // 1~12
  speechMs: number;           // 30_000 | 60_000 | 90_000 | 120_000
  vibe: Vibe;
  difficulty: Difficulty;
  categories: Category[];     // 빈 배열 = 전체
  /** 모드 선택 방식 */
  modePolicy: "HOST" | "RANDOM" | "ROTATE";
  /** 주제 선택 방식 */
  topicPolicy: "HOST" | "RANDOM" | "VOTE";
  randomEvents: boolean;
  secretMissions: boolean;
  peerRating: "OFF" | "QUICK" | "DETAILED";
  sound: boolean;
}

export const DEFAULT_SETTINGS: RoomSettings = {
  name: "DEBATE NIGHT",
  maxPlayers: 4,
  totalRounds: 5,
  speechMs: 60_000,
  vibe: "AUTO",
  difficulty: 3,
  categories: [],
  modePolicy: "HOST",
  topicPolicy: "HOST",
  randomEvents: true,
  secretMissions: true,
  peerRating: "QUICK",
  sound: true,
};

export type RoomStatus = "LOBBY" | "PLAYING" | "FINISHED";

export interface RoomState {
  code: string;
  createdAt: number;
  updatedAt: number;
  hostId: string;
  status: RoomStatus;
  settings: RoomSettings;
  players: Player[];
  /** 현재 페이즈 */
  phase: PhaseId;
  /** 서버 기준 종료 시각 (epoch ms). null 이면 무제한 */
  phaseEndsAt: number | null;
  phaseStartedAt: number;
  /** 전이 경합 방지 토큰 (단조 증가) */
  phaseToken: number;
  round: Round | null;
  /** 지난 라운드 결과 */
  history: RoundResult[];
  /** 이미 사용한 주제 id */
  usedTopicIds: string[];
  /** 주제 투표 (topicPolicy = VOTE) */
  topicCandidates: Topic[];
  topicVotes: Record<string, string>;
  /** 최종 결과 */
  finalSummary?: FinalSummary;
  /** 아나운서 로그 — 최근 것부터 */
  announcements: Announcement[];
  /** 라운드 재미도 피드백 (추천 알고리즘 입력) */
  funVotes: Record<number, number>;
  /** 모드 선택 단계에서 임시로 잡아둔 모드 */
  pendingMode: DebateMode | null;
  /** 현재(또는 다음) 라운드 번호 */
  roundNo: number;
  /** 지난 라운드들의 모드 이력 */
  modeHistory: DebateMode[];
  /** 게임 시작 시각 */
  startedAt: number | null;
  /** 라운드별 재미도 투표 인원 */
  funVoteCounts?: Record<number, number>;
  /** 모든 라운드에 걸쳐 남긴 한마디 */
  allQuotes?: { playerId: string; text: string; score: number; round: number }[];
}

export interface Announcement {
  id: string;
  at: number;
  text: string;
  tone: "info" | "action" | "alert" | "celebrate";
}

export interface FinalSummary {
  totalRounds: number;
  playedAt: number;
  durationMs: number;
  standings: { playerId: string; nickname: string; avatar: string; score: number }[];
  champion: string | null;
  mostPersuasive: string | null;
  funniest: string | null;
  mostLogical: string | null;
  mostFlips: string | null;
  stubborn: string | null;
  titles: Record<string, string[]>;  // playerId -> title codes
  bestQuote?: { playerId: string; text: string };
}

/* ── 액션 ─────────────────────────────────────────────────────────────── */

export type Action =
  | { type: "JOIN"; playerId: string; nickname: string; avatar: string }
  | { type: "LEAVE"; playerId: string }
  | { type: "PING"; playerId: string }
  | { type: "SET_READY"; playerId: string; ready: boolean }
  | { type: "KICK"; playerId: string; targetId: string }
  | { type: "UPDATE_SETTINGS"; playerId: string; settings: Partial<RoomSettings> }
  | { type: "START_GAME"; playerId: string }
  | { type: "CHOOSE_MODE"; playerId: string; mode: DebateMode }
  | { type: "CHOOSE_TOPIC"; playerId: string; topic: Topic }
  | { type: "REROLL_TOPICS"; playerId: string }
  | { type: "VOTE_TOPIC"; playerId: string; topicId: string }
  | { type: "CHOOSE_STANCE"; playerId: string; stance: Stance }
  | { type: "PICK_PLAYER"; playerId: string; targetId: string }
  | { type: "CHOOSE_REBUTTAL"; playerId: string; kind: RebuttalKind }
  | { type: "SUBMIT_VOTE"; playerId: string; vote: Omit<Vote, "at"> }
  | { type: "SUBMIT_RATING"; playerId: string; ratings: Record<string, Rating> }
  | { type: "SUBMIT_QUICK_AWARD"; playerId: string; code: AwardCode; rateeId: string }
  | { type: "SUBMIT_QUOTE"; playerId: string; text: string }
  | { type: "MISSION_VOTE"; playerId: string; success: boolean }
  | { type: "FUN_VOTE"; playerId: string; score: number }
  | { type: "ADVANCE"; playerId: string; phaseToken: number }   // 호스트/발언자 수동 진행
  | { type: "TIMEOUT"; phaseToken: number }                      // 워치독
  | { type: "EXTEND_TIME"; playerId: string; ms: number }
  | { type: "NEXT_ROUND"; playerId: string }
  | { type: "END_GAME"; playerId: string }
  | { type: "RESTART"; playerId: string };

export interface ActionResult {
  state: RoomState;
  /** 서버가 다시 스케줄해야 할 타이머 */
  changed: boolean;
}
