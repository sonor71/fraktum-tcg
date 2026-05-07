import { useNavigate } from "react-router-dom";
import { useGameStore } from "../useGameStore";

export default function Settings() {
  const nav = useNavigate();
  const settings = useGameStore((state) => state.settings);
  const setSettings = useGameStore((state) => state.setSettings);
  const giveDemoCoins = useGameStore((state) => state.giveDemoCoins);
  const giveStarterCards = useGameStore((state) => state.giveStarterCards);
  const resetProgress = useGameStore((state) => state.resetProgress);

  return (
    <section className="demo-page">
      <header className="page-head"><div><p>System</p><h1>Settings & Demo Tools</h1></div><button onClick={() => nav("/")} type="button">Back to Hub</button></header>
      <div className="settings-grid">
        <section className="glass-panel"><h2>Settings</h2><label><input type="checkbox" checked={settings.sound} onChange={(event) => setSettings({ sound: event.target.checked })} /> Sound</label><label><input type="checkbox" checked={settings.music} onChange={(event) => setSettings({ music: event.target.checked })} /> Music</label><label><input type="checkbox" checked={settings.reducedMotion} onChange={(event) => setSettings({ reducedMotion: event.target.checked })} /> Reduced motion</label></section>
        <section className="glass-panel"><h2>Demo Seed Data</h2><button onClick={giveDemoCoins} type="button">Give Demo Coins</button><button onClick={giveStarterCards} type="button">Give Starter Cards</button><button className="danger" onClick={resetProgress} type="button">Reset Progress</button></section>
      </div>
    </section>
  );
}
