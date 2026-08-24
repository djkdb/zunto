import Link from "next/link";
import {
  BookOpen, Dices, History, LogIn, Play, Shuffle, Users,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { TOPIC_COUNT } from "@/lib/data/topics";
import { RecentRoomStrip } from "@/components/room/recent-room-strip";
import { QuickStartButton } from "@/components/room/quick-start-button";

const SECONDARY = [
  { href: "/join", icon: LogIn, label: "방 참가하기", desc: "코드 6자리 입력" },
  { href: "/topics", icon: Dices, label: "오늘의 랜덤 주제", desc: `${TOPIC_COUNT}개 중에서` },
  { href: "/rules", icon: BookOpen, label: "토론 규칙", desc: "모드 7종 설명" },
  { href: "/history", icon: History, label: "지난 토론 기록", desc: "결과 다시 보기" },
];

export default function Home() {
  return (
    <div className="safe-t safe-b mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-8 pt-10">
      <header className="animate-rise">
        <div className="mb-3 flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.22em] text-ink-faint">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
          party debate game
        </div>
        <Logo size="lg" />
        <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-dim">
          술자리에서 시작해서 새벽까지 가는 토론 게임.
          <br />
          <span className="text-ink-mute">진행자 없이 앱이 사회를 봅니다.</span>
        </p>
      </header>

      <div className="mt-9 animate-rise space-y-3" style={{ animationDelay: "60ms" }}>
        <Link
          href="/create"
          className="group relative flex h-[4.5rem] w-full items-center gap-4 overflow-hidden rounded-3xl bg-accent px-6 text-left shadow-[0_18px_50px_-16px_var(--color-accent)] transition-transform active:scale-[0.98]"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15">
            <Play size={22} className="fill-white text-white" />
          </span>
          <span className="flex-1">
            <span className="block text-lg font-black tracking-tight text-white">토론 시작하기</span>
            <span className="block text-[0.8rem] font-medium text-white/70">방 만들고 친구 초대</span>
          </span>
          <span className="text-2xl text-white/50 transition-transform group-active:translate-x-1">›</span>
        </Link>

        <QuickStartButton />
      </div>

      <RecentRoomStrip />

      <nav className="mt-6 grid animate-rise grid-cols-2 gap-3" style={{ animationDelay: "120ms" }}>
        {SECONDARY.map(({ href, icon: Icon, label, desc }) => (
          <Link
            key={href}
            href={href}
            className="rounded-3xl border border-night-700 bg-night-850/70 p-4 transition-colors active:bg-night-800"
          >
            <Icon size={20} className="mb-3 text-accent-soft" />
            <span className="block text-[0.92rem] font-bold">{label}</span>
            <span className="mt-0.5 block text-[0.75rem] text-ink-mute">{desc}</span>
          </Link>
        ))}
      </nav>

      <div className="flex-1" />

      <footer className="mt-8 animate-fade space-y-3" style={{ animationDelay: "200ms" }}>
        <div className="flex items-center justify-center gap-5 text-[0.72rem] text-ink-faint">
          <span className="flex items-center gap-1.5">
            <Users size={13} /> 2~8명
          </span>
          <span className="flex items-center gap-1.5">
            <Shuffle size={13} /> 모드 7종
          </span>
          <span className="flex items-center gap-1.5">
            <Dices size={13} /> 주제 {TOPIC_COUNT}개
          </span>
        </div>
        <p className="text-center text-[0.7rem] leading-relaxed text-ink-faint">
          한 명이 방을 만들고 코드를 공유하면 끝.
          <br />
          나머지는 앱이 알아서 진행합니다.
        </p>
      </footer>
    </div>
  );
}
