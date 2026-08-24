import { NextResponse } from "next/server";
import { ALL_TOPICS, TOPICS_BY_CATEGORY } from "@/lib/data/topics";
import { recommendTopics } from "@/lib/game/recommend";
import { mulberry32 } from "@/lib/game/rng";
import type { Category, DebateMode, Difficulty, Vibe } from "@/lib/game/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const category = url.searchParams.get("category") as Category | null;
  const mode = (url.searchParams.get("mode") as DebateMode | null) ?? "BALANCE";
  const vibe = (url.searchParams.get("vibe") as Vibe | null) ?? "AUTO";
  const count = Math.min(30, Math.max(1, Number(url.searchParams.get("count") ?? 6)));
  const playerCount = Math.min(8, Math.max(2, Number(url.searchParams.get("players") ?? 4)));
  const seed = Number(url.searchParams.get("seed") ?? Date.now());

  const topics = recommendTopics(
    {
      playerCount,
      vibe,
      categories: category ? [category] : [],
      mode,
      difficulty: 3 as Difficulty,
      hour: new Date().getHours(),
      usedTopicIds: [],
      roundNo: 1,
      funHistory: [],
      rand: mulberry32(seed >>> 0),
    },
    count
  );

  return NextResponse.json({
    ok: true,
    total: ALL_TOPICS.length,
    counts: Object.fromEntries(
      Object.entries(TOPICS_BY_CATEGORY).map(([k, v]) => [k, v.length])
    ),
    topics,
  });
}
