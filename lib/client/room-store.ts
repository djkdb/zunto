"use client";
import { create } from "zustand";
import type { Action, Player, RoomState, Step } from "@/lib/game/types";
import { createTransport, type Transport } from "./transport";
import { serverClock } from "./clock";
import { loadIdentity } from "./identity";

export type ConnStatus = "idle" | "connecting" | "live" | "offline" | "gone";

interface RoomStoreState {
  code: string | null;
  state: RoomState | null;
  status: ConnStatus;
  error: string | null;
  playerId: string;
  /** 서버에 보냈지만 아직 반영 안 된 액션이 있는지 */
  pending: number;
  /** 이 방에 한 번이라도 실제로 들어가 있었는가 (강퇴/퇴장 안내 구분용) */
  everJoined: boolean;

  connect: (code: string, playerId: string) => void;
  disconnect: () => void;
  send: (action: Action) => Promise<RoomState | null>;
  setError: (e: string | null) => void;
  ingest: (state: RoomState, serverNow: number, sentAt?: number) => void;
}

let transport: Transport | null = null;
let teardown: (() => void) | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let watchdog: ReturnType<typeof setInterval> | null = null;
let lastTimeoutToken = -1;

export const useRoomStore = create<RoomStoreState>((set, get) => ({
  code: null,
  state: null,
  status: "idle",
  error: null,
  playerId: "",
  pending: 0,
  everJoined: false,

  setError: (e) => set({ error: e }),

  ingest: (state, serverNow, sentAt) => {
    serverClock.sync(serverNow, sentAt);
    const prev = get().state;
    // 오래된 스냅샷은 버린다
    if (prev && prev.code === state.code && state.updatedAt < prev.updatedAt && state.phaseToken < prev.phaseToken) return;
    const me = state.players.some((p) => p.id === get().playerId);
    set(me ? { state, error: null, everJoined: true } : { state, error: null });
  },

  connect: (code, playerId) => {
    if (get().code === code && teardown) return;
    teardown?.();
    set({ code, playerId, status: "connecting", state: null, error: null, everJoined: false });

    transport ??= createTransport();
    teardown = transport.connect(
      code,
      ({ state, serverNow }) => get().ingest(state, serverNow),
      (s) => set({ status: s === "gone" ? "gone" : s }),
      playerId
    );

    if (heartbeat) clearInterval(heartbeat);
    heartbeat = setInterval(() => {
      const st = get();
      if (!st.code || !st.playerId) return;
      void st.send({ type: "PING", playerId: st.playerId });
    }, 8_000);

    if (watchdog) clearInterval(watchdog);
    watchdog = setInterval(() => {
      const st = get();
      const s = st.state;
      if (!s || !st.playerId) return;
      if (s.phaseEndsAt === null) return;
      const remaining = s.phaseEndsAt - serverClock.now();
      if (remaining > 0) return;
      if (lastTimeoutToken === s.phaseToken) return;

      // 여러 명이 동시에 보내지 않도록 접속 순서만큼 지연 (서버는 멱등)
      const idx = s.players.filter((p) => p.connected).findIndex((p) => p.id === st.playerId);
      const delay = Math.max(0, idx) * 350;
      if (remaining > -delay) return;

      lastTimeoutToken = s.phaseToken;
      void st.send({ type: "TIMEOUT", phaseToken: s.phaseToken });
    }, 250);
  },

  disconnect: () => {
    teardown?.();
    teardown = null;
    if (heartbeat) clearInterval(heartbeat);
    if (watchdog) clearInterval(watchdog);
    heartbeat = null;
    watchdog = null;
    lastTimeoutToken = -1;
    set({ code: null, state: null, status: "idle", pending: 0, everJoined: false });
  },

  send: async (action) => {
    const { code } = get();
    if (!code) return null;
    const sentAt = Date.now();
    set((s) => ({ pending: s.pending + 1 }));
    try {
      const res = await fetch(`/api/rooms/${code}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        if (data?.error === "NOT_FOUND") set({ status: "gone" });
        else if (action.type !== "PING" && action.type !== "TIMEOUT") {
          set({ error: data?.message ?? "요청을 처리하지 못했습니다" });
        }
        return null;
      }
      get().ingest(data.state as RoomState, data.serverNow as number, sentAt);
      return data.state as RoomState;
    } catch {
      set({ status: "offline" });
      return null;
    } finally {
      set((s) => ({ pending: Math.max(0, s.pending - 1) }));
    }
  },
}));

/* ── 파생 셀렉터 ─────────────────────────────────────────────────────── */

export function selectMe(s: RoomState | null, playerId: string): Player | null {
  return s?.players.find((p) => p.id === playerId) ?? null;
}

export function selectStep(s: RoomState | null): Step | null {
  if (!s?.round) return null;
  return s.round.steps[s.round.stepIndex] ?? null;
}

export function selectIsHost(s: RoomState | null, playerId: string) {
  return Boolean(s && s.hostId === playerId);
}

export function selectIsMyTurn(s: RoomState | null, playerId: string) {
  const step = selectStep(s);
  return Boolean(step?.actorId && step.actorId === playerId);
}

export function selectActive(s: RoomState | null): Player[] {
  return (s?.players ?? []).filter((p) => p.active && p.connected);
}

/** 방에 들어갈 때 한 번 호출: 참가 요청 후 실시간 연결 */
export async function joinRoom(code: string, nickname: string, avatar: string) {
  const id = loadIdentity();
  const res = await fetch(`/api/rooms/${code}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId: id.playerId, nickname, avatar }),
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    throw new Error(data?.message ?? "방에 들어가지 못했습니다");
  }
  return { state: data.state as RoomState, playerId: id.playerId };
}
