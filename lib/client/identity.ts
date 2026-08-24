"use client";
import { useSyncExternalStore } from "react";
import { AVATARS } from "@/lib/game/avatars";
import { createStore } from "./hooks";

const KEY = "dn:identity";
const ROOMS_KEY = "dn:rooms";
const HISTORY_KEY = "dn:history";

export interface Identity {
  playerId: string;
  nickname: string;
  avatar: string;
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `p_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/* ── localStorage 를 외부 스토어로 다룬다 ────────────────────────────
 * 스냅샷 참조가 안정적이어야 useSyncExternalStore 가 무한 렌더를 돌지 않는다.
 * 그래서 모듈 레벨에 캐시를 두고, 값이 실제로 바뀔 때만 새 객체를 만든다.
 */
const SERVER_IDENTITY: Identity = Object.freeze({
  playerId: "", nickname: "", avatar: AVATARS[0],
});

let cache: Identity | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

export function loadIdentity(): Identity {
  if (typeof window === "undefined") return SERVER_IDENTITY;
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Identity;
      if (parsed.playerId) {
        cache = { playerId: parsed.playerId, nickname: parsed.nickname ?? "", avatar: parsed.avatar || AVATARS[0] };
        return cache;
      }
    }
  } catch { /* 손상된 값은 무시 */ }
  const fresh: Identity = {
    playerId: makeId(),
    nickname: "",
    avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
  };
  cache = fresh;
  try { localStorage.setItem(KEY, JSON.stringify(fresh)); } catch { /* 저장 실패해도 게임은 된다 */ }
  return fresh;
}

export function saveIdentity(id: Partial<Identity>): Identity {
  const cur = loadIdentity();
  const next: Identity = { ...cur, ...id };
  if (!next.playerId) next.playerId = makeId();
  if (next.playerId === cur.playerId && next.nickname === cur.nickname && next.avatar === cur.avatar) {
    return cur;
  }
  cache = next;
  if (typeof window !== "undefined") {
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* 무시 */ }
  }
  emit();
  return next;
}

function subscribeIdentity(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** 렌더 중에 안전하게 읽는 훅 (SSR 에서는 빈 값) */
export function useIdentity(): Identity {
  return useSyncExternalStore(subscribeIdentity, loadIdentity, () => SERVER_IDENTITY);
}

const noopSubscribe = () => () => {};

/** 배포된 도메인 기준 초대 링크 — SSR 에서는 빈 문자열 */
export function useOrigin(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => (typeof window === "undefined" ? "" : window.location.origin),
    () => ""
  );
}

/* ── 최근 방 ────────────────────────────────────────────────────────── */

export interface RecentRoom { code: string; name: string; at: number }

const EMPTY_ROOMS: RecentRoom[] = [];

const RECENT_WINDOW_MS = 1000 * 60 * 60 * 8;

function readRecentRooms(): RecentRoom[] {
  if (typeof window === "undefined") return EMPTY_ROOMS;
  try {
    const list = JSON.parse(localStorage.getItem(ROOMS_KEY) ?? "[]") as RecentRoom[];
    if (!Array.isArray(list)) return EMPTY_ROOMS;
    // 오래된 방은 읽는 시점에 걸러낸다 (렌더 중에 시간을 읽지 않기 위해)
    const fresh = list.filter((r) => r && Date.now() - r.at < RECENT_WINDOW_MS);
    return fresh.length ? fresh : EMPTY_ROOMS;
  } catch { return EMPTY_ROOMS; }
}

const recentRoomsStore = createStore(readRecentRooms, EMPTY_ROOMS);

export function rememberRoom(code: string, name: string) {
  if (typeof window === "undefined") return;
  const list = readRecentRooms().filter((r) => r.code !== code);
  list.unshift({ code, name, at: Date.now() });
  try { localStorage.setItem(ROOMS_KEY, JSON.stringify(list.slice(0, 8))); } catch { /* 무시 */ }
  recentRoomsStore.invalidate();
}

export function loadRecentRooms(): RecentRoom[] {
  return readRecentRooms();
}

export function useRecentRooms(): RecentRoom[] {
  return recentRoomsStore.use();
}

/* ── 지난 토론 기록 ──────────────────────────────────────────────────── */

export interface HistoryEntry {
  code: string;
  roomName: string;
  playedAt: number;
  durationMs: number;
  rounds: number;
  players: { nickname: string; avatar: string; score: number }[];
  championNickname: string | null;
  myTitles: string[];
  myNickname: string;
  headlines: string[];
}

const EMPTY_HISTORY: HistoryEntry[] = [];

function readHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return EMPTY_HISTORY;
  try {
    const list = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as HistoryEntry[];
    return Array.isArray(list) ? list : EMPTY_HISTORY;
  } catch { return EMPTY_HISTORY; }
}

const historyStore = createStore(readHistory, EMPTY_HISTORY);

export function saveHistory(entry: HistoryEntry) {
  if (typeof window === "undefined") return;
  const list = readHistory().filter(
    (h) => !(h.code === entry.code && Math.abs(h.playedAt - entry.playedAt) < 60_000)
  );
  list.unshift(entry);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 30))); } catch { /* 무시 */ }
  historyStore.invalidate();
}

export function loadHistory(): HistoryEntry[] {
  return readHistory();
}

export function useHistory(): HistoryEntry[] {
  return historyStore.use();
}

export function clearHistory() {
  if (typeof window !== "undefined") localStorage.removeItem(HISTORY_KEY);
  historyStore.invalidate();
}
