import { NextResponse } from "next/server";
import { applyAction } from "@/lib/server/room-service";
import { coerceCode } from "@/lib/server/codes";
import type { Action } from "@/lib/game/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set<Action["type"]>([
  "JOIN", "LEAVE", "PING", "SET_READY", "KICK", "UPDATE_SETTINGS", "START_GAME",
  "CHOOSE_MODE", "CHOOSE_TOPIC", "REROLL_TOPICS", "VOTE_TOPIC", "CHOOSE_STANCE",
  "PICK_PLAYER", "CHOOSE_REBUTTAL", "SUBMIT_VOTE", "SUBMIT_RATING",
  "SUBMIT_QUICK_AWARD", "SUBMIT_QUOTE", "MISSION_VOTE", "FUN_VOTE",
  "ADVANCE", "TIMEOUT", "EXTEND_TIME", "NEXT_ROUND", "END_GAME", "RESTART",
]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code: raw } = await params;
  const code = coerceCode(raw);
  const action = (await req.json().catch(() => null)) as Action | null;

  if (!action || !ALLOWED.has(action.type)) {
    return NextResponse.json({ ok: false, error: "BAD_ACTION" }, { status: 400 });
  }

  try {
    const state = await applyAction(code, action);
    if (!state) {
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND", message: "방이 사라졌습니다." },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, state, serverNow: Date.now() });
  } catch (e) {
    const message = e instanceof Error ? e.message : "처리하지 못했습니다";
    return NextResponse.json({ ok: false, error: "SERVER", message }, { status: 500 });
  }
}
