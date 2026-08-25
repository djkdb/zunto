import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * 빌드 시점에 NEXT_PUBLIC_SUPABASE_* 가 있었는지를 번들에 상수로 박아둔다.
   *
   * 이 값은 webpack DefinePlugin 이 빌드 때 리터럴로 치환하므로 런타임 환경 변수로는
   * 덮어쓸 수 없다. 덕분에 "빌드에는 안 넣고 런타임 변수로만 넣은" 실수를 잡아낼 수 있다.
   * 그 상태에서는 서버만 Supabase 를 쓰고 브라우저는 SSE 로 떨어져서,
   * 방은 만들어지는데 참가자끼리 화면이 갱신되지 않는다. (/api/health 참고)
   */
  env: {
    BUILD_HAS_SUPABASE:
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ? "1"
        : "0",
  },
};

export default nextConfig;
