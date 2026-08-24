import type { Category, DebateMode, Difficulty, Intensity, Topic } from "@/lib/game/types";
import { recommendTopics } from "@/lib/game/recommend";
import { mulberry32 } from "@/lib/game/rng";

export interface GenerateRequest {
  /** 자유 서술 — 예: 미국 여행 중인 20대 대학생 4명이 호텔에서 할 토론 주제 10개 */
  prompt: string;
  count: number;
  mode?: DebateMode;
  category?: Category;
  playerCount?: number;
}

export interface GeneratedTopic {
  topic: string;
  category: Category;
  difficulty: Difficulty;
  intensity: Intensity;
  mode: DebateMode;
  optionA?: string;
  optionB?: string;
  followUpQuestions?: string[];
}

export interface TopicProvider {
  readonly id: string;
  readonly label: string;
  generate(req: GenerateRequest): Promise<GeneratedTopic[]>;
}

/** 기본 제공자 — 내장 DB 에서 상황에 맞게 골라준다 (AI 없이도 동작) */
export class BuiltinTopicProvider implements TopicProvider {
  readonly id = "builtin";
  readonly label = "내장 주제 DB";

  async generate(req: GenerateRequest): Promise<GeneratedTopic[]> {
    const rand = mulberry32(Math.floor(Math.random() * 2 ** 31));
    const mode = req.mode ?? "BALANCE";
    const topics = recommendTopics(
      {
        playerCount: req.playerCount ?? 4,
        vibe: "AUTO",
        categories: req.category ? [req.category] : [],
        mode,
        difficulty: 3,
        hour: new Date().getHours(),
        usedTopicIds: [],
        roundNo: 1,
        funHistory: [],
        rand,
      },
      req.count
    );
    return topics.map(toGenerated);
  }
}

export function toGenerated(t: Topic): GeneratedTopic {
  return {
    topic: t.text,
    category: t.category,
    difficulty: t.difficulty,
    intensity: t.intensity,
    mode: t.modes[0],
    optionA: t.optionA,
    optionB: t.optionB,
    followUpQuestions: t.followUps,
  };
}

export function fromGenerated(g: GeneratedTopic, idx: number): Topic {
  return {
    id: `ai-${Date.now().toString(36)}-${idx}`,
    text: g.topic,
    category: g.category,
    modes: [g.mode],
    difficulty: g.difficulty,
    intensity: g.intensity,
    optionA: g.optionA,
    optionB: g.optionB,
    followUps: g.followUpQuestions,
    source: "ai",
  };
}

/**
 * AI 제공자 자리.
 * ANTHROPIC_API_KEY 등을 넣고 이 클래스만 구현하면 나머지는 그대로 동작한다.
 * 응답은 GeneratedTopic[] 형태(JSON)여야 한다.
 */
export class AiTopicProvider implements TopicProvider {
  readonly id = "ai";
  readonly label = "AI 주제 생성";
  constructor(private endpoint: string, private apiKey: string) {}

  async generate(req: GenerateRequest): Promise<GeneratedTopic[]> {
    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`AI 주제 생성 실패 (${res.status})`);
    const data = await res.json();
    return (data.topics ?? []) as GeneratedTopic[];
  }
}

export function getTopicProvider(): TopicProvider {
  const endpoint = process.env.TOPIC_AI_ENDPOINT;
  const key = process.env.TOPIC_AI_KEY;
  if (endpoint && key) return new AiTopicProvider(endpoint, key);
  return new BuiltinTopicProvider();
}
