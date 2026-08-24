import { NextResponse } from "next/server";
import { getRoom } from "@/lib/server/room-service";
import { coerceCode } from "@/lib/server/codes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const state = await getRoom(coerceCode(code));
  if (!state) {
    return NextResponse.json(
      { ok: false, error: "NOT_FOUND", message: "그런 방이 없습니다. 코드를 다시 확인해 주세요." },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true, state, serverNow: Date.now() });
}
