"use client";
import { useEffect } from "react";
import { Swords, Target } from "lucide-react";
import type { RoomState } from "@/lib/game/types";
import { MODE_META } from "@/lib/game/types";
import { TopicCard } from "@/components/game/topic-card";
import { Timer } from "@/components/game/timer";
import { PlayerAvatar } from "@/components/room/player-chip";
import { PhaseBody } from "./frame";
import { StanceButton } from "./position-phase";
import { play } from "@/lib/client/sound";
import { cn } from "@/lib/utils";

/** 입장 배정 공개 — 찬반 / 변론 / 한 명 설득 */
export function AssignRevealPhase({ state, playerId }: { state: RoomState; playerId: string }) {
  const round = state.round!;
  const step = round.steps[round.stepIndex];
  const active = state.players.filter((p) => round.order.includes(p.id));
  const optionA = round.topic.optionA ?? "찬성";
  const optionB = round.topic.optionB ?? "반대";

  useEffect(() => { play("reveal"); }, []);

  if (round.mode === "PERSUADE_ONE") {
    const target = state.players.find((p) => p.id === round.targetId);
    const iAmTarget = round.targetId === playerId;
    return (
      <PhaseBody className="pb-24">
        <div className="flex items-center justify-between">
          <span className="rounded-lg bg-accent/15 px-2 py-1 text-[0.62rem] font-black uppercase tracking-[0.18em] text-accent-soft">
            표적 지정
          </span>
          <Timer endsAt={state.phaseEndsAt} totalMs={step?.ms ?? 9_000} size={60} />
        </div>

        <div className="rounded-3xl border border-danger/30 bg-danger/10 p-7 text-center">
          <Target size={28} className="mx-auto mb-3 text-danger" />
          {target && (
            <div className="mx-auto w-fit animate-pop">
              <PlayerAvatar player={target} size={76} ring />
            </div>
          )}
          <p className="mt-3 text-2xl font-black tracking-tight">{target?.nickname}</p>
          <p className="mt-2 text-[0.88rem] leading-relaxed text-ink-dim">
            {iAmTarget
              ? "나머지 전원이 당신을 설득하러 옵니다. 끝까지 버티세요."
              : `${target?.nickname} 님의 마음을 바꾸면 여러분이 이깁니다.`}
          </p>
        </div>

        <TopicCard topic={round.topic} size="md" />
      </PhaseBody>
    );
  }

  const mine = round.assigned[playerId];
  const teamA = active.filter((p) => round.assigned[p.id] === "A");
  const teamB = active.filter((p) => round.assigned[p.id] === "B");
  const real = round.initialStances[playerId];
  const forcedAgainst = mine && real && mine !== real;

  return (
    <PhaseBody className="pb-24">
      <div className="flex items-center justify-between">
        <span className="rounded-lg bg-accent/15 px-2 py-1 text-[0.62rem] font-black uppercase tracking-[0.18em] text-accent-soft">
          입장 배정
        </span>
        <Timer endsAt={state.phaseEndsAt} totalMs={step?.ms ?? 9_000} size={60} />
      </div>

      <TopicCard topic={round.topic} size="md" showMeta={false} />

      {mine && (
        <div
          className={cn(
            "animate-pop rounded-3xl border p-6 text-center",
            mine === "A"
              ? "border-stance-a/40 bg-stance-a/12"
              : "border-stance-b/40 bg-stance-b/12"
          )}
        >
          <p className="text-[0.7rem] font-black uppercase tracking-[0.25em] text-ink-faint">
            당신이 방어할 입장
          </p>
          <p
            className={cn(
              "mt-2 font-mono text-5xl font-black",
              mine === "A" ? "text-stance-a" : "text-stance-b"
            )}
          >
            {mine}
          </p>
          <p className="mt-2 text-lg font-bold leading-snug">{mine === "A" ? optionA : optionB}</p>
          {forcedAgainst && (
            <p className="mt-3 rounded-2xl bg-night-900/60 px-3 py-2 text-[0.78rem] font-bold text-warn">
              😈 당신 생각과 반대입니다. 그래도 방어하세요.
            </p>
          )}
          {round.mode === "ADVOCATE" && !forcedAgainst && (
            <p className="mt-3 text-[0.78rem] text-ink-mute">평소 생각은 잠시 접어두세요.</p>
          )}
        </div>
      )}

      {round.mode !== "ADVOCATE" && (
        <div className="grid grid-cols-2 gap-2">
          <TeamColumn side="A" label={optionA} players={teamA} playerId={playerId} />
          <TeamColumn side="B" label={optionB} players={teamB} playerId={playerId} />
        </div>
      )}

      <p className="flex items-center justify-center gap-1.5 text-center text-[0.78rem] text-ink-faint">
        <Swords size={13} /> {MODE_META[round.mode].ko}
      </p>
    </PhaseBody>
  );
}

