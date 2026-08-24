import type { RoomState } from "@/lib/game/types";

export interface RoomStore {
  readonly kind: "memory" | "supabase";
  create(state: RoomState): Promise<RoomState>;
  get(code: string): Promise<RoomState | null>;
  /** 읽고-수정하고-쓰기를 원자적으로. mutator 가 false 를 반환하면 저장하지 않는다. */
  mutate(code: string, fn: (s: RoomState) => void | boolean): Promise<RoomState | null>;
  delete(code: string): Promise<void>;
  exists(code: string): Promise<boolean>;
}

let cached: RoomStore | null = null;

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

export async function getStore(): Promise<RoomStore> {
  if (cached) return cached;
  if (isSupabaseConfigured()) {
    const { SupabaseStore } = await import("./supabase-store");
    cached = new SupabaseStore();
  } else {
    const { MemoryStore } = await import("./memory-store");
    cached = new MemoryStore();
  }
  return cached;
}
