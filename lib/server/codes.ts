/** 헷갈리는 글자(0/O, 1/I) 제외 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateCode(len = 6): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

/** 사용자가 친 코드를 알파벳 집합에 맞춰 보정 */
export function coerceCode(input: string): string {
  const up = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  let out = "";
  for (const ch of up) {
    if (ALPHABET.includes(ch)) { out += ch; continue; }
    if (ch === "0") out += "O";
    else if (ch === "1") out += "I";
    else if (ch === "O") out += "O";
    else if (ch === "I") out += "I";
    else out += ch;
  }
  return out.slice(0, 6);
}

export function isValidCode(code: string) {
  return /^[A-Z0-9]{6}$/.test(code);
}
