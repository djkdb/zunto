import { getRoom, tickRoom, touchRoom } from "@/lib/server/room-service";
import { subscribe } from "@/lib/server/hub";
import { coerceCode } from "@/lib/server/codes";
import type { RoomState } from "@/lib/game/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 15_000;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code: raw } = await params;
  const code = coerceCode(raw);
  const playerId = new URL(req.url).searchParams.get("playerId") ?? "";

  const initial = await getRoom(code);
  if (!initial) {
    return new Response("event: gone\ndata: {}\n\n", {
      status: 404,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, payload: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
          );
        } catch {
          cleanup();
        }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        unsubscribe?.();
        if (heartbeat) clearInterval(heartbeat);
        try { controller.close(); } catch { /* 이미 닫힘 */ }
      };

      send("state", { state: initial, serverNow: Date.now() });

      unsubscribe = subscribe(code, (s: RoomState) => {
        send("state", { state: s, serverNow: Date.now() });
      });

      // 구독이 살아있는 동안 서버 타이머가 계속 돌도록 한 번 킥
      touchRoom(code, playerId).catch(() => {});
      tickRoom(code).catch(() => {});

      heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          cleanup();
          return;
        }
        // 연결이 살아있으면 이 참가자도 살아있다
        touchRoom(code, playerId).catch(() => {});
        tickRoom(code).catch(() => {});
      }, HEARTBEAT_MS);

      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      closed = true;
      unsubscribe?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
