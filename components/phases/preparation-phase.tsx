"use client";
import { Lightbulb } from "lucide-react";
import type { RoomState } from "@/lib/game/types";
import { MODE_META } from "@/lib/game/types";
import { TopicCard } from "@/components/game/topic-card";
import { Timer } from "@/components/game/timer";
import { MissionCard } from "@/components/game/mission-card";
import { EventBadge } from "@/components/game/event-banner";
import { PlayerAvatar } from "@/components/room/player-chip";
import { PhaseBody, PhaseHeading } from "./frame";
import { cn } from "@/lib/utils";

export function PreparationPhase({ state, playerId }: { state: RoomState; playerId: string }) {
  const round = state.round!;
  const step = round.steps[round.stepIndex];
  const mine = round.assigned[playerId] ?? round.initialStances[playerId];
  const optionA = round.topic.optionA ?? "찬성";
  const optionB = round.topic.optionB ?? "반대";
  const order = round.order
    .map((id) => state.players.find((p) => p.id === id))
    .filter(Boolean) as RoomState["players"];

  return (
    <PhaseBody className="pb-24">
      <div className="flex items-start justify-between gap-3">
        <PhaseHeading phase="PREPARATION" />
        <Timer endsAt={state.phaseEndsAt} totalMs={step?.ms ?? 30_000} size={84} label="준비" />
      </div>

      <TopicCard topic={round.topic} size="md" />
      <EventBadge state={state} />

      {mine && !MODE_META[round.mode].isPickPerson && (
        <div
          className={cn(
            "rounded-2xl border px-4 py-3",
            mine === "A" ? "border-stance-a/40 bg-stance-a/10" : "border-stance-b/40 bg-stance-b/10"
          )}
        >
          <p className="text-[0.68rem] font-black uppercase tracking-widest text-ink-faint">내 입장</p>
          <p className={cn("mt-1 text-[1.05rem] font-bold", mine === "A" ? "text-stance-a" : "text-stance-b")}>
            {mine} · {mine === "A" ? optionA : optionB}
          </p>
        </div>
      )}

      <MissionCard state={state} playerId={playerId} />

      <div className="rounded-3xl border border-night-700 bg-night-850/50 p-4">
        <p className="mb-3 flex items-center gap-1.5 text-[0.75rem] font-bold uppercase tracking-wider text-ink-mute">
          <Lightbulb size={13} /> 발언 순서
        </p>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
          {order.map((p, i) => (
            <span key={p.id} className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1.5",
                  p.id === playerId
                    ? "border-accent bg-accent/15 text-ink"
                    : "border-night-600 bg-night-800 text-ink-dim"
                )}
              >
                <PlayerAvatar player={p} size={20} />
                <span className="text-[0.78rem] font-bold">{p.nickname}</span>
              </span>
              {i < order.length - 1 && <span className="text-ink-faint">→</span>}
            </span>
          ))}
        </div>
      </div>

      {round.topic.followUps && round.topic.followUps.length > 0 && (
        <div className="rounded-3xl border border-night-700 bg-night-850/40 p-4">
          <p className="mb-2 text-[0.75rem] font-bold uppercase tracking-wider text-ink-mute">
            막히면 이걸 던져보세요
          </p>
          <ul className="space-y-1.5">
            {round.topic.followUps.map((f, i) => (
              <li key={i} className="text-[0.83rem] leading-snug text-ink-dim">· {f}</li>
            ))}
          </ul>
        </div>
      )}
    </PhaseBody>
  );
}
