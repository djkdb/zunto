"use client";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, QrCode, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function useRoomUrl(code: string) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined") setUrl(`${window.location.origin}/room/${code}`);
  }, [code]);
  return url;
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // clipboard API 가 막힌 환경 대비
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

export function RoomCodeCard({ code, name }: { code: string; name: string }) {
  const url = useRoomUrl(code);
  const [copied, setCopied] = useState(false);

  async function share() {
    const text = `${name} — DEBATENIGHT 방 코드 ${code}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "DEBATENIGHT", text, url });
        return;
      } catch { /* 사용자가 취소함 */ }
    }
    if (await copyText(url)) toast.success("초대 링크를 복사했습니다");
  }

  async function copy() {
    if (await copyText(code)) {
      setCopied(true);
      toast.success("코드를 복사했습니다");
      setTimeout(() => setCopied(false), 1600);
    }
  }

  return (
    <div className="rounded-3xl border border-night-700 bg-night-850/70 p-5 text-center">
      <p className="text-[0.7rem] font-bold uppercase tracking-[0.25em] text-ink-faint">room code</p>
      <button
        onClick={copy}
        className="mx-auto mt-2 flex items-center gap-2 font-mono text-[2.6rem] font-black leading-none tracking-[0.16em] text-ink transition-opacity active:opacity-60"
      >
        {code}
        {copied ? <Check size={20} className="text-good" /> : <Copy size={19} className="text-ink-faint" />}
      </button>
      <p className="mt-3 text-[0.78rem] leading-relaxed text-ink-mute">
        친구들에게 이 코드를 알려주세요
      </p>
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" size="md" block onClick={share}>
          <Share2 size={17} /> 초대 링크
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary" size="md" className="px-4" aria-label="QR 코드">
              <QrCode size={18} />
            </Button>
          </DialogTrigger>
          <DialogContent className="text-center">
            <DialogTitle className="text-lg font-black">카메라로 찍으면 바로 입장</DialogTitle>
            <div className="mx-auto mt-5 w-fit rounded-3xl bg-white p-4">
              {url ? (
                <QRCodeSVG value={url} size={208} level="M" />
              ) : (
                <div className="h-52 w-52 animate-pulse rounded-xl bg-night-200" />
              )}
            </div>
            <p className="mt-4 font-mono text-xl font-black tracking-[0.2em]">{code}</p>
            <p className="mt-1 break-all text-[0.7rem] text-ink-faint">{url}</p>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
