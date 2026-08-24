"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Home, Loader2, LogOut, Volume2, VolumeX, Wifi, WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import type { RoomState } from "@/lib/game/types";
import { MODE_META } from "@/lib/game/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Announcer } from "@/components/brand/announcer";
import { Logo } from "@/components/brand/logo";
import { AvatarPicker } from "@/components/room/avatar-picker";
import { AVATARS } from "@/lib/game/avatars";
import { TimerBar } from "@/components/game/timer";
import { EventOverlay } from "@/components/game/event-banner";
import { LobbyPhase } from "@/components/phases/lobby-phase";
import { ModeSelectPhase } from "@/components/phases/mode-select-phase";
import { TopicSelectPhase } from "@/components/phases/topic-select-phase";
import { PositionPhase } from "@/components/phases/position-phase";
import { AssignRevealPhase, RevealPhase } from "@/components/phases/reveal-phase";
import { PreparationPhase } from "@/components/phases/preparation-phase";
import { RebuttalPickPhase, SpeechPhase } from "@/components/phases/speech-phase";
import { VotingPhase } from "@/components/phases/voting-phase";
import { RatingPhase } from "@/components/phases/rating-phase";
import { ResultPhase } from "@/components/phases/result-phase";
import { FinishedPhase } from "@/components/phases/finished-phase";
import { useRoomStore } from "@/lib/client/room-store";
import { rememberRoom, saveIdentity, useIdentity } from "@/lib/client/identity";
import { setSoundEnabled, unlock, useSoundEnabled } from "@/lib/client/sound";
import { cn } from "@/lib/utils";

