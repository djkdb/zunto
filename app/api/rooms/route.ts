import { NextResponse } from "next/server";
import { createRoomWithCode } from "@/lib/server/room-service";
import { DEFAULT_SETTINGS, type RoomSettings } from "@/lib/game/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitize(input: unknown): Partial<RoomSettings> {
  const s = (input ?? {}) as Partial<RoomSettings>;
  const out: Partial<RoomSettings> = {};
  if (typeof s.name === "string") out.name = s.name.trim().slice(0, 24) || DEFAULT_SETTINGS.name;
  if (typeof s.maxPlayers === "number") out.maxPlayers = Math.min(8, Math.max(2, Math.round(s.maxPlayers)));
  if (typeof s.totalRounds === "number") out.totalRounds = Math.min(12, Math.max(1, Math.round(s.totalRounds)));
  if (typeof s.speechMs === "number") out.speechMs = Math.min(180_000, Math.max(20_000, Math.round(s.speechMs)));
  if (typeof s.difficulty === "number") out.difficulty = Math.min(5, Math.max(1, Math.round(s.difficulty))) as RoomSettings["difficulty"];
  if (typeof s.vibe === "string") out.vibe = s.vibe as RoomSettings["vibe"];
  if (Array.isArray(s.categories)) out.categories = s.categories.slice(0, 9) as RoomSettings["categories"];
  if (typeof s.modePolicy === "string") out.modePolicy = s.modePolicy as RoomSettings["modePolicy"];
  if (typeof s.topicPolicy === "string") out.topicPolicy = s.topicPolicy as RoomSettings["topicPolicy"];
  if (typeof s.randomEvents === "boolean") out.randomEvents = s.randomEvents;
  if (typeof s.secretMissions === "boolean") out.secretMissions = s.secretMissions;
  if (typeof s.peerRating === "string") out.peerRating = s.peerRating as RoomSettings["peerRating"];
  return out;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const state = await createRoomWithCode(sanitize(body.settings));
    return NextResponse.json({ ok: true, code: state.code, state, serverNow: Date.now() });
  } catch (e) {
    const message = e instanceof Error ? e.message : "방을 만들지 못했습니다";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
