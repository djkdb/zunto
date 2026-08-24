"use client";
import { useEffect, useState } from "react";
import type { RandomEvent, RoomState } from "@/lib/game/types";
import { play } from "@/lib/client/sound";
import { cn } from "@/lib/utils";

/** 이벤트가 발동되면 전체 화면으로 한 번 크게 보여주고, 이후엔 얇은 배너로 남는다 */
export function EventOverlay({ event, phase }: { event?: RandomEvent; phase: string }) {
  const [shown, setShown] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    if (!event) return;
    if (event.appliesFrom !== phase) return;
    if (dismissed === event.code) return;
    setShown(true);
    play("event");
    const t = setTimeout(() => { setShown(false); setDismissed(event.code); }, 3600);
    return () => clearTimeout(t);
  }, [event, phase, dismissed]);

  if (!event || !shown) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid animate-fade place-items-center bg-night-950/92 px-8 backdrop-blur-md"
      onClick={() => { setShown(false); setDismissed(event.code); }}
    >
      <div className="animate-pop text-center">
        <div className="mb-4 text-[4.5rem] leading-none">{event.emoji}</div>
        <div className="mb-1 text-[0.7rem] font-black uppercase tracking-[0.3em] text-danger">
          random event
        </div>
        <h2 className="mb-3 text-3xl font-black tracking-tight">{event.title}</h2>
        <p className="mx-auto max-w-xs text-[0.95rem] leading-relaxed text-ink-dim">{event.desc}</p>
        <p className="mt-8 text-[0.7rem] text-ink-faint">탭하면 넘어갑니다</p>
      </div>
    </div>
  );
}

export function EventBadge({ state }: { state: RoomState }) {
  const ev = state.round?.event;
  if (!ev) return null;
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-2xl border border-danger/35 bg-danger/10 px-3 py-2 text-[0.76rem] font-bold text-danger"
      )}
    >
      <span className="text-base leading-none">{ev.emoji}</span>
      <span className="flex-1 leading-snug">
        {ev.title}
        <span className="ml-1.5 font-medium text-danger/70">{ev.desc}</span>
      </span>
    </div>
  );
}
