import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RoomState } from "@/lib/game/types";
import type { RoomStore } from "./store";

/**
 * Supabase(Postgres) 어댑터.
 * rooms.state(jsonb) 에 전체 상태를 저장하고 version 으로 낙관적 잠금을 건다.
 * Realtime 은 클라이언트가 rooms 행 UPDATE 를 직접 구독한다.
 */
export class SupabaseStore implements RoomStore {
  readonly kind = "supabase" as const;
  private client: SupabaseClient;

  constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    this.client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async create(state: RoomState) {
    const { error } = await this.client.from("rooms").insert({
      code: state.code,
      name: state.settings.name,
      host_id: state.hostId || null,
      status: state.status,
      settings: state.settings,
      state,
      version: 1,
    });
    if (error) throw new Error(`방 생성 실패: ${error.message}`);
    return state;
  }

  async get(code: string) {
    const { data, error } = await this.client
      .from("rooms").select("state").eq("code", code).maybeSingle();
    if (error) throw new Error(error.message);
    return (data?.state as RoomState) ?? null;
  }

  async mutate(code: string, fn: (s: RoomState) => void | boolean) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const { data, error } = await this.client
        .from("rooms").select("state, version").eq("code", code).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;

      const state = data.state as RoomState;
      const version = data.version as number;
      const res = fn(state);
      if (res === false) return state;

      const { data: updated, error: upErr } = await this.client
        .from("rooms")
        .update({
          state,
          version: version + 1,
          status: state.status,
          name: state.settings.name,
          host_id: state.hostId || null,
          settings: state.settings,
          updated_at: new Date().toISOString(),
        })
        .eq("code", code)
        .eq("version", version)
        .select("state")
        .maybeSingle();

      if (upErr) throw new Error(upErr.message);
      if (updated) return updated.state as RoomState;
      // 버전 충돌 → 아주 짧게 쉬고 재시도
      await new Promise((r) => setTimeout(r, 25 + attempt * 30));
    }
    return this.get(code);
  }

  async delete(code: string) {
    await this.client.from("rooms").delete().eq("code", code);
  }

  async exists(code: string) {
    const { data } = await this.client.from("rooms").select("code").eq("code", code).maybeSingle();
    return Boolean(data);
  }
}
