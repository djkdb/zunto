import Link from "next/link";
import { PageShell } from "@/components/brand/page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AWARD_META, AWARDS, CATEGORIES, CATEGORY_META, MODES, MODE_META,
  REBUTTAL_META, VIBES, VIBE_META,
} from "@/lib/game/types";
import { TITLES } from "@/lib/game/titles";
import { TOPIC_COUNT } from "@/lib/data/topics";

const FLOW = [
  { ko: "입장 선택", desc: "A/B 또는 찬반. 남의 선택은 안 보입니다", t: "10~20초" },
  { ko: "생각할 시간", desc: "뭘 말할지 정리하세요", t: "30초" },
  { ko: "주장", desc: "순서대로 자기 입장을 방어합니다", t: "설정한 시간" },
  { ko: "반박", desc: "반박 방식을 고르고 앞사람을 칩니다", t: "30초" },
  { ko: "최종 주장", desc: "마지막 한 마디", t: "20초" },
  { ko: "익명 투표", desc: "지금 진짜 생각 + 최고의 설득가", t: "25초" },
  { ko: "결과 공개", desc: "승자 · 의견 변화 · 어워드", t: "—" },
];

export default function RulesPage() {
  return (
    <PageShell title="토론 규칙" back="/">
      <div className="space-y-8 pb-10">
        <section>
          <h2 className="text-xl font-black tracking-tight">30초 요약</h2>
          <ol className="mt-3 space-y-2">
            {[
              "한 명이 방을 만들고 6자리 코드를 공유합니다",
              "친구들이 코드나 링크로 들어옵니다",
              "방장이 시작을 누르면 앱이 사회를 봅니다",
              "화면에 나오는 대로만 하면 됩니다. 진행자는 필요 없습니다",
            ].map((t, i) => (
              <li key={i} className="flex gap-3 rounded-2xl border border-night-700 bg-night-850/50 px-4 py-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/15 font-mono text-[0.72rem] font-black text-accent">
                  {i + 1}
                </span>
                <span className="text-[0.88rem] leading-snug text-ink-dim">{t}</span>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="text-xl font-black tracking-tight">한 라운드의 흐름</h2>
          <div className="mt-3 space-y-1.5">
            {FLOW.map((f, i) => (
              <div
                key={f.ko}
                className="flex items-center gap-3 rounded-2xl border border-night-700 bg-night-850/50 px-4 py-3"
              >
                <span className="w-14 shrink-0 text-[0.6rem] font-black uppercase tracking-wider text-accent-soft">
                  phase {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.9rem] font-bold">{f.ko}</span>
                  <span className="block text-[0.75rem] text-ink-mute">{f.desc}</span>
                </span>
                <span className="shrink-0 font-mono text-[0.72rem] text-ink-faint">{f.t}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[0.78rem] leading-relaxed text-ink-faint">
            모든 시간은 서버 기준으로 흐릅니다. 누구의 화면에서도 같은 숫자가 보이고,
            시간이 끝나면 자동으로 다음 단계로 넘어갑니다.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-black tracking-tight">토론 모드 {MODES.length}종</h2>
          <div className="mt-3 space-y-2">
            {MODES.map((m) => {
              const meta = MODE_META[m];
              return (
                <div key={m} className="rounded-3xl border border-night-700 bg-night-850/50 p-4">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-night-800 text-lg">
                      {meta.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[0.6rem] font-black text-accent-soft">MODE {meta.letter}</span>
                        <span className="text-[0.95rem] font-bold">{meta.ko}</span>
                      </div>
                      <p className="text-[0.78rem] text-ink-mute">{meta.tagline}</p>
                    </div>
                    <Badge>{meta.minPlayers}인+</Badge>
                  </div>
                  <ol className="mt-3 space-y-1 border-t border-night-700 pt-3">
                    {meta.how.map((h, i) => (
                      <li key={i} className="flex gap-2 text-[0.78rem] text-ink-dim">
                        <span className="font-black text-accent">{i + 1}</span>
                        {h}
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-black tracking-tight">반박 방식</h2>
          <p className="mt-1 text-[0.82rem] text-ink-mute">
            반박할 차례가 오면 하나를 고릅니다. 고른 방식대로 30초 발언합니다.
          </p>
          <div className="mt-3 space-y-1.5">
            {Object.entries(REBUTTAL_META).map(([k, v]) => (
              <div key={k} className="flex items-center gap-3 rounded-2xl border border-night-700 bg-night-850/50 px-4 py-2.5">
                <span className="text-lg">{v.emoji}</span>
                <span className="w-20 shrink-0 text-[0.85rem] font-bold">{v.ko}</span>
                <span className="text-[0.78rem] text-ink-mute">{v.hint}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-black tracking-tight">분위기</h2>
          <p className="mt-1 text-[0.82rem] text-ink-mute">
            주제 추천에 쓰입니다. 시간대와 라운드 수도 함께 반영됩니다.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {VIBES.map((v) => (
              <div key={v} className="rounded-2xl border border-night-700 bg-night-850/50 p-3">
                <span className="text-lg">{VIBE_META[v].emoji}</span>
                <span className="mt-1 block text-[0.86rem] font-bold">{VIBE_META[v].ko}</span>
                <span className="block text-[0.72rem] leading-snug text-ink-mute">{VIBE_META[v].desc}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-black tracking-tight">주제 {TOPIC_COUNT}개</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {CATEGORIES.map((c) => (
              <Link
                key={c}
                href={`/topics?category=${c}`}
                className="rounded-2xl border border-night-700 bg-night-850/50 p-3 text-center transition-colors active:bg-night-800"
              >
                <span className="block text-xl">{CATEGORY_META[c].emoji}</span>
                <span className="mt-1 block text-[0.8rem] font-bold">{CATEGORY_META[c].ko}</span>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-black tracking-tight">점수와 칭호</h2>
          <div className="mt-3 rounded-3xl border border-night-700 bg-night-850/50 p-4">
            <p className="text-[0.75rem] font-bold uppercase tracking-wider text-ink-mute">점수</p>
            <ul className="mt-2 space-y-1 text-[0.82rem] text-ink-dim">
              <li>· 이긴 쪽 +3 · MVP +5 · 어워드 +1 · 미션 성공 +3</li>
              <li>· 소수편으로 이기면 언더독 보너스 +2</li>
              <li>· 내 쪽으로 넘어온 사람 1명당 +1</li>
            </ul>
            <p className="mt-4 text-[0.75rem] font-bold uppercase tracking-wider text-ink-mute">
              설득력 점수
            </p>
            <p className="mt-1.5 font-mono text-[0.8rem] text-ink-dim">
              논리 × 0.3 + 설득 × 0.3 + 창의 × 0.2 + 웃음 × 0.2 (+한 방 보너스)
            </p>
            <p className="mt-1.5 text-[0.75rem] text-ink-faint">
              순위표로 스트레스 받지 말라고, 점수보다 칭호를 더 크게 보여줍니다.
            </p>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {AWARDS.map((a) => (
              <Badge key={a}>
                {AWARD_META[a].emoji} {AWARD_META[a].ko}
              </Badge>
            ))}
          </div>

          <div className="mt-3 space-y-1.5">
            {TITLES.map((t) => (
              <div key={t.code} className="flex items-center gap-3 rounded-2xl border border-night-700 bg-night-850/40 px-4 py-2.5">
                <span className="text-lg">{t.emoji}</span>
                <span className="w-24 shrink-0 text-[0.85rem] font-bold">{t.ko}</span>
                <span className="text-[0.75rem] text-ink-mute">{t.desc}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-night-700 bg-night-850/50 p-4">
          <h2 className="text-[0.95rem] font-black">이런 건 알아두세요</h2>
          <ul className="mt-2 space-y-1.5 text-[0.82rem] leading-relaxed text-ink-dim">
            <li>· 새로고침해도 그대로 돌아옵니다. 점수도 유지됩니다.</li>
            <li>· 방장이 나가면 다음 사람에게 자동으로 방장이 넘어갑니다.</li>
            <li>· 발언자가 나가면 기다리지 않고 바로 다음 순서로 갑니다.</li>
            <li>· 게임 중에 들어온 사람은 다음 라운드부터 참여합니다.</li>
            <li>· CHAOS 카테고리는 수위가 있습니다. 상처 줄 것 같으면 건너뛰세요.</li>
          </ul>
        </section>

        <div className="flex gap-2">
          <Button variant="secondary" size="lg" block asChild>
            <Link href="/join">방 참가하기</Link>
          </Button>
          <Button size="lg" block asChild>
            <Link href="/create">방 만들기</Link>
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
