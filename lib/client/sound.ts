"use client";
import { useSyncExternalStore } from "react";

/**
 * 파일 없이 WebAudio 로 만든 아주 얇은 사운드 레이어.
 * 기본값은 조용하게. 사용자가 껐다 켤 수 있다.
 */
export type Sfx =
  | "tick" | "tickUrgent" | "start" | "turn" | "timeUp"
  | "vote" | "reveal" | "win" | "join" | "event";

const KEY = "dn:sound";
let ctx: AudioContext | null = null;
let enabled = true;
const master = 0.22;

const listeners = new Set<() => void>();
let loaded = false;

export function isSoundEnabled() {
  if (typeof window === "undefined") return true;
  if (!loaded) {
    const raw = localStorage.getItem(KEY);
    enabled = raw === null ? true : raw === "1";
    loaded = true;
  }
  return enabled;
}

export function setSoundEnabled(on: boolean) {
  if (enabled === on && loaded) return;
  enabled = on;
  loaded = true;
  if (typeof window !== "undefined") localStorage.setItem(KEY, on ? "1" : "0");
  if (on) void unlock();
  for (const fn of listeners) fn();
}

function subscribeSound(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** 렌더 중에 안전하게 읽는 훅 */
export function useSoundEnabled(): boolean {
  return useSyncExternalStore(subscribeSound, isSoundEnabled, () => true);
}

/** 첫 사용자 제스처에서 호출해야 iOS 에서 소리가 난다 */
export async function unlock() {
  if (typeof window === "undefined") return;
  try {
    ctx ??= new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") await ctx.resume();
  } catch { /* 오디오 없이도 게임은 돌아간다 */ }
}

interface ToneSpec {
  freq: number; dur: number; type?: OscillatorType;
  gain?: number; sweepTo?: number; delay?: number;
}

function tone({ freq, dur, type = "sine", gain = 1, sweepTo, delay = 0 }: ToneSpec) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, master * gain), t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

const RECIPES: Record<Sfx, () => void> = {
  tick:       () => tone({ freq: 880, dur: 0.045, type: "triangle", gain: 0.35 }),
  tickUrgent: () => tone({ freq: 1180, dur: 0.07, type: "square", gain: 0.42 }),
  start: () => {
    tone({ freq: 392, dur: 0.16, type: "triangle" });
    tone({ freq: 587, dur: 0.2, type: "triangle", delay: 0.11 });
    tone({ freq: 784, dur: 0.28, type: "triangle", delay: 0.22 });
  },
  turn: () => {
    tone({ freq: 660, dur: 0.1, type: "sine" });
    tone({ freq: 990, dur: 0.14, type: "sine", delay: 0.07 });
  },
  timeUp: () => {
    tone({ freq: 300, dur: 0.3, type: "sawtooth", gain: 0.5, sweepTo: 120 });
  },
  vote:   () => tone({ freq: 1046, dur: 0.09, type: "sine", gain: 0.5 }),
  reveal: () => {
    tone({ freq: 523, dur: 0.14, type: "triangle" });
    tone({ freq: 698, dur: 0.16, type: "triangle", delay: 0.1 });
    tone({ freq: 880, dur: 0.3, type: "triangle", delay: 0.2 });
  },
  win: () => {
    [523, 659, 784, 1046].forEach((f, i) =>
      tone({ freq: f, dur: 0.34, type: "triangle", delay: i * 0.11, gain: 0.9 })
    );
  },
  join:  () => tone({ freq: 740, dur: 0.09, type: "sine", gain: 0.4 }),
  event: () => {
    tone({ freq: 180, dur: 0.26, type: "sawtooth", gain: 0.5, sweepTo: 520 });
    tone({ freq: 620, dur: 0.18, type: "square", gain: 0.3, delay: 0.2 });
  },
};

export function play(sfx: Sfx) {
  if (typeof window === "undefined") return;
  if (!enabled) return;
  if (!ctx) { void unlock(); }
  if (!ctx || ctx.state !== "running") return;
  try { RECIPES[sfx](); } catch { /* 무시 */ }
}
