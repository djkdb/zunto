"use client";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageShell({
  children,
  title,
  back = "/",
  right,
  className,
  wide,
}: {
  children: React.ReactNode;
  title?: string;
  back?: string | null;
  right?: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div className="min-h-dvh">
      {(title || back) && (
        <header className="safe-t sticky top-0 z-30 border-b border-night-800/80 bg-night-950/70 backdrop-blur-xl">
          <div className={cn("mx-auto flex h-14 items-center gap-2 px-4", wide ? "max-w-3xl" : "max-w-lg")}>
            {back ? (
              <Link
                href={back}
                className="-ml-2 grid h-10 w-10 place-items-center rounded-full text-ink-dim transition-colors hover:bg-night-800 hover:text-ink"
                aria-label="뒤로"
              >
                <ChevronLeft size={22} />
              </Link>
            ) : (
              <span className="w-2" />
            )}
            <h1 className="flex-1 truncate text-[0.95rem] font-bold">{title}</h1>
            {right}
          </div>
        </header>
      )}
      <main className={cn("safe-b mx-auto px-4 pb-10 pt-5", wide ? "max-w-3xl" : "max-w-lg", className)}>
        {children}
      </main>
    </div>
  );
}
