"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import type { Rating, RoomState } from "@/lib/game/types";
import { AWARDS, AWARD_META, type AwardCode } from "@/lib/game/types";
import { Timer } from "@/components/game/timer";
import { PlayerAvatar } from "@/components/room/player-chip";
import { Button } from "@/components/ui/button";
import { ActionDock, PhaseBody, PhaseHeading } from "./frame";
import { useRoomStore } from "@/lib/client/room-store";
import { play } from "@/lib/client/sound";
import { cn } from "@/lib/utils";

export function RatingPhase({ state, playerId }: { state: RoomState; playerId: string }) {
  const detailed = state.settings.peerRating === "DETAILED";
  return detailed
    ? <DetailedRating state={state} playerId={playerId} />
    : <QuickRating state={state} playerId={playerId} />;
}

/* ── 빠른 평가: 한 명에게 어워드 하나 ─────────────────────────────────── */

function QuickRating({ state, playerId }: { state: RoomState; playerId: string }) {
  const send = useRoomStore((s) => s.send);
  const round = state.round!;
  const step = round.steps[round.stepIndex];
  const active = state.players.filter((p) => round.order.includes(p.id) && p.connected);
  const others = active.filter((p) => p.id !== playerId);
  const mine = round.quickAwards[playerId];
  const [code, setCode] = useState<AwardCode>(mine?.code ?? "PERSUASION");
  const [ratee, setRatee] = useState<string | undefined>(mine?.rateeId);
  const done = active.filter((p) => round.quickAwards[p.id]).length;

  return (
    <>
      <PhaseBody className="pb-44">
        <div className="flex items-start justify-between gap-3">
          <PhaseHeading phase="RATING" />
          <Timer endsAt={state.phaseEndsAt} totalMs={step?.ms ?? 30_000} size={64} />
        </div>

        <header>
          <h2 className="text-xl font-black tracking-tight">오늘의 어워드</h2>
          <p className="mt-1 text-[0.84rem] text-ink-mute">
            한 명에게 하나만. 순위가 아니라 오늘 이 사람의 캐릭터를 정하는 겁니다.
          </p>
        </header>

        <div className="grid grid-cols-5 gap-1.5">
          {AWARDS.map((a) => (
            <button
              key={a}
              onClick={() => setCode(a)}
              disabled={Boolean(mine)}
              className={cn(
                "rounded-2xl border px-1 py-2.5 text-center transition-all active:scale-[0.96]",
                code === a ? "border-accent bg-accent/15" : "border-night-700 bg-night-850/60",
                mine && "opacity-60"
              )}
            >
              <span className="block text-lg leading-none">{AWARD_META[a].emoji}</span>
              <span className="mt-1 block text-[0.6rem] font-bold leading-tight text-ink-dim">
                {AWARD_META[a].ko}
              </span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {others.map((p) => {
            const on = ratee === p.id;
            return (
              <button
                key={p.id}
                disabled={Boolean(mine)}
                onClick={() => { setRatee(p.id); play("tick"); }}
                className={cn(
                  "flex items-center gap-2.5 rounded-2xl border px-3 py-3 text-left transition-all active:scale-[0.97]",
                  on ? "border-accent bg-accent/15" : "border-night-700 bg-night-850/60",
                  mine && "opacity-60"
                )}
              >
                <PlayerAvatar player={p} size={36} ring={on} />
                <span className="min-w-0 flex-1 truncate text-[0.86rem] font-bold">{p.nickname}</span>
                {on && <Check size={15} className="shrink-0 text-accent" />}
              </button>
            );
          })}
        </div>

        {others.length === 0 && (
          <p className="rounded-2xl border border-night-700 bg-night-850/50 px-4 py-3 text-center text-[0.84rem] text-ink-mute">
            평가할 상대가 없습니다. 넘어가세요.
          </p>
        )}
      </PhaseBody>

      <ActionDock hint={`${done}/${active.length}명 평가 완료`}>
        <Button
          size="xl"
          block
          variant={mine ? "good" : "primary"}
          disabled={Boolean(mine) || (others.length > 0 && !ratee)}
          onClick={() => {
            if (!ratee) return;
            play("vote");
            void send({ type: "SUBMIT_QUICK_AWARD", playerId, code, rateeId: ratee });
          }}
        >
          {mine ? (
            <><Check size={19} /> {AWARD_META[mine.code].emoji} 완료</>
          ) : (
            `${AWARD_META[code].emoji} ${AWARD_META[code].ko} 주기`
          )}
        </Button>
      </ActionDock>
    </>
  );
}

/* ── 상세 평가: 5개 항목 × 상대 ──────────────────────────────────────── */

const EMPTY: Rating = { logic: 3, persuasion: 3, creativity: 3, humor: 3, punch: 3 };

function DetailedRating({ state, playerId }: { state: RoomState; playerId: string }) {
  const send = useRoomStore((s) => s.send);
  const round = state.round!;
  const step = round.steps[round.stepIndex];
  const active = state.players.filter((p) => round.order.includes(p.id) && p.connected);
  const others = active.filter((p) => p.id !== playerId);
  const submitted = Boolean(round.ratings[playerId]);
  const [idx, setIdx] = useState(0);
  const [values, setValues] = useState<Record<string, Rating>>(
    () => Object.fromEntries(others.map((p) => [p.id, { ...EMPTY }]))
  );
  const done = active.filter((p) => round.ratings[p.id]).length;
  const current = others[idx];

  if (!current) {
    return (
      <PhaseBody className="pb-24">
        <PhaseHeading phase="RATING" />
        <p className="rounded-2xl border border-night-700 bg-night-850/50 px-4 py-6 text-center text-[0.86rem] text-ink-mute">
          평가할 상대가 없습니다.
        </p>
      </PhaseBody>
    );
  }

  const rating = values[current.id] ?? EMPTY;
  const setKey = (k: keyof Rating, v: number) =>
    setValues((prev) => ({ ...prev, [current.id]: { ...prev[current.id], [k]: v } }));

  return (
    <>
      <PhaseBody className="pb-44">
        <div className="flex items-start justify-between gap-3">
          <PhaseHeading
            phase="RATING"
            extra={<span className="text-[0.7rem] font-bold text-ink-faint">{idx + 1}/{others.length}</span>}
          />
          <Timer endsAt={state.phaseEndsAt} totalMs={step?.ms ?? 50_000} size={64} />
        </div>

        <div className="flex items-center gap-3 rounded-3xl border border-night-700 bg-night-850/60 p-4">
          <PlayerAvatar player={current} size={52} ring />
          <div>
            <p className="text-lg font-black">{current.nickname}</p>
            <p className="text-[0.78rem] text-ink-mute">이번 라운드 어땠나요?</p>
          </div>
        </div>

        <div className="space-y-3">
          {AWARDS.map((a) => {
            const key = AWARD_META[a].key;
            return (
              <div key={a} className="rounded-2xl border border-night-700 bg-night-850/50 px-4 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[0.84rem] font-bold">
                    {AWARD_META[a].emoji} {AWARD_META[a].ko.replace("제일 ", "")}
                  </span>
                  <span className="font-mono text-sm font-black text-accent">{rating[key]}</span>
                </div>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      disabled={submitted}
                      onClick={() => { setKey(key, n); play("tick"); }}
                      className={cn(
                        "h-9 flex-1 rounded-xl border text-[0.8rem] font-bold transition-all active:scale-95",
                        rating[key] >= n
                          ? "border-accent bg-accent/20 text-ink"
                          : "border-night-600 bg-night-800 text-ink-faint"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </PhaseBody>

      <ActionDock hint={`${done}/${active.length}명 평가 완료`}>
        <div className="flex gap-2">
          {idx > 0 && (
            <Button variant="secondary" size="lg" className="px-5" onClick={() => setIdx((i) => i - 1)}>
              이전
            </Button>
          )}
          <Button
            size="lg"
            block
            variant={submitted ? "good" : "primary"}
            disabled={submitted}
            onClick={() => {
              if (idx < others.length - 1) { setIdx((i) => i + 1); play("tick"); return; }
              play("vote");
              void send({ type: "SUBMIT_RATING", playerId, ratings: values });
            }}
          >
            {submitted
              ? <><Check size={18} /> 평가 완료</>
              : idx < others.length - 1 ? "다음 사람" : "평가 제출"}
          </Button>
        </div>
      </ActionDock>
    </>
  );
}
