"use client";
import { useEffect, useRef } from "react";
import { Mic, Minus, Plus, SkipForward } from "lucide-react";
import type { RoomState } from "@/lib/game/types";
import { MODE_META, REBUTTAL_META } from "@/lib/game/types";
import { Timer } from "@/components/game/timer";
import { PlayerAvatar } from "@/components/room/player-chip";
import { EventBadge } from "@/components/game/event-banner";
import { TopicCard } from "@/components/game/topic-card";
import { Button } from "@/components/ui/button";
import { ActionDock, ListenMode, PhaseBody, PhaseHeading } from "./frame";
import { useRoomStore } from "@/lib/client/room-store";
import { play } from "@/lib/client/sound";
import { cn } from "@/lib/utils";

const NOTE_TEXT: Record<string, string> = {
  TARGET_OPENING: "왜 그렇게 생각하는지 먼저 말해주세요",
  PERSUADE: "표적을 설득하세요",
  DEFEND_SELF: "왜 그렇게 보였는지 해명할 기회입니다",
  WHY_PICKED: "왜 그 사람을 골랐는지 말해주세요",
  ACCEPTANCE: "소감 한 마디",
  TARGET_DEFENSE: "쏟아진 설득에 대해 답하세요",
  LAST_PUSH: "마지막 한 방",
  GROUP: "돌아가며 한 마디씩",
};

/** SPEECH · REBUTTAL · FINAL_ARGUMENT 공용 화면 */
export function SpeechPhase({ state, playerId }: { state: RoomState; playerId: string }) {
  const send = useRoomStore((s) => s.send);
  const round = state.round!;
  const step = round.steps[round.stepIndex];
  const actor = state.players.find((p) => p.id === step?.actorId);
  const target = state.players.find((p) => p.id === step?.targetId);
  const isMyTurn = step?.actorId === playerId;
  const isGroup = !step?.actorId;
  const isHost = state.hostId === playerId;
  const announced = useRef<number>(-1);

  const mine = round.assigned[playerId] ?? round.initialStances[playerId];
  const actorStance = actor ? round.assigned[actor.id] ?? round.initialStances[actor.id] : undefined;
  const optionA = round.topic.optionA ?? "찬성";
  const optionB = round.topic.optionB ?? "반대";

  useEffect(() => {
    if (announced.current === state.phaseToken) return;
    announced.current = state.phaseToken;
    play("turn");
    if (isMyTurn && typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { navigator.vibrate?.(([60, 40, 60] as unknown) as number[]); } catch { /* 지원 안 함 */ }
    }
  }, [state.phaseToken, isMyTurn]);

  const kind = round.rebuttals[playerId];
  const positionIdx = round.steps
    .slice(0, round.stepIndex + 1)
    .filter((s) => s.phase === step?.phase).length;
  const totalOfPhase = round.steps.filter((s) => s.phase === step?.phase).length;

  return (
    <>
      <PhaseBody className="pb-36">
        <div className="flex items-start justify-between gap-3">
          <PhaseHeading
            phase={step?.phase ?? "SPEECH"}
            extra={
              totalOfPhase > 1 ? (
                <span className="text-[0.7rem] font-bold text-ink-faint">
                  {positionIdx}/{totalOfPhase}
                </span>
              ) : undefined
            }
          />
        </div>

        <div
          className={cn(
            "relative overflow-hidden rounded-3xl border p-6 text-center transition-colors",
            isMyTurn
              ? "border-accent bg-accent/12 shadow-[0_0_60px_-18px_var(--color-accent)]"
              : "border-night-700 bg-night-850/60"
          )}
        >
          {actor ? (
            <>
              <div className="mx-auto w-fit animate-pop">
                <PlayerAvatar player={actor} size={72} ring />
              </div>
              <p className="mt-3 text-[0.7rem] font-black uppercase tracking-[0.25em] text-ink-faint">
                {isMyTurn ? "당신 차례입니다" : "now speaking"}
              </p>
              <p className="mt-1 text-2xl font-black tracking-tight">
                {actor.nickname}
                {isMyTurn && <span className="ml-2 text-accent">← 나</span>}
              </p>
              {actorStance && !MODE_META[round.mode].isPickPerson && (
                <p
                  className={cn(
                    "mt-1.5 text-[0.85rem] font-bold",
                    actorStance === "A" ? "text-stance-a" : "text-stance-b"
                  )}
                >
                  {actorStance} · {actorStance === "A" ? optionA : optionB}
                </p>
              )}
            </>
          ) : (
            <>
              <Mic size={30} className="mx-auto text-accent" />
              <p className="mt-3 text-2xl font-black tracking-tight">다 같이 마무리</p>
            </>
          )}

          {step?.note && NOTE_TEXT[step.note] && (
            <p className="mt-3 text-[0.85rem] text-ink-dim">{NOTE_TEXT[step.note]}</p>
          )}

          {step?.phase === "REBUTTAL" && target && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-night-600 bg-night-900/70 px-3 py-1.5 text-[0.78rem]">
              <span className="text-ink-faint">반박 대상</span>
              <span className="font-bold text-ink">{target.avatar} {target.nickname}</span>
            </p>
          )}
          {step?.phase === "REBUTTAL" && isMyTurn && kind && (
            <p className="mt-2 text-[0.82rem] font-bold text-accent-soft">
              {REBUTTAL_META[kind].emoji} {REBUTTAL_META[kind].ko} — {REBUTTAL_META[kind].hint}
            </p>
          )}

          <div className="mt-5 flex justify-center">
            <Timer
              endsAt={state.phaseEndsAt}
              totalMs={step?.ms ?? state.settings.speechMs}
              size={isMyTurn ? 176 : 132}
              label={isMyTurn ? "말하세요" : undefined}
            />
          </div>
        </div>

        <EventBadge state={state} />

        {!isMyTurn && !isGroup && actor && (
          <ListenMode
            speaker={actor.nickname}
            note={mine && actorStance && mine !== actorStance ? "반대편입니다. 반박할 거리를 메모해 두세요." : undefined}
          />
        )}

        <TopicCard topic={round.topic} size="sm" showMeta={false} />
      </PhaseBody>

      <ActionDock hint={isMyTurn ? "다 말했으면 넘겨도 됩니다" : "시간이 끝나면 자동으로 넘어갑니다"}>
        {isMyTurn || isHost ? (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="lg"
              className="px-4"
              onClick={() => send({ type: "EXTEND_TIME", playerId, ms: -15_000 })}
              aria-label="15초 줄이기"
            >
              <Minus size={17} />
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="px-4"
              onClick={() => send({ type: "EXTEND_TIME", playerId, ms: 30_000 })}
              aria-label="30초 추가"
            >
              <Plus size={17} />
            </Button>
            <Button
              size="lg"
              block
              onClick={() => send({ type: "ADVANCE", playerId, phaseToken: state.phaseToken })}
            >
              <SkipForward size={17} /> {isMyTurn ? "발언 마치기" : "다음으로"}
            </Button>
          </div>
        ) : (
          <Button size="lg" block variant="secondary" disabled>
            {actor ? `${actor.nickname} 님이 말하는 중` : "진행 중"}
          </Button>
        )}
      </ActionDock>
    </>
  );
}

