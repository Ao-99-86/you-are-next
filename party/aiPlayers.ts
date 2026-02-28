import {
  BOT_LATERAL_DRIFT,
  BOT_SPEED,
  MAP_DEPTH,
  MAP_WIDTH,
  START_Z,
} from "../game/constants";
import { WINNING_SAMPLE_MESSAGES } from "../game/chat";
import type { PlayerLifeState, Vec3 } from "../game/types";

export interface BotRecord {
  id: string;
  clientId: string;
  connId: null;
  name: string;
  isBot: true;
  lifeState: PlayerLifeState;
  position: Vec3;
  yaw: number;
  pitch: number;
  connected: boolean;
  isReady: boolean;
  lastUpdateMs: number;
  recatchGraceUntilMs: number;
  lateralPhase: number;
  chatPending: boolean;
}

export function createBot(
  botNumber: number,
  roomId: string,
  spawnOffset: number,
  nowMs: number
): BotRecord {
  return {
    id: `bot_${botNumber}_${roomId}`,
    clientId: `bot_client_${botNumber}_${roomId}`,
    connId: null,
    name: `Bot ${botNumber}`,
    isBot: true,
    lifeState: "alive",
    position: { x: spawnOffset, y: 1.8, z: START_Z },
    yaw: 0,
    pitch: 0,
    connected: true,
    isReady: true,
    lastUpdateMs: nowMs,
    recatchGraceUntilMs: nowMs + 15_000, // spawn immunity lets humans get caught first
    lateralPhase: Math.random() * Math.PI * 2,
    chatPending: false,
  };
}

export function tickBotMovement(
  bot: BotRecord,
  dtSeconds: number,
  nowMs: number
): void {
  const dtScale = Math.max(0.25, Math.min(2.5, dtSeconds * 60));

  // Advance forward (+Z)
  bot.position.z += BOT_SPEED * dtScale;

  // Sinusoidal lateral drift
  bot.lateralPhase += dtSeconds * 1.5;
  const lateralDelta =
    Math.sin(bot.lateralPhase) * BOT_LATERAL_DRIFT * dtScale;
  bot.position.x += lateralDelta;

  // Clamp to map bounds
  const halfW = MAP_WIDTH / 2 - 1;
  const halfD = MAP_DEPTH / 2 - 1;
  bot.position.x = Math.max(-halfW, Math.min(halfW, bot.position.x));
  bot.position.z = Math.max(-halfD, Math.min(halfD, bot.position.z));

  // Face direction of travel
  bot.yaw = Math.atan2(lateralDelta, BOT_SPEED * dtScale);
  bot.lastUpdateMs = nowMs;
}

export function pickDeterministicBotMessage(roundIndex: number): string {
  return WINNING_SAMPLE_MESSAGES[
    roundIndex % WINNING_SAMPLE_MESSAGES.length
  ];
}

export async function resolveBotChatMessage(
  roundIndex: number,
  generateLlmMessage: (roundIndex: number) => Promise<string | null>
): Promise<string> {
  try {
    const llmResult = await generateLlmMessage(roundIndex);
    if (llmResult && llmResult.trim().length > 0) {
      return llmResult.trim();
    }
  } catch {
    // Fall through to deterministic
  }
  return pickDeterministicBotMessage(roundIndex);
}
