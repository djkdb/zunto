import type { Action, RoomSettings, RoomState } from "@/lib/game/types";
import { createRoom, reduce, tick } from "@/lib/game/machine";
import { generateCode } from "./codes";
import { getStore, isSupabaseConfigured } from "./store";
import { clearTimer, publish, setTimer, subscriberCount } from "./hub";

const MIN_TIMER_MS = 120;

/** 방을 만들고 코드 충돌을 피한다 */
export async function createRoomWithCode(settings: Partial<RoomSettings>): Promise<RoomState> {
  const store = await getStore();
  for (let i = 0; i < 12; i++) {
    const code = generateCode();
    if (await store.exists(code)) continue;
    const state = createRoom(code, settings, Date.now());
    await store.create(state);
    return state;
  }
  throw new Error("방 코드를 만들지 못했습니다. 다시 시도해 주세요.");
}

export async function getRoom(code: string): Promise<RoomState | null> {
  const store = await getStore();
  return store.get(code);
}

/** 액션을 적용하고 구독자에게 방송 */
export async function applyAction(code: string, action: Action): Promise<RoomState | null> {
  const store = await getStore();
  const next = await store.mutate(code, (s) => {
    reduce(s, action, Date.now());
  });
  if (next) afterWrite(next);
  return next;
}

/** 서버 쪽 타이머/연결 정리 후 방송 */
export async function tickRoom(code: string): Promise<RoomState | null> {
  const store = await getStore();
  const next = await store.mutate(code, (s) => {
    const changed = tick(s, Date.now());
    return changed || s.phaseEndsAt !== null;
  });
  if (next) afterWrite(next);
  return next;
}

function afterWrite(state: RoomState) {
  publish(state);
  scheduleNext(state);
}

/**
 * 메모리 모드에서는 서버가 직접 타이머를 돌려 페이즈를 넘긴다.
 * Supabase(서버리스) 모드에서는 클라이언트 워치독이 TIMEOUT 을 보낸다.
 */
function scheduleNext(state: RoomState) {
  if (isSupabaseConfigured()) return;
  const code = state.code;
  if (subscriberCount(code) === 0) { clearTimer(code); return; }

  const now = Date.now();
  const dueAt = state.phaseEndsAt ?? now + 8_000;   // 타이머가 없어도 주기적으로 연결 점검
  const delay = Math.max(MIN_TIMER_MS, dueAt - now + 60);

  setTimer(code, delay, () => {
    tickRoom(code).catch(() => { /* 방이 사라졌을 수 있다 */ });
  });
}

/**
 * SSE 연결이 살아있다는 것 자체가 그 참가자가 살아있다는 뜻이다.
 * 브로드캐스트 없이 lastSeen 만 갱신한다 (모바일이 탭을 재워도 오프라인 처리되지 않게).
 */
export async function touchRoom(code: string, playerId: string): Promise<void> {
  if (!playerId) return;
  const store = await getStore();
  await store.mutate(code, (s) => {
    const p = s.players.find((x) => x.id === playerId);
    if (!p) return false;
    p.lastSeen = Date.now();
    if (!p.connected) {
      p.connected = true;
      return true;      // 다시 살아났으면 알린다
    }
    return store.kind === "memory" ? false : true;
  });
}

export { publish };
