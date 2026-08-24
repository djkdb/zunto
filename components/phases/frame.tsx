"use client";
import { cn } from "@/lib/utils";
import type { PhaseId } from "@/lib/game/types";

export const PHASE_LABEL: Partial<Record<PhaseId, { step: string; ko: string }>> = {
  POSITION_SELECT: { step: "PHASE 1", ko: "선택" },
  ASSIGN_REVEAL: { step: "PHASE 1", ko: "배정" },
  PREPARATION: { step: "PHASE 2", ko: "생각할 시간" },
  SPEECH: { step: "PHASE 3", ko: "주장" },
  REBUTTAL_PICK: { step: "PHASE 4", ko: "반박 준비" },
  REBUTTAL: { step: "PHASE 4", ko: "반박" },
  FINAL_ARGUMENT: { step: "PHASE 5", ko: "최종 주장" },
  VOTING: { step: "PHASE 6", ko: "투표" },
  REVEAL: { step: "PHASE 6", ko: "공개" },
  RATING: { step: "PHASE 7", ko: "평가" },
  RESULT: { step: "RESULT", ko: "결과" },
};

export function PhaseHeading({
  phase, extra, className,
}: {
  phase: PhaseId;
  extra?: React.ReactNode;
  className?: string;
}) {
  const meta = PHASE_LABEL[phase];
  if (!meta) return null;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="rounded-lg bg-accent/15 px-2 py-1 text-[0.62rem] font-black uppercase tracking-[0.18em] text-accent-soft">
        {meta.step}
      </span>
      <span className="text-[0.82rem] font-bold text-ink-dim">{meta.ko}</span>
      {extra}
    </div>
  );
}

/** 모든 페이즈 화면의 공통 뼈대 */
export function PhaseBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("animate-rise space-y-4", className)}>{children}</div>;
}

/** 화면 하단 고정 액션 영역 */
export function ActionDock({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="safe-b fixed inset-x-0 bottom-0 z-30 border-t border-night-800 bg-night-950/88 px-4 pt-3 backdrop-blur-xl">
      <div className="mx-auto max-w-lg space-y-2">
        {hint && <p className="text-center text-[0.72rem] text-ink-faint">{hint}</p>}
        {children}
      </div>
    </div>
  );
}

/** 내 차례가 아닐 때 보여주는 경청 모드 */
export function ListenMode({ speaker, note }: { speaker: string; note?: string }) {
  return (
    <div className="rounded-3xl border border-night-700 bg-night-850/50 p-6 text-center">
      <div className="mx-auto mb-3 flex h-2 w-16 items-center justify-center gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="w-1.5 rounded-full bg-accent/60"
            style={{
              height: `${6 + (i % 3) * 6}px`,
              animation: `float ${1.1 + i * 0.14}s ease-in-out ${i * 0.09}s infinite`,
            }}
          />
        ))}
      </div>
      <p className="text-[0.7rem] font-black uppercase tracking-[0.25em] text-ink-faint">경청 모드</p>
      <p className="mt-2 text-lg font-bold">{speaker} 님의 발언을 듣는 중</p>
      {note && <p className="mt-1.5 text-[0.8rem] text-ink-mute">{note}</p>}
    </div>
  );
}
