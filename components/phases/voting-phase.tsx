"use client";
import { useState } from "react";
import { Check, EyeOff, Quote, Send } from "lucide-react";
import type { RoomState, Stance } from "@/lib/game/types";
import { MODE_META } from "@/lib/game/types";
import { Timer } from "@/components/game/timer";
import { PlayerAvatar } from "@/components/room/player-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ActionDock, PhaseBody, PhaseHeading } from "./frame";
import { StanceButton } from "./position-phase";
import { useRoomStore } from "@/lib/client/room-store";
import { play } from "@/lib/client/sound";
import { cn } from "@/lib/utils";

export function VotingPhase({ state, playerId }: { state: RoomState; playerId: string }) {
  const send = useRoomStore((s) => s.send);
  const round = state.round!;
  const step = round.steps[round.stepIndex];
  const active = state.players.filter((p) => round.order.includes(p.id) && p.connected);
  const others = active.filter((p) => p.id !== playerId);
  const needStance = !MODE_META[round.mode].isPickPerson && round.mode !== "ADVOCATE";

  const myVote = round.votes[playerId];
  const [stance, setStance] = useState<Stance | undefined>(myVote?.stance);
  const [mvp, setMvp] = useState<string | undefined>(myVote?.mvpId);
  const [quote, setQuote] = useState(round.quotes[playerId] ?? "");
  const [quoteSent, setQuoteSent] = useState(Boolean(round.quotes[playerId]));

  const votedCount = active.filter((p) => round.votes[p.id]).length;
  const submitted = Boolean(myVote);
  const ready = (!needStance || Boolean(stance)) && (others.length === 0 || Boolean(mvp));

  const optionA = round.topic.optionA ?? "찬성";
  const optionB = round.topic.optionB ?? "반대";
  const before = round.initialStances[playerId];

  function submit() {
    if (!ready) return;
    play("vote");
    void send({ type: "SUBMIT_VOTE", playerId, vote: { stance, mvpId: mvp } });
  }

  return (
    <>
      <PhaseBody className="pb-44">
        <div className="flex items-start justify-between gap-3">
          <PhaseHeading phase="VOTING" />
          <Timer endsAt={state.phaseEndsAt} totalMs={step?.ms ?? 25_000} size={64} />
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-night-600 bg-night-800/60 px-4 py-2.5 text-[0.78rem] text-ink-dim">
          <EyeOff size={15} className="shrink-0 text-accent-soft" />
          다른 사람의 선택은 아무도 볼 수 없습니다. 전원 완료 후 동시에 공개됩니다.
        </div>

        {needStance && (
          <section className="space-y-2.5">
            <p className="text-[0.78rem] font-bold uppercase tracking-wider text-ink-mute">
              지금 당신의 진짜 생각은?
              {before && (
                <span className="ml-2 font-medium normal-case text-ink-faint">
                  (처음엔 {before} 를 골랐습니다)
                </span>
              )}
            </p>
            <StanceButton
              side="A" label={optionA} selected={stance === "A"}
              onClick={() => { setStance("A"); play("tick"); }} disabled={submitted}
            />
            <StanceButton
              side="B" label={optionB} selected={stance === "B"}
              onClick={() => { setStance("B"); play("tick"); }} disabled={submitted}
            />
            {before && stance && stance !== before && (
              <p className="animate-rise rounded-2xl border border-warn/40 bg-warn/10 px-4 py-2.5 text-[0.8rem] font-bold text-warn">
                🔄 의견을 바꿨습니다. 결과에서 공개됩니다.
              </p>
            )}
          </section>
        )}

        {others.length > 0 && (
          <section className="space-y-2">
            <p className="text-[0.78rem] font-bold uppercase tracking-wider text-ink-mute">
              가장 설득력 있었던 사람
            </p>
            <div className="grid grid-cols-2 gap-2">
              {others.map((p) => {
                const on = mvp === p.id;
                return (
                  <button
                    key={p.id}
                    disabled={submitted}
                    onClick={() => { setMvp(p.id); play("tick"); }}
                    className={cn(
                      "flex items-center gap-2.5 rounded-2xl border px-3 py-3 text-left transition-all active:scale-[0.97]",
                      on ? "border-accent bg-accent/15" : "border-night-700 bg-night-850/60",
                      submitted && "opacity-60"
                    )}
                  >
                    <PlayerAvatar player={p} size={36} ring={on} />
                    <span className="min-w-0 flex-1 truncate text-[0.86rem] font-bold">{p.nickname}</span>
                    {on && <Check size={15} className="shrink-0 text-accent" />}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section className="space-y-2">
          <p className="flex items-center gap-1.5 text-[0.78rem] font-bold uppercase tracking-wider text-ink-mute">
            <Quote size={13} /> 오늘의 한 마디 <span className="font-medium normal-case text-ink-faint">(선택)</span>
          </p>
          <div className="flex gap-2">
            <Input
              value={quote}
              onChange={(e) => { setQuote(e.target.value.slice(0, 90)); setQuoteSent(false); }}
              placeholder="기억에 남을 문장을 적어보세요"
              maxLength={90}
              className="h-12"
            />
            <Button
              variant={quoteSent ? "good" : "secondary"}
              size="md"
              className="px-4"
              disabled={!quote.trim()}
              onClick={() => {
                void send({ type: "SUBMIT_QUOTE", playerId, text: quote });
                setQuoteSent(true);
              }}
              aria-label="한 마디 저장"
            >
              {quoteSent ? <Check size={17} /> : <Send size={16} />}
            </Button>
          </div>
        </section>
      </PhaseBody>

      <ActionDock hint={`${votedCount}/${active.length}명 투표 완료`}>
        <div className="mb-1 flex items-center justify-center gap-2">
          {active.map((p) => (
            <span
              key={p.id}
              className={cn(
                "h-2 w-6 rounded-full transition-colors",
                round.votes[p.id] ? "bg-good" : "bg-night-600"
              )}
              title={round.votes[p.id] ? `${p.nickname} 완료` : `${p.nickname} 대기`}
            />
          ))}
        </div>
        <Button
          size="xl"
          block
          variant={submitted ? "good" : "primary"}
          disabled={!ready || submitted}
          onClick={submit}
        >
          {submitted ? <><Check size={19} /> 투표 완료 · 기다리는 중</> : "투표하기"}
        </Button>
      </ActionDock>
    </>
  );
}
