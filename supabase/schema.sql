-- ============================================================================
-- DEBATENIGHT — PostgreSQL / Supabase 스키마
--
-- 적용 방법
--   1) Supabase 프로젝트 → SQL Editor → 이 파일 전체 붙여넣고 Run
--   2) Database → Replication → supabase_realtime 에 rooms 테이블 추가
--      (아래 publication 구문이 자동으로 해준다)
--   3) .env.local 에 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
--      / SUPABASE_SERVICE_ROLE_KEY 를 넣으면 앱이 자동으로 Supabase 모드로 전환된다
-- ============================================================================

create extension if not exists "pgcrypto";

-- ── 익명 사용자 (디바이스 아이덴티티) ────────────────────────────────────
create table if not exists public.users (
  id          uuid primary key default gen_random_uuid(),
  nickname    text not null,
  avatar      text not null default '🦊',
  created_at  timestamptz not null default now()
);

-- ── 방 ───────────────────────────────────────────────────────────────────
-- state(jsonb) 가 게임의 단일 진실 소스. version 으로 낙관적 잠금을 건다.
create table if not exists public.rooms (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  name        text not null default 'DEBATE NIGHT',
  host_id     text,
  status      text not null default 'LOBBY'
                check (status in ('LOBBY', 'PLAYING', 'FINISHED')),
  settings    jsonb not null default '{}'::jsonb,
  state       jsonb not null,
  version     integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists rooms_code_idx        on public.rooms (code);
create index if not exists rooms_updated_at_idx  on public.rooms (updated_at desc);
create index if not exists rooms_status_idx      on public.rooms (status);

-- ── 참가자 (분석/통계용 정규화 테이블) ────────────────────────────────────
create table if not exists public.room_players (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.rooms(id) on delete cascade,
  user_id       text not null,
  nickname      text not null,
  avatar        text not null default '🦊',
  color         text not null default '#7B61FF',
  is_host       boolean not null default false,
  is_connected  boolean not null default true,
  score         integer not null default 0,
  joined_at     timestamptz not null default now(),
  unique (room_id, user_id)
);
create index if not exists room_players_room_idx on public.room_players (room_id);

-- ── 주제 ─────────────────────────────────────────────────────────────────
create table if not exists public.debate_topics (
  id          text primary key,
  text        text not null,
  category    text not null,
  modes       text[] not null default '{}',
  difficulty  smallint not null default 3 check (difficulty between 1 and 5),
  intensity   smallint not null default 2 check (intensity  between 1 and 5),
  option_a    text,
  option_b    text,
  follow_ups  text[] default '{}',
  min_players smallint not null default 2,
  source      text not null default 'builtin',
  tags        text[] default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists topics_category_idx  on public.debate_topics (category);
create index if not exists topics_modes_idx     on public.debate_topics using gin (modes);
create index if not exists topics_intensity_idx on public.debate_topics (intensity, difficulty);

-- ── 세션 / 라운드 ────────────────────────────────────────────────────────
create table if not exists public.debate_sessions (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.rooms(id) on delete cascade,
  total_rounds  smallint not null default 5,
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  summary       jsonb
);
create index if not exists sessions_room_idx on public.debate_sessions (room_id);

create table if not exists public.debate_rounds (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.debate_sessions(id) on delete cascade,
  round_no        smallint not null,
  mode            text not null,
  topic_id        text references public.debate_topics(id) on delete set null,
  topic_snapshot  jsonb not null,
  event_code      text,
  speaking_order  text[] not null default '{}',
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  result          jsonb,
  unique (session_id, round_no)
);
create index if not exists rounds_session_idx on public.debate_rounds (session_id, round_no);

-- ── 발언 ─────────────────────────────────────────────────────────────────
create table if not exists public.speeches (
  id             uuid primary key default gen_random_uuid(),
  round_id       uuid not null references public.debate_rounds(id) on delete cascade,
  user_id        text not null,
  kind           text not null,      -- SPEECH | REBUTTAL | FINAL_ARGUMENT
  rebuttal_type  text,               -- LOGIC | EXPERIENCE | QUESTION | CONCEDE | KNOCKOUT
  target_user_id text,
  quote          text,
  started_at     timestamptz not null default now(),
  duration_ms    integer not null default 0,
  order_no       smallint not null default 0
);
create index if not exists speeches_round_idx on public.speeches (round_id, order_no);

-- ── 투표 ─────────────────────────────────────────────────────────────────
create table if not exists public.votes (
  id          uuid primary key default gen_random_uuid(),
  round_id    uuid not null references public.debate_rounds(id) on delete cascade,
  voter_id    text not null,
  stance      text check (stance in ('A', 'B')),
  mvp_id      text,
  pick_id     text,
  created_at  timestamptz not null default now(),
  unique (round_id, voter_id)
);
create index if not exists votes_round_idx on public.votes (round_id);

-- ── 평가 ─────────────────────────────────────────────────────────────────
create table if not exists public.ratings (
  id          uuid primary key default gen_random_uuid(),
  round_id    uuid not null references public.debate_rounds(id) on delete cascade,
  rater_id    text not null,
  ratee_id    text not null,
  logic       smallint not null default 3 check (logic      between 0 and 5),
  persuasion  smallint not null default 3 check (persuasion between 0 and 5),
  creativity  smallint not null default 3 check (creativity between 0 and 5),
  humor       smallint not null default 3 check (humor      between 0 and 5),
  punch       smallint not null default 3 check (punch      between 0 and 5),
  created_at  timestamptz not null default now(),
  unique (round_id, rater_id, ratee_id)
);
create index if not exists ratings_round_idx on public.ratings (round_id);

-- ── 비밀 미션 ────────────────────────────────────────────────────────────
create table if not exists public.missions (
  id         uuid primary key default gen_random_uuid(),
  round_id   uuid not null references public.debate_rounds(id) on delete cascade,
  user_id    text not null,
  code       text not null,
  text       text not null,
  succeeded  boolean,
  unique (round_id, user_id)
);

-- ── 누적 개인 통계 ───────────────────────────────────────────────────────
create table if not exists public.player_stats (
  user_id          text primary key,
  rounds           integer not null default 0,
  wins             integer not null default 0,
  mvp_count        integer not null default 0,
  flips            integer not null default 0,
  picked_count     integer not null default 0,
  avg_logic        numeric(4,2) not null default 0,
  avg_persuasion   numeric(4,2) not null default 0,
  avg_creativity   numeric(4,2) not null default 0,
  avg_humor        numeric(4,2) not null default 0,
  titles           jsonb not null default '[]'::jsonb,
  updated_at       timestamptz not null default now()
);

-- ── updated_at 자동 갱신 ─────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists rooms_touch_updated_at on public.rooms;
create trigger rooms_touch_updated_at
  before update on public.rooms
  for each row execute function public.touch_updated_at();

-- ── 오래된 방 정리 (pg_cron 이 있으면 스케줄에 걸어도 좋다) ────────────────
create or replace function public.gc_stale_rooms()
returns integer language plpgsql as $$
declare removed integer;
begin
  delete from public.rooms where updated_at < now() - interval '12 hours';
  get diagnostics removed = row_count;
  return removed;
end $$;

-- ── Realtime ─────────────────────────────────────────────────────────────
-- 클라이언트는 rooms 행의 UPDATE 를 구독해서 상태를 받는다.
alter table public.rooms replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.rooms;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

-- ── RLS ──────────────────────────────────────────────────────────────────
-- 로그인 없이 코드만으로 들어오는 게임이라, 방은 누구나 읽을 수 있어야 한다.
-- 쓰기는 서버(service role)만 한다. 서비스 롤 키는 절대 클라이언트에 노출하지 말 것.
alter table public.rooms          enable row level security;
alter table public.room_players   enable row level security;
alter table public.debate_topics  enable row level security;
alter table public.debate_sessions enable row level security;
alter table public.debate_rounds  enable row level security;
alter table public.speeches       enable row level security;
alter table public.votes          enable row level security;
alter table public.ratings        enable row level security;
alter table public.missions       enable row level security;
alter table public.player_stats   enable row level security;

drop policy if exists "rooms are readable by anyone" on public.rooms;
create policy "rooms are readable by anyone"
  on public.rooms for select using (true);

drop policy if exists "topics are readable by anyone" on public.debate_topics;
create policy "topics are readable by anyone"
  on public.debate_topics for select using (true);

-- 나머지 테이블은 기본 거부 상태로 두고 service role 로만 접근한다.
