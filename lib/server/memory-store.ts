import type { RoomState } from "@/lib/game/types";
import type { RoomStore } from "./store";

interface Bank { rooms: Map<string, RoomState>; }
const g = globalThis as unknown as { __dn_rooms?: Bank };
const bank: Bank = (g.__dn_rooms ??= { rooms: new Map() });

const MAX_AGE_MS = 1000 * 60 * 60 * 12; // 12시간 지난 방은 정리

function gc() {
  const now = Date.now();
  for (const [code, s] of bank.rooms) {
    if (now - s.updatedAt > MAX_AGE_MS) bank.rooms.delete(code);
  }
}

export class MemoryStore implements RoomStore {
  readonly kind = "memory" as const;

  async create(state: RoomState) {
    gc();
    bank.rooms.set(state.code, state);
    return state;
  }

  async get(code: string) {
    return bank.rooms.get(code) ?? null;
  }

  async mutate(code: string, fn: (s: RoomState) => void | boolean) {
    const s = bank.rooms.get(code);
    if (!s) return null;
    const res = fn(s);
    if (res === false) return s;
    bank.rooms.set(code, s);
    return s;
  }

  async delete(code: string) { bank.rooms.delete(code); }
  async exists(code: string) { return bank.rooms.has(code); }
}

export function allRoomCodes() { return [...bank.rooms.keys()]; }
