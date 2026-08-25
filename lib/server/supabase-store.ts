import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RoomState } from "@/lib/game/types";
import type { RoomStore } from "./store";
import { normalizeSupabaseUrl } from "@/lib/supabase-url";

/**
 * Supabase(Postgres) 어댑터.
 * rooms.state(jsonb) 에 전체 상태를 저장하고 version 으로 낙관적 잠금을 건다.
 * Realtime 은 클라이언트가 rooms 행 UPDATE 를 직접 구독한다.
 */
const RLS_HINT =
  "SUPABASE_SERVICE_ROLE_KEY 가 설정되어 있지 않으면 RLS 때문에 쓰기가 막힙니다. " +
  ".env.local 에 service_role 키를 넣어주세요 (NEXT_PUBLIC_ 접두사 없이).";

export class SupabaseStore implements RoomStore {
  readonly kind = "supabase" as const;
  private client: SupabaseClient;
  private hasServiceRole: boolean;

  constructor() {
    const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.hasServiceRole = Boolean(serviceRole?.trim());
    const key = (serviceRole || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
    if (!this.hasServiceRole) {
      console.warn(`[debatenight] ${RLS_HINT}`);
    }
    this.client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  /** 원인을 짐작할 수 있으면 힌트를, 아니면 어디를 보라고 알려준다 */
  private fail(message: string): never {
    const permissionish = /row-level security|permission|policy|JWT/i.test(message);
    if (permissionish && !this.hasServiceRole) {
      throw new Error(`${message} — ${RLS_HINT}`);
    }
    // 화면에 원인 모를 에러만 뜨면 손쓸 방법이 없다. 진단 엔드포인트로 보낸다.
    throw new Error(`${message} (원인은 /api/health 에서 확인할 수 있습니다)`);
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
    if (error) this.fail(`방 생성 실패: ${error.message}`);
    return state;
  }

  async get(code: string) {
    const { data, error } = await this.client
      .from("rooms").select("state").eq("code", code).maybeSingle();
    if (error) this.fail(error.message);
    return (data?.state as RoomState) ?? null;
  }

  async mutate(code: string, fn: (s: RoomState) => void | boolean) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const { data, error } = await this.client
        .from("rooms").select("state, version").eq("code", code).maybeSingle();
      if (error) this.fail(error.message);
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

      if (upErr) this.fail(upErr.message);
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
