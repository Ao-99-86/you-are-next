import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MultiplayerGame } from "../../engine/MultiplayerGame";
import {
  GamePhase,
  type ArgumentSession,
  type GameResult,
  type MonsterState,
  type RoomEvent,
} from "../../game/types";
import { useGameRoom } from "../hooks/useGameRoom";
import GameOverScreen from "./GameOverScreen";
import HUD from "./HUD";
import MonsterChat from "./MonsterChat";

export default function MultiplayerCanvas() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<MultiplayerGame | null>(null);

  const [debug, setDebug] = useState("");
  const [phase, setPhase] = useState<GamePhase>(GamePhase.LOADING);
  const [distanceToGoal, setDistanceToGoal] = useState(0);
  const [monsterState, setMonsterState] = useState<MonsterState>("patrol");
  const [argumentSession, setArgumentSession] =
    useState<ArgumentSession | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [result, setResult] = useState<GameResult | null>(null);
  const [isEaten, setIsEaten] = useState(false);

  const roundSubmitLockRef = useRef<string | null>(null);

  const room = useGameRoom({
    onSnapshot: (snapshot) => {
      const game = gameRef.current;
      if (game) {
        game.applySnapshot(snapshot);
      }

      // Track eaten state for assist panel
      if (room.selfId) {
        const self = snapshot.players.find((p) => p.id === room.selfId);
        setIsEaten(self?.lifeState === "eaten");
      }
    },
    onEvent: (event: RoomEvent) => {
      // Handle discrete events if needed (e.g., sound effects)
    },
  });

  // Connect to room on mount
  useEffect(() => {
    if (!roomId) return;
    // If we came from lobby, the room hook might already be connected.
    // If navigated directly, connect with a generic name.
    if (!room.connected) {
      room.connect(roomId, `Player_${Date.now() % 10000}`);
    }
  }, [roomId]);

  // Initialize game engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const game = new MultiplayerGame(canvas);
    gameRef.current = game;

    game.onDebug = (info) => setDebug(info);
    game.onPhaseChange = (nextPhase) => setPhase(nextPhase);
    game.onHudUpdate = (hud) => {
      setDistanceToGoal(hud.distanceToGoal);
      setMonsterState(hud.monsterState);
      setPhase(hud.phase);
    };
    game.onArgumentStart = (session) => {
      setArgumentSession(session);
      setPhase(GamePhase.ARGUMENT);
    };
    game.onArgumentUpdate = (session) => {
      setArgumentSession(session);
    };
    game.onGameOver = (nextResult) => {
      setResult(nextResult);
      setPhase(GamePhase.GAME_OVER);
      setArgumentSession(null);
    };

    // Wire input sampling to network hook
    game.onInputSample = (input) => {
      room.sendInput(input);
    };

    game.start().catch((err) => console.error("Game failed to start:", err));

    const handleResize = () => game.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      game.dispose();
      gameRef.current = null;
    };
  }, []);

  // Set selfId on game when room provides it
  useEffect(() => {
    const game = gameRef.current;
    if (game && room.selfId) {
      game.selfId = room.selfId;
    }
  }, [room.selfId]);

  // Argument timer (mirrors BabylonCanvas logic)
  useEffect(() => {
    const session = argumentSession;
    if (!session || session.outcome !== "in_progress") {
      setSecondsRemaining(0);
      roundSubmitLockRef.current = null;
      return;
    }

    const roundKey = `${session.id}:${session.currentRound}`;
    roundSubmitLockRef.current = null;
    const deadlineMs = Date.now() + session.secondsPerRound * 1000;

    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((deadlineMs - Date.now()) / 1000)
      );
      setSecondsRemaining(remaining);
      if (remaining > 0) return;
      if (roundSubmitLockRef.current === roundKey) return;

      roundSubmitLockRef.current = roundKey;
      // Auto-submit empty on timeout
      if (isActiveTyper && argumentSession?.id) {
        room.submitChat(argumentSession.id, "");
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 250);
    return () => window.clearInterval(intervalId);
  }, [
    argumentSession?.id,
    argumentSession?.currentRound,
    argumentSession?.outcome,
    argumentSession?.secondsPerRound,
  ]);

  const isActiveTyper =
    room.snapshot?.argument?.activeTyperId === room.selfId;

  const handleChatSubmit = (message: string) => {
    if (!argumentSession || argumentSession.outcome !== "in_progress") return;

    const roundKey = `${argumentSession.id}:${argumentSession.currentRound}`;
    if (roundSubmitLockRef.current === roundKey) return;

    roundSubmitLockRef.current = roundKey;
    room.submitChat(argumentSession.id, message);
  };

  // Alive players for assist panel (when eaten)
  const alivePlayers = isEaten
    ? (room.snapshot?.players
        .filter((p) => p.lifeState === "alive" && p.id !== room.selfId)
        .map((p) => ({ id: p.id, name: p.name })) ?? [])
    : undefined;

  return (
    <>
      <canvas ref={canvasRef} className="game-canvas" />
      {debug && <div className="debug-overlay">{debug}</div>}

      <HUD
        phase={phase}
        distanceToGoal={distanceToGoal}
        monsterState={monsterState}
        alivePlayers={alivePlayers}
        onAssistTarget={isEaten ? room.assistTarget : undefined}
      />

      <MonsterChat
        visible={phase === GamePhase.ARGUMENT && !!argumentSession}
        session={argumentSession}
        secondsRemaining={secondsRemaining}
        onSubmit={handleChatSubmit}
        isActiveTyper={isActiveTyper}
      />

      <GameOverScreen
        visible={phase === GamePhase.GAME_OVER}
        result={result}
        onReturnToMenu={() => navigate("/")}
      />
    </>
  );
}
