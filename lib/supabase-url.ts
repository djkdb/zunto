/**
 * Supabase 프로젝트 주소를 정규화한다.
 *
 * 대시보드가 "Project URL" 과 "RESTful endpoint"(.../rest/v1/) 를 나란히 보여줘서
 * 뒤엣것을 복사해 넣는 실수가 잦다. 그대로 두면 클라이언트가 /rest/v1 을 한 번 더
 * 붙여서 PGRST125 (Invalid path specified in request URL) 가 난다.
 *
 * 서버와 브라우저가 같은 값을 써야 하므로 (브라우저는 Realtime 웹소켓 주소를
 * 여기서 만든다) 양쪽이 이 함수를 공유한다.
 */
export function normalizeSupabaseUrl(raw: string | undefined | null): string {
  if (!raw) return "";
  return raw
    .trim()
    .replace(/[\u200B-\u200F\uFEFF\u00A0]/g, "")  // 붙여넣기에 딸려오는 제로폭·NBSP
    .replace(/\/+$/, "")                      // 끝의 슬래시
    .replace(/\/rest\/v1$/i, "")              // .../rest/v1 → 프로젝트 주소
    .replace(/\/+$/, "");
}

/** 정규화하면서 뭔가 바뀌었다면 그 이유를 알려준다 (진단용) */
export function explainSupabaseUrl(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const normalized = normalizeSupabaseUrl(raw);
  if (normalized === raw) return null;
  if (/\/rest\/v1\/?$/i.test(raw.trim())) {
    return (
      "Project URL 이 아니라 RESTful endpoint 를 넣으셨습니다. " +
      `앱이 ${normalized} 로 고쳐서 쓰고 있지만, 값을 바로잡아 두는 편이 좋습니다.`
    );
  }
  return `앞뒤 공백이나 슬래시를 정리해서 ${normalized} 로 씁니다.`;
}
