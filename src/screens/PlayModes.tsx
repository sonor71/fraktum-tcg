import { useNavigate } from "react-router-dom";
import { FRAKTUM_MAIN_DECK_SIZE, splitDeckSelection } from "../game/deckRules";
import { useGameStore } from "../useGameStore";

type Mode = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  status: "open" | "locked";
  badge: string;
  actionLabel: string;
  onClick: () => void;
};

export default function PlayModes() {
  const nav = useNavigate();
  const ownedCards = useGameStore((state) => state.ownedCards);
  const deckIds = useGameStore((state) => state.deckIds);
  const mainDeckCount = splitDeckSelection(ownedCards, deckIds).mainDeck.length;

  const openMatch = (path: string) => {
    if (mainDeckCount !== FRAKTUM_MAIN_DECK_SIZE) {
      window.alert(
        `Сначала собери ровно ${FRAKTUM_MAIN_DECK_SIZE} основных карт в сцене DECK. Сейчас выбрано: ${mainDeckCount}.`,
      );
      nav("/deck");
      return;
    }

    nav(path);
  };

  const openAiMatch = () => openMatch("/match/ai");
  const openOnlineMatchmaking = () => openMatch("/match/online");

  const MODES: Mode[] = [
    {
      id: "story",
      title: "СЮЖЕТ",
      subtitle: "кампания и главы",
      description:
        "Проходи историю FRAKTUM, открывай новые эпизоды и развивай свою колоду по мере прохождения.",
      status: "locked",
      badge: "закрыто",
      actionLabel: "СКОРО",
      onClick: () => {},
    },
    {
      id: "ai",
      title: "СОРЕВНОВАТЕЛЬНЫЙ С ИИ",
      subtitle: "быстрый тестовый матч",
      description:
        "Локальный режим для быстрой проверки интерфейса, D20, Воли и базовой логики карт. Бот остаётся только как тестовый стенд.",
      status: "open",
      badge: "доступно",
      actionLabel: "ИГРАТЬ",
      onClick: openAiMatch,
    },
    {
      id: "online",
      title: "СОРЕВНОВАТЕЛЬНЫЙ ОНЛАЙН",
      subtitle: "PvP matchmaking beta",
      description:
        "Поиск реального соперника через Supabase matchmaking. Комната создаётся на сервере, второй игрок подключается к ней через Realtime.",
      status: "open",
      badge: "beta",
      actionLabel: "ИСКАТЬ ИГРОКА",
      onClick: openOnlineMatchmaking,
    },
  ];

  return (
    <div className="playRoot">
      <div className="playBackdrop" aria-hidden="true" />

      <div className="playHeader">
        <div className="playKicker">ВЫБОР РЕЖИМА</div>
        <h1 className="playTitle">Во что сыграем?</h1>
        <p className="playLead">
          Выбери режим, который подходит тебе сейчас. Онлайн-режим использует Supabase beta-matchmaking.
        </p>
      </div>

      <div className="playGrid">
        {MODES.map((mode) => {
          const locked = mode.status === "locked";

          return (
            <section
              key={mode.id}
              className={`playCard ${locked ? "isLocked" : "isOpen"}`}
            >
              <div className="playCardGlow" aria-hidden="true" />

              <div className="playCardInner">
                <div className="playCardTop">
                  <span
                    className={`playBadge ${
                      locked ? "isLocked" : "isOpen"
                    }`}
                  >
                    {mode.badge}
                  </span>
                  <span className="playModeLine" />
                </div>

                <div className="playTextBlock">
                  <h2 className="playModeTitle">{mode.title}</h2>
                  <div className="playModeSubtitle">{mode.subtitle}</div>
                  <p className="playModeDescription">{mode.description}</p>
                </div>

                <button
                  className={`playActionBtn ${locked ? "isLocked" : "isOpen"}`}
                  onClick={() => {
                    if (!locked) mode.onClick();
                  }}
                  disabled={locked}
                >
                  {mode.actionLabel}
                </button>
              </div>
            </section>
          );
        })}
      </div>

      <div className="playFooter">
        <button className="playBackBtn" onClick={() => nav("/")}>НАЗАД В МЕНЮ</button>
      </div>
    </div>
  );
}
