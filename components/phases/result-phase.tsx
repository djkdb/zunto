"use client";
import { useEffect, useState } from "react";
import { ArrowRight, Flag, Quote, Smile, Trophy } from "lucide-react";
import type { RoomState } from "@/lib/game/types";
import { AWARD_META, MODE_META } from "@/lib/game/types";
import { PlayerAvatar } from "@/components/room/player-chip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActionDock, PhaseBody } from "./frame";
import { useRoomStore } from "@/lib/client/room-store";
import { play } from "@/lib/client/sound";
import { cn } from "@/lib/utils";

export function ResultPhase({ state, playerId }: { state: RoomState; playerId: string }) {
  const send = useRoomStore((s) => s.send);
  const round = state.round!;
  const res = round.result;
  const isHost = state.hostId === playerId;
  const [funVoted, setFunVoted] = useState(false);
  const isLast = state.roundNo >= state.settings.totalRounds;

  useEffect(() => { play("win"); }, []);

  if (!res) return null;

  const P = (id?: string | null) => state.players.find((p) => p.id === id);
  const winners = res.winnerIds.map(P).filter(Boolean) as RoomState["players"];
  const mvp = P(res.mvpId);
  const bestQuote = pickQuote(state);

  return (
    <>
      <PhaseBody className="pb-40">
        <header className="text-center">
          <p className="text-[0.68rem] font-black uppercase tracking-[0.3em] text-ink-faint">
            round {round.no} result
          </p>
          <h2 className="mt-2 text-[1.6rem] font-black leading-tight tracking-tight text-shimmer">
            {res.headline}
          </h2>
          <div className="mt-2 flex justify-center">
            <Badge variant="accent">
              {MODE_META[round.mode].emoji} {MODE_META[round.mode].ko}
            </Badge>
          </div>
        </header>

        {!MODE_META[round.mode].isPickPerson && round.mode !== "ADVOCATE" && (
          <div className="grid grid-cols-2 gap-2">
            <TallyCard
              side="A" label={round.topic.optionA ?? "찬성"}
              n={res.finalTally.A} was={res.initialTally.A}
              win={res.winningStance === "A"}
            />
            <TallyCard
              side="B" label={round.topic.optionB ?? "반대"}
              n={res.finalTally.B} was={res.initialTally.B}
              win={res.winningStance === "B"}
            />
          </div>
        )}

        {winners.length > 0 && (
          <AwardBlock
            icon={<Trophy size={16} className="text-warn" />}
            label="토론 승리"
            players={winners}
            playerId={playerId}
            tone="warn"
          />
        )}

        {mvp && (
          <AwardBlock
            icon={<span className="text-base">🎤</span>}
            label={`가장 설득력 있었던 사람 · ${res.mvpVotes}표`}
            players={[mvp]}
            playerId={playerId}
            tone="accent"
          />
        )}

        {bestQuote && (
          <div className="rounded-3xl border border-night-700 bg-night-850/60 p-5">
            <p className="mb-2 flex items-center gap-1.5 text-[0.7rem] font-black uppercase tracking-widest text-ink-faint">
              <Quote size={12} /> 가장 강한 한마디
            </p>
            <p className="text-[1.05rem] font-bold leading-relaxed text-ink">
              “{bestQuote.text}”
            </p>
            <p className="mt-2 text-[0.78rem] text-ink-mute">
              — {P(bestQuote.playerId)?.avatar} {P(bestQuote.playerId)?.nickname}
            </p>
          </div>
        )}

        {Object.keys(res.awardWinners).length > 0 && (
          <div className="rounded-3xl border border-night-700 bg-night-850/50 p-4">
            <p className="mb-3 text-[0.72rem] font-black uppercase tracking-widest text-ink-faint">
              오늘의 어워드
            </p>
            <div className="space-y-2">
              {(Object.entries(res.awardWinners) as [keyof typeof AWARD_META, string][]).map(
                ([code, id]) => {
                  const p = P(id);
                  if (!p) return null;
                  return (
                    <div key={code} className="flex items-center gap-2.5">
                      <span className="text-lg">{AWARD_META[code].emoji}</span>
                      <span className="flex-1 text-[0.8rem] text-ink-mute">{AWARD_META[code].ko}</span>
                      <span className="text-[0.86rem] font-bold">
                        {p.avatar} {p.nickname}
                      </span>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        )}

        {res.flippers.length > 0 && (
          <div className="rounded-3xl border border-warn/30 bg-warn/8 p-4">
            <p className="mb-2 text-[0.72rem] font-black uppercase tracking-widest text-warn">
              🤔 의견을 바꾼 사람
            </p>
            <div className="flex flex-wrap gap-2">
              {res.flippers.map((id) => {
                const p = P(id);
                return p ? (
                  <span key={id} className="text-[0.86rem] font-bold text-ink">
                    {p.avatar} {p.nickname}
                  </span>
                ) : null;
              })}
            </div>
          </div>
        )}

        {round.mission && <MissionResult state={state} playerId={playerId} />}

        <ScoreBoard state={state} playerId={playerId} deltas={res.deltas} />

        {!funVoted && (
          <div className="rounded-3xl border border-night-700 bg-night-850/50 p-4">
            <p className="mb-3 flex items-center gap-1.5 text-[0.78rem] font-bold text-ink-dim">
              <Smile size={14} /> 이번 라운드 재밌었나요?
            </p>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    void send({ type: "FUN_VOTE", playerId, score: n });
                    setFunVoted(true);
                  }}
                  className="h-11 flex-1 rounded-xl border border-night-600 bg-night-800 text-lg transition-all active:scale-95 active:border-accent"
                >
                  {["😐", "🙂", "😄", "😆", "🤣"][n - 1]}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[0.7rem] text-ink-faint">
              다음 주제 추천에 반영됩니다
            </p>
          </div>
        )}
      </PhaseBody>

      <ActionDock
        hint={
          isHost
            ? isLast ? "마지막 라운드입니다" : `다음은 라운드 ${state.roundNo + 1}`
            : "방장이 다음 라운드를 시작하기를 기다리는 중"
        }
      >
        {isHost ? (
          <div className="flex gap-2">
            {!isLast && (
              <Button
                variant="secondary"
                size="lg"
                className="px-4"
                onClick={() => send({ type: "END_GAME", playerId })}
                aria-label="여기서 끝내기"
              >
                <Flag size={17} />
              </Button>
            )}
            <Button size="lg" block onClick={() => send({ type: "NEXT_ROUND", playerId })}>
              {isLast ? "최종 결과 보기" : "다음 라운드"} <ArrowRight size={17} />
            </Button>
          </div>
        ) : (
          <Button size="lg" block variant="secondary" disabled>
            잠시만요
          </Button>
        )}
      </ActionDock>
    </>
  );
}

function pickQuote(state: RoomState) {
  const round = state.round;
  if (!round) return null;
  const entries = Object.entries(round.quotes);
  if (!entries.length) return null;
  entries.sort((a, b) => b[1].length - a[1].length);
  return { playerId: entries[0][0], text: entries[0][1] };
}

function TallyCard({
  side, label, n, was, win,
}: {
  side: "A" | "B"; label: string; n: number; was: number; win: boolean;
}) {
  const isA = side === "A";
  const delta = n - was;
  return (
    <div
      className={cn(
        "rounded-3xl border p-4",
        win
          ? isA
            ? "border-stance-a bg-stance-a/15"
            : "border-stance-b bg-stance-b/15"
          : "border-night-700 bg-night-850/50"
      )}
    >
      <div className="flex items-baseline gap-1.5">
        <span className={cn("font-mono text-[0.7rem] font-black", isA ? "text-stance-a" : "text-stance-b")}>
          {side}
        </span>
        {win && <span className="text-[0.62rem] font-black text-warn">WIN</span>}
      </div>
      <p className="mt-1 text-[0.8rem] font-bold leading-snug">{label}</p>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className={cn("font-mono text-3xl font-black", isA ? "text-stance-a" : "text-stance-b")}>
          {n}
        </span>
        <span className="text-[0.72rem] text-ink-faint">표</span>
        {delta !== 0 && (
          <span className={cn("text-[0.72rem] font-bold", delta > 0 ? "text-good" : "text-danger")}>
            {delta > 0 ? `+${delta}` : delta}
          </span>
        )}
      </p>
    </div>
  );
}

function AwardBlock({
  icon, label, players, playerId, tone,
}: {
  icon: React.ReactNode;
  label: string;
  players: RoomState["players"];
  playerId: string;
  tone: "warn" | "accent";
}) {
  return (
    <div
      className={cn(
        "animate-pop rounded-3xl border p-4",
        tone === "warn" ? "border-warn/40 bg-warn/10" : "border-accent/40 bg-accent/10"
      )}
    >
      <p className="mb-2.5 flex items-center gap-1.5 text-[0.7rem] font-black uppercase tracking-widest">
        {icon}
        <span className={tone === "warn" ? "text-warn" : "text-accent-soft"}>{label}</span>
      </p>
      <div className="flex flex-wrap gap-3">
        {players.map((p) => (
          <div key={p.id} className="flex items-center gap-2">
            <PlayerAvatar player={p} size={36} ring />
            <span className="text-[0.95rem] font-black">
              {p.nickname}
              {p.id === playerId && <span className="ml-1 text-[0.65rem] text-accent">나</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MissionResult({ state, playerId }: { state: RoomState; playerId: string }) {
  const send = useRoomStore((s) => s.send);
  const round = state.round!;
  const mission = round.mission!;
  const owner = state.players.find((p) => p.id === mission.playerId);
  const isOwner = mission.playerId === playerId;
  const myVote = round.missionVotes[playerId];
  const result = round.result?.mission;
  const yes = Object.values(round.missionVotes).filter(Boolean).length;
  const total = Object.keys(round.missionVotes).length;

  return (
    <div className="rounded-3xl border border-warn/35 bg-warn/8 p-4">
      <p className="mb-2 text-[0.7rem] font-black uppercase tracking-widest text-warn">
        🕵️ 비밀 미션 공개
      </p>
      <p className="text-[0.86rem] text-ink-mute">
        {owner?.avatar} <span className="font-bold text-ink">{owner?.nickname}</span> 님의 미션
      </p>
      <p className="mt-1.5 text-[1.05rem] font-bold leading-snug">{mission.text}</p>

      {isOwner ? (
        <p className="mt-3 text-[0.8rem] text-ink-mute">
          친구들이 성공 여부를 판정하고 있습니다 · {yes}/{Math.max(1, total)}표
        </p>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button
            size="sm" block
            variant={myVote === true ? "good" : "secondary"}
            onClick={() => send({ type: "MISSION_VOTE", playerId, success: true })}
          >
            성공했다
          </Button>
          <Button
            size="sm" block
            variant={myVote === false ? "danger" : "secondary"}
            onClick={() => send({ type: "MISSION_VOTE", playerId, success: false })}
          >
            아니다
          </Button>
        </div>
      )}

      {result?.succeeded !== null && result?.succeeded !== undefined && (
        <p
          className={cn(
            "mt-3 text-center text-[0.9rem] font-black",
            result.succeeded ? "text-good" : "text-danger"
          )}
        >
          {result.succeeded ? "미션 성공 · +3점" : "미션 실패"}
        </p>
      )}
    </div>
  );
}

export function ScoreBoard({
  state, playerId, deltas,
}: {
  state: RoomState;
  playerId: string;
  deltas?: Record<string, number>;
}) {
  const ranked = [...state.players]
    .filter((p) => p.active || p.score > 0)
    .sort((a, b) => b.score - a.score);
  const max = Math.max(1, ranked[0]?.score ?? 1);

  return (
    <div className="rounded-3xl border border-night-700 bg-night-850/50 p-4">
      <p className="mb-3 text-[0.72rem] font-black uppercase tracking-widest text-ink-faint">
        누적 점수
      </p>
      <div className="space-y-2">
        {ranked.map((p, i) => (
          <div key={p.id} className="flex items-center gap-2.5">
            <span className="w-4 shrink-0 text-center font-mono text-[0.75rem] font-black text-ink-faint">
              {i + 1}
            </span>
            <PlayerAvatar player={p} size={30} ring={p.id === playerId} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.84rem] font-bold">{p.nickname}</span>
              <span className="mt-1 flex h-1 overflow-hidden rounded-full bg-night-700">
                <span
                  className="h-full rounded-full bg-accent transition-[width] duration-700"
                  style={{ width: `${(p.score / max) * 100}%` }}
                />
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="font-mono text-[0.95rem] font-black">{p.score}</span>
              {deltas?.[p.id] ? (
                <span className="ml-1 animate-pop text-[0.7rem] font-black text-good">
                  +{deltas[p.id]}
                </span>
              ) : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
