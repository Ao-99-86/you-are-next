import { createArgumentSession, evaluateResponse } from "./chat";
import type { ArgumentSession, GameAction, GameLogicState } from "./types";

export function createInitialGameLogicState(): GameLogicState {
  return {
    argument: null,
  };
}

function resolveOutcome(argument: ArgumentSession): ArgumentSession {
  const outcome = argument.totalScore >= argument.requiredScore ? "won" : "lost";
  return {
    ...argument,
    outcome,
  };
}

function updateArgumentWithMessage(
  argument: ArgumentSession,
  message: string,
  nowMs: number,
  timedOut: boolean
): ArgumentSession {
  if (argument.outcome !== "in_progress") return argument;
  if (argument.currentRound < 0 || argument.currentRound >= argument.rounds.length) {
    return argument;
  }

  const evaluation = evaluateResponse(argument.currentRound, message);
  const rounds = argument.rounds.map((round, idx) => {
    if (idx !== argument.currentRound) return round;
    return {
      ...round,
      playerMessage: message.length > 0 ? message : null,
      monsterReply: evaluation.monsterReply,
      points: evaluation.points,
      matchedKeywords: evaluation.matchedKeywords,
      timedOut,
    };
  });

  const totalScore = rounds.reduce((sum, round) => sum + round.points, 0);
  const isLastRound = argument.currentRound >= rounds.length - 1;
  const updated: ArgumentSession = {
    ...argument,
    rounds,
    totalScore,
    updatedAtMs: nowMs,
    currentRound: isLastRound ? argument.currentRound : argument.currentRound + 1,
  };

  return isLastRound ? resolveOutcome(updated) : updated;
}

export function gameUpdater(state: GameLogicState, action: GameAction): GameLogicState {
  switch (action.type) {
    case "PLAYER_CAUGHT":
      return {
        ...state,
        argument: createArgumentSession(action.nowMs ?? Date.now()),
      };

    case "CHAT_MESSAGE": {
      if (!state.argument) return state;
      const message = action.message.trim();
      return {
        ...state,
        argument: updateArgumentWithMessage(
          state.argument,
          message,
          action.nowMs ?? Date.now(),
          false
        ),
      };
    }

    case "ROUND_TIMEOUT": {
      if (!state.argument) return state;
      return {
        ...state,
        argument: updateArgumentWithMessage(
          state.argument,
          "",
          action.nowMs ?? Date.now(),
          true
        ),
      };
    }

    case "ARGUMENT_WON":
      if (!state.argument) return state;
      return {
        ...state,
        argument: {
          ...state.argument,
          updatedAtMs: action.nowMs ?? Date.now(),
          outcome: "won",
        },
      };

    case "ARGUMENT_LOST":
      if (!state.argument) return state;
      return {
        ...state,
        argument: {
          ...state.argument,
          updatedAtMs: action.nowMs ?? Date.now(),
          outcome: "lost",
        },
      };

    case "RESET_ARGUMENT":
      return {
        ...state,
        argument: null,
      };

    default:
      return state;
  }
}
