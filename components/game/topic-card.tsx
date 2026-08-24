"use client";
import { CATEGORY_META, type Topic } from "@/lib/game/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function TopicCard({
  topic, size = "lg", className, showMeta = true,
}: {
  topic: Topic;
  size?: "sm" | "md" | "lg";
  className?: string;
  showMeta?: boolean;
}) {
  const meta = CATEGORY_META[topic.category];
  const text = {
    sm: "text-[1rem] leading-snug",
    md: "text-[1.25rem] leading-snug",
    lg: "text-[1.6rem] leading-[1.28]",
  }[size];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-night-700 bg-night-850/80 p-5",
        className
      )}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-[0.13] blur-2xl"
        style={{ background: meta.hue }}
      />
      {showMeta && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <Badge variant="accent">
            {meta.emoji} {meta.ko}
          </Badge>
          <Badge>난이도 {"●".repeat(topic.difficulty)}</Badge>
          {topic.intensity >= 4 && <Badge variant="danger">🌶️ 수위 높음</Badge>}
        </div>
      )}
      <p className={cn("font-bold tracking-tight text-ink", text)}>{topic.text}</p>
      {topic.optionA && topic.optionB && (
        <div className="mt-4 flex items-stretch gap-2">
          <div className="flex-1 rounded-2xl border border-stance-a/30 bg-stance-a/10 px-3 py-2.5">
            <span className="block text-[0.65rem] font-black tracking-widest text-stance-a">A</span>
            <span className="mt-0.5 block text-[0.85rem] font-bold leading-snug text-ink">{topic.optionA}</span>
          </div>
          <div className="flex-1 rounded-2xl border border-stance-b/30 bg-stance-b/10 px-3 py-2.5">
            <span className="block text-[0.65rem] font-black tracking-widest text-stance-b">B</span>
            <span className="mt-0.5 block text-[0.85rem] font-bold leading-snug text-ink">{topic.optionB}</span>
          </div>
        </div>
      )}
    </div>
  );
}
