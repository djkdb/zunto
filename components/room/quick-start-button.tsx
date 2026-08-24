"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { loadIdentity, rememberRoom, saveIdentity } from "@/lib/client/identity";
import { nextAvatar } from "@/lib/game/avatars";
import { unlock } from "@/lib/client/sound";

/** 설정 없이 바로 방 만들기 — 기본값 4명 · 5라운드 · 알아서 분위기 */
export function QuickStartButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function go() {
    if (busy) return;
    setBusy(true);
    void unlock();
    try {
      const id = loadIdentity();
      const nickname = id.nickname || "방장";
      const avatar = id.avatar || nextAvatar([]);
      saveIdentity({ nickname, avatar });

      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: { name: "빠른 토론", maxPlayers: 4, totalRounds: 3, vibe: "AUTO", topicPolicy: "HOST" },
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "방을 만들지 못했습니다");

      await fetch(`/api/rooms/${data.code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: id.playerId, nickname, avatar }),
      });
      rememberRoom(data.code, "빠른 토론");
      router.push(`/room/${data.code}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "방을 만들지 못했습니다");
      setBusy(false);
    }
  }

  return (
    <button
      onClick={go}
      disabled={busy}
      className="flex h-16 w-full items-center gap-4 rounded-3xl border border-night-600 bg-night-850/80 px-6 text-left transition-colors active:bg-night-800 disabled:opacity-60"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-warn/12">
        {busy ? (
          <Loader2 size={19} className="animate-spin text-warn" />
        ) : (
          <Zap size={19} className="text-warn" />
        )}
      </span>
      <span className="flex-1">
        <span className="block text-[0.98rem] font-bold">빠른 토론</span>
        <span className="block text-[0.76rem] text-ink-mute">설정 건너뛰고 바로 시작 · 3라운드</span>
      </span>
      <span className="text-xl text-ink-faint">›</span>
    </button>
  );
}
