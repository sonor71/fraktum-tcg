import type { PropsWithChildren } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useGameStore } from "../useGameStore";

export default function Shell({ children }: PropsWithChildren) {
  const location = useLocation();
  const nav = useNavigate();
  const coins = useGameStore((state) => state.coins);
  const level = useGameStore((state) => state.level);
  const isMatchRoute = location.pathname.startsWith("/match/");

  return (
    <div className="shell">
      <div className="shellFx shellFxGrid" />
      <div className="shellFx shellFxGlow shellFxGlowA" />
      <div className="shellFx shellFxGlow shellFxGlowB" />
      <div className="shellNoise" />
      {!isMatchRoute ? (
        <>
          <div className="topbar">
            <button className="brand" onClick={() => nav("/")} type="button"><span className="brandDot" />FRAKTUM</button>
            <div className="topbarSpacer" />
            <div className="currencyRow"><div className="pill interactive"><div className="pillIcon" /><div><div className="pillLabel">Coins</div><div className="pillValue">{coins}</div></div></div><div className="pill interactive"><div className="pillIcon" /><div><div className="pillLabel">Level</div><div className="pillValue">{level}</div></div></div></div>
          </div>
          <div className="rightbar">
            <button className="rbtn" onClick={() => nav("/profile")} title="Profile" type="button">P</button>
            <button className="rbtn" onClick={() => nav("/collection")} title="Collection" type="button">C</button>
            <button className="rbtn" onClick={() => nav("/deck-builder")} title="Deck" type="button">D</button>
            <button className="rbtn" onClick={() => nav("/shop")} title="Market" type="button">M</button>
            <button className="rbtn" onClick={() => nav("/settings")} title="Settings" type="button">S</button>
          </div>
        </>
      ) : null}
      <div key={location.pathname} className="content pageEnter" style={isMatchRoute ? { top: 0, left: 0, right: 0, bottom: 0, padding: 0 } : undefined}>{children}</div>
    </div>
  );
}
