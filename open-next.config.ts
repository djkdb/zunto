import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * Cloudflare Workers 배포 설정.
 * 방 상태는 Supabase 에 저장되므로 별도 캐시/큐 설정은 필요 없다.
 */
export default defineCloudflareConfig();
