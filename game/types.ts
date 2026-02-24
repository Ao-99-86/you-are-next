export enum GamePhase {
  LOADING = "loading",
  PLAYING = "playing",
  ARGUMENT = "argument",
  GAME_OVER = "game_over",
}

export enum GameResult {
  WIN = "win",
  EATEN = "eaten",
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type MonsterState = "patrol" | "chase";

export type ChatOutcome = "in_progress" | "won" | "lost";

export interface ArgumentRound {
  roundNumber: number;
  taunt: string;
  playerMessage: string | null;
  monsterReply: string | null;
  points: number;
  matchedKeywords: string[];
  timedOut: boolean;
}

export interface ArgumentSession {
  id: string;
  rounds: ArgumentRound[];
  currentRound: number;
  totalScore: number;
  requiredScore: number;
  secondsPerRound: number;
  startedAtMs: number;
  updatedAtMs: number;
  outcome: ChatOutcome;
}

export interface HudSnapshot {
  phase: GamePhase;
  distanceToGoal: number;
  monsterState: MonsterState;
}

export type GameAction =
  | { type: "PLAYER_CAUGHT"; nowMs?: number }
  | { type: "CHAT_MESSAGE"; message: string; nowMs?: number }
  | { type: "ROUND_TIMEOUT"; nowMs?: number }
  | { type: "ARGUMENT_WON"; nowMs?: number }
  | { type: "ARGUMENT_LOST"; nowMs?: number }
  | { type: "RESET_ARGUMENT"; nowMs?: number };

export interface GameLogicState {
  argument: ArgumentSession | null;
}
