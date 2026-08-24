"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/brand/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/segmented";
import { AvatarPicker } from "@/components/room/avatar-picker";
import { loadIdentity, rememberRoom, saveIdentity } from "@/lib/client/identity";
import { coerceCode, isValidCode } from "@/lib/server/codes";
import { unlock } from "@/lib/client/sound";
import { CodeInput } from "@/components/room/code-input";

function JoinInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState("🐻");
  const [busy, setBusy] = useState(false);
  const nickRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = loadIdentity();
    setNickname(id.nickname);
    if (id.avatar) setAvatar(id.avatar);
    const fromUrl = params.get("code");
    if (fromUrl) setCode(coerceCode(fromUrl));
  }, [params]);

  async function join() {
    const c = coerceCode(code);
    const nick = nickname.trim();
    if (!isValidCode(c)) { toast.error("코드 6자리를 정확히 입력해 주세요"); return; }
    if (!nick) { toast.error("닉네임을 입력해 주세요"); nickRef.current?.focus(); return; }
    if (busy) return;
    setBusy(true);
    void unlock();
    try {
      const id = loadIdentity();
      saveIdentity({ nickname: nick, avatar });
      const res = await fetch(`/api/rooms/${c}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: id.playerId, nickname: nick, avatar }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.message ?? "입장하지 못했습니다");
      rememberRoom(c, data.state?.settings?.name ?? c);
      router.push(`/room/${c}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "입장하지 못했습니다");
      setBusy(false);
    }
  }

  const ready = isValidCode(coerceCode(code)) && Boolean(nickname.trim());

  return (
    <PageShell title="방 참가하기" back="/">
      <div className="space-y-7 pb-28">
        <Field label="방 코드" hint="친구에게 받은 6자리">
          <CodeInput value={code} onChange={setCode} onComplete={() => nickRef.current?.focus()} />
        </Field>

        <Field label="내 닉네임" hint="최대 12자">
          <Input
            ref={nickRef}
            value={nickname}
            onChange={(e) => setNickname(e.target.value.slice(0, 12))}
            placeholder="친구들이 부르는 이름"
            maxLength={12}
            autoComplete="off"
            onKeyDown={(e) => { if (e.key === "Enter" && ready) void join(); }}
          />
          <AvatarPicker value={avatar} onChange={setAvatar} />
        </Field>

        <p className="rounded-2xl border border-night-700 bg-night-850/50 px-4 py-3 text-[0.78rem] leading-relaxed text-ink-mute">
          링크를 받았다면 그냥 눌러도 됩니다. 코드가 자동으로 채워집니다.
        </p>
      </div>

      <div className="safe-b fixed inset-x-0 bottom-0 z-20 border-t border-night-800 bg-night-950/85 px-4 pt-3 backdrop-blur-xl">
        <div className="mx-auto max-w-lg">
          <Button size="xl" block onClick={join} disabled={busy || !ready}>
            {busy ? <Loader2 size={20} className="animate-spin" /> : <LogIn size={19} />}
            {busy ? "입장하는 중" : "입장하기"}
          </Button>
        </div>
      </div>
    </PageShell>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<PageShell title="방 참가하기" back="/"><div className="h-40" /></PageShell>}>
      <JoinInner />
    </Suspense>
  );
}
