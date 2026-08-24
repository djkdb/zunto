/**
 * 개발용 봇 — 실제 HTTP API 를 통해 방에 들어가 자동으로 플레이한다.
 * 사용법: npm run bots -- <ROOM_CODE> [봇 수] [--auto-start]
 * 브라우저를 한 명으로 두고 나머지를 채워서 실시간 동기화를 눈으로 확인할 때 쓴다.
 */
import { MODE_META, type Action, type RoomState } from "../lib/game/types";

const BASE = process.env.BOTS_BASE ?? "http://localhost:3000";
const code = process.argv[2];
const count = Number(process.argv[3] ?? 3);
const autoStart = process.argv.includes("--auto-start");

if (!code) {
  console.error("사용법: npm run bots -- <ROOM_CODE> [봇 수] [--auto-start]");
  process.exit(1);
}

const NAMES = ["민수", "지훈", "현우", "서연", "다은", "태호", "유진"];
const AVATARS = ["🐻", "🐼", "🐯", "🦁", "🐸", "🐨", "🐺"];

interface Bot { id: string; name: string; avatar: string }
const bots: Bot[] = Array.from({ length: count }, (_, i) => ({
  id: `bot-${code}-${i}`,
  name: NAMES[i % NAMES.length],
  avatar: AVATARS[i % AVATARS.length],
}));

async function post(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => null);
}

const act = (a: Action) => post(`/api/rooms/${code}/action`, a);

