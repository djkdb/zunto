"use client";
import { Crown, WifiOff } from "lucide-react";
import type { Player } from "@/lib/game/types";
import { cn } from "@/lib/utils";

export function PlayerAvatar({
  player, size = 44, ring, dim, badge,
}: {
  player: Player;
  size?: number;
  ring?: boolean;
  dim?: boolean;
  badge?: React.ReactNode;
}) {
  return (
    <div className="relative shrink-0">
      <div
        className={cn(
          "grid place-items-center rounded-2xl border-2 transition-all",
          dim && "opacity-35 grayscale"
        )}
        style={{
          width: size,
          height: size,
          fontSize: size * 0.48,
          borderColor: ring ? player.color : "var(--color-night-600)",
          background: ring ? `${player.color}22` : "var(--color-night-800)",
          boxShadow: ring ? `0 0 18px -4px ${player.color}` : undefined,
        }}
      >
        {player.avatar}
      </div>
      {badge}
      {!player.connected && (
        <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border-2 border-night-950 bg-night-700 text-ink-mute">
          <WifiOff size={9} />
        </span>
      )}
    </div>
  );
}

export function PlayerChip({
  player, isMe, right, onClick, selected, disabled, sub,
}: {
  player: Player;
  isMe?: boolean;
  right?: React.ReactNode;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  sub?: React.ReactNode;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all",
        selected
          ? "border-accent bg-accent/12"
          : "border-night-700 bg-night-850/60",
        onClick && !disabled && "active:scale-[0.98] active:bg-night-800",
        disabled && "opacity-40"
      )}
    >
      <PlayerAvatar player={player} size={40} ring={selected} dim={!player.connected} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[0.92rem] font-bold">{player.nickname}</span>
          {player.isHost && <Crown size={13} className="shrink-0 text-warn" />}
          {isMe && <span className="shrink-0 text-[0.65rem] font-black text-accent">나</span>}
        </span>
        {sub && <span className="mt-0.5 block truncate text-[0.72rem] text-ink-mute">{sub}</span>}
      </span>
      {right}
    </Comp>
  );
}
