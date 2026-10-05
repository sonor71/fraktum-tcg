import { useEffect } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import BackgroundMusic from "./components/BackgroundMusic";
import { CardPassportHost } from "./components/CardPassport";
import MatchPage from "./components/match/MatchPage";
import Collection from "./screens/Collection";
import Clubs from "./screens/Clubs";
import Deck from "./screens/Deck";
import Inventory from "./screens/Inventory";
import Market from "./screens/Market";
import Menu from "./screens/Menu";
import PackOpen from "./screens/PackOpen";
import PlayModes from "./screens/PlayModes";
import Profile from "./screens/Profile";
import Settings from "./screens/Settings";
import Shop from "./screens/Shop";
import { syncSupabaseSessionFromLauncher } from "./services/supabaseClient";
import Shell from "./ui/shell";

export default function App() {
  useEffect(() => {
    void syncSupabaseSessionFromLauncher();
  }, []);

  return (
    <HashRouter>
      <BackgroundMusic />
      <CardPassportHost />

      <Shell>
        <Routes>
          <Route path="/" element={<Menu />} />
          <Route path="/play" element={<PlayModes />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/collection" element={<Collection />} />
          <Route path="/deck" element={<Deck />} />
          <Route path="/deck-builder" element={<Navigate to="/deck" replace />} />
          <Route path="/market" element={<Market />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/clubs" element={<Clubs />} />
          <Route path="/pack" element={<PackOpen />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/match/ai" element={<MatchPage />} />
          <Route path="/match/online" element={<MatchPage />} />
          <Route path="/match/:mode" element={<MatchPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </HashRouter>
  );
}
