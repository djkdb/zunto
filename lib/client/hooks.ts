"use client";
import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * 클라이언트에서만 의미가 있는 값을 렌더 중에 안전하게 읽는다.
 * read 는 같은 값을 계속 돌려줘야 한다 (모듈 캐시 등). 매번 새 객체를 만들면 무한 렌더가 난다.
 */
export function useClientValue<T>(read: () => T, serverValue: T): T {
  return useSyncExternalStore(noopSubscribe, read, () => serverValue);
}

export function useIsClient(): boolean {
  return useClientValue(() => true, false);
}

/** 구독 가능한 아주 작은 외부 스토어 */
export function createStore<T>(load: () => T, serverValue: T) {
  let cache: T | null = null;
  let dirty = true;
  const listeners = new Set<() => void>();

  const snapshot = (): T => {
    if (dirty || cache === null) {
      cache = load();
      dirty = false;
    }
    return cache;
  };

  return {
    snapshot,
    /** 저장소를 바꾼 뒤 호출 — 다음 스냅샷부터 새로 읽는다 */
    invalidate() {
      dirty = true;
      for (const fn of listeners) fn();
    },
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
    use(): T {
      return useSyncExternalStore(this.subscribe.bind(this), snapshot, () => serverValue);
    },
  };
}

/** 클라이언트에서 한 번만 뽑고 고정되는 난수 시드 (SSR 에서는 0) */
let seedValue: number | null = null;
const seedListeners = new Set<() => void>();

function getSeed(): number {
  return (seedValue ??= Math.floor(Math.random() * 1e9));
}

export function rerollSeed() {
  seedValue = Math.floor(Math.random() * 1e9);
  for (const fn of seedListeners) fn();
}

export function useRandomSeed(): number {
  return useSyncExternalStore(
    (fn) => { seedListeners.add(fn); return () => { seedListeners.delete(fn); }; },
    getSeed,
    () => 0
  );
}
