import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Game } from "../../engine/Game";
import {
  GamePhase,
  type ArgumentSession,
  type MonsterState,
  type GameResult,
} from "../../game/types";
import GameOverScreen from "./GameOverScreen";
import HUD from "./HUD";
import MonsterChat from "./MonsterChat";

export default function BabylonCanvas() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const roundSubmitLockRef = useRef<string | null>(null);

  const [debug, setDebug] = useState("");
  const [phase, setPhase] = useState<GamePhase>(GamePhase.LOADING);
  const [distanceToGoal, setDistanceToGoal] = useState(0);
  const [monsterState, setMonsterState] = useState<MonsterState>("patrol");
  const [argumentSession, setArgumentSession] = useState<ArgumentSession | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [result, setResult] = useState<GameResult | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const game = new Game(canvas);
    gameRef.current = game;

    game.onDebug = (info: string) => setDebug(info);
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
      console.log(`[game] Game over: ${nextResult}`);
    };

    game.start().catch((err) => console.error("Game failed to start:", err));

    const handleResize = () => game.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      game.dispose();
      gameRef.current = null;
      roundSubmitLockRef.current = null;
    };
  }, []);

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
      const remaining = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining > 0) return;
      if (roundSubmitLockRef.current === roundKey) return;

      roundSubmitLockRef.current = roundKey;
      gameRef.current?.submitChatMessage("");
    };

    tick();
    const intervalId = window.setInterval(tick, 250);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [argumentSession?.id, argumentSession?.currentRound, argumentSession?.outcome, argumentSession?.secondsPerRound]);

  const handleChatSubmit = (message: string) => {
    const game = gameRef.current;
    if (!game || !argumentSession || argumentSession.outcome !== "in_progress") return;

    const roundKey = `${argumentSession.id}:${argumentSession.currentRound}`;
    if (roundSubmitLockRef.current === roundKey) return;

    roundSubmitLockRef.current = roundKey;
    game.submitChatMessage(message);
  };

  return (
    <>
      <canvas ref={canvasRef} className="game-canvas" />
      {debug && <div className="debug-overlay">{debug}</div>}

      <HUD
        phase={phase}
        distanceToGoal={distanceToGoal}
        monsterState={monsterState}
      />

      <MonsterChat
        visible={phase === GamePhase.ARGUMENT && !!argumentSession}
        session={argumentSession}
        secondsRemaining={secondsRemaining}
        onSubmit={handleChatSubmit}
      />

      <GameOverScreen
        visible={phase === GamePhase.GAME_OVER}
        result={result}
        onReturnToMenu={() => navigate("/")}
      />
    </>
  );
}
