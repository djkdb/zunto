"use client";
import { useRef } from "react";
import { coerceCode } from "@/lib/server/codes";
import { cn } from "@/lib/utils";

/** 6칸 코드 입력 — 실제 입력은 숨은 input 하나가 받는다 (모바일에서 가장 안정적) */
export function CodeInput({
  value, onChange, onComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const chars = value.padEnd(6, " ").slice(0, 6).split("");

  return (
    <div className="relative" onClick={() => ref.current?.focus()}>
      <input
        ref={ref}
        value={value}
        onChange={(e) => {
          const next = coerceCode(e.target.value);
          onChange(next);
          if (next.length === 6) onComplete?.();
        }}
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={6}
        aria-label="방 코드"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
      <div className="pointer-events-none grid grid-cols-6 gap-1.5">
        {chars.map((c, i) => (
          <div
            key={i}
            className={cn(
              "grid h-14 place-items-center rounded-2xl border font-mono text-2xl font-black tracking-wider transition-colors",
              c.trim()
                ? "border-accent/60 bg-accent/10 text-ink"
                : i === value.length
                  ? "border-accent/50 bg-night-800 text-ink-faint"
                  : "border-night-600 bg-night-800/60 text-ink-faint"
            )}
          >
            {c.trim() || "·"}
          </div>
        ))}
      </div>
    </div>
  );
}
