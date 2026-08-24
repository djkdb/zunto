export const AVATARS = [
  "🦊", "🐻", "🐼", "🐯", "🦁", "🐸", "🐨", "🐺",
  "🦉", "🐙", "🦄", "🐧", "🦖", "🐢", "🦜", "🐿️",
  "👽", "🤖", "🎃", "👻", "🐲", "🦈", "🐝", "🦩",
] as const;

export const PLAYER_COLORS = [
  "#7B61FF", "#4CC9F0", "#FF6B8B", "#3DDC97",
  "#FFC94B", "#FF8F4B", "#B084FF", "#59D3FF",
] as const;

export function avatarForIndex(i: number) {
  return AVATARS[i % AVATARS.length];
}
export function colorForIndex(i: number) {
  return PLAYER_COLORS[i % PLAYER_COLORS.length];
}

/** 이미 쓰인 아바타를 피해서 배정 */
export function nextAvatar(used: string[]): string {
  const free = AVATARS.filter((a) => !used.includes(a));
  const pool: readonly string[] = free.length ? free : AVATARS;
  return pool[Math.floor(Math.random() * pool.length)];
}
export function nextColor(used: string[]): string {
  const free = PLAYER_COLORS.filter((c) => !used.includes(c));
  const pool: readonly string[] = free.length ? free : PLAYER_COLORS;
  return pool[0];
}
