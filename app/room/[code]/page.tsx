import type { Metadata } from "next";
import { RoomClient } from "@/components/room/room-client";
import { coerceCode } from "@/lib/server/codes";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const room = coerceCode(code);
  const title = `${room} — DEBATENIGHT 토론방`;
  const description = "닉네임만 넣으면 바로 참가. 진행자 없이 앱이 사회를 봅니다.";
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
  };
}

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <RoomClient code={coerceCode(code)} />;
}