async function snapshot(): Promise<RoomState | null> {
  const res = await fetch(`${BASE}/api/rooms/${code}`, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  return data?.ok ? (data.state as RoomState) : null;
}

const rand = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  for (const b of bots) {
    const res = await post(`/api/rooms/${code}/join`, {
      playerId: b.id, nickname: b.name, avatar: b.avatar,
    });
    console.log(res?.ok ? `✅ ${b.name} 입장` : `❌ ${b.name} — ${res?.message}`);
    await act({ type: "SET_READY", playerId: b.id, ready: true });
  }

  let lastPhase = "";
  let lastToken = -1;

  for (;;) {
    const s = await snapshot();
    if (!s) { console.log("방이 사라졌습니다"); return; }

    for (const b of bots) await act({ type: "PING", playerId: b.id });

    const mine = bots.filter((b) => s.players.some((p) => p.id === b.id));
    const ids = s.players.filter((p) => p.active && p.connected).map((p) => p.id);
    const step = s.round?.steps[s.round.stepIndex];

    if (s.phaseToken !== lastToken || s.phase !== lastPhase) {
      lastToken = s.phaseToken;
      lastPhase = s.phase;
      const who = step?.actorId ? ` · ${s.players.find((p) => p.id === step.actorId)?.nickname}` : "";
      console.log(
        `[R${s.roundNo}] ${s.phase}${who}` +
        (s.round ? ` (${MODE_META[s.round.mode].ko})` : "") +
        (s.announcements[0] ? `  — ${s.announcements[0].text}` : "")
      );
    }

    switch (s.phase) {
      case "LOBBY":
        if (autoStart && s.players.length >= 2 && bots.some((b) => b.id === s.hostId)) {
          await act({ type: "START_GAME", playerId: s.hostId });
        }
        break;

      case "MODE_SELECT":
        if (bots.some((b) => b.id === s.hostId)) {
          const pool = Object.values(MODE_META).filter((m) => m.minPlayers <= ids.length);
          await act({ type: "CHOOSE_MODE", playerId: s.hostId, mode: rand(pool).id });
        }
        break;

      case "TOPIC_SELECT":
        if (s.settings.topicPolicy === "VOTE") {
          for (const b of mine) {
            if (!s.topicVotes[b.id] && s.topicCandidates[0]) {
              await act({ type: "VOTE_TOPIC", playerId: b.id, topicId: rand(s.topicCandidates).id });
            }
          }
        } else if (bots.some((b) => b.id === s.hostId) && s.topicCandidates[0]) {
          await act({ type: "CHOOSE_TOPIC", playerId: s.hostId, topic: rand(s.topicCandidates) });
        }
        break;

      case "POSITION_SELECT": {
        const r = s.round!;
        for (const b of mine) {
          if (MODE_META[r.mode].isPickPerson) {
            if (r.picks[b.id]) continue;
            const others = ids.filter((x) => x !== b.id);
            if (others.length) await act({ type: "PICK_PLAYER", playerId: b.id, targetId: rand(others) });
          } else {
            if (r.initialStances[b.id]) continue;
            await act({ type: "CHOOSE_STANCE", playerId: b.id, stance: Math.random() < 0.5 ? "A" : "B" });
          }
        }
        break;
      }

      case "REBUTTAL_PICK": {
        const actor = step?.actorId;
        if (actor && mine.some((b) => b.id === actor)) {
          await sleep(900);
          await act({
            type: "CHOOSE_REBUTTAL", playerId: actor,
            kind: rand(["LOGIC", "EXPERIENCE", "QUESTION", "CONCEDE", "KNOCKOUT"] as const),
          });
        }
        break;
      }

      case "SPEECH":
      case "REBUTTAL":
      case "FINAL_ARGUMENT": {
        // 봇 차례면 조금 말하는 척하다가 넘긴다
        const actor = step?.actorId;
        if (actor && mine.some((b) => b.id === actor)) {
          const remaining = (s.phaseEndsAt ?? 0) - Date.now();
          if (remaining > 4000) { await sleep(2500); break; }
          await act({ type: "ADVANCE", playerId: actor, phaseToken: s.phaseToken });
        }
        break;
      }

      case "VOTING": {
        const r = s.round!;
        for (const b of mine) {
          if (r.votes[b.id]) continue;
          const others = ids.filter((x) => x !== b.id);
          await act({
            type: "SUBMIT_VOTE", playerId: b.id,
            vote: {
              stance: Math.random() < 0.5 ? "A" : "B",
              mvpId: others.length ? rand(others) : undefined,
            },
          });
          if (Math.random() < 0.5) {
            await act({
              type: "SUBMIT_QUOTE", playerId: b.id,
              text: rand([
                "돈이 행복을 살 수 없다면 왜 다들 밤새 일할까",
                "결국 사람은 자기가 믿고 싶은 걸 믿는다",
                "그건 네 얘기고 내 얘기는 아니야",
                "우리 지금 이거 왜 싸우고 있지",
              ]),
            });
          }
        }
        break;
      }

      case "RATING": {
        const r = s.round!;
        for (const b of mine) {
          const others = ids.filter((x) => x !== b.id);
          if (!others.length) continue;
          if (s.settings.peerRating === "DETAILED") {
            if (r.ratings[b.id]) continue;
            const ratings = Object.fromEntries(
              others.map((o) => [o, {
                logic: 2 + Math.floor(Math.random() * 4),
                persuasion: 2 + Math.floor(Math.random() * 4),
                creativity: 2 + Math.floor(Math.random() * 4),
                humor: 2 + Math.floor(Math.random() * 4),
                punch: 2 + Math.floor(Math.random() * 4),
              }])
            );
            await act({ type: "SUBMIT_RATING", playerId: b.id, ratings });
          } else {
            if (r.quickAwards[b.id]) continue;
            await act({
              type: "SUBMIT_QUICK_AWARD", playerId: b.id,
              code: rand(["LOGIC", "PERSUASION", "CREATIVITY", "HUMOR", "PUNCH"] as const),
              rateeId: rand(others),
            });
          }
        }
        break;
      }

      case "RESULT": {
        const r = s.round!;
        if (r.mission) {
          for (const b of mine) {
            if (b.id === r.mission.playerId) continue;
            if (b.id in r.missionVotes) continue;
            await act({ type: "MISSION_VOTE", playerId: b.id, success: Math.random() < 0.7 });
          }
        }
        for (const b of mine) {
          await act({ type: "FUN_VOTE", playerId: b.id, score: 3 + Math.floor(Math.random() * 3) });
        }
        if (bots.some((b) => b.id === s.hostId)) {
          await sleep(2500);
          await act({ type: "NEXT_ROUND", playerId: s.hostId });
        }
        break;
      }

      case "FINISHED":
        console.log("\n🏁 게임 종료");
        console.log(
          s.finalSummary!.standings.map((x, i) => `  ${i + 1}. ${x.avatar} ${x.nickname} — ${x.score}점`).join("\n")
        );
        return;
    }

    await sleep(900);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
