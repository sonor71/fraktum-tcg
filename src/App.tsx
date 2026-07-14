import { useEffect } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import BackgroundMusic from "./components/BackgroundMusic";
import Collection from "./screens/Collection";
import Deck from "./screens/Deck";
import Hub from "./screens/Hub";
import Inventory from "./screens/Inventory";
import Market from "./screens/Market";
import MatchPage from "./components/match/MatchPage";
import PackOpen from "./screens/PackOpen";
import PlayModes from "./screens/PlayModes";
import Profile from "./screens/Profile";
import Settings from "./screens/Settings";
import Shop from "./screens/Shop";
import Shell from "./ui/shell";
import { syncSupabaseSessionFromLauncher } from "./services/supabaseClient";
import { CardPassportHost } from "./components/CardPassport";

export default function App() {
  useEffect(() => {
    void syncSupabaseSessionFromLauncher();
  }, []);

  return (
    <HashRouter >
      <BackgroundMusic />
      <CardPassportHost />

      <Shell>
        <Routes>
          <Route path="/" element={<Hub />} />
          <Route path="/collection" element={<Collection />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/deck" element={<Deck />} />
          <Route path="/deck-builder" element={<Navigate to="/deck" replace />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/market" element={<Market />} />
          <Route path="/pack" element={<PackOpen />} />
          <Route path="/play" element={<PlayModes />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/match/ai" element={<MatchPage />} />
          <Route path="/match/online" element={<MatchPage />} />
          <Route path="/match/:mode" element={<MatchPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </HashRouter >
  );
}
