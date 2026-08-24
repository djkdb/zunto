import { NextResponse } from "next/server";
import { getStore } from "@/lib/server/store";
import { TOPIC_COUNT } from "@/lib/data/topics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 배포가 제대로 물렸는지 확인하는 용도.
 *
 * 서버리스(Cloudflare / Vercel)에서 store 가 "memory" 로 나오면
 * 요청마다 다른 인스턴스가 뜨기 때문에 방이 공유되지 않는다 —
 * 즉 친구가 코드를 넣어도 "그런 방이 없습니다" 가 뜬다.
 * 배포 직후 이 엔드포인트로 먼저 확인할 것.
 */
export async function GET() {
  const store = await getStore();
  const supabase = store.kind === "supabase";
  const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const realtime = supabase ? "supabase" : "sse";

  const warnings: string[] = [];
  if (!supabase) {
    warnings.push(
      "저장소가 인메모리입니다. 로컬에서는 괜찮지만 서버리스 배포에서는 방이 공유되지 않습니다. " +
        "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 를 빌드 시점에 넣으세요."
    );
  } else if (!hasServiceRole) {
    warnings.push(
      "SUPABASE_SERVICE_ROLE_KEY 가 없습니다. RLS 때문에 방 생성/수정이 막힙니다. " +
        "`wrangler secret put SUPABASE_SERVICE_ROLE_KEY` 로 넣으세요."
    );
  }

  // 상태 코드는 항상 200 — 워커 자체는 살아 있다.
  // "여러 기기가 같이 놀 수 있는 설정인가" 는 ok 로 판단한다
  // (로컬 개발에서는 인메모리가 정상이므로 5xx 를 돌려주면 오해를 부른다).
  return NextResponse.json(
    {
      ok: warnings.length === 0,
      mode: supabase ? "production" : "local",
      store: store.kind,
      realtime,
      hasServiceRole,
      topics: TOPIC_COUNT,
      serverNow: Date.now(),
      warnings,
    },
    { status: 200 }
  );
}
