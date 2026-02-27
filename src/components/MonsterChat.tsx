import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ArgumentSession } from "../../game/types";

interface MonsterChatProps {
  visible: boolean;
  session: ArgumentSession | null;
  secondsRemaining: number;
  onSubmit: (message: string) => void;
  isActiveTyper?: boolean;
}

function useTypewriter(text: string, speedMs = 30): string {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    setDisplayed("");
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speedMs);
    return () => clearInterval(id);
  }, [text, speedMs]);
  return displayed;
}

export default function MonsterChat({
  visible,
  session,
  secondsRemaining,
  onSubmit,
  isActiveTyper = true,
}: MonsterChatProps) {
  const [message, setMessage] = useState("");
  const activeRound = useMemo(() => {
    if (!session) return null;
    return session.rounds[session.currentRound] ?? null;
  }, [session]);

  const activeTaunt = activeRound?.taunt ?? "";
  const typewriterText = useTypewriter(activeTaunt);

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
        <h2 className="monster-chat-title">THE MONSTER DEMANDS AN ARGUMENT</h2>
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
              <strong>Current taunt:</strong>{" "}
              {typewriterText}
              <span className="typewriter-cursor">|</span>
            </p>
            {isActiveTyper ? (
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
            ) : (
              <p className="monster-chat-result" style={{ opacity: 0.6 }}>
                WATCHING...
              </p>
            )}
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
