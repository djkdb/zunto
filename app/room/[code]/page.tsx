import { RoomClient } from "@/components/room/room-client";
import { coerceCode } from "@/lib/server/codes";

export const dynamic = "force-dynamic";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <RoomClient code={coerceCode(code)} />;
}
