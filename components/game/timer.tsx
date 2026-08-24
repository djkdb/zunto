"use client";
import { useEffect, useRef, useState } from "react";
import { serverClock } from "@/lib/client/clock";
import { play } from "@/lib/client/sound";
import { cn } from "@/lib/utils";

/** 서버 기준 종료 시각으로만 계산 — 모든 참가자가 같은 숫자를 본다 */
export function useRemaining(endsAt: number | null, totalMs: number) {
  const [ms, setMs] = useState(() => (endsAt === null ? totalMs : Math.max(0, endsAt - serverClock.now())));
  const raf = useRef<number>(0);

  useEffect(() => {
    if (endsAt === null) { setMs(totalMs); return; }
    let alive = true;
    const loop = () => {
      if (!alive) return;
      setMs(Math.max(0, endsAt - serverClock.now()));
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(raf.current); };
  }, [endsAt, totalMs]);

  return ms;
}

export function Timer({
  endsAt, totalMs, size = 168, label, compact,
}: {
  endsAt: number | null;
  totalMs: number;
  size?: number;
  label?: string;
  compact?: boolean;
}) {
  const ms = useRemaining(endsAt, totalMs);
  const secs = Math.ceil(ms / 1000);
  const pct = totalMs > 0 ? Math.max(0, Math.min(1, ms / totalMs)) : 0;
  const urgent = endsAt !== null && secs <= 10 && secs > 0;
  const critical = endsAt !== null && secs <= 5 && secs > 0;
  const lastBeep = useRef(-1);

  useEffect(() => {
    if (endsAt === null) return;
    if (secs === lastBeep.current) return;
    lastBeep.current = secs;
    if (secs <= 0) play("timeUp");
    else if (secs <= 5) play("tickUrgent");
    else if (secs <= 10) play("tick");
  }, [secs, endsAt]);

  if (endsAt === null) {
    return (
      <div className={cn("grid place-items-center", compact && "flex items-center gap-2")}>
        <span className="text-[0.75rem] font-bold uppercase tracking-widest text-ink-faint">
          {label ?? "시간 제한 없음"}
        </span>
      </div>
    );
  }

  if (compact) {
    return (
      <div
        className={cn(
          "tabnum flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-sm font-black transition-colors",
          critical ? "bg-danger/20 text-danger" : urgent ? "bg-warn/15 text-warn" : "bg-night-800 text-ink-dim"
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", critical ? "bg-danger" : urgent ? "bg-warn" : "bg-ink-faint")} />
        {String(Math.floor(secs / 60)).padStart(1, "0")}:{String(secs % 60).padStart(2, "0")}
      </div>
    );
  }

  const r = size / 2 - 8;
  const circ = 2 * Math.PI * r;

  return (
    <div
      className={cn("relative grid place-items-center", critical && "animate-shake")}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={7} className="stroke-night-700" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={7} strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          className={cn(
            "transition-[stroke-dashoffset] duration-200 ease-linear",
            critical ? "stroke-danger" : urgent ? "stroke-warn" : "stroke-accent"
          )}
          style={critical ? { filter: "drop-shadow(0 0 8px var(--color-danger))" } : undefined}
        />
      </svg>
      <div
        className={cn(
          "absolute inset-0 grid place-items-center rounded-full",
          critical && "animate-pulse-ring"
        )}
      >
        <div className="text-center">
          <div
            className={cn(
              "tabnum font-mono font-black leading-none tracking-tight transition-colors",
              critical ? "text-danger" : urgent ? "text-warn" : "text-ink"
            )}
            style={{ fontSize: size * 0.31 }}
          >
            {secs}
          </div>
          {label && (
            <div className="mt-1.5 text-[0.68rem] font-bold uppercase tracking-widest text-ink-faint">
              {label}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** 얇은 진행 바 — 화면 상단 고정용 */
export function TimerBar({ endsAt, totalMs }: { endsAt: number | null; totalMs: number }) {
  const ms = useRemaining(endsAt, totalMs);
  if (endsAt === null) return <div className="h-0.5 w-full bg-night-800" />;
  const pct = totalMs > 0 ? Math.max(0, Math.min(1, ms / totalMs)) : 0;
  const secs = Math.ceil(ms / 1000);
  return (
    <div className="h-0.5 w-full overflow-hidden bg-night-800">
      <div
        className={cn(
          "h-full transition-[width] duration-200 ease-linear",
          secs <= 5 ? "bg-danger" : secs <= 10 ? "bg-warn" : "bg-accent"
        )}
        style={{ width: `${pct * 100}%` }}
      />
    </div>
  );
}
