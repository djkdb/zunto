import { cn } from "@/lib/utils";

export function Logo({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const scale = { sm: "text-lg", md: "text-2xl", lg: "text-[2.6rem] leading-[1.05]" }[size];
  return (
    <div className={cn("font-black tracking-[-0.04em]", scale, className)}>
      <span className="text-ink">DEBATE</span>
      <span className="text-accent">NIGHT</span>
    </div>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "grid h-11 w-11 place-items-center rounded-2xl bg-accent/15 text-xl ring-1 ring-accent/30",
        className
      )}
      aria-hidden
    >
      🎙️
    </div>
  );
}
