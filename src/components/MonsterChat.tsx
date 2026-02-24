import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ArgumentSession } from "../../game/types";

interface MonsterChatProps {
  visible: boolean;
  session: ArgumentSession | null;
  secondsRemaining: number;
  onSubmit: (message: string) => void;
}

export default function MonsterChat({
  visible,
  session,
  secondsRemaining,
  onSubmit,
}: MonsterChatProps) {
  const [message, setMessage] = useState("");
  const activeRound = useMemo(() => {
    if (!session) return null;
    return session.rounds[session.currentRound] ?? null;
  }, [session]);

  useEffect(() => {
    setMessage("");
  }, [session?.id, session?.currentRound]);

  if (!visible || !session) return null;

  const isInProgress = session.outcome === "in_progress";
  const onFormSubmit = (evt: FormEvent) => {
    evt.preventDefault();
    if (!isInProgress) return;
    onSubmit(message);
    setMessage("");
  };

  return (
    <div className="monster-chat-overlay">
      <div className="monster-chat-card">
        <h2>THE MONSTER DEMANDS AN ARGUMENT</h2>
        <div className="monster-chat-meta">
          <span>
            Round {Math.min(session.currentRound + 1, session.rounds.length)} / {session.rounds.length}
          </span>
          <span>Score {session.totalScore} / {session.requiredScore}</span>
          <span>{secondsRemaining}s</span>
        </div>

        <div className="monster-chat-log" role="log" aria-live="polite">
          {session.rounds.map((round) => (
            <div key={round.roundNumber} className="monster-chat-round">
              <p className="monster-line">
                <strong>Monster:</strong> {round.taunt}
              </p>
              {round.playerMessage && (
                <p className="player-line">
                  <strong>You:</strong> {round.playerMessage}
                </p>
              )}
              {round.monsterReply && (
                <p className="monster-line">
                  <strong>Monster:</strong> {round.monsterReply}
                </p>
              )}
            </div>
          ))}
        </div>

        {isInProgress && activeRound && (
          <div className="monster-chat-active">
            <p className="monster-line">
              <strong>Current taunt:</strong> {activeRound.taunt}
            </p>
            <form onSubmit={onFormSubmit} className="monster-chat-form">
              <input
                value={message}
                onChange={(evt) => setMessage(evt.target.value)}
                placeholder="Type your defense..."
                autoFocus
                maxLength={220}
              />
              <button type="submit">Send</button>
            </form>
          </div>
        )}

        {!isInProgress && (
          <p className="monster-chat-result">
            {session.outcome === "won"
              ? "You survived this round. Run."
              : "The monster is done listening."}
          </p>
        )}
      </div>
    </div>
  );
}
