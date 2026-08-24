"use client";
import Link from "next/link";
import { Trash2, Trophy } from "lucide-react";
import { PageShell } from "@/components/brand/page-shell";
import { Button } from "@/components/ui/button";
import { clearHistory, useHistory } from "@/lib/client/identity";
import { useIsClient } from "@/lib/client/hooks";
import { titleOf } from "@/lib/game/titles";

export default function HistoryPage() {
  const items = useHistory();
  const mounted = useIsClient();

  if (!mounted) {
    return <PageShell title="지난 토론 기록" back="/"><div className="h-40" /></PageShell>;
  }

  return (
    <PageShell
      title="지난 토론 기록"
      back="/"
      right={
        items.length > 0 ? (
          <button
            onClick={() => clearHistory()}
            className="grid h-9 w-9 place-items-center rounded-full text-ink-faint transition-colors active:bg-night-800"
            aria-label="기록 지우기"
          >
            <Trash2 size={16} />
          </button>
        ) : undefined
      }
    >
      <div className="space-y-4 pb-10">
        {items.length === 0 ? (
          <div className="rounded-3xl border border-night-700 bg-night-850/50 p-8 text-center">
            <p className="text-4xl">🌙</p>
            <p className="mt-4 text-lg font-bold">아직 기록이 없습니다</p>
            <p className="mt-1.5 text-[0.85rem] leading-relaxed text-ink-mute">
              한 판 끝내면 여기에 남습니다.
              <br />
              기록은 이 기기에만 저장됩니다.
            </p>
            <Button size="lg" block className="mt-6" asChild>
              <Link href="/create">첫 토론 시작하기</Link>
            </Button>
          </div>
        ) : (
          items.map((h, i) => (
            <article
              key={`${h.code}-${h.playedAt}`}
              className="animate-rise rounded-3xl border border-night-700 bg-night-850/60 p-4"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <header className="flex items-baseline justify-between gap-3">
                <h2 className="min-w-0 flex-1 truncate text-[1rem] font-black">{h.roomName}</h2>
                <span className="shrink-0 font-mono text-[0.7rem] text-ink-faint">{h.code}</span>
              </header>
              <p className="mt-0.5 text-[0.74rem] text-ink-faint">
                {new Date(h.playedAt).toLocaleString("ko-KR", {
                  month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
                })}
                {" · "}
                {h.rounds}라운드 · {Math.max(1, Math.round(h.durationMs / 60000))}분
              </p>

              {h.championNickname && (
                <div className="mt-3 flex items-center gap-2 rounded-2xl border border-warn/35 bg-warn/10 px-3 py-2">
                  <Trophy size={14} className="text-warn" />
                  <span className="text-[0.85rem] font-bold">{h.championNickname}</span>
                  <span className="text-[0.72rem] text-ink-mute">종합 우승</span>
                </div>
              )}

              <div className="mt-3 space-y-1.5">
                {h.players.map((p, idx) => (
                  <div key={`${p.nickname}-${idx}`} className="flex items-center gap-2 text-[0.82rem]">
                    <span className="w-4 text-center font-mono text-[0.7rem] text-ink-faint">{idx + 1}</span>
                    <span className="flex-1 truncate">
                      {p.avatar} {p.nickname}
                      {p.nickname === h.myNickname && (
                        <span className="ml-1.5 text-[0.65rem] font-black text-accent">나</span>
                      )}
                    </span>
                    <span className="font-mono font-black">{p.score}</span>
                  </div>
                ))}
              </div>

              {h.myTitles.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {h.myTitles.map((c) => {
                    const t = titleOf(c);
                    return (
                      <span
                        key={c}
                        className="rounded-full border border-accent/35 bg-accent/12 px-2.5 py-1 text-[0.68rem] font-bold text-accent-soft"
                      >
                        {t.emoji} {t.ko}
                      </span>
                    );
                  })}
                </div>
              )}

              {h.headlines.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-[0.76rem] font-bold text-ink-mute">
                    라운드별 기록 {h.headlines.length}개
                  </summary>
                  <ol className="mt-2 space-y-1">
                    {h.headlines.map((line, k) => (
                      <li key={k} className="flex gap-2 text-[0.78rem] text-ink-dim">
                        <span className="font-mono font-black text-accent">{k + 1}</span>
                        {line}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </article>
          ))
        )}
      </div>
    </PageShell>
  );
}