export function RoomClient({ code }: { code: string }) {
  const router = useRouter();
  const { state, status, connect, disconnect, error, setError, everJoined } = useRoomStore();
  const identity = useIdentity();
  const playerId = identity.playerId;
  const sound = useSoundEnabled();

  useEffect(() => {
    if (!playerId) return;
    connect(code, playerId);
    return () => disconnect();
  }, [code, playerId, connect, disconnect]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      setError(null);
    }
  }, [error, setError]);

  useEffect(() => {
    if (state) rememberRoom(state.code, state.settings.name);
  }, [state]);

  // 브라우저를 닫으면 알린다 (best-effort)
  useEffect(() => {
    if (!playerId) return;
    const onHide = () => {
      if (document.visibilityState !== "hidden") return;
      navigator.sendBeacon?.(
        `/api/rooms/${code}/action`,
        new Blob([JSON.stringify({ type: "PING", playerId })], { type: "application/json" })
      );
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [code, playerId]);

  const me = state?.players.find((p) => p.id === playerId);

  if (status === "gone") return <RoomGone code={code} />;

  if (!state) {
    return (
      <div className="grid min-h-dvh place-items-center px-6">
        <div className="text-center">
          <Loader2 size={28} className="mx-auto animate-spin text-accent" />
          <p className="mt-4 font-mono text-lg font-black tracking-[0.2em]">{code}</p>
          <p className="mt-1 text-[0.82rem] text-ink-mute">
            {status === "offline" ? "다시 연결하는 중" : "방에 들어가는 중"}
          </p>
        </div>
      </div>
    );
  }

  if (!me) {
    return everJoined
      ? <RemovedFromRoom code={code} />
      : <JoinGate code={code} state={state} onJoined={(id) => connect(code, id)} />;
  }

  const round = state.round;
  const step = round?.steps[round.stepIndex];
  const heat = Math.min(4, Math.floor(((state.roundNo - 1) / Math.max(1, state.settings.totalRounds)) * 5));

  return (
    <div className="min-h-dvh" data-heat={heat}>
      <EventOverlay event={round?.event} phase={state.phase} />

      <header className="safe-t sticky top-0 z-40 border-b border-night-800/80 bg-night-950/75 backdrop-blur-xl">
        <div className="mx-auto flex h-13 max-w-lg items-center gap-2 px-4">
          <Link href="/" className="shrink-0" aria-label="홈으로">
            <Logo size="sm" />
          </Link>

          <div className="min-w-0 flex-1 text-center">
            {state.status === "LOBBY" ? (
              <p className="truncate text-[0.78rem] font-bold text-ink-dim">{state.settings.name}</p>
            ) : (
              <p className="truncate text-[0.75rem] font-bold text-ink-dim">
                <span className="text-accent">R{state.roundNo}</span>
                <span className="text-ink-faint">/{state.settings.totalRounds}</span>
                {round && (
                  <span className="ml-1.5">
                    {MODE_META[round.mode].emoji} {MODE_META[round.mode].ko}
                  </span>
                )}
              </p>
            )}
          </div>

          <button
            onClick={() => {
              const next = !sound;
              setSoundEnabled(next);
              if (next) void unlock();
            }}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-faint transition-colors active:bg-night-800"
            aria-label={sound ? "소리 끄기" : "소리 켜기"}
          >
            {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>

          <ConnBadge status={status} />
          <ExitButton code={code} playerId={playerId} onLeave={() => router.push("/")} />
        </div>
        <TimerBar endsAt={state.phaseEndsAt} totalMs={step?.ms ?? 0} />
      </header>

      <main className="mx-auto max-w-lg px-4 pt-4">
        {state.phase !== "FINISHED" && (
          <div className="mb-4">
            <Announcer items={state.announcements} />
          </div>
        )}
        <PhaseSwitch state={state} playerId={playerId} />
      </main>
    </div>
  );
}

function PhaseSwitch({ state, playerId }: { state: RoomState; playerId: string }) {
  switch (state.phase) {
    case "LOBBY":
      return <LobbyPhase state={state} playerId={playerId} />;
    case "MODE_SELECT":
    case "ROUND_INTERMISSION":
      return <ModeSelectPhase state={state} playerId={playerId} />;
    case "TOPIC_SELECT":
      return <TopicSelectPhase state={state} playerId={playerId} />;
    case "POSITION_SELECT":
      return <PositionPhase state={state} playerId={playerId} />;
    case "ASSIGN_REVEAL":
      return <AssignRevealPhase state={state} playerId={playerId} />;
    case "REVEAL":
      return <RevealPhase state={state} playerId={playerId} />;
    case "PREPARATION":
      return <PreparationPhase state={state} playerId={playerId} />;
    case "SPEECH":
    case "REBUTTAL":
    case "FINAL_ARGUMENT":
      return <SpeechPhase state={state} playerId={playerId} />;
    case "REBUTTAL_PICK":
      return <RebuttalPickPhase state={state} playerId={playerId} />;
    case "VOTING":
      return <VotingPhase state={state} playerId={playerId} />;
    case "RATING":
      return <RatingPhase state={state} playerId={playerId} />;
    case "RESULT":
      return <ResultPhase state={state} playerId={playerId} />;
    case "FINISHED":
      return <FinishedPhase state={state} playerId={playerId} />;
    default:
      return null;
  }
}

function ConnBadge({ status }: { status: string }) {
  const live = status === "live";
  return (
    <span
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-full",
        live ? "text-good" : "text-warn"
      )}
      title={live ? "실시간 연결됨" : "다시 연결하는 중"}
    >
      {live ? <Wifi size={15} /> : <WifiOff size={15} className="animate-pulse" />}
    </span>
  );
}

