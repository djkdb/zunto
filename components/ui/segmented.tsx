"use client";
import { cn } from "@/lib/utils";

export interface SegOption<T extends string | number> {
  value: T;
  label: string;
  sub?: string;
  emoji?: string;
}

export function Segmented<T extends string | number>({
  value, options, onChange, columns, size = "md", className,
}: {
  value: T;
  options: SegOption<T>[];
  onChange: (v: T) => void;
  columns?: number;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      className={cn("grid gap-2", className)}
      style={{ gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0,1fr))` }}
      role="radiogroup"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-2xl border text-center transition-all active:scale-[0.97]",
              size === "sm" ? "px-2 py-2" : "px-3 py-3",
              active
                ? "border-accent bg-accent/15 text-ink shadow-[0_0_0_1px_var(--color-accent)]"
                : "border-night-600 bg-night-800/60 text-ink-mute"
            )}
          >
            {o.emoji && <span className="mb-0.5 block text-lg leading-none">{o.emoji}</span>}
            <span className={cn("block font-bold", size === "sm" ? "text-[0.8rem]" : "text-[0.88rem]")}>
              {o.label}
            </span>
            {o.sub && <span className="mt-0.5 block text-[0.68rem] leading-tight opacity-70">{o.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Field({
  label, hint, children, className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.78rem] font-bold uppercase tracking-wider text-ink-mute">{label}</span>
        {hint && <span className="text-[0.72rem] text-ink-faint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export function ToggleRow({
  label, desc, checked, onChange, emoji,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  emoji?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-2xl border border-night-700 bg-night-850/60 px-4 py-3 text-left transition-colors active:bg-night-800"
    >
      {emoji && <span className="text-lg">{emoji}</span>}
      <span className="flex-1">
        <span className="block text-[0.9rem] font-bold">{label}</span>
        <span className="block text-[0.72rem] leading-snug text-ink-mute">{desc}</span>
      </span>
      <span
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors",
          checked ? "bg-accent" : "bg-night-600"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[1.4rem]" : "translate-x-0.5"
          )}
        />
      </span>
    </button>
  );
}
