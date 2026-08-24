"use client";
import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Download, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import type { FinalSummary, RoomState } from "@/lib/game/types";
import { Button } from "@/components/ui/button";
import { titleOf } from "@/lib/game/titles";

export function ShareCard({ state, summary }: { state: RoomState; summary: FinalSummary }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const P = (id?: string | null) => state.players.find((p) => p.id === id);
  const rows = [
    { emoji: "🏆", label: "WINNER", id: summary.champion },
    { emoji: "🔥", label: "MOST PERSUASIVE", id: summary.mostPersuasive },
    { emoji: "😂", label: "FUNNIEST", id: summary.funniest },
    { emoji: "🧠", label: "MOST LOGICAL", id: summary.mostLogical },
  ].filter((r) => r.id);

  async function render(): Promise<Blob | null> {
    if (!ref.current) return null;
    const dataUrl = await toPng(ref.current, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: "#06060B",
    });
    const res = await fetch(dataUrl);
    return res.blob();
  }

  async function share() {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await render();
      if (!blob) throw new Error("이미지를 만들지 못했습니다");
      const file = new File([blob], `debatenight-${state.code}.png`, { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "DEBATE NIGHT" });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("결과 카드를 저장했습니다");
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        toast.error("이미지를 만들지 못했습니다");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div
        ref={ref}
        className="overflow-hidden rounded-3xl border border-night-600 p-6"
        style={{
          background: "linear-gradient(160deg, #0F1119 0%, #06060B 55%, #140F26 100%)",
        }}
      >
        <div className="flex items-baseline justify-between">
          <p className="text-[1.35rem] font-black tracking-[-0.03em]">
            <span style={{ color: "#F7F7FB" }}>DEBATE</span>
            <span style={{ color: "#7B61FF" }}>NIGHT</span>
          </p>
          <p className="font-mono text-[0.7rem] font-bold" style={{ color: "#545872" }}>
            {state.code}
          </p>
        </div>

        <div className="mt-1 flex gap-3 text-[0.72rem] font-bold" style={{ color: "#7C819B" }}>
          <span>{summary.standings.length} PLAYER{summary.standings.length === 1 ? "" : "S"}</span>
          <span>·</span>
          <span>{summary.totalRounds} ROUND{summary.totalRounds === 1 ? "" : "S"}</span>
          <span>·</span>
          <span>{Math.max(1, Math.round(summary.durationMs / 60000))} MIN</span>
        </div>

        <div className="mt-5 space-y-3">
          {rows.map((r) => {
            const p = P(r.id);
            if (!p) return null;
            return (
              <div key={r.label} className="flex items-center gap-3">
                <span className="text-xl leading-none">{r.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.6rem] font-black tracking-[0.16em]" style={{ color: "#545872" }}>
                    {r.label}
                  </p>
                  <p className="truncate text-[1.05rem] font-black" style={{ color: "#F7F7FB" }}>
                    {p.avatar} {p.nickname}
                  </p>
                </div>
                <span className="font-mono text-[0.85rem] font-black" style={{ color: "#7B61FF" }}>
                  {p.score}
                </span>
              </div>
            );
          })}
        </div>

        {summary.bestQuote && (
          <div
            className="mt-5 rounded-2xl px-4 py-3"
            style={{ background: "rgba(123,97,255,0.12)", border: "1px solid rgba(123,97,255,0.28)" }}
          >
            <p className="text-[0.6rem] font-black tracking-[0.16em]" style={{ color: "#9B87FF" }}>
              BEST LINE
            </p>
            <p className="mt-1 text-[0.88rem] font-bold leading-snug" style={{ color: "#F7F7FB" }}>
              “{summary.bestQuote.text}”
            </p>
            <p className="mt-1 text-[0.7rem]" style={{ color: "#7C819B" }}>
              — {P(summary.bestQuote.playerId)?.nickname}
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-1.5">
          {Object.entries(summary.titles).slice(0, 6).map(([pid, codes]) => {
            const p = P(pid);
            const t = titleOf(codes[0]);
            if (!p) return null;
            return (
              <span
                key={pid}
                className="rounded-full px-2.5 py-1 text-[0.65rem] font-bold"
                style={{ background: "#141622", color: "#B4B7CC", border: "1px solid #262A3C" }}
              >
                {t.emoji} {p.nickname} · {t.ko}
              </span>
            );
          })}
        </div>
      </div>

      <Button variant="secondary" size="lg" block onClick={share} disabled={busy}>
        {busy ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={17} />}
        결과 카드 공유하기
        {!busy && <Download size={15} className="opacity-50" />}
      </Button>
    </div>
  );
}
