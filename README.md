# DEBATENIGHT 🎙️

> 술자리에서 시작해서 새벽까지 가는 토론 게임

친구 2~8명이 방 하나 만들어서 시작하는 **실시간 토론 파티 게임**.
진행자가 필요 없습니다. 앱이 순서, 시간, 규칙을 전부 알려줍니다.

```
방 생성 → 코드 공유 → 모드 선택 → 주제 선택 → 입장 선택 → 준비 시간
→ 주장 → 반박 → 최종 주장 → 익명 투표 → 결과 공개 → 다음 라운드 → 최종 결과
```

---

## 바로 해보기

```bash
npm install
npm run dev
```

`http://localhost:3000` 접속 → **토론 시작하기** → 나온 6자리 코드를 친구에게 전달.
같은 와이파이라면 `http://<내 로컬 IP>:3000` 으로 친구 폰에서 바로 들어올 수 있습니다.

> 환경 변수 없이도 완전히 동작합니다 (인메모리 + SSE).
> 서버를 재시작하면 방이 사라지고, 서버리스 배포에서는 동작하지 않습니다. → [배포](#배포)

---

## 무엇이 들어 있나

| | |
|---|---|
| 토론 모드 | 7종 (밸런스 · 찬반 · 한 명 설득 · 지목 · 소수 의견 · 변론 게임 · 친구 평가) |
| 주제 | 403개 · 9개 카테고리 (돈/연애/우정/인생/밸런스/여행/일/심연/카오스) |
| 추천 | 인원 · 분위기 · 시간대 · 라운드 · 직전 재미도를 반영한 가중치 추천 |
| 랜덤 이벤트 | 6종 (악마의 변호인 · 더블 타임 · 한 문장 · 타겟 지정 · 침묵 · 주제 전환) |
| 비밀 미션 | 15종 · 라운드마다 한 명에게만 |
| 칭호 | 14종 · 최종 결과에서 부여 |
| 결과 공유 | PNG 카드 생성 → 시스템 공유 시트 / 다운로드 |
| 참가 | 6자리 코드 · 초대 링크 · QR |

---

## 실행 스크립트

```bash
npm run dev        # 개발 서버
npm run build      # 프로덕션 빌드
npm run typecheck  # 타입 검사
npm run simulate   # 게임 엔진 헤드리스 시뮬레이션 (39개 시나리오)
npm run bots -- <ROOM_CODE> [봇수] [--auto-start]   # 실제 API 로 봇 참가시키기
```

`npm run simulate` 은 2~8명 · 모드 7종 · 이탈/새로고침/호스트 위임/중복 닉네임 등
예외 상황까지 전부 돌려봅니다. 게임 로직을 고쳤다면 이걸 먼저 통과시키세요.

혼자서 UI 를 테스트하려면 브라우저로 방을 만든 뒤:

```bash
npm run bots -- A7K92P 3
```

---

## 아키텍처

**서버가 유일한 권위입니다.** 클라이언트는 액션만 보내고 스냅샷을 렌더합니다.

```
클라이언트 ──POST /api/rooms/[code]/action──▶ reduce(state, action, now) ──▶ 저장 ──▶ 방송
     ▲                                                                              │
     └──────────── SSE 또는 Supabase Realtime ◀───────────────────────────────────────┘
```

- **상태 머신** — 라운드 시작 시 `Step[]` 을 통째로 계산합니다. 전이 = `stepIndex + 1`.
  모드별 흐름이 데이터가 되므로 상태 머신 자체는 단순합니다. (`lib/game/steps.ts`)
- **타이머** — 서버가 `phaseEndsAt`(epoch ms)을 정하고, 클라이언트는 클럭 오프셋을
  중앙값으로 보정해서 씁니다. 모든 참가자가 **같은 숫자**를 봅니다. (`lib/client/clock.ts`)
- **전이 경합 방지** — 모든 전이 액션은 단조 증가하는 `phaseToken` 을 동봉합니다.
  토큰이 다르면 무시되므로 중복 전이가 발생하지 않습니다.
- **타이머 구동 이중화** — ①메모리 모드에서는 서버 `setTimeout` ②모든 클라이언트의
  워치독(만료 후 `TIMEOUT` 전송). 둘 다 멱등이라 어느 쪽이 죽어도 게임이 멈추지 않습니다.

### 폴더 구조

```
app/                라우트 + API
  api/rooms/…       방 생성 · 스냅샷 · 액션 · 참가 · SSE 스트림
  room/[code]/      게임 셸
components/
  ui/               shadcn 스타일 프리미티브
  phases/           페이즈별 화면 (로비 ~ 최종 결과)
  game/ room/       타이머 · 주제 카드 · 결과 · 공유 카드 등
lib/
  game/             types · machine · steps · scoring · events · missions
                    titles · recommend · rng · avatars
  data/topics/      카테고리별 주제 403개
  server/           store(추상) · memory-store · supabase-store · hub(SSE) · room-service
  client/           transport(SSE|Supabase) · room-store(zustand) · clock · sound · identity
  ai/               topic-provider (DB | AI 스텁)
supabase/schema.sql PostgreSQL 스키마
scripts/            시뮬레이터 · 봇
```

### 저장소 어댑터

`lib/server/store.ts` 가 환경 변수를 보고 자동으로 고릅니다.

| 조건 | 저장소 | 실시간 | 용도 |
|---|---|---|---|
| 환경 변수 없음 | 인메모리 | SSE | 로컬 개발 · 같은 와이파이 |
| `NEXT_PUBLIC_SUPABASE_URL` 있음 | Supabase Postgres | Supabase Realtime | 프로덕션 배포 |

---

## 배포

서버리스 환경(Vercel / Cloudflare)에는 **인메모리 저장소가 통하지 않습니다.**
요청마다 다른 인스턴스가 뜨기 때문에 방이 공유되지 않습니다. Supabase 를 먼저 붙이세요.

### 1단계 — Supabase 준비 (공통, 5분)

1. [supabase.com](https://supabase.com) → **New project** (Free 플랜으로 충분합니다).
   Region 은 친구들이 있는 곳과 가까운 쪽 — 한국이면 `Northeast Asia (Seoul)`.
2. 왼쪽 **SQL Editor → New query** 에 [`supabase/schema.sql`](supabase/schema.sql)
   **전체**를 붙여넣고 **Run**. `Success. No rows returned` 이면 정상입니다.
   이 스크립트가 테이블 · 인덱스 · RLS 정책 · Realtime publication 까지 전부 만듭니다.
3. Realtime 이 붙었는지 확인합니다. **SQL Editor** 에서:

   ```sql
   select schemaname, tablename
     from pg_publication_tables
    where pubname = 'supabase_realtime';
   ```

   `public | rooms` 가 나오면 정상입니다. 대시보드에서 보려면
   **Database → Publications → supabase_realtime** 입니다.
   (**Database → Replication** 은 외부로 데이터를 내보내는 다른 기능이라 여기가 아닙니다.)
4. **Project Settings → API Keys** 에서 값 3개를 복사합니다.

| 이름 | 어디서 | 쓰이는 곳 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Project URL** | 브라우저 + 서버 (빌드 시점 인라인) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / public | 브라우저 Realtime 구독 |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role (**secret**) | 서버 전용 쓰기 |

```bash
cp .env.example .env.local
# 위 3개를 채운다
```

`SUPABASE_SERVICE_ROLE_KEY` 는 서버 전용입니다. `NEXT_PUBLIC_` 접두사를 붙이지 마세요 —
붙이면 브라우저 번들에 들어가서 누구나 DB 를 쓸 수 있게 됩니다.

> **URL 은 `Project URL` 을 복사하세요.** 대시보드가 바로 옆에 보여주는
> `RESTful endpoint` (`https://xxxx.supabase.co/rest/v1/`) 를 넣으면
> 클라이언트가 `/rest/v1` 을 한 번 더 붙여서 `PGRST125 Invalid path specified in
> request URL` 로 방 생성이 실패합니다. 앱이 알아서 잘라내긴 하지만
> `/api/health` 가 경고를 띄우니 값을 바로잡아 두세요.

제대로 붙었는지는 로컬에서 바로 확인할 수 있습니다.

```bash
npm run dev
curl localhost:3000/api/health
# { "ok": true, "store": "supabase", "realtime": "supabase", "hasServiceRole": true }
```

### 2단계 — 배포

<details>
<summary><b>Vercel</b></summary>

```bash
npx vercel
npx vercel --prod
```

또는 GitHub 저장소를 Vercel 에 연결하면 push 마다 자동 배포됩니다.
**Project Settings → Environment Variables** 에 위 3개를 넣으세요.
</details>

<details open>
<summary><b>Cloudflare 대시보드에서 바로</b> (Workers Builds · 제일 간단)</summary>

로컬에 아무것도 깔지 않고, API 토큰도 만들 필요 없이 Cloudflare 가 직접 GitHub 를
읽어서 빌드·배포합니다. push 하면 자동으로 다시 배포됩니다.

1. **Workers & Pages → Create → Import a repository** 에서 GitHub 계정을 연결하고
   이 저장소를 고릅니다.
2. 빌드 설정을 이렇게 넣습니다.

   | 항목 | 값 |
   |---|---|
   | Build command | `npm run build:cf` |
   | Deploy command | `npx wrangler deploy` |
   | Production branch | 배포할 브랜치 (보통 `main`) |

3. 환경 변수를 넣습니다. **어디에 넣느냐가 값보다 중요합니다.** 아래 표를 지키세요.

   | 변수 | 넣는 곳 | 이유 |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | **빌드** 환경 변수 | 빌드 때 번들에 리터럴로 박힌다 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **빌드** 환경 변수 | 〃 |
   | `SUPABASE_SERVICE_ROLE_KEY` | **런타임 Secret** | 서버 전용. 번들에 들어가면 안 된다 |

   `NEXT_PUBLIC_*` 는 빌드 변수에만 넣으면 됩니다. 빌드 때 브라우저 번들과 서버 번들
   양쪽에 값이 박히기 때문에 런타임 변수로 또 넣을 필요가 없습니다.

4. 첫 배포가 끝나면 **워커 → Settings → Variables and Secrets** 에서
   `SUPABASE_SERVICE_ROLE_KEY` 를 **Secret** 으로 추가하고 한 번 더 배포합니다.
   (`wrangler secret put` 과 마찬가지로 워커가 만들어진 뒤에야 넣을 수 있습니다.)

5. `https://<워커>.<계정>.workers.dev/api/health` 로 확인합니다.

> **`NEXT_PUBLIC_*` 를 런타임 변수에만 넣으면 조용히 깨집니다.**
> 서버는 런타임 값을 읽어서 Supabase 를 쓰는데, 브라우저 번들에는 값이 없어서
> 실시간 연결이 SSE 로 떨어집니다. Cloudflare 는 요청마다 다른 인스턴스가 뜨므로
> SSE 브로드캐스트가 참가자에게 닿지 않습니다. **방은 만들어지는데 아무도 서로의
> 화면을 못 봅니다.** `/api/health` 의 `browserHasSupabase` 가 이 경우를 잡아줍니다.

</details>

<details>
<summary><b>Cloudflare Workers</b> (내 컴퓨터에서 wrangler 로)</summary>

`NEXT_PUBLIC_*` 는 **빌드 시점에 번들로 인라인**됩니다. `npm run deploy:cf` 는 빌드까지 하므로
배포를 실행하는 머신(또는 CI)에 `.env.local` 이나 환경 변수로 두 값이 반드시 있어야 합니다.

```bash
# 0) 인증 — 브라우저 로그인
npx wrangler login
#    CI/원격이라 브라우저를 못 열면 API 토큰을 쓴다
#    export CLOUDFLARE_API_TOKEN=...   CLOUDFLARE_ACCOUNT_ID=...

# 1) 첫 배포 (워커가 만들어진다)
npm run deploy:cf

# 2) 서버 전용 키를 시크릿으로 (워커가 있어야 넣을 수 있다)
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY

# 3) 시크릿을 반영해서 한 번 더
npm run deploy:cf
```

API 토큰을 쓴다면 다음 권한이 필요합니다.

| 범위 | 권한 |
|---|---|
| Account | Workers Scripts — **Edit** |
| Account | Account Settings — **Read** |
| User | User Details — **Read** |
| Zone | Workers Routes — Edit *(커스텀 도메인을 붙일 때만)* |

**배포 직후 반드시 확인하세요.**

```bash
curl https://debatenight.<계정>.workers.dev/api/health
# { "ok": true, "mode": "production", "store": "supabase",
#   "realtime": "supabase", "browserHasSupabase": true, "hasServiceRole": true }
```

| 필드 | 뜻 | false 면 |
|---|---|---|
| `store` | 서버가 쓰는 저장소 | `memory` = 방이 인스턴스마다 따로 논다 |
| `browserHasSupabase` | 브라우저 번들에 값이 박혔는가 | `NEXT_PUBLIC_*` 를 빌드 변수로 안 넣은 것 |
| `hasServiceRole` | 서버 전용 키가 있는가 | RLS 때문에 방 생성이 실패한다 |

`store` 가 `memory` 로 나오면 Supabase 가 안 붙은 것입니다. 화면은 멀쩡히 뜨지만
**요청마다 다른 인스턴스가 뜨기 때문에 친구가 코드를 넣으면 "그런 방이 없습니다" 가 뜹니다.**
`hasServiceRole` 이 `false` 면 RLS 때문에 방 생성이 실패합니다.

로컬에서 워커 런타임 그대로 미리 보려면:

```bash
npm run preview:cf
```

`wrangler.jsonc` 의 `name` 이 워커 이름이자 기본 도메인이 됩니다
(`debatenight.<계정>.workers.dev`). 커스텀 도메인은 대시보드에서 연결하세요.
</details>

<details>
<summary><b>GitHub Actions</b> (로컬에 아무것도 깔지 않고 배포)</summary>

[`.github/workflows/deploy-cloudflare.yml`](.github/workflows/deploy-cloudflare.yml) 이 들어 있습니다.
저장소 **Settings → Secrets and variables → Actions** 에 5개를 넣고,
**Actions** 탭에서 *Deploy to Cloudflare Workers → Run workflow* 를 누르면 끝입니다.

| 시크릿 | 값 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | 위 표의 권한을 가진 토큰 |
| `CLOUDFLARE_ACCOUNT_ID` | 대시보드 Account ID |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role 키 |

워크플로가 하는 일: 타입 검사 → 린트 → `npm run simulate` (39개 시나리오) →
빌드 & 배포 → service_role 키를 워커 시크릿으로 주입 → `/api/health` 로 배포 확인.
어느 하나라도 실패하면 빨간불이 뜹니다.

기본은 수동 실행입니다. push 마다 자동 배포하려면 워크플로 안의 `push:` 트리거 주석을 푸세요.
</details>

### 3단계 — 친구 초대

배포하면 초대 링크가 그대로 실제 도메인을 가리킵니다.

```
https://<내 도메인>/room/A7K92P
```

- **초대 링크** 버튼 → 카톡/메시지로 바로 공유 (모바일에서는 시스템 공유 시트)
- **QR** 버튼 → 화면에 띄우면 친구가 카메라로 찍고 바로 입장
- 링크로 들어오면 닉네임만 입력하고 끝

---

## 예외 처리

다음 상황에서도 게임이 멈추지 않습니다. 전부 `npm run simulate` 로 검증합니다.

- 새로고침 / 브라우저 종료 → 같은 기기면 점수와 자리를 유지한 채 복귀
- 네트워크 단절 → 지수 백오프로 재연결, 서버 상태를 다시 받아옴
- 발언자가 나감 → 기다리지 않고 즉시 다음 순서
- 방장이 나감 → 다음 접속자에게 자동 위임
- 아무도 선택/투표를 안 함 → 시간 만료 시 자동으로 채우고 진행
- 게임 중 입장 → 다음 라운드부터 참여 (현재 라운드 순서는 건드리지 않음)
- 중복 닉네임 → 자동으로 번호를 붙여 구분
- 없는 방 코드 / 가득 찬 방 / 끝난 방 → 각각 안내 화면

---

## AI 주제 생성

`lib/ai/topic-provider.ts` 가 제공자를 추상화합니다.
기본값은 내장 DB 이고, `TOPIC_AI_ENDPOINT` + `TOPIC_AI_KEY` 를 넣으면 AI 로 전환됩니다.

```
POST /api/topics/generate
{ "prompt": "미국 여행 중인 20대 대학생 4명이 호텔에서 할 토론 주제 10개", "count": 10 }
```

응답 형식: `topic · category · difficulty · intensity · mode · optionA · optionB · followUpQuestions`

---

## 만들 때 세운 원칙

- 토론보다 재미가 먼저다. 정답이 있는 주제는 넣지 않는다.
- 한 라운드가 길어지지 않게 한다 (6명 이상이면 최종 주장을 공동 마무리로 줄인다).
- 점수판으로 스트레스 주지 않는다. 순위보다 칭호를 크게 보여준다.
- 모바일 세로, 한 손 조작. 큰 버튼, 큰 타이머, 최소 입력.
- 어떤 화면에서도 "지금 뭘 해야 하지?" 라는 생각이 들지 않게 한다.

CHAOS 카테고리는 수위가 있지만, 불법 · 혐오 · 성적 강압 · 위험 행위를 조장하는
질문은 넣지 않았습니다.
