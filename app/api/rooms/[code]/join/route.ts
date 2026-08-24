import { NextResponse } from "next/server";
import { applyAction, getRoom } from "@/lib/server/room-service";
import { canJoin } from "@/lib/game/machine";
import { coerceCode } from "@/lib/server/codes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  NOT_FOUND: "그런 방이 없습니다. 코드를 다시 확인해 주세요.",
  FULL: "방이 가득 찼습니다.",
  FINISHED: "이미 끝난 방입니다.",
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code: raw } = await params;
  const code = coerceCode(raw);
  const body = await req.json().catch(() => ({}));
  const playerId = String(body.playerId ?? "").slice(0, 64);
  const nickname = String(body.nickname ?? "").trim().slice(0, 12);
  const avatar = String(body.avatar ?? "").slice(0, 8);

  if (!playerId || !nickname) {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST", message: "닉네임을 입력해 주세요." }, { status: 400 });
  }

  const state = await getRoom(code);
  if (!state) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND", message: MESSAGES.NOT_FOUND }, { status: 404 });
  }
  const rejection = canJoin(state, playerId);
  if (rejection) {
    return NextResponse.json({ ok: false, error: rejection, message: MESSAGES[rejection] }, { status: 409 });
  }

  const next = await applyAction(code, { type: "JOIN", playerId, nickname, avatar });
  return NextResponse.json({ ok: true, state: next, serverNow: Date.now() });
}
