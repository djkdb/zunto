import { NextResponse } from "next/server";
import { fromGenerated, getTopicProvider } from "@/lib/ai/topic-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const prompt = String(body.prompt ?? "").slice(0, 400);
  const count = Math.min(10, Math.max(1, Number(body.count ?? 5)));

  try {
    const provider = getTopicProvider();
    const generated = await provider.generate({
      prompt,
      count,
      mode: body.mode,
      category: body.category,
      playerCount: body.playerCount,
    });
    return NextResponse.json({
      ok: true,
      provider: provider.id,
      label: provider.label,
      topics: generated.map(fromGenerated),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "주제를 생성하지 못했습니다";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
