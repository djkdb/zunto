import type { Category, Topic } from "@/lib/game/types";
import { MONEY_TOPICS } from "./money";
import { LOVE_TOPICS } from "./love";
import { FRIENDSHIP_TOPICS } from "./friendship";
import { LIFE_TOPICS } from "./life";
import { FUN_TOPICS } from "./fun";
import { TRAVEL_TOPICS } from "./travel";
import { WORK_TOPICS } from "./work";
import { DEEP_TOPICS } from "./deep";
import { CHAOS_TOPICS } from "./chaos";

export const TOPICS_BY_CATEGORY: Record<Category, Topic[]> = {
  MONEY: MONEY_TOPICS,
  LOVE: LOVE_TOPICS,
  FRIENDSHIP: FRIENDSHIP_TOPICS,
  LIFE: LIFE_TOPICS,
  FUN: FUN_TOPICS,
  TRAVEL: TRAVEL_TOPICS,
  WORK: WORK_TOPICS,
  DEEP: DEEP_TOPICS,
  CHAOS: CHAOS_TOPICS,
};

export const ALL_TOPICS: Topic[] = Object.values(TOPICS_BY_CATEGORY).flat();

export const TOPIC_INDEX: Map<string, Topic> = new Map(ALL_TOPICS.map((t) => [t.id, t]));

export const TOPIC_COUNT = ALL_TOPICS.length;
