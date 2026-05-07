import { BrowserRouter, Route, Routes } from "react-router-dom";
import Collection from "./screens/Collection";
import Deck from "./screens/Deck";
import Inventory from "./screens/Inventory";
import MatchScreen from "./screens/Match/MatchScreen";
import Menu from "./screens/Menu";
import PackOpen from "./screens/PackOpen";
import PlayModes from "./screens/PlayModes";
import Shop from "./screens/Shop";
import Shell from "./ui/shell";

export default function App() {
  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Menu />} />
          <Route path="/collection" element={<Collection />} />
          <Route path="/deck" element={<Deck />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/pack" element={<PackOpen />} />
          <Route path="/play" element={<PlayModes />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/match/ai" element={<MatchScreen />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
}
