import { GameResult } from "../../game/types";

interface GameOverScreenProps {
  visible: boolean;
  result: GameResult | null;
  onReturnToMenu: () => void;
}

export default function GameOverScreen({
  visible,
  result,
  onReturnToMenu,
}: GameOverScreenProps) {
  if (!visible || !result) return null;

  return (
    <div className="game-over-screen">
      <div className="game-over-card">
        <h2>{result === GameResult.WIN ? "YOU ESCAPED" : "YOU WERE EATEN"}</h2>
        <p>
          {result === GameResult.WIN
            ? "You reached the far edge of the forest."
            : "Your argument failed. The forest goes silent."}
        </p>
        <button onClick={onReturnToMenu}>Return</button>
      </div>
    </div>
  );
}
