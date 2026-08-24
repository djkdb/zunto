import type { RoomState } from "@/lib/game/types";

type Listener = (state: RoomState) => void;

interface HubShape {
  listeners: Map<string, Set<Listener>>;
  timers: Map<string, ReturnType<typeof setTimeout>>;
}

const g = globalThis as unknown as { __dn_hub?: HubShape };
const hub: HubShape = (g.__dn_hub ??= { listeners: new Map(), timers: new Map() });

export function subscribe(code: string, fn: Listener): () => void {
  let set = hub.listeners.get(code);
  if (!set) { set = new Set(); hub.listeners.set(code, set); }
  set.add(fn);
  return () => {
    set!.delete(fn);
    if (set!.size === 0) hub.listeners.delete(code);
  };
}

export function publish(state: RoomState) {
  const set = hub.listeners.get(state.code);
  if (!set) return;
  for (const fn of set) {
    try { fn(state); } catch { /* 구독자 하나가 죽어도 나머지는 계속 */ }
  }
}

export function subscriberCount(code: string) {
  return hub.listeners.get(code)?.size ?? 0;
}

export function setTimer(code: string, ms: number, fn: () => void) {
  clearTimer(code);
  hub.timers.set(code, setTimeout(fn, Math.max(0, ms)));
}

export function clearTimer(code: string) {
  const t = hub.timers.get(code);
  if (t) { clearTimeout(t); hub.timers.delete(code); }
}
