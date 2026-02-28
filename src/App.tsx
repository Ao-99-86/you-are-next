import { useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { nanoid } from "nanoid";
import BabylonCanvas from "./components/BabylonCanvas";
import Lobby from "./components/Lobby";
import MultiplayerCanvas from "./components/MultiplayerCanvas";

function Landing() {
  const navigate = useNavigate();
  const [invite, setInvite] = useState("");

  const handleMultiplayer = () => {
    const roomId = nanoid(8);
    const params = invite.trim()
      ? `?invite=${encodeURIComponent(invite.trim())}`
      : "";
    navigate(`/lobby/${roomId}${params}`);
  };

  return (
    <div className="landing">
      <h1>YOU ARE NEXT</h1>
      <p>Run. Hide. Argue for your life.</p>
      <button onClick={() => navigate("/play")}>Solo</button>
      <input
        type="text"
        placeholder="Invite code"
        value={invite}
        onChange={(e) => setInvite(e.target.value)}
        className="landing-invite-input"
      />
      <button onClick={handleMultiplayer}>Multiplayer</button>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/play" element={<BabylonCanvas />} />
      <Route path="/lobby/:roomId" element={<Lobby />} />
      <Route path="/play/:roomId" element={<MultiplayerCanvas />} />
    </Routes>
  );
}