function TeamColumn({
  side, label, players, playerId,
}: {
  side: "A" | "B";
  label: string;
  players: RoomState["players"];
  playerId: string;
}) {
  const isA = side === "A";
  return (
    <div
      className={cn(
        "rounded-3xl border p-3",
        isA ? "border-stance-a/30 bg-stance-a/8" : "border-stance-b/30 bg-stance-b/8"
      )}
    >
      <p className={cn("text-[0.62rem] font-black tracking-widest", isA ? "text-stance-a" : "text-stance-b")}>
        {side}
      </p>
      <p className="mt-0.5 text-[0.8rem] font-bold leading-snug">{label}</p>
      <div className="mt-3 space-y-1.5">
        {players.map((p) => (
          <div key={p.id} className="flex items-center gap-2">
            <PlayerAvatar player={p} size={26} />
            <span className={cn("truncate text-[0.76rem]", p.id === playerId ? "font-black text-ink" : "text-ink-dim")}>
              {p.nickname}
            </span>
          </div>
        ))}
        {!players.length && <p className="text-[0.72rem] text-ink-faint">아무도 없음</p>}
      </div>
    </div>
  );
}

/** 소수 의견 / 지목 결과 공개 */
export function RevealPhase({ state, playerId }: { state: RoomState; playerId: string }) {
  const round = state.round!;
  const step = round.steps[round.stepIndex];
  const active = state.players.filter((p) => round.order.includes(p.id));

  useEffect(() => { play("reveal"); }, []);

  if (step?.note === "PICK_REVEAL") {
    const tally: Record<string, number> = {};
    for (const t of Object.values(round.picks)) tally[t] = (tally[t] ?? 0) + 1;
    const ranked = active
      .map((p) => ({ p, n: tally[p.id] ?? 0 }))
      .sort((a, b) => b.n - a.n);
    const max = ranked[0]?.n ?? 0;
    const anonymous = round.mode === "FRIEND_RATING";

    return (
      <PhaseBody className="pb-24">
        <div className="flex items-center justify-between">
          <span className="rounded-lg bg-accent/15 px-2 py-1 text-[0.62rem] font-black uppercase tracking-[0.18em] text-accent-soft">
            결과 공개
          </span>
          <Timer endsAt={state.phaseEndsAt} totalMs={step?.ms ?? 11_000} size={60} />
        </div>

        <TopicCard topic={round.topic} size="md" showMeta={false} />

        <div className="space-y-2">
          {ranked.map(({ p, n }, i) => (
            <div
              key={p.id}
              className={cn(
                "flex animate-sweep items-center gap-3 rounded-2xl border px-3 py-3",
                n === max && n > 0
                  ? "border-accent bg-accent/12"
                  : "border-night-700 bg-night-850/50"
              )}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <PlayerAvatar player={p} size={40} ring={n === max && n > 0} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.92rem] font-bold">
                  {p.nickname}
                  {p.id === playerId && <span className="ml-1.5 text-[0.65rem] text-accent">나</span>}
                </span>
                <span className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-night-700">
                  <span
                    className="h-full rounded-full bg-accent transition-[width] duration-700"
                    style={{ width: max ? `${(n / max) * 100}%` : "0%" }}
                  />
                </span>
              </span>
              <span className="shrink-0 font-mono text-2xl font-black text-ink">{n}</span>
            </div>
          ))}
        </div>

        {!anonymous && (
          <div className="rounded-2xl border border-night-700 bg-night-850/40 p-4">
            <p className="mb-2 text-[0.75rem] font-bold uppercase tracking-wider text-ink-mute">누가 누굴 골랐나</p>
            <div className="space-y-1.5">
              {active.map((p) => {
                const target = state.players.find((x) => x.id === round.picks[p.id]);
                return (
                  <p key={p.id} className="text-[0.8rem] text-ink-dim">
                    <span className="font-bold text-ink">{p.avatar} {p.nickname}</span>
                    <span className="mx-1.5 text-ink-faint">→</span>
                    <span className="font-bold text-accent-soft">
                      {target ? `${target.avatar} ${target.nickname}` : "선택 안 함"}
                    </span>
                  </p>
                );
              })}
            </div>
          </div>
        )}
        {anonymous && (
          <p className="text-center text-[0.78rem] text-ink-faint">
            누가 누굴 찍었는지는 비밀입니다 🤐
          </p>
        )}
      </PhaseBody>
    );
  }

  if (step?.note === "MINORITY_REVEAL") {
    const a = active.filter((p) => round.initialStances[p.id] === "A");
    const b = active.filter((p) => round.initialStances[p.id] === "B");
    const minority = round.minorityStance;
    const iAmMinority = round.initialStances[playerId] === minority;

    return (
      <PhaseBody className="pb-24">
        <div className="flex items-center justify-between">
          <span className="rounded-lg bg-accent/15 px-2 py-1 text-[0.62rem] font-black uppercase tracking-[0.18em] text-accent-soft">
            동시 공개
          </span>
          <Timer endsAt={state.phaseEndsAt} totalMs={step?.ms ?? 11_000} size={60} />
        </div>

        <TopicCard topic={round.topic} size="md" showMeta={false} />

        <div className="grid gap-2.5">
          <StanceButton side="A" label={round.topic.optionA ?? "찬성"} count={a.length} disabled />
          <StanceButton side="B" label={round.topic.optionB ?? "반대"} count={b.length} disabled />
        </div>

        <div className="animate-pop rounded-3xl border border-warn/40 bg-warn/12 p-6 text-center">
          <p className="text-[0.7rem] font-black uppercase tracking-[0.25em] text-warn">오늘의 주인공</p>
          <div className="mt-3 flex justify-center gap-2">
            {active
              .filter((p) => round.initialStances[p.id] === minority)
              .map((p) => (
                <div key={p.id} className="flex flex-col items-center gap-1">
                  <PlayerAvatar player={p} size={48} ring />
                  <span className="text-[0.72rem] font-bold">{p.nickname}</span>
                </div>
              ))}
          </div>
          <p className="mt-4 text-[0.85rem] leading-relaxed text-ink-dim">
            {iAmMinority
              ? "소수는 당신입니다. 먼저 변론하고, 나머지 전원의 반박을 받습니다."
              : "소수가 먼저 변론합니다. 그 다음 여러분이 반박하세요."}
          </p>
        </div>
      </PhaseBody>
    );
  }

  // 투표 공개
  return <VoteRevealPhase state={state} playerId={playerId} />;
}

