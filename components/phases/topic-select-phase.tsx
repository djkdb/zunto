"use client";
import { useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import type { RoomState, Topic } from "@/lib/game/types";
import { MODE_META } from "@/lib/game/types";
import { Button } from "@/components/ui/button";
import { TopicCard } from "@/components/game/topic-card";
import { ActionDock, PhaseBody } from "./frame";
import { ModeBadge, WaitingCard } from "./mode-select-phase";
import { useRoomStore } from "@/lib/client/room-store";
import { Timer } from "@/components/game/timer";
import { cn } from "@/lib/utils";

export function TopicSelectPhase({ state, playerId }: { state: RoomState; playerId: string }) {
  const send = useRoomStore((s) => s.send);
  const isHost = state.hostId === playerId;
  const isVote = state.settings.topicPolicy === "VOTE";
  const mode = state.pendingMode ?? "BALANCE";
  const [picked, setPicked] = useState<string | null>(null);
  const myVote = state.topicVotes[playerId];

  const voteCount = (id: string) =>
    Object.values(state.topicVotes).filter((v) => v === id).length;

  const canChoose = isVote || isHost;

  return (
    <>
      <PhaseBody className="pb-32">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.7rem] font-black uppercase tracking-[0.25em] text-ink-faint">
              round {state.roundNo}
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">
              {isVote ? "주제를 골라주세요" : isHost ? "오늘 이걸로 갈까요?" : "주제를 고르는 중"}
            </h2>
            <div className="mt-2">
              <ModeBadge mode={mode} />
            </div>
          </div>
          {isVote && <Timer endsAt={state.phaseEndsAt} totalMs={20_000} size={68} />}
        </header>

        {!canChoose && !isVote ? (
          <WaitingCard
            title="방장이 주제를 고르는 중"
            desc={MODE_META[mode].tagline}
          />
        ) : null}

        <div className="space-y-3">
          {state.topicCandidates.map((t) => {
            const selected = isVote ? myVote === t.id : picked === t.id;
            const n = voteCount(t.id);
            return (
              <button
                key={t.id}
                disabled={!canChoose}
                onClick={() => {
                  if (isVote) void send({ type: "VOTE_TOPIC", playerId, topicId: t.id });
                  else setPicked(t.id);
                }}
                className={cn(
                  "block w-full text-left transition-all",
                  canChoose && "active:scale-[0.99]",
                  !canChoose && "opacity-70"
                )}
              >
                <div className="relative">
                  <TopicCard
                    topic={t}
                    size="md"
                    className={cn(selected && "border-accent bg-accent/10 shadow-[0_0_0_1px_var(--color-accent)]")}
                  />
                  {isVote && n > 0 && (
                    <span className="absolute right-3 top-3 grid h-7 min-w-7 place-items-center rounded-full bg-accent px-2 text-[0.72rem] font-black text-white">
                      {n}
                    </span>
                  )}
                  {!isVote && selected && (
                    <span className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-accent text-white">
                      <Check size={15} />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {state.topicCandidates.length === 0 && (
          <WaitingCard title="주제를 찾는 중" desc="잠시만요" />
        )}
      </PhaseBody>

      {isHost && (
        <ActionDock hint={isVote ? "전원 투표하면 자동으로 시작합니다" : undefined}>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="lg"
              className="px-4"
              onClick={() => send({ type: "REROLL_TOPICS", playerId })}
              aria-label="다른 주제 보기"
            >
              <RefreshCw size={18} />
            </Button>
            {!isVote && (
              <Button
                size="lg"
                block
                disabled={!picked}
                onClick={() => {
                  const t = state.topicCandidates.find((x) => x.id === picked);
                  if (t) void send({ type: "CHOOSE_TOPIC", playerId, topic: t as Topic });
                }}
              >
                {picked ? "이 주제로 시작" : "주제를 골라주세요"}
              </Button>
            )}
            {isVote && (
              <Button variant="secondary" size="lg" block disabled>
                다 같이 투표 중
              </Button>
            )}
          </div>
        </ActionDock>
      )}

      {!isHost && isVote && (
        <ActionDock hint="전원 투표하면 자동으로 시작합니다">
          <Button size="lg" block variant={myVote ? "good" : "secondary"} disabled>
            {myVote ? <><Check size={18} /> 투표 완료</> : "위에서 주제를 고르세요"}
          </Button>
        </ActionDock>
      )}
    </>
  );
}
