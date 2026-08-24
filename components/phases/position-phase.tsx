"use client";
import { Check, EyeOff } from "lucide-react";
import type { RoomState, Stance } from "@/lib/game/types";
import { MODE_META } from "@/lib/game/types";
import { TopicCard } from "@/components/game/topic-card";
import { Timer } from "@/components/game/timer";
import { PlayerAvatar } from "@/components/room/player-chip";
import { ActionDock, PhaseBody, PhaseHeading } from "./frame";
import { useRoomStore } from "@/lib/client/room-store";
import { play } from "@/lib/client/sound";
import { cn } from "@/lib/utils";

export function PositionPhase({ state, playerId }: { state: RoomState; playerId: string }) {
  const send = useRoomStore((s) => s.send);
  const round = state.round!;
  const step = round.steps[round.stepIndex];
  const isPick = MODE_META[round.mode].isPickPerson;
  const active = state.players.filter((p) => p.active && p.connected);
  const done = active.filter((p) => (isPick ? round.picks[p.id] : round.initialStances[p.id]));
  const myStance = round.initialStances[playerId];
  const myPick = round.picks[playerId];
  const secret = step?.note === "SECRET" || step?.note === "PICK_SECRET" || step?.note === "REAL_OPINION";

  const optionA = round.topic.optionA ?? "찬성";
  const optionB = round.topic.optionB ?? "반대";

  function choose(s: Stance) {
    play("vote");
    void send({ type: "CHOOSE_STANCE", playerId, stance: s });
  }

  return (
    <>
      <PhaseBody className="pb-40">
        <div className="flex items-start justify-between gap-3">
          <PhaseHeading phase="POSITION_SELECT" />
          <Timer endsAt={state.phaseEndsAt} totalMs={step?.ms ?? 15_000} size={64} />
        </div>

        <TopicCard topic={round.topic} size="lg" />

        {secret && (
          <div className="flex items-center gap-2 rounded-2xl border border-night-600 bg-night-800/60 px-4 py-2.5 text-[0.78rem] text-ink-dim">
            <EyeOff size={15} className="text-accent-soft" />
            {step?.note === "REAL_OPINION"
              ? "지금은 진짜 생각을 고르세요. 곧 앱이 입장을 다시 배정합니다."
              : "아무도 당신의 선택을 볼 수 없습니다. 동시에 공개됩니다."}
          </div>
        )}

        {isPick ? (
          <div className="space-y-2">
            <p className="text-[0.78rem] font-bold uppercase tracking-wider text-ink-mute">
              한 명을 고르세요
            </p>
            <div className="grid grid-cols-2 gap-2">
              {active
                .filter((p) => p.id !== playerId)
                .map((p) => {
                  const on = myPick === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        play("vote");
                        void send({ type: "PICK_PLAYER", playerId, targetId: p.id });
                      }}
                      className={cn(
                        "flex items-center gap-2.5 rounded-2xl border px-3 py-3 text-left transition-all active:scale-[0.97]",
                        on ? "border-accent bg-accent/15" : "border-night-700 bg-night-850/60"
                      )}
                    >
                      <PlayerAvatar player={p} size={38} ring={on} />
                      <span className="min-w-0 flex-1 truncate text-[0.88rem] font-bold">{p.nickname}</span>
                      {on && <Check size={16} className="shrink-0 text-accent" />}
                    </button>
                  );
                })}
            </div>
          </div>
        ) : (
          <div className="grid gap-2.5">
            <StanceButton
              side="A" label={optionA} selected={myStance === "A"} onClick={() => choose("A")}
            />
            <StanceButton
              side="B" label={optionB} selected={myStance === "B"} onClick={() => choose("B")}
            />
          </div>
        )}
      </PhaseBody>

      <ActionDock hint={`${done.length}/${active.length}명 선택 완료 · 전원 선택하면 바로 넘어갑니다`}>
        <div className="flex items-center justify-center gap-2">
          {active.map((p) => {
            const ok = isPick ? Boolean(round.picks[p.id]) : Boolean(round.initialStances[p.id]);
            return (
              <div key={p.id} className="flex flex-col items-center gap-1">
                <PlayerAvatar player={p} size={34} dim={!ok} ring={ok && p.id === playerId} />
                <span className={cn("h-1 w-6 rounded-full", ok ? "bg-good" : "bg-night-600")} />
              </div>
            );
          })}
        </div>
      </ActionDock>
    </>
  );
}

export function StanceButton({
  side, label, selected, onClick, disabled, count, big,
}: {
  side: "A" | "B";
  label: string;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  count?: number;
  big?: boolean;
}) {
  const isA = side === "A";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative flex w-full items-center gap-3.5 overflow-hidden rounded-3xl border px-5 text-left transition-all",
        big ? "py-6" : "py-5",
        !disabled && "active:scale-[0.98]",
        selected
          ? isA
            ? "border-stance-a bg-stance-a/15 shadow-[0_0_0_1px_var(--color-stance-a)]"
            : "border-stance-b bg-stance-b/15 shadow-[0_0_0_1px_var(--color-stance-b)]"
          : "border-night-600 bg-night-850/70",
        disabled && "opacity-60"
      )}
    >
      <span
        className={cn(
          "grid h-12 w-12 shrink-0 place-items-center rounded-2xl font-mono text-xl font-black",
          isA ? "bg-stance-a/20 text-stance-a" : "bg-stance-b/20 text-stance-b"
        )}
      >
        {side}
      </span>
      <span className="min-w-0 flex-1 text-[1.05rem] font-bold leading-snug">{label}</span>
      {typeof count === "number" && (
        <span
          className={cn(
            "shrink-0 font-mono text-2xl font-black",
            isA ? "text-stance-a" : "text-stance-b"
          )}
        >
          {count}
        </span>
      )}
      {selected && typeof count !== "number" && (
        <Check size={20} className={cn("shrink-0", isA ? "text-stance-a" : "text-stance-b")} />
      )}
    </button>
  );
}
