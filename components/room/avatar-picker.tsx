"use client";
import { AVATARS } from "@/lib/game/avatars";
import { cn } from "@/lib/utils";

export function AvatarPicker({
  value, onChange, taken = [],
}: {
  value: string;
  onChange: (v: string) => void;
  taken?: string[];
}) {
  return (
    <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-1">
      {AVATARS.map((a) => {
        const isTaken = taken.includes(a) && a !== value;
        return (
          <button
            key={a}
            type="button"
            disabled={isTaken}
            onClick={() => onChange(a)}
            className={cn(
              "grid h-12 w-12 shrink-0 place-items-center rounded-2xl border text-2xl transition-all",
              a === value
                ? "scale-105 border-accent bg-accent/15"
                : "border-night-700 bg-night-800/60",
              isTaken && "opacity-25"
            )}
            aria-label={`아바타 ${a}`}
            aria-pressed={a === value}
          >
            {a}
          </button>
        );
      })}
    </div>
  );
}