function VoteRevealPhase({ state, playerId }: { state: RoomState; playerId: string }) {
  const round = state.round!;
  const step = round.steps[round.stepIndex];
  const active = state.players.filter((p) => round.order.includes(p.id));
  const tallyA = active.filter((p) => round.votes[p.id]?.stance === "A").length;
  const tallyB = active.filter((p) => round.votes[p.id]?.stance === "B").length;
  const initA = active.filter((p) => round.initialStances[p.id] === "A").length;
  const initB = active.length - initA;
  const flippers = active.filter((p) => {
    const before = round.initialStances[p.id];
    const after = round.votes[p.id]?.stance;
    return before && after && before !== after;
  });

  return (
    <PhaseBody className="pb-24">
      <div className="flex items-center justify-between">
        <span className="rounded-lg bg-accent/15 px-2 py-1 text-[0.62rem] font-black uppercase tracking-[0.18em] text-accent-soft">
          투표 공개
        </span>
        <Timer endsAt={state.phaseEndsAt} totalMs={step?.ms ?? 11_000} size={60} />
      </div>

      <div className="grid gap-2.5">
        <StanceButton side="A" label={round.topic.optionA ?? "찬성"} count={tallyA} disabled big />
        <StanceButton side="B" label={round.topic.optionB ?? "반대"} count={tallyB} disabled big />
      </div>

      <div className="rounded-3xl border border-night-700 bg-night-850/60 p-5">
        <p className="text-[0.72rem] font-bold uppercase tracking-wider text-ink-mute">의견 변화</p>
        <div className="mt-3 flex items-center justify-center gap-4 font-mono">
          <span className="text-center">
            <span className="block text-[0.65rem] text-ink-faint">시작</span>
            <span className="text-xl font-black text-stance-a">{initA}</span>
            <span className="mx-1 text-ink-faint">:</span>
            <span className="text-xl font-black text-stance-b">{initB}</span>
          </span>
          <span className="text-2xl text-ink-faint">→</span>
          <span className="text-center">
            <span className="block text-[0.65rem] text-ink-faint">지금</span>
            <span className="text-xl font-black text-stance-a">{tallyA}</span>
            <span className="mx-1 text-ink-faint">:</span>
            <span className="text-xl font-black text-stance-b">{tallyB}</span>
          </span>
        </div>
        <p className="mt-4 text-center text-[0.92rem] font-bold">
          {flippers.length === 0
            ? "아무도 의견을 바꾸지 않았습니다"
            : `${flippers.length}명이 의견을 바꿨습니다`}
        </p>
        {flippers.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {flippers.map((p) => (
              <span
                key={p.id}
                className="flex items-center gap-1.5 rounded-full border border-warn/40 bg-warn/12 px-3 py-1.5 text-[0.78rem] font-bold text-warn"
              >
                {p.avatar} {p.nickname}
                {p.id === playerId && " (나)"}
              </span>
            ))}
          </div>
        )}
      </div>
    </PhaseBody>
  );
}
