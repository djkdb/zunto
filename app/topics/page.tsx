"use client";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Dices, Sparkles } from "lucide-react";
import { PageShell } from "@/components/brand/page-shell";
import { Button } from "@/components/ui/button";
import { TopicCard } from "@/components/game/topic-card";
import { TOPICS_BY_CATEGORY, ALL_TOPICS } from "@/lib/data/topics";
import { CATEGORIES, CATEGORY_META, type Category, type Topic } from "@/lib/game/types";
import { mulberry32, shuffle } from "@/lib/game/rng";
import { rerollSeed, useIsClient, useRandomSeed } from "@/lib/client/hooks";
import { cn } from "@/lib/utils";

function TopicsInner() {
  const params = useSearchParams();
  const fromUrl = params.get("category") as Category | null;
  const [draftCategory, setDraftCategory] = useState<Category | "ALL" | null>(null);
  const category: Category | "ALL" =
    draftCategory ?? (fromUrl && CATEGORIES.includes(fromUrl) ? fromUrl : "ALL");
  const setCategory = setDraftCategory;
  const seed = useRandomSeed();
  const mounted = useIsClient();

  const pool = useMemo(
    () => (category === "ALL" ? ALL_TOPICS : TOPICS_BY_CATEGORY[category]),
    [category]
  );

  const list = useMemo(() => {
    if (!mounted) return pool.slice(0, 10);
    return shuffle(pool, mulberry32(seed)).slice(0, 10) as Topic[];
  }, [pool, seed, mounted]);

  const reroll = () => rerollSeed();

  return (
    <PageShell title="오늘의 랜덤 주제" back="/">
      <div className="space-y-4 pb-28">
        <p className="text-[0.84rem] leading-relaxed text-ink-mute">
          주제 {ALL_TOPICS.length}개 중에서 무작위로 꺼냈습니다.
          <br />
          맘에 드는 게 있으면 그냥 이걸로 얘기해도 됩니다.
        </p>

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <button
            onClick={() => setCategory("ALL")}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-[0.8rem] font-bold transition-colors",
              category === "ALL"
                ? "border-accent bg-accent/15 text-ink"
                : "border-night-600 bg-night-850 text-ink-mute"
            )}
          >
            전체 {ALL_TOPICS.length}
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-[0.8rem] font-bold transition-colors",
                category === c
                  ? "border-accent bg-accent/15 text-ink"
                  : "border-night-600 bg-night-850 text-ink-mute"
              )}
            >
              {CATEGORY_META[c].emoji} {CATEGORY_META[c].ko} {TOPICS_BY_CATEGORY[c].length}
            </button>
          ))}
        </div>

        {category !== "ALL" && (
          <p className="rounded-2xl border border-night-700 bg-night-850/50 px-4 py-3 text-[0.8rem] text-ink-mute">
            {CATEGORY_META[category].desc}
          </p>
        )}

        <div className="space-y-3">
          {list.map((t, i) => (
            <div key={t.id} className="animate-rise" style={{ animationDelay: `${i * 35}ms` }}>
              <TopicCard topic={t} size="md" />
            </div>
          ))}
        </div>
      </div>

      <div className="safe-b fixed inset-x-0 bottom-0 z-20 border-t border-night-800 bg-night-950/85 px-4 pt-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg gap-2">
          <Button variant="secondary" size="lg" block onClick={reroll}>
            <Dices size={18} /> 다시 뽑기
          </Button>
          <Button size="lg" block asChild>
            <Link href="/create">
              <Sparkles size={17} /> 이걸로 시작
            </Link>
          </Button>
        </div>
      </div>
    </PageShell>
  );
}

export default function TopicsPage() {
  return (
    <Suspense fallback={<PageShell title="오늘의 랜덤 주제" back="/"><div className="h-40" /></PageShell>}>
      <TopicsInner />
    </Suspense>
  );
}
