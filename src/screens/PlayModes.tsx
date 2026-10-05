import { useNavigate } from "react-router-dom";
import { FRAKTUM_MAIN_DECK_SIZE, splitDeckSelection } from "../game/deckRules";
import { useGameStore } from "../useGameStore";

export default function PlayModes() {
  const nav = useNavigate();
  const ownedCards = useGameStore((state) => state.ownedCards);
  const deckIds = useGameStore((state) => state.deckIds);
  const mainDeckCount = splitDeckSelection(ownedCards, deckIds).mainDeck.length;
  const deckReady = mainDeckCount === FRAKTUM_MAIN_DECK_SIZE;

  const openMatch = (path: string) => {
    if (!deckReady) {
      nav("/deck");
      return;
    }
    nav(path);
  };

  return (
    <div className="playRoot playRootV2">
      <div className="playBackdrop" aria-hidden="true" />

      <header className="playHeader playHeaderV2">
        <span className="playKicker">АРЕНА FRAKTUM</span>
        <h1 className="playTitle">Выбери матч</h1>
        <p className="playLead">
          Без лишних режимов: быстрый тест против ИИ или реальный PvP.
        </p>

        <button
          type="button"
          className={deckReady ? "playDeckStatus is-ready" : "playDeckStatus"}
          onClick={() => nav("/deck")}
        >
          <span>КОЛОДА</span>
          <b>{mainDeckCount}/{FRAKTUM_MAIN_DECK_SIZE}</b>
          <small>{deckReady ? "ГОТОВА" : "НУЖНО СОБРАТЬ"}</small>
        </button>
      </header>

      <div className="playGrid playGridV2">
        <section className="playCard playCardV2 isOpen">
          <div className="playCardGlow" aria-hidden="true" />
          <div className="playCardInner">
            <div className="playCardTop">
              <span className="playBadge isOpen">ТРЕНИРОВКА</span>
              <span className="playModeLine" />
            </div>
            <div className="playTextBlock">
              <h2 className="playModeTitle">ПРОТИВ ИИ</h2>
              <div className="playModeSubtitle">быстрый матч без очереди</div>
              <p className="playModeDescription">
                Проверяй колоду, D20, Волю и комбинации карт.
              </p>
            </div>
            <button className="playActionBtn isOpen" type="button" onClick={() => openMatch("/match/ai")}>
              ИГРАТЬ
            </button>
          </div>
        </section>

        <section className="playCard playCardV2 isOpen is-ranked">
          <div className="playCardGlow" aria-hidden="true" />
          <div className="playCardInner">
            <div className="playCardTop">
              <span className="playBadge isOpen">PVP BETA</span>
              <span className="playModeLine" />
            </div>
            <div className="playTextBlock">
              <h2 className="playModeTitle">ОНЛАЙН</h2>
              <div className="playModeSubtitle">матч против игрока</div>
              <p className="playModeDescription">
                Основной соревновательный режим FRAKTUM.
              </p>
            </div>
            <button className="playActionBtn isOpen" type="button" onClick={() => openMatch("/match/online")}>
              НАЙТИ ИГРОКА
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
