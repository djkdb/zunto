"use client";
import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import type { RoomState } from "@/lib/game/types";
import { missionHint } from "@/lib/game/missions";

/** 비밀 미션 — 본인만 볼 수 있다. 탭해야 열린다 (옆사람 훔쳐보기 방지) */
export function MissionCard({ state, playerId }: { state: RoomState; playerId: string }) {
  const mission = state.round?.mission;
  const [open, setOpen] = useState(false);
  if (!mission || mission.playerId !== playerId) return null;

  return (
    <button
      onClick={() => setOpen((v) => !v)}
      className="w-full rounded-3xl border border-warn/40 bg-warn/10 p-4 text-left transition-colors active:bg-warn/15"
    >
      <div className="flex items-center gap-2">
        <Lock size={14} className="text-warn" />
        <span className="flex-1 text-[0.68rem] font-black uppercase tracking-[0.2em] text-warn">
          secret mission · 당신에게만 보입니다
        </span>
        {open ? <EyeOff size={15} className="text-warn" /> : <Eye size={15} className="text-warn" />}
      </div>
      {open ? (
        <div className="mt-2.5 animate-rise">
          <p className="text-[1.05rem] font-bold leading-snug text-ink">{mission.text}</p>
          <p className="mt-1 text-[0.76rem] text-warn/80">{missionHint(mission.code)}</p>
          <p className="mt-2 text-[0.72rem] text-ink-faint">
            성공 여부는 라운드가 끝난 뒤 친구들이 판정합니다.
          </p>
        </div>
      ) : (
        <p className="mt-2 text-[0.85rem] font-bold text-warn/70">탭해서 확인 · 들키지 마세요</p>
      )}
    </button>
  );
}
