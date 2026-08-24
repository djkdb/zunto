"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock3 } from "lucide-react";
import { loadRecentRooms, type RecentRoom } from "@/lib/client/identity";

export function RecentRoomStrip() {
  const [rooms, setRooms] = useState<RecentRoom[]>([]);

  useEffect(() => {
    setRooms(loadRecentRooms().filter((r) => Date.now() - r.at < 1000 * 60 * 60 * 8));
  }, []);

  if (!rooms.length) return null;

  return (
    <section className="mt-5 animate-fade">
      <div className="mb-2 flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-wider text-ink-faint">
        <Clock3 size={12} /> 최근 방
      </div>
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {rooms.map((r) => (
          <Link
            key={r.code}
            href={`/room/${r.code}`}
            className="shrink-0 rounded-2xl border border-night-700 bg-night-850 px-4 py-2.5 transition-colors active:bg-night-800"
          >
            <span className="block font-mono text-sm font-bold tracking-widest text-accent-soft">
              {r.code}
            </span>
            <span className="block max-w-32 truncate text-[0.7rem] text-ink-mute">{r.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
