import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const zones = [
  { id: "arena", title: "Arena", path: "/match-launcher", x: 72, y: 44 },
  { id: "market", title: "Market", path: "/shop", x: 26, y: 35 },
  { id: "collection", title: "Collection", path: "/collection", x: 44, y: 70 },
  { id: "profile", title: "Profile", path: "/profile", x: 82, y: 72 },
  { id: "deck", title: "Deck Builder", path: "/deck-builder", x: 56, y: 24 },
];

export default function Hub() {
  const nav = useNavigate();
  const [player, setPlayer] = useState({ x: 50, y: 52 });
  const nearest = useMemo(() => zones.find((zone) => Math.hypot(zone.x - player.x, zone.y - player.y) < 12), [player]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "e" && nearest) nav(nearest.path);
      setPlayer((current) => {
        const speed = 3;
        const next = { ...current };
        if (key === "w" || key === "arrowup") next.y -= speed;
        if (key === "s" || key === "arrowdown") next.y += speed;
        if (key === "a" || key === "arrowleft") next.x -= speed;
        if (key === "d" || key === "arrowright") next.x += speed;
        return { x: Math.min(92, Math.max(8, next.x)), y: Math.min(86, Math.max(14, next.y)) };
      });
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [nav, nearest]);

  return (
    <section className="demo-page hub-page">
      <div className="hub-map" style={{ backgroundPosition: `${50 - player.x / 8}% ${50 - player.y / 10}%` }}>
        <div className="hub-title">
          <p>FRAKTUM CITY</p>
          <h1>Demo Hub</h1>
          <span>Move with WASD / arrows. Approach a district and press E.</span>
        </div>
        {zones.map((zone) => (
          <button key={zone.id} className={`hub-zone ${nearest?.id === zone.id ? "is-near" : ""}`} style={{ left: `${zone.x}%`, top: `${zone.y}%` }} onClick={() => nav(zone.path)} type="button">
            <span>{zone.title}</span>
            {nearest?.id === zone.id ? <small>Press E to interact</small> : null}
          </button>
        ))}
        <div className="hub-player" style={{ left: `${player.x}%`, top: `${player.y}%` }}><span /></div>
      </div>
      <nav className="quick-nav">
        {zones.map((zone) => <button key={zone.id} onClick={() => nav(zone.path)} type="button">{zone.title}</button>)}
        <button onClick={() => nav("/settings")} type="button">Settings</button>
      </nav>
    </section>
  );
}
