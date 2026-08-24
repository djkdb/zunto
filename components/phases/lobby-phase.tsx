"use client";
import { useState } from "react";
import { Check, Loader2, Play, Settings2, UserMinus, Users } from "lucide-react";
import { toast } from "sonner";
import type { RoomSettings, RoomState } from "@/lib/game/types";
import { VIBE_META, MODE_META } from "@/lib/game/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, Segmented, ToggleRow } from "@/components/ui/segmented";
import { PlayerChip } from "@/components/room/player-chip";
import { RoomCodeCard } from "@/components/room/share-sheet";
import { ActionDock } from "./frame";
import { useRoomStore } from "@/lib/client/room-store";
import { play } from "@/lib/client/sound";

export function LobbyPhase({ state, playerId }: { state: RoomState; playerId: string }) {
  const send = useRoomStore((s) => s.send);
  const [starting, setStarting] = useState(false);
  const isHost = state.hostId === playerId;
  const me = state.players.find((p) => p.id === playerId);
  const connected = state.players.filter((p) => p.connected);
  const readyCount = connected.filter((p) => p.ready || p.isHost).length;
  const canStart = connected.length >= 2;

  async function start() {
    if (!canStart) { toast.error("최소 2명이 필요합니다"); return; }
    setStarting(true);
    play("start");
    await send({ type: "START_GAME", playerId });
    setStarting(false);
  }

  return (
    <>
      <div className="space-y-4 pb-32">
        <RoomCodeCard code={state.code} name={state.settings.name} />

        <section className="rounded-3xl border border-night-700 bg-night-850/60 p-4">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-[0.8rem] font-bold uppercase tracking-wider text-ink-mute">
              <Users size={14} /> 참가자
              <span className="text-accent">
                {connected.length}/{state.settings.maxPlayers}
              </span>
            </h2>
            {isHost && <SettingsDialog state={state} playerId={playerId} />}
          </header>

          <div className="space-y-2">
            {state.players.map((p) => (
              <PlayerChip
                key={p.id}
                player={p}
                isMe={p.id === playerId}
                sub={p.isHost ? "방장" : p.ready ? "준비 완료" : "대기 중"}
                right={
                  <span className="flex items-center gap-1.5">
                    {(p.ready || p.isHost) && (
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-good/15 text-good">
                        <Check size={13} />
                      </span>
                    )}
                    {isHost && p.id !== playerId && (
                      <button
                        onClick={() => send({ type: "KICK", playerId, targetId: p.id })}
                        className="grid h-7 w-7 place-items-center rounded-full text-ink-faint transition-colors active:bg-danger/20 active:text-danger"
                        aria-label={`${p.nickname} 내보내기`}
                      >
                        <UserMinus size={14} />
                      </button>
                    )}
                  </span>
                }
              />
            ))}
            {Array.from({ length: Math.max(0, state.settings.maxPlayers - state.players.length) }).map(
              (_, i) => (
                <div
                  key={`empty-${i}`}
                  className="flex items-center gap-3 rounded-2xl border border-dashed border-night-700 px-3 py-2.5 opacity-50"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-2xl border border-night-700 text-ink-faint">
                    ?
                  </div>
                  <span className="text-[0.85rem] text-ink-faint">친구를 기다리는 중</span>
                </div>
              )
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-night-700 bg-night-850/40 p-4">
          <h2 className="mb-3 text-[0.8rem] font-bold uppercase tracking-wider text-ink-mute">
            오늘의 설정
          </h2>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="accent">
              {VIBE_META[state.settings.vibe].emoji} {VIBE_META[state.settings.vibe].ko}
            </Badge>
            <Badge>{state.settings.totalRounds}라운드</Badge>
            <Badge>발언 {state.settings.speechMs / 1000}초</Badge>
            <Badge>
              {state.settings.modePolicy === "HOST" ? "방장이 모드 선택" : "모드 자동"}
            </Badge>
            <Badge>
              {state.settings.topicPolicy === "HOST"
                ? "방장이 주제 선택"
                : state.settings.topicPolicy === "VOTE"
                  ? "주제 투표"
                  : "주제 랜덤"}
            </Badge>
            {state.settings.randomEvents && <Badge variant="danger">🎲 랜덤 이벤트</Badge>}
            {state.settings.secretMissions && <Badge variant="warn">🕵️ 비밀 미션</Badge>}
            {state.settings.categories.length > 0 && (
              <Badge>카테고리 {state.settings.categories.length}개</Badge>
            )}
          </div>
          <p className="mt-3 text-[0.75rem] leading-relaxed text-ink-faint">
            진행자는 필요 없습니다. 시작하면 앱이 순서와 시간을 전부 알려줍니다.
          </p>
        </section>
      </div>

      <ActionDock
        hint={
          isHost
            ? canStart
              ? `${connected.length}명 · 준비 ${readyCount}명`
              : "친구가 최소 1명 더 들어와야 시작할 수 있습니다"
            : me?.ready
              ? "방장이 시작하기를 기다리는 중"
              : "준비되면 아래 버튼을 누르세요"
        }
      >
        {isHost ? (
          <Button size="xl" block onClick={start} disabled={!canStart || starting}>
            {starting ? <Loader2 size={20} className="animate-spin" /> : <Play size={19} className="fill-current" />}
            토론 시작하기
          </Button>
        ) : (
          <Button
            size="xl"
            block
            variant={me?.ready ? "good" : "primary"}
            onClick={() => {
              play("join");
              void send({ type: "SET_READY", playerId, ready: !me?.ready });
            }}
          >
            {me?.ready ? <><Check size={19} /> 준비 완료</> : "준비하기"}
          </Button>
        )}
      </ActionDock>
    </>
  );
}

function SettingsDialog({ state, playerId }: { state: RoomState; playerId: string }) {
  const send = useRoomStore((s) => s.send);
  const [draft, setDraft] = useState<RoomSettings>(state.settings);

  const set = <K extends keyof RoomSettings>(k: K, v: RoomSettings[K]) =>
    setDraft((p) => ({ ...p, [k]: v }));

  return (
    <Dialog onOpenChange={(o) => o && setDraft(state.settings)}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Settings2 size={15} /> 설정
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="text-lg font-black">방 설정</DialogTitle>
        <div className="mt-5 space-y-5">
          <Field label="인원">
            <Segmented
              columns={7}
              size="sm"
              value={draft.maxPlayers}
              onChange={(v) => set("maxPlayers", v)}
              options={[2, 3, 4, 5, 6, 7, 8].map((n) => ({ value: n, label: String(n) }))}
            />
          </Field>
          <Field label="라운드">
            <Segmented
              columns={5}
              size="sm"
              value={draft.totalRounds}
              onChange={(v) => set("totalRounds", v)}
              options={[3, 5, 7, 9, 12].map((n) => ({ value: n, label: String(n) }))}
            />
          </Field>
          <Field label="발언 시간">
            <Segmented
              columns={4}
              size="sm"
              value={draft.speechMs}
              onChange={(v) => set("speechMs", v)}
              options={[30_000, 60_000, 90_000, 120_000].map((ms) => ({
                value: ms, label: `${ms / 1000}초`,
              }))}
            />
          </Field>
          <Field label="주제 선택 방식">
            <Segmented
              columns={3}
              size="sm"
              value={draft.topicPolicy}
              onChange={(v) => set("topicPolicy", v)}
              options={[
                { value: "HOST", label: "방장이" },
                { value: "VOTE", label: "다 같이" },
                { value: "RANDOM", label: "랜덤" },
              ]}
            />
          </Field>
          <Field label="모드 선택 방식">
            <Segmented
              columns={2}
              size="sm"
              value={draft.modePolicy}
              onChange={(v) => set("modePolicy", v)}
              options={[
                { value: "HOST", label: "방장이 고름" },
                { value: "RANDOM", label: "앱이 고름" },
              ]}
            />
          </Field>
          <ToggleRow
            emoji="🎲" label="랜덤 이벤트" desc="판을 뒤집는 이벤트"
            checked={draft.randomEvents} onChange={(v) => set("randomEvents", v)}
          />
          <ToggleRow
            emoji="🕵️" label="비밀 미션" desc="한 명에게 몰래 미션"
            checked={draft.secretMissions} onChange={(v) => set("secretMissions", v)}
          />
          <Button
            block
            size="lg"
            onClick={() => {
              void send({ type: "UPDATE_SETTINGS", playerId, settings: draft });
              toast.success("설정을 저장했습니다");
            }}
          >
            저장하기
          </Button>
          <p className="text-center text-[0.7rem] text-ink-faint">
            사용 가능한 모드: {Object.values(MODE_META).filter((m) => m.minPlayers <= draft.maxPlayers).length}종
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
