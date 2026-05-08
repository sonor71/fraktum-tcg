import { BrowserRouter, Route, Routes } from "react-router-dom";
import Collection from "./screens/Collection";
import DeckBuilder from "./screens/DeckBuilder";

import Hub from "./screens/Hub/Hub";

import Hub from "./screens/Hub";

import MatchLauncher from "./screens/MatchLauncher";
import MatchScreen from "./screens/Match/MatchScreen";
import Profile from "./screens/Profile";
import Settings from "./screens/Settings";
import Shop from "./screens/Shop";
import Shell from "./ui/shell";

export default function App() {
  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Hub />} />
          <Route path="/collection" element={<Collection />} />
          <Route path="/deck-builder" element={<DeckBuilder />} />
          <Route path="/deck" element={<DeckBuilder />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/match-launcher" element={<MatchLauncher />} />
          <Route path="/match/ai" element={<MatchScreen />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
}
