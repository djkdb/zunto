"use client";
import { useEffect, useRef, useState } from "react";
import { Megaphone } from "lucide-react";
import type { Announcement } from "@/lib/game/types";
import { cn } from "@/lib/utils";

const TONE: Record<Announcement["tone"], string> = {
  info: "border-night-600 bg-night-800/80 text-ink-dim",
  action: "border-accent/40 bg-accent/12 text-accent-soft",
  alert: "border-warn/40 bg-warn/12 text-warn",
  celebrate: "border-good/40 bg-good/12 text-good",
};

/**
 * 앱이 사회자 역할을 한다. 지금 뭘 해야 하는지 항상 여기에 뜬다.
 */
export function Announcer({ items }: { items: Announcement[] }) {
  const latest = items[0];
  const [shown, setShown] = useState(latest);
  const ref = useRef<string | null>(null);

  useEffect(() => {
    if (!latest) return;
    if (ref.current === latest.id) return;
    ref.current = latest.id;
    setShown(latest);
  }, [latest]);

  if (!shown) return null;

  return (
    <div
      key={shown.id}
      role="status"
      aria-live="polite"
      className={cn(
        "flex animate-rise items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm font-medium leading-snug",
        TONE[shown.tone]
      )}
    >
      <Megaphone size={16} className="mt-0.5 shrink-0 opacity-80" />
      <span className="flex-1">{shown.text}</span>
    </div>
  );
}
