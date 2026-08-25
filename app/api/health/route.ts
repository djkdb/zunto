import { NextResponse } from "next/server";
import { getStore } from "@/lib/server/store";
import { TOPIC_COUNT } from "@/lib/data/topics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 배포가 제대로 물렸는지 확인하는 용도.
 *
 * 환경 변수가 "있는지" 만 보지 않고 Supabase 에 실제로 요청을 한 번 보내본다.
 * 값이 다 채워져 있어도 URL 이 틀렸거나 키가 안 맞으면 방 생성이 실패하는데,
 * 그때 화면에는 원인을 알 수 없는 에러만 뜨기 때문이다.
 */

/** 눈에 안 보이는 문자(제로폭·BOM·개행 등)를 사람이 읽을 수 있게 */
function describeOddChars(value: string): string | null {
  const odd = [...value].filter((c) => {
    const n = c.codePointAt(0)!;
    return n < 0x20 || n === 0x7f || (n >= 0x200b && n <= 0x200f) || n === 0xfeff || n === 0xa0;
  });
  if (!odd.length) return null;
  return odd.map((c) => `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`).join(", ");
}

/** Supabase REST 에 가장 가벼운 요청을 한 번 보내서 진짜로 닿는지 본다 */
async function probeSupabase(url: string, key: string) {
  const endpoint = `${url.replace(/\/+$/, "")}/rest/v1/rooms?select=code&limit=1`;
  try {
    const res = await fetch(endpoint, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    // 성공했을 때는 본문을 돌려주지 않는다 (방 코드가 들어 있다)
    const body = res.ok ? undefined : (await res.text()).slice(0, 300);
    return { ok: res.ok, status: res.status, endpoint, body };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      endpoint,
      body: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    };
  }
}

export async function GET() {
  const store = await getStore();
  const supabase = store.kind === "supabase";
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const hasServiceRole = Boolean(serviceRole);
  const realtime = supabase ? "supabase" : "sse";

  // 빌드 때 번들에 박힌 값 — 런타임 환경 변수로 덮어쓸 수 없다 (next.config.ts 참고)
  const browserHasSupabase = process.env.BUILD_HAS_SUPABASE === "1";

  const warnings: string[] = [];

  if (!supabase) {
    warnings.push(
      "저장소가 인메모리입니다. 로컬에서는 괜찮지만 서버리스 배포에서는 방이 공유되지 않습니다. " +
        "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 를 빌드 시점에 넣으세요."
    );
  }
  if (supabase && !browserHasSupabase) {
    warnings.push(
      "서버는 Supabase 를 쓰는데 브라우저 번들에는 값이 없습니다. " +
        "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 를 런타임 변수가 아니라 " +
        "빌드 환경 변수로 넣고 다시 배포하세요. 지금 상태로는 방은 만들어지지만 " +
        "참가자끼리 화면이 갱신되지 않습니다."
    );
  }
  if (supabase && !hasServiceRole) {
    warnings.push(
      "SUPABASE_SERVICE_ROLE_KEY 가 없습니다. RLS 때문에 방 생성/수정이 막힙니다."
    );
  }

  /* ── URL 모양 점검 ─────────────────────────────────────────────── */
  const url: Record<string, unknown> = { raw: rawUrl, length: rawUrl.length };
  const odd = describeOddChars(rawUrl);
  if (odd) {
    url.oddChars = odd;
    warnings.push(
      `NEXT_PUBLIC_SUPABASE_URL 에 눈에 안 보이는 문자가 들어 있습니다 (${odd}). ` +
        "값을 지우고 다시 붙여넣으세요."
    );
  }
  if (rawUrl) {
    try {
      const u = new URL(rawUrl.trim());
      url.origin = u.origin;
      url.pathname = u.pathname;
      if (u.pathname !== "/" && u.pathname !== "") {
        warnings.push(
          `NEXT_PUBLIC_SUPABASE_URL 에 경로가 붙어 있습니다 ("${u.pathname}"). ` +
            "프로젝트 주소만 넣어야 합니다 — 예: https://xxxx.supabase.co"
        );
      }
      if (u.protocol !== "https:") {
        warnings.push(`NEXT_PUBLIC_SUPABASE_URL 이 https 가 아닙니다 ("${u.protocol}").`);
      }
    } catch {
      url.parsed = false;
      warnings.push(
        `NEXT_PUBLIC_SUPABASE_URL 을 주소로 해석할 수 없습니다: "${rawUrl.slice(0, 80)}"`
      );
    }
  }

  /* ── 실제로 닿는지 ────────────────────────────────────────────── */
  let reachable: Awaited<ReturnType<typeof probeSupabase>> | null = null;
  if (supabase && rawUrl) {
    reachable = await probeSupabase(rawUrl.trim(), (serviceRole || anon).trim());
    if (!reachable.ok) {
      warnings.push(
        `Supabase 에 요청이 실패했습니다 (HTTP ${reachable.status}). ` +
          `응답: ${reachable.body}`
      );
    }
  }

  return NextResponse.json(
    {
      ok: warnings.length === 0,
      mode: supabase ? "production" : "local",
      store: store.kind,
      realtime,
      browserHasSupabase,
      hasServiceRole,
      keyKind: serviceRole
        ? serviceRole.startsWith("sb_secret_")
          ? "secret"
          : serviceRole.startsWith("eyJ")
            ? "legacy-jwt"
            : "unknown"
        : null,
      url,
      reachable,
      topics: TOPIC_COUNT,
      serverNow: Date.now(),
      warnings,
    },
    { status: 200 }
  );
}
