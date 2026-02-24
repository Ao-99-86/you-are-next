import { Routes, Route, useNavigate } from "react-router-dom";
import BabylonCanvas from "./components/BabylonCanvas";

function Landing() {
  const navigate = useNavigate();
  return (
    <div className="landing">
      <h1>YOU ARE NEXT</h1>
      <p>Run. Hide. Argue for your life.</p>
      <button onClick={() => navigate("/play")}>Play</button>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/play" element={<BabylonCanvas />} />
    </Routes>
  );
}