function ExitButton({
  code, playerId, onLeave,
}: {
  code: string; playerId: string; onLeave: () => void;
}) {
  const send = useRoomStore((s) => s.send);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-faint transition-colors active:bg-night-800"
          aria-label="나가기"
        >
          <LogOut size={16} />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="text-lg font-black">방에서 나갈까요?</DialogTitle>
        <p className="mt-2 text-[0.86rem] leading-relaxed text-ink-mute">
          같은 기기로 코드 <span className="font-mono font-bold text-ink">{code}</span> 를 다시 입력하면
          점수와 함께 그대로 돌아올 수 있습니다.
        </p>
        <div className="mt-5 flex gap-2">
          <Button
            variant="danger"
            size="lg"
            block
            onClick={async () => {
              await send({ type: "LEAVE", playerId });
              onLeave();
            }}
          >
            나가기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function JoinGate({
  code, state, onJoined,
}: {
  code: string;
  state: RoomState;
  onJoined: (playerId: string) => void;
}) {
  const identity = useIdentity();
  // null = 아직 안 건드림 → 저장된 값을 그대로 보여준다
  const [draftNickname, setDraftNickname] = useState<string | null>(null);
  const [draftAvatar, setDraftAvatar] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const taken = state.players.map((p) => p.avatar);
  const nickname = draftNickname ?? identity.nickname;
  const avatar =
    draftAvatar ??
    (taken.includes(identity.avatar)
      ? AVATARS.find((a) => !taken.includes(a)) ?? identity.avatar
      : identity.avatar || AVATARS[0]);
  const setNickname = setDraftNickname;
  const setAvatar = setDraftAvatar;

  const full = state.players.length >= state.settings.maxPlayers;
  const finished = state.status === "FINISHED";

  async function join() {
    const nick = nickname.trim();
    if (!nick) { toast.error("닉네임을 입력해 주세요"); return; }
    setBusy(true);
    void unlock();
    try {
      const id = saveIdentity({ nickname: nick, avatar });
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: id.playerId, nickname: nick, avatar }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message ?? "입장하지 못했습니다");
      onJoined(id.playerId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "입장하지 못했습니다");
      setBusy(false);
    }
  }

  return (
    <div className="safe-t safe-b mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5">
      <div className="animate-rise space-y-6">
        <header className="text-center">
          <Logo size="md" className="mb-4" />
          <p className="font-mono text-3xl font-black tracking-[0.16em] text-accent">{code}</p>
          <p className="mt-2 text-lg font-bold">{state.settings.name}</p>
          <p className="mt-1 text-[0.84rem] text-ink-mute">
            {state.players.length}/{state.settings.maxPlayers}명 ·{" "}
            {state.status === "LOBBY" ? "아직 시작 전입니다" : `라운드 ${state.roundNo} 진행 중`}
          </p>
        </header>

        {state.players.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {state.players.map((p) => (
              <span
                key={p.id}
                className="flex items-center gap-1.5 rounded-full border border-night-700 bg-night-850 px-3 py-1.5 text-[0.8rem] font-bold"
              >
                {p.avatar} {p.nickname}
              </span>
            ))}
          </div>
        )}

        {finished ? (
          <ErrorBlock
            title="이미 끝난 방입니다"
            desc="새 방을 만들어서 다시 시작해 보세요."
          />
        ) : full ? (
          <ErrorBlock
            title="방이 가득 찼습니다"
            desc={`최대 ${state.settings.maxPlayers}명까지 들어갈 수 있어요.`}
          />
        ) : (
          <>
            <div className="space-y-2">
              <Input
                value={nickname}
                onChange={(e) => setNickname(e.target.value.slice(0, 12))}
                placeholder="닉네임을 입력하세요"
                maxLength={12}
                autoComplete="off"
                onKeyDown={(e) => { if (e.key === "Enter") void join(); }}
              />
              <AvatarPicker value={avatar} onChange={setAvatar} taken={taken} />
            </div>

            <Button size="xl" block onClick={join} disabled={busy || !nickname.trim()}>
              {busy ? <Loader2 size={20} className="animate-spin" /> : null}
              입장하기
            </Button>

            {state.status !== "LOBBY" && (
              <p className="text-center text-[0.78rem] leading-relaxed text-ink-faint">
                게임이 이미 시작됐습니다. 지금 들어가면 다음 라운드부터 참여합니다.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ErrorBlock({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-danger/35 bg-danger/10 p-5 text-center">
        <p className="text-lg font-black text-danger">{title}</p>
        <p className="mt-1.5 text-[0.85rem] text-ink-dim">{desc}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" size="lg" block asChild>
          <Link href="/"><Home size={17} /> 홈으로</Link>
        </Button>
        <Button size="lg" block asChild>
          <Link href="/create">새 방 만들기</Link>
        </Button>
      </div>
    </div>
  );
}

function RoomGone({ code }: { code: string }) {
  return (
    <div className="safe-t safe-b mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5">
      <div className="animate-rise space-y-5 text-center">
        <Logo size="md" />
        <p className="font-mono text-2xl font-black tracking-[0.16em] text-ink-faint">{code}</p>
        <ErrorBlock
          title="그런 방이 없습니다"
          desc="코드가 틀렸거나 방이 이미 정리됐습니다."
        />
      </div>
    </div>
  );
}

function RemovedFromRoom({ code }: { code: string }) {
  return (
    <div className="safe-t safe-b mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5">
      <div className="animate-rise space-y-5 text-center">
        <Logo size="md" />
        <ErrorBlock
          title="방에서 나왔습니다"
          desc={`방장이 내보냈거나 직접 나갔습니다. 코드 ${code} 로 다시 들어갈 수 있습니다.`}
        />
      </div>
    </div>
  );
}
