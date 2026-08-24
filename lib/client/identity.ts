"use client";
import { AVATARS } from "@/lib/game/avatars";

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

export function loadIdentity(): Identity {
  if (typeof window === "undefined") return { playerId: "", nickname: "", avatar: AVATARS[0] };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Identity;
      if (parsed.playerId) return parsed;
    }
  } catch { /* 손상된 값은 무시 */ }
  const fresh: Identity = {
    playerId: makeId(),
    nickname: "",
    avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
  };
  saveIdentity(fresh);
  return fresh;
}

export function saveIdentity(id: Partial<Identity>) {
  if (typeof window === "undefined") return;
  const cur = (() => {
    try { return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Identity; } catch { return {} as Identity; }
  })();
  const next = { ...cur, ...id };
  if (!next.playerId) next.playerId = makeId();
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

/* ── 최근 방 ────────────────────────────────────────────────────────── */

export interface RecentRoom { code: string; name: string; at: number }

export function rememberRoom(code: string, name: string) {
  if (typeof window === "undefined") return;
  const list = loadRecentRooms().filter((r) => r.code !== code);
  list.unshift({ code, name, at: Date.now() });
  localStorage.setItem(ROOMS_KEY, JSON.stringify(list.slice(0, 8)));
}

export function loadRecentRooms(): RecentRoom[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(ROOMS_KEY) ?? "[]") as RecentRoom[]; }
  catch { return []; }
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

export function saveHistory(entry: HistoryEntry) {
  if (typeof window === "undefined") return;
  const list = loadHistory().filter(
    (h) => !(h.code === entry.code && Math.abs(h.playedAt - entry.playedAt) < 60_000)
  );
  list.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 30)));
}

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as HistoryEntry[]; }
  catch { return []; }
}

export function clearHistory() {
  if (typeof window !== "undefined") localStorage.removeItem(HISTORY_KEY);
}
