import { useRef, useEffect, useState } from "react";
import { Game } from "../../engine/Game";

export default function BabylonCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [debug, setDebug] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const game = new Game(canvas);
    gameRef.current = game;

    game.onDebug = (info: string) => setDebug(info);

    game.start().catch((err) => console.error("Game failed to start:", err));

    const handleResize = () => game.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      game.dispose();
      gameRef.current = null;
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="game-canvas" />
      {debug && <div className="debug-overlay">{debug}</div>}
    </>
  );
}
