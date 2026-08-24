/** 결정적 난수 — 같은 시드면 모든 서버/클라이언트에서 같은 결과 */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type Rand = () => number;

export function pick<T>(arr: readonly T[], rand: Rand): T {
  return arr[Math.floor(rand() * arr.length)];
}

export function shuffle<T>(arr: readonly T[], rand: Rand): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function sampleN<T>(arr: readonly T[], n: number, rand: Rand): T[] {
  return shuffle(arr, rand).slice(0, n);
}

/** 가중치 기반 추첨 */
export function weightedPick<T>(items: readonly T[], weights: number[], rand: Rand): T {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return pick(items, rand);
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}
