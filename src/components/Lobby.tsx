import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGameRoom } from "../hooks/useGameRoom";

export default function Lobby() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const room = useGameRoom({
    onSnapshot: (snap) => {
      if (snap.phase === "playing" || snap.phase === "argument") {
        navigate(`/play/${roomId}`);
      }
    },
  });

  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);

  const handleJoin = () => {
    if (!roomId || !name.trim()) return;
    room.connect(roomId, name.trim());
    setJoined(true);
  };

  const selfPlayer = room.snapshot?.players.find(
    (p) => p.id === room.selfId
  );
  const connectedPlayers =
    room.snapshot?.players.filter((p) => p.connected) ?? [];
  const isReady = selfPlayer?.isReady ?? false;
  const hostId = room.snapshot?.hostId ?? null;
  const isHost = hostId === room.selfId;
  const allReady =
    connectedPlayers.length >= 2 &&
    connectedPlayers.every((p) => p.isReady);

  if (!roomId) {
    return (
      <div className="lobby">
        <h1>YOU ARE NEXT</h1>
        <p>Invalid room.</p>
      </div>
    );
  }

  // Name entry
  if (!joined) {
    return (
      <div className="lobby">
        <h1>YOU ARE NEXT</h1>
        <p className="lobby-room-id">Room: {roomId}</p>
        <form
          className="lobby-name-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleJoin();
          }}
        >
          <input
            type="text"
            placeholder="Enter your name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={16}
            autoFocus
          />
          <button type="submit" disabled={!name.trim()}>
            Join
          </button>
        </form>
      </div>
    );
  }

  // Waiting for connection
  if (!room.connected || !room.snapshot) {
    return (
      <div className="lobby">
        <h1>YOU ARE NEXT</h1>
        <p>Connecting...</p>
      </div>
    );
  }

  return (
    <div className="lobby">
      <h1>YOU ARE NEXT</h1>
      <p className="lobby-room-id">Room: {roomId}</p>

      <div className="lobby-players">
        <h3>Players ({connectedPlayers.length}/4)</h3>
        <ul>
          {room.snapshot.players.map((p) => (
            <li key={p.id} className="lobby-player-row">
              <span className="lobby-player-name">
                {p.name}
                {p.id === hostId && (
                  <span className="lobby-host-badge"> [HOST]</span>
                )}
                {!p.connected && <span className="lobby-host-badge"> [OFFLINE]</span>}
              </span>
              <span
                className={
                  p.isReady ? "lobby-ready ready" : "lobby-ready not-ready"
                }
              >
                {p.isReady ? "READY" : "NOT READY"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="lobby-actions">
        <button
          className="lobby-ready-btn"
          onClick={() => room.setReady(!isReady)}
        >
          {isReady ? "Unready" : "Ready Up"}
        </button>

        {isHost && (
          <button
            className="lobby-start-btn"
            onClick={() => room.requestStart()}
            disabled={!allReady}
          >
            Start Game
          </button>
        )}
      </div>

      {!allReady && isHost && (
        <p className="lobby-hint">
          All players must be ready to start (min 2 players).
        </p>
      )}
    </div>
  );
}
