import type { PlayerState } from "../../game/core/types";
import { BonusSlots } from "./BonusSlots";
import { StatusBar } from "./StatusBar";

export function HeroPanel({ player, label, alignment = "left" }: { player: PlayerState; label: string; alignment?: "left" | "right" }) {
  return (
    <section className={`matchHeroPanel is-${alignment}`}>
      <div className="matchHeroIdentity">
        <div>
          <span className="matchHeroRank">{player.id === "enemy" ? "AI Rank III" : "Fraktum Adept"}</span>
          <h2>{label}</h2>
        </div>
        <div className="matchShieldPip" title={`Shield ${player.shield}`}>◆ {player.shield}</div>
      </div>

      <div className="matchHeroBody">
        <div className="matchHeroPortrait">
          <img src={player.hero.definition.image} alt={player.hero.definition.title} />
        </div>
        <div className="matchHeroMeters">
          <StatusBar label="HP" value={player.hp} max={player.maxHp} tone="hp" />
          <StatusBar label="Will" value={player.will} max={player.maxWill} tone="will" />
          <StatusBar label="Shield" value={player.shield} max={Math.max(5, player.shield)} tone="shield" />
        </div>
      </div>

      <BonusSlots cards={player.bonusCards} />
    </section>
  );
}
