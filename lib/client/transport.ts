"use client";
import type { RoomState } from "@/lib/game/types";
import { normalizeSupabaseUrl } from "@/lib/supabase-url";

export interface Snapshot { state: RoomState; serverNow: number }
export type OnSnapshot = (snap: Snapshot) => void;
export type OnStatus = (status: "connecting" | "live" | "offline" | "gone") => void;

export interface Transport {
  readonly kind: "sse" | "supabase";
  connect(code: string, onSnapshot: OnSnapshot, onStatus: OnStatus, playerId?: string): () => void;
}

const SUPABASE_URL = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_ANON = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

/** 방이 사라졌는지(404) 한 번 확인한다. 판단이 안 서면 false = 재연결 시도. */
async function probeGone(code: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/rooms/${code}`, { cache: "no-store" });
    return res.status === 404;
  } catch {
    return false;   // 네트워크가 끊긴 것뿐이면 계속 재연결한다
  }
}

/* ── SSE (기본, 제로 컨피그) ─────────────────────────────────────────── */

class SseTransport implements Transport {
  readonly kind = "sse" as const;

  connect(code: string, onSnapshot: OnSnapshot, onStatus: OnStatus, playerId?: string) {
    let es: EventSource | null = null;
    let retry = 0;
    let stopped = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const open = () => {
      if (stopped) return;
      onStatus(retry === 0 ? "connecting" : "offline");
      const qs = playerId ? `?playerId=${encodeURIComponent(playerId)}` : "";
      es = new EventSource(`/api/rooms/${code}/stream${qs}`);

      es.addEventListener("state", (ev) => {
        retry = 0;
        onStatus("live");
        try { onSnapshot(JSON.parse((ev as MessageEvent).data) as Snapshot); }
        catch { /* 깨진 프레임 무시 */ }
      });

      es.addEventListener("gone", () => {
        stopped = true;
        onStatus("gone");
        es?.close();
      });

      es.onerror = () => {
        es?.close();
        if (stopped) return;
        onStatus("offline");
        // EventSource 는 404 본문을 읽지 못하고 그냥 에러만 낸다.
        // 방이 정말 없는 것인지 REST 로 확인해서, 잘못된 코드면 즉시 안내한다.
        void probeGone(code).then((gone) => {
          if (stopped) return;
          if (gone) { stopped = true; onStatus("gone"); return; }
          retry = Math.min(retry + 1, 6);
          retryTimer = setTimeout(open, 400 * 2 ** (retry - 1));
        });
      };
    };

    open();
    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }
}

/* ── Supabase Realtime (프로덕션) ────────────────────────────────────── */

class SupabaseTransport implements Transport {
  readonly kind = "supabase" as const;

  connect(code: string, onSnapshot: OnSnapshot, onStatus: OnStatus) {
    let stopped = false;
    let cleanup: (() => void) | null = null;
    onStatus("connecting");

    (async () => {
      const { createClient } = await import("@supabase/supabase-js");
      if (stopped) return;
      const client = createClient(SUPABASE_URL, SUPABASE_ANON, {
        auth: { persistSession: false },
        realtime: { params: { eventsPerSecond: 20 } },
      });

      // 최초 스냅샷은 REST 로
      const res = await fetch(`/api/rooms/${code}`, { cache: "no-store" }).catch(() => null);
      if (stopped) return;
      if (res?.status === 404) { onStatus("gone"); return; }
      const first = await res?.json().catch(() => null);
      if (first?.ok && !stopped) onSnapshot(first as Snapshot);

      const channel = client
        .channel(`room:${code}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "rooms", filter: `code=eq.${code}` },
          (payload) => {
            const state = (payload.new as { state?: RoomState })?.state;
            if (state) onSnapshot({ state, serverNow: Date.now() });
          }
        )
        .subscribe((status) => {
          if (stopped) return;
          if (status === "SUBSCRIBED") onStatus("live");
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") onStatus("offline");
        });

      cleanup = () => { client.removeChannel(channel); };
    })();

    return () => { stopped = true; cleanup?.(); };
  }
}

export function createTransport(): Transport {
  return SUPABASE_URL && SUPABASE_ANON ? new SupabaseTransport() : new SseTransport();
}

export const REALTIME_KIND = SUPABASE_URL && SUPABASE_ANON ? "supabase" : "sse";