/** 반박 방식 고르기 */
export function RebuttalPickPhase({ state, playerId }: { state: RoomState; playerId: string }) {
  const send = useRoomStore((s) => s.send);
  const round = state.round!;
  const step = round.steps[round.stepIndex];
  const actor = state.players.find((p) => p.id === step?.actorId);
  const target = state.players.find((p) => p.id === step?.targetId);
  const isMyTurn = step?.actorId === playerId;

  if (!isMyTurn) {
    return (
      <PhaseBody className="pb-24">
        <PhaseHeading phase="REBUTTAL_PICK" />
        <div className="rounded-3xl border border-night-700 bg-night-850/60 p-8 text-center">
          {actor && (
            <div className="mx-auto w-fit">
              <PlayerAvatar player={actor} size={60} ring />
            </div>
          )}
          <p className="mt-3 text-lg font-bold">{actor?.nickname} 님이 반박 방식을 고르는 중</p>
          <p className="mt-1 text-[0.82rem] text-ink-mute">잠시만요</p>
          <div className="mt-5 flex justify-center">
            <Timer endsAt={state.phaseEndsAt} totalMs={step?.ms ?? 10_000} size={92} />
          </div>
        </div>
      </PhaseBody>
    );
  }

  const kinds = Object.entries(REBUTTAL_META) as [
    keyof typeof REBUTTAL_META,
    (typeof REBUTTAL_META)[keyof typeof REBUTTAL_META],
  ][];

  return (
    <PhaseBody className="pb-24">
      <div className="flex items-start justify-between gap-3">
        <PhaseHeading phase="REBUTTAL_PICK" />
        <Timer endsAt={state.phaseEndsAt} totalMs={step?.ms ?? 10_000} size={64} />
      </div>

      <div className="rounded-3xl border border-accent/40 bg-accent/10 p-5 text-center">
        <p className="text-[0.7rem] font-black uppercase tracking-[0.25em] text-accent-soft">당신 차례</p>
        <p className="mt-1.5 text-xl font-black">
          {target ? `${target.nickname} 님을 반박합니다` : "반박할 차례입니다"}
        </p>
        <p className="mt-1.5 text-[0.83rem] text-ink-dim">하나만 고르세요. 고르면 바로 시작합니다.</p>
      </div>

      <div className="grid gap-2">
        {kinds.map(([code, meta]) => (
          <button
            key={code}
            onClick={() => {
              play("vote");
              void send({ type: "CHOOSE_REBUTTAL", playerId, kind: code });
            }}
            className="flex items-center gap-3.5 rounded-2xl border border-night-600 bg-night-850/70 px-4 py-4 text-left transition-all active:scale-[0.98] active:border-accent active:bg-accent/12"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-night-800 text-xl">
              {meta.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.95rem] font-bold">{meta.ko}</span>
              <span className="block text-[0.78rem] text-ink-mute">{meta.hint}</span>
            </span>
            <span className="text-ink-faint">›</span>
          </button>
        ))}
      </div>
    </PhaseBody>
  );
}
