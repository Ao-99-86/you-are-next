import { GamePhase, type MonsterState } from "../../game/types";

interface AlivePlayer {
  id: string;
  name: string;
}

interface HUDProps {
  phase: GamePhase;
  distanceToGoal: number;
  monsterState: MonsterState;
  alivePlayers?: AlivePlayer[];
  onAssistTarget?: (id: string) => void;
}

function phaseLabel(phase: GamePhase): string {
  switch (phase) {
    case GamePhase.PLAYING:
      return "RUN";
    case GamePhase.ARGUMENT:
      return "ARGUMENT";
    case GamePhase.GAME_OVER:
      return "END";
    case GamePhase.LOADING:
    default:
      return "LOADING";
  }
}

export default function HUD({
  phase,
  distanceToGoal,
  monsterState,
  alivePlayers,
  onAssistTarget,
}: HUDProps) {
  return (
    <>
      <div className="hud" aria-live="polite">
        <div className="hud-row">
          <span className="hud-label">PHASE</span>
          <span className="hud-value">{phaseLabel(phase)}</span>
        </div>
        <div className="hud-row">
          <span className="hud-label">GOAL</span>
          <span className="hud-value">{distanceToGoal.toFixed(1)}m</span>
        </div>
        <div className="hud-row">
          <span className="hud-label">MONSTER</span>
          <span className="hud-value">{monsterState.toUpperCase()}</span>
        </div>
      </div>

      {alivePlayers && alivePlayers.length > 0 && onAssistTarget && (
        <div className="assist-panel">
          {alivePlayers.map((p) => (
            <button key={p.id} onClick={() => onAssistTarget(p.id)}>
              Assist {p.name}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
