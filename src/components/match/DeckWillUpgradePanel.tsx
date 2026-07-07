import {
  getWillUpgradePreview,
  useGameStore,
  type WillUpgradeKey,
} from "../../useGameStore";
import "./DeckWillUpgradePanel.css";

function UpgradeRow({
  title,
  value,
  description,
  level,
  canUpgrade,
  onUpgrade,
}: {
  title: string;
  value: string;
  description: string;
  level: number;
  canUpgrade: boolean;
  onUpgrade: () => void;
}) {
  return (
    <div className="deckWillUpgradeRow">
      <div className="deckWillUpgradeInfo">
        <span>{title}</span>
        <b>{value}</b>
        <small>{description}</small>
      </div>

      <div className="deckWillUpgradeMeta">
        <i>LVL {level}</i>
        <button type="button" onClick={onUpgrade} disabled={!canUpgrade}>
          + UPGRADE
        </button>
      </div>
    </div>
  );
}

export function DeckWillUpgradePanel() {
  const level = useGameStore((state) => state.level);
  const willUpgrades = useGameStore((state) => state.willUpgrades);
  const upgradeWillStat = useGameStore((state) => state.upgradeWillStat);
  const preview = getWillUpgradePreview(level, willUpgrades);

  const handleUpgrade = (key: WillUpgradeKey) => {
    upgradeWillStat(key);
  };

  return (
    <section className="deckWillUpgradePanel" aria-label="Will upgrades">
      <header className="deckWillUpgradeHeader">
        <div>
          <span>Прокачка воли</span>
          <h3>Will Core</h3>
        </div>

        <strong title="Очки прокачки даются за каждый 2-й уровень профиля">
          {preview.availablePoints}/{preview.totalPoints} points
        </strong>
      </header>

      <div className="deckWillUpgradeSummary">
        <span>Матч начнётся с параметрами:</span>
        <b>MAX WILL {preview.maxWill}</b>
        <b>+{preview.regenPerRound}/ROUND</b>
      </div>

      <UpgradeRow
        title="Максимум воли"
        value={`${preview.maxWill}`}
        description="Увеличивает верхний лимит Will в матче."
        level={preview.maxWillLevel}
        canUpgrade={preview.maxWillCanUpgrade}
        onUpgrade={() => handleUpgrade("maxWill")}
      />

      <UpgradeRow
        title="Пополнение за раунд"
        value={`+${preview.regenPerRound}`}
        description="В начале каждого твоего раунда восстанавливает Will до лимита."
        level={preview.regenLevel}
        canUpgrade={preview.regenCanUpgrade}
        onUpgrade={() => handleUpgrade("regen")}
      />

      <p className="deckWillUpgradeNote">
        1 очко прокачки даётся за каждый 2-й уровень профиля. Очки тратятся навсегда для текущего профиля.
      </p>
    </section>
  );
}
