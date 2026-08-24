"use client";
import { useState } from "react";
import { Shuffle } from "lucide-react";
import type { DebateMode, RoomState } from "@/lib/game/types";
import { MODES, MODE_META } from "@/lib/game/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActionDock, PhaseBody } from "./frame";
import { useRoomStore } from "@/lib/client/room-store";
import { cn } from "@/lib/utils";

export function ModeSelectPhase({ state, playerId }: { state: RoomState; playerId: string }) {
  const send = useRoomStore((s) => s.send);
  const isHost = state.hostId === playerId;
  const count = state.players.filter((p) => p.active && p.connected).length;
  const [selected, setSelected] = useState<DebateMode | null>(null);

  const available = MODES.filter((m) => MODE_META[m].minPlayers <= count);

  if (!isHost) {
    return (
      <PhaseBody className="pb-32">
        <WaitingCard
          title="방장이 모드를 고르는 중"
          desc="곧 이번 라운드의 방식이 정해집니다"
        />
        <div className="grid grid-cols-2 gap-2">
          {available.map((m) => (
            <div key={m} className="rounded-2xl border border-night-700 bg-night-850/40 p-3 opacity-60">
              <span className="text-lg">{MODE_META[m].emoji}</span>
              <span className="mt-1 block text-[0.82rem] font-bold">{MODE_META[m].ko}</span>
            </div>
          ))}
        </div>
      </PhaseBody>
    );
  }

  return (
    <>
      <PhaseBody className="pb-32">
        <header>
          <p className="text-[0.7rem] font-black uppercase tracking-[0.25em] text-ink-faint">
            round {state.roundNo}
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-tight">어떻게 붙을까요?</h2>
          <p className="mt-1 text-[0.85rem] text-ink-mute">모드를 고르면 주제를 추천해 드립니다</p>
        </header>

        <div className="space-y-2">
          {available.map((m) => {
            const meta = MODE_META[m];
            const on = selected === m;
            return (
              <button
                key={m}
                onClick={() => setSelected(m)}
                className={cn(
                  "w-full rounded-3xl border p-4 text-left transition-all active:scale-[0.99]",
                  on ? "border-accent bg-accent/12" : "border-night-700 bg-night-850/60"
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-night-800 text-xl">
                    {meta.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[0.6rem] font-black text-accent-soft">MODE {meta.letter}</span>
                      <span className="text-[0.95rem] font-bold">{meta.ko}</span>
                    </div>
                    <p className="mt-0.5 text-[0.8rem] leading-snug text-ink-mute">{meta.tagline}</p>
                    {on && (
                      <ol className="mt-3 animate-rise space-y-1 border-t border-accent/20 pt-3">
                        {meta.how.map((h, i) => (
                          <li key={i} className="flex gap-2 text-[0.76rem] text-ink-dim">
                            <span className="font-black text-accent">{i + 1}</span>
                            {h}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                  <span className="shrink-0 text-[0.65rem] font-bold text-ink-faint">
                    ~{meta.estimatedMin}분
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {MODES.length > available.length && (
          <p className="text-center text-[0.72rem] text-ink-faint">
            인원이 {Math.min(...MODES.filter((m) => !available.includes(m)).map((m) => MODE_META[m].minPlayers))}명
            이상이면 모드가 더 열립니다
          </p>
        )}
      </PhaseBody>

      <ActionDock>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="lg"
            className="px-4"
            onClick={() => {
              const m = available[Math.floor(Math.random() * available.length)];
              setSelected(m);
              void send({ type: "CHOOSE_MODE", playerId, mode: m });
            }}
            aria-label="랜덤 모드"
          >
            <Shuffle size={18} />
          </Button>
          <Button
            size="lg"
            block
            disabled={!selected}
            onClick={() => selected && send({ type: "CHOOSE_MODE", playerId, mode: selected })}
          >
            {selected ? `${MODE_META[selected].ko}으로 진행` : "모드를 골라주세요"}
          </Button>
        </div>
      </ActionDock>
    </>
  );
}

export function WaitingCard({ title, desc, extra }: { title: string; desc?: string; extra?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-night-700 bg-night-850/50 p-8 text-center">
      <div className="mx-auto mb-4 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-accent"
            style={{ animation: `float 1.1s ease-in-out ${i * 0.16}s infinite` }}
          />
        ))}
      </div>
      <p className="text-lg font-bold">{title}</p>
      {desc && <p className="mt-1.5 text-[0.85rem] text-ink-mute">{desc}</p>}
      {extra}
    </div>
  );
}

export function ModeBadge({ mode }: { mode: DebateMode }) {
  const meta = MODE_META[mode];
  return (
    <Badge variant="accent">
      {meta.emoji} {meta.ko}
    </Badge>
  );
}
