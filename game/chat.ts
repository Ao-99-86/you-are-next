import {
  CHAT_ROUNDS,
  CHAT_ROUND_SECONDS,
  CHAT_WIN_THRESHOLD,
} from "./constants";
import type { ArgumentRound, ArgumentSession } from "./types";

export const MONSTER_TAUNTS = [
  "You look tired. Give me one reason not to swallow you whole.",
  "Words are cheap. Prove you are worth the trouble.",
  "Final chance. Convince me you belong among the living.",
];

const ROUND_KEYWORDS: string[][] = [
  ["sorry", "mercy", "please", "alive"],
  ["promise", "help", "change", "learn"],
  ["friends", "family", "future", "earn"],
];

const DEFAULT_ROUND_KEYWORDS = [
  "please",
  "promise",
  "future",
  "change",
];

const NORMALIZE_REGEX = /[^a-z0-9\s]/g;

function normalizeText(input: string): string {
  return input.toLowerCase().replace(NORMALIZE_REGEX, " ").trim();
}

function getRoundKeywords(roundIndex: number): string[] {
  return ROUND_KEYWORDS[roundIndex] ?? DEFAULT_ROUND_KEYWORDS;
}

function buildMonsterReply(points: number, matched: string[], timedOut: boolean): string {
  if (timedOut) {
    return "Silence? Pathetic. I will count that as surrender.";
  }
  if (points >= 4) {
    return matched.length > 0
      ? `You said "${matched.join(", ")}". Amusing. I might let you crawl on.`
      : "Surprisingly coherent. Keep talking.";
  }
  if (points >= 2) {
    return "Weak argument. Barely worth hearing.";
  }
  return "That is all? You are making this easy for me.";
}

export function createArgumentSession(nowMs = Date.now()): ArgumentSession {
  const rounds: ArgumentRound[] = [];
  for (let i = 0; i < CHAT_ROUNDS; i += 1) {
    rounds.push({
      roundNumber: i + 1,
      taunt: MONSTER_TAUNTS[i % MONSTER_TAUNTS.length],
      playerMessage: null,
      monsterReply: null,
      points: 0,
      matchedKeywords: [],
      timedOut: false,
    });
  }

  return {
    id: `arg_${nowMs}_${Math.floor(Math.random() * 1_000_000)}`,
    rounds,
    currentRound: 0,
    totalScore: 0,
    requiredScore: CHAT_WIN_THRESHOLD,
    secondsPerRound: CHAT_ROUND_SECONDS,
    startedAtMs: nowMs,
    updatedAtMs: nowMs,
    outcome: "in_progress",
  };
}

export interface ChatEvaluation {
  points: number;
  matchedKeywords: string[];
  monsterReply: string;
}

export function evaluateResponse(roundIndex: number, message: string): ChatEvaluation {
  const normalized = normalizeText(message);
  const timedOut = normalized.length === 0;
  if (timedOut) {
    return {
      points: 0,
      matchedKeywords: [],
      monsterReply: buildMonsterReply(0, [], true),
    };
  }

  const keywords = getRoundKeywords(roundIndex);
  const tokens = new Set(normalized.split(/\s+/).filter(Boolean));
  const matchedKeywords: string[] = [];

  for (const keyword of keywords) {
    if (keyword.includes(" ")) {
      if (normalized.includes(keyword)) matchedKeywords.push(keyword);
      continue;
    }
    if (tokens.has(keyword)) matchedKeywords.push(keyword);
  }

  let points = matchedKeywords.length * 2;
  if (normalized.length >= 40) {
    points += 1;
  }
  points = Math.min(points, 5);

  return {
    points,
    matchedKeywords,
    monsterReply: buildMonsterReply(points, matchedKeywords, false),
  };
}

export const WINNING_SAMPLE_MESSAGES = [
  "Please show mercy and keep me alive. I am sorry.",
  "I promise I can change and help if you let me go.",
  "My family and friends need me. I will earn a future.",
];
