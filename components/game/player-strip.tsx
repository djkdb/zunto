"use client";
import type { Player, RoomState } from "@/lib/game/types";
import { PlayerAvatar } from "@/components/room/player-chip";
import { cn } from "@/lib/utils";

/** 상단 참가자 줄 — 지금 누가 말하는지, 누가 끝냈는지 한눈에 */
export function PlayerStrip({
  state, activeId, doneIds, playerId, onTap,
}: {
  state: RoomState;
  activeId?: string;
  doneIds?: string[];
  playerId: string;
  onTap?: (p: Player) => void;
}) {
  const players = state.players.filter((p) => p.active || state.status === "LOBBY");
  return (
    <div className="no-scrollbar -mx-1 flex gap-2.5 overflow-x-auto px-1 py-1">
      {players.map((p) => {
        const isActive = p.id === activeId;
        const done = doneIds?.includes(p.id);
        return (
          <button
            key={p.id}
            onClick={() => onTap?.(p)}
            disabled={!onTap}
            className={cn("relative flex w-14 shrink-0 flex-col items-center gap-1", isActive && "animate-pop")}
          >
            <PlayerAvatar
              player={p}
              size={44}
              ring={isActive}
              dim={!p.connected}
              badge={
                done ? (
                  <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full border-2 border-night-950 bg-good text-[0.6rem] font-black text-night-950">
                    ✓
                  </span>
                ) : undefined
              }
            />
            <span
              className={cn(
                "w-full truncate text-center text-[0.65rem] font-bold",
                isActive ? "text-accent" : "text-ink-mute"
              )}
            >
              {p.nickname}
              {p.id === playerId ? "" : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
