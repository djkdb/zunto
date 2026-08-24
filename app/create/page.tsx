"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/brand/page-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, Segmented, ToggleRow } from "@/components/ui/segmented";
import { AvatarPicker } from "@/components/room/avatar-picker";
import {
  CATEGORIES, CATEGORY_META, DEFAULT_SETTINGS, VIBES, VIBE_META,
  type Category, type RoomSettings, type Vibe,
} from "@/lib/game/types";
import { loadIdentity, rememberRoom, saveIdentity } from "@/lib/client/identity";
import { unlock } from "@/lib/client/sound";
import { cn } from "@/lib/utils";

export default function CreatePage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState("🦊");
  const [advanced, setAdvanced] = useState(false);
  const [s, setS] = useState<RoomSettings>({ ...DEFAULT_SETTINGS });

  useEffect(() => {
    const id = loadIdentity();
    setNickname(id.nickname);
    if (id.avatar) setAvatar(id.avatar);
  }, []);

  const set = <K extends keyof RoomSettings>(k: K, v: RoomSettings[K]) =>
    setS((prev) => ({ ...prev, [k]: v }));

  const estimate = useMemo(() => {
    const perRound = 60 + (s.speechMs / 1000) * Math.min(s.maxPlayers, 5) * 1.7;
    const mins = Math.round((perRound * s.totalRounds) / 60);
    return `약 ${mins}분`;
  }, [s.speechMs, s.totalRounds, s.maxPlayers]);

  async function create() {
    const nick = nickname.trim();
    if (!nick) { toast.error("닉네임을 입력해 주세요"); return; }
    if (busy) return;
    setBusy(true);
    void unlock();
    try {
      const id = loadIdentity();
      saveIdentity({ nickname: nick, avatar });
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: s }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "방을 만들지 못했습니다");

      const joined = await fetch(`/api/rooms/${data.code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: id.playerId, nickname: nick, avatar }),
      }).then((r) => r.json());
      if (!joined.ok) throw new Error(joined.message ?? "입장하지 못했습니다");

      rememberRoom(data.code, s.name);
      router.push(`/room/${data.code}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "방을 만들지 못했습니다");
      setBusy(false);
    }
  }

  return (
    <PageShell title="방 만들기" back="/">
      <div className="space-y-6 pb-28">
        <Field label="내 닉네임" hint="최대 12자">
          <Input
            value={nickname}
            onChange={(e) => setNickname(e.target.value.slice(0, 12))}
            placeholder="친구들이 부르는 이름"
            maxLength={12}
            autoComplete="off"
          />
          <AvatarPicker value={avatar} onChange={setAvatar} />
        </Field>

        <Field label="방 이름">
          <Input
            value={s.name}
            onChange={(e) => set("name", e.target.value.slice(0, 24))}
            placeholder="예: 제주도 3일차"
            maxLength={24}
          />
        </Field>

        <Field label="인원" hint="4명이 제일 재밌습니다">
          <Segmented
            columns={7}
            size="sm"
            value={s.maxPlayers}
            onChange={(v) => set("maxPlayers", v)}
            options={[2, 3, 4, 5, 6, 7, 8].map((n) => ({ value: n, label: String(n) }))}
          />
        </Field>

        <Field label="오늘 분위기">
          <Segmented
            columns={3}
            value={s.vibe}
            onChange={(v) => set("vibe", v as Vibe)}
            options={VIBES.map((v) => ({
              value: v,
              label: VIBE_META[v].ko,
              emoji: VIBE_META[v].emoji,
            }))}
          />
          <p className="text-[0.74rem] leading-snug text-ink-faint">{VIBE_META[s.vibe].desc}</p>
        </Field>

        <Field label="라운드 수" hint={estimate}>
          <Segmented
            columns={5}
            size="sm"
            value={s.totalRounds}
            onChange={(v) => set("totalRounds", v)}
            options={[3, 5, 7, 9, 12].map((n) => ({ value: n, label: `${n}` }))}
          />
        </Field>

        <Field label="발언 시간">
          <Segmented
            columns={4}
            size="sm"
            value={s.speechMs}
            onChange={(v) => set("speechMs", v)}
            options={[30_000, 60_000, 90_000, 120_000].map((ms) => ({
              value: ms,
              label: `${ms / 1000}초`,
            }))}
          />
        </Field>

        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          className="flex w-full items-center justify-between rounded-2xl border border-night-700 bg-night-850/60 px-4 py-3 text-left"
        >
          <span className="text-[0.85rem] font-bold text-ink-dim">세부 설정</span>
          <span className={cn("text-ink-faint transition-transform", advanced && "rotate-90")}>›</span>
        </button>

        {advanced && (
          <div className="animate-rise space-y-6 rounded-3xl border border-night-700 bg-night-850/40 p-4">
            <Field label="주제 카테고리" hint={s.categories.length ? `${s.categories.length}개 선택` : "전체"}>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map((c) => {
                  const on = s.categories.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() =>
                        set(
                          "categories",
                          (on ? s.categories.filter((x) => x !== c) : [...s.categories, c]) as Category[]
                        )
                      }
                      className={cn(
                        "rounded-2xl border px-2 py-2.5 text-center transition-all active:scale-[0.97]",
                        on ? "border-accent bg-accent/15" : "border-night-600 bg-night-800/60"
                      )}
                    >
                      <span className="block text-lg leading-none">{CATEGORY_META[c].emoji}</span>
                      <span className={cn("mt-1 block text-[0.75rem] font-bold", on ? "text-ink" : "text-ink-mute")}>
                        {CATEGORY_META[c].ko}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="난이도" hint={["가볍게", "말랑", "보통", "진지", "빡세게"][s.difficulty - 1]}>
              <Segmented
                columns={5}
                size="sm"
                value={s.difficulty}
                onChange={(v) => set("difficulty", v as RoomSettings["difficulty"])}
                options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: "●".repeat(n) }))}
              />
            </Field>

            <Field label="모드 선택 방식">
              <Segmented
                columns={2}
                size="sm"
                value={s.modePolicy}
                onChange={(v) => set("modePolicy", v)}
                options={[
                  { value: "HOST", label: "방장이 고름" },
                  { value: "RANDOM", label: "앱이 고름" },
                ]}
              />
            </Field>

            <Field label="주제 선택 방식">
              <Segmented
                columns={3}
                size="sm"
                value={s.topicPolicy}
                onChange={(v) => set("topicPolicy", v)}
                options={[
                  { value: "HOST", label: "방장이" },
                  { value: "VOTE", label: "다 같이" },
                  { value: "RANDOM", label: "랜덤" },
                ]}
              />
            </Field>

            <Field label="라운드 평가">
              <Segmented
                columns={3}
                size="sm"
                value={s.peerRating}
                onChange={(v) => set("peerRating", v)}
                options={[
                  { value: "QUICK", label: "빠르게", sub: "한 번 탭" },
                  { value: "DETAILED", label: "자세히", sub: "5개 항목" },
                  { value: "OFF", label: "안 함" },
                ]}
              />
            </Field>

            <div className="space-y-2">
              <ToggleRow
                emoji="🎲"
                label="랜덤 이벤트"
                desc="토론 중간에 판을 뒤집는 이벤트가 등장합니다"
                checked={s.randomEvents}
                onChange={(v) => set("randomEvents", v)}
              />
              <ToggleRow
                emoji="🕵️"
                label="비밀 미션"
                desc="매 라운드 한 명에게 몰래 미션이 주어집니다"
                checked={s.secretMissions}
                onChange={(v) => set("secretMissions", v)}
              />
            </div>
          </div>
        )}
      </div>

      <div className="safe-b fixed inset-x-0 bottom-0 z-20 border-t border-night-800 bg-night-950/85 px-4 pt-3 backdrop-blur-xl">
        <div className="mx-auto max-w-lg">
          <Button size="xl" block onClick={create} disabled={busy || !nickname.trim()}>
            {busy ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={19} />}
            {busy ? "방 만드는 중" : "방 만들기"}
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
