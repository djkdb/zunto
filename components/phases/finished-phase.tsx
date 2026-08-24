"use client";
import { useEffect, useMemo } from "react";
import Link from "next/link";
import { Home, RotateCcw } from "lucide-react";
import type { RoomState } from "@/lib/game/types";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/room/player-chip";
import { ShareCard } from "@/components/game/share-card";
import { PhaseBody } from "./frame";
import { ScoreBoard } from "./result-phase";
import { useRoomStore } from "@/lib/client/room-store";
import { titleOf } from "@/lib/game/titles";
import { play } from "@/lib/client/sound";
import { saveHistory } from "@/lib/client/identity";
import { persuasionScore } from "@/lib/game/scoring";
import { cn } from "@/lib/utils";

export function FinishedPhase({ state, playerId }: { state: RoomState; playerId: string }) {
  const send = useRoomStore((s) => s.send);
  const summary = state.finalSummary;
  const isHost = state.hostId === playerId;
  const me = state.players.find((p) => p.id === playerId);

  useEffect(() => { play("win"); }, []);

  useEffect(() => {
    if (!summary || !me) return;
    saveHistory({
      code: state.code,
      roomName: state.settings.name,
      playedAt: summary.playedAt,
      durationMs: summary.durationMs,
      rounds: summary.totalRounds,
      players: summary.standings.map((s) => ({
        nickname: s.nickname, avatar: s.avatar, score: s.score,
      })),
      championNickname:
        state.players.find((p) => p.id === summary.champion)?.nickname ?? null,
      myTitles: summary.titles[playerId] ?? [],
      myNickname: me.nickname,
      headlines: state.history.map((h) => h.headline),
    });
  }, [summary, me, state, playerId]);

  const highlights = useMemo(() => {
    if (!summary) return [];
    return [
      { emoji: "🏆", label: "종합 우승", id: summary.champion },
      { emoji: "🔥", label: "최고의 설득가", id: summary.mostPersuasive },
      { emoji: "😂", label: "분위기메이커", id: summary.funniest },
      { emoji: "🧠", label: "가장 논리적인 사람", id: summary.mostLogical },
      { emoji: "🎯", label: "의견을 가장 많이 바꾼 사람", id: summary.mostFlips },
      { emoji: "🗿", label: "끝까지 안 바뀐 사람", id: summary.stubborn },
    ].filter((h) => h.id);
  }, [summary]);

  if (!summary) return null;
  const P = (id?: string | null) => state.players.find((p) => p.id === id);

  return (
    <PhaseBody className="pb-10">
      <header className="py-6 text-center">
        <p className="text-[0.68rem] font-black uppercase tracking-[0.35em] text-ink-faint">
          debate night
        </p>
        <h2 className="mt-2 text-[2rem] font-black leading-none tracking-tight text-shimmer">
          COMPLETE
        </h2>
        <p className="mt-3 text-[0.85rem] text-ink-mute">
          총 {summary.totalRounds}라운드 · {Math.max(1, Math.round(summary.durationMs / 60000))}분 ·{" "}
          {summary.standings.length}명
        </p>
      </header>

      <div className="space-y-2">
        {highlights.map((h, i) => {
          const p = P(h.id);
          if (!p) return null;
          return (
            <div
              key={h.label}
              className={cn(
                "flex animate-sweep items-center gap-3 rounded-3xl border p-4",
                i === 0 ? "border-warn/45 bg-warn/10" : "border-night-700 bg-night-850/55"
              )}
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <span className="text-2xl">{h.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.72rem] font-bold uppercase tracking-wider text-ink-mute">
                  {h.label}
                </p>
                <p className="truncate text-[1.1rem] font-black">
                  {p.nickname}
                  {p.id === playerId && <span className="ml-1.5 text-[0.7rem] text-accent">나</span>}
                </p>
              </div>
              <PlayerAvatar player={p} size={40} ring={i === 0} />
            </div>
          );
        })}
      </div>

      <ScoreBoard state={state} playerId={playerId} />

      <section className="rounded-3xl border border-night-700 bg-night-850/50 p-4">
        <p className="mb-3 text-[0.72rem] font-black uppercase tracking-widest text-ink-faint">
          player profile
        </p>
        <div className="space-y-3">
          {state.players
            .filter((p) => p.stats.rounds > 0)
            .sort((a, b) => b.score - a.score)
            .map((p) => {
              const titles = summary.titles[p.id] ?? [];
              const stats = p.stats;
              const avgP = persuasionScore(stats.ratingSum, stats.ratingCount);
              const favored =
                stats.stanceA === stats.stanceB ? "반반" : stats.stanceA > stats.stanceB ? "A 쪽" : "B 쪽";
              return (
                <div key={p.id} className="rounded-2xl border border-night-700 bg-night-900/50 p-3">
                  <div className="flex items-center gap-2.5">
                    <PlayerAvatar player={p} size={36} ring={p.id === playerId} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.92rem] font-black">{p.nickname}</span>
                      <span className="flex flex-wrap gap-1 pt-1">
                        {titles.map((c) => {
                          const t = titleOf(c);
                          return (
                            <span
                              key={c}
                              className="rounded-full border border-accent/35 bg-accent/12 px-2 py-0.5 text-[0.64rem] font-bold text-accent-soft"
                              title={t.desc}
                            >
                              {t.emoji} {t.ko}
                            </span>
                          );
                        })}
                      </span>
                    </span>
                    <span className="font-mono text-lg font-black">{p.score}</span>
                  </div>
                  <div className="mt-2.5 grid grid-cols-4 gap-1.5 text-center">
                    <Stat label="승률" value={`${Math.round((stats.wins / Math.max(1, stats.rounds)) * 100)}%`} />
                    <Stat label="MVP" value={`${stats.mvp}`} />
                    <Stat label="의견변경" value={`${stats.flips}`} />
                    <Stat label="설득력" value={avgP ? avgP.toFixed(1) : "-"} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[0.68rem] text-ink-faint">
                    <span>많이 고른 쪽 · {favored}</span>
                    <span>지목당함 · {stats.picked}회</span>
                    {stats.missionsDone > 0 && <span>미션 성공 · {stats.missionsDone}회</span>}
                  </div>
                </div>
              );
            })}
        </div>
      </section>

      {state.history.length > 0 && (
        <section className="rounded-3xl border border-night-700 bg-night-850/40 p-4">
          <p className="mb-3 text-[0.72rem] font-black uppercase tracking-widest text-ink-faint">
            오늘 밤의 토론 기록
          </p>
          <ol className="space-y-2">
            {state.history.map((h, i) => (
              <li key={i} className="flex gap-2.5 text-[0.82rem]">
                <span className="font-mono font-black text-accent">{i + 1}</span>
                <span className="flex-1 leading-snug text-ink-dim">{h.headline}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <ShareCard state={state} summary={summary} />

      <div className="flex gap-2 pt-2">
        <Button variant="secondary" size="lg" block asChild>
          <Link href="/">
            <Home size={17} /> 홈으로
          </Link>
        </Button>
        {isHost && (
          <Button size="lg" block onClick={() => send({ type: "RESTART", playerId })}>
            <RotateCcw size={17} /> 한 판 더
          </Button>
        )}
      </div>
      {!isHost && (
        <p className="pb-4 text-center text-[0.76rem] text-ink-faint">
          방장이 한 판 더 시작하면 자동으로 로비로 돌아갑니다
        </p>
      )}
    </PhaseBody>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-night-800/70 py-1.5">
      <p className="font-mono text-[0.88rem] font-black text-ink">{value}</p>
      <p className="text-[0.6rem] text-ink-faint">{label}</p>
    </div>
  );
}
