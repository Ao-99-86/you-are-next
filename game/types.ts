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

// ── Multiplayer Network Types (Phase 4) ──────────────────────────────

export type RoomPhase = "lobby" | "playing" | "argument" | "game_over";
export type PlayerLifeState = "alive" | "caught" | "eaten" | "escaped";

export interface NetworkPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  lifeState: PlayerLifeState;
  position: Vec3;
  yaw: number;
  pitch: number;
  connected: boolean;
  isReady: boolean;
  lastUpdateMs: number;
}

export interface NetworkMonsterState {
  position: Vec3;
  yaw: number;
  state: MonsterState;
  targetPlayerId: string | null;
}

export interface NetworkArgumentState {
  active: boolean;
  caughtPlayerId: string | null;
  session: ArgumentSession | null;
  activeTyperId: string | null;
}

export interface RoomSnapshot {
  serverTimeMs: number;
  phase: RoomPhase;
  hostId: string | null;
  players: NetworkPlayerState[];
  monster: NetworkMonsterState;
  argument: NetworkArgumentState;
  result: GameResult | null;
}

// Client → Server messages
export type ClientMessage =
  | { type: "JOIN_ROOM"; roomId: string; name: string; clientId?: string }
  | { type: "SET_READY"; ready: boolean }
  | { type: "REQUEST_START" }
  | {
      type: "PLAYER_INPUT";
      seq: number;
      moveH: number;
      moveV: number;
      yaw: number;
      pitch: number;
      dtMs: number;
    }
  | { type: "CHAT_SUBMIT"; sessionId: string; message: string }
  | { type: "ASSIST_TARGET"; targetPlayerId: string };

// Server → Client messages
export type ServerMessage =
  | {
      type: "WELCOME";
      selfId: string;
      roomId: string;
      tickRate: number;
      maxPlayers: number;
    }
  | { type: "ROOM_SNAPSHOT"; snapshot: RoomSnapshot }
  | { type: "ROOM_EVENT"; event: RoomEvent }
  | { type: "ERROR"; code: string; message: string };

export type RoomEvent =
  | { type: "PLAYER_CAUGHT"; playerId: string }
  | {
      type: "ARGUMENT_STARTED";
      sessionId: string;
      caughtPlayerId: string;
    }
  | {
      type: "ARGUMENT_ROUND_RESOLVED";
      sessionId: string;
      round: number;
      points: number;
    }
  | { type: "PLAYER_EATEN"; playerId: string }
  | { type: "PLAYER_ESCAPED"; playerId: string }
  | { type: "GAME_OVER"; result: GameResult };
