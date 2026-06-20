import { useNavigate } from "react-router-dom"

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

  const openReactMatch = () => nav("/match/ai");

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
      subtitle: "быстрый матч",
      description:
        "Сразись против искусственного интеллекта по правилам FRAKTUM: D20, Воля, эффекты карт и простой ИИ уже встроены в React/TypeScript матч.",
      status: "open",
      badge: "доступно",
      actionLabel: "ИГРАТЬ",
      onClick: openReactMatch,
    },
    {
      id: "money",
      title: "СОРЕВНОВАТЕЛЬНЫЙ НА ДЕНЬГИ",
      subtitle: "PvP с игроками",
      description:
        "Матчи против реальных игроков с денежным входом и повышенными ставками. Режим откроется позже.",
      status: "locked",
      badge: "закрыто",
      actionLabel: "СКОРО",
      onClick: () => {},
    },
  ];

  return (
    <div className="playRoot">
      <div className="playBackdrop" aria-hidden="true" />

      <div className="playHeader">
        <div className="playKicker">ВЫБОР РЕЖИМА</div>
        <h1 className="playTitle">Во что сыграем?</h1>
        <p className="playLead">
          Выбери режим, который подходит тебе сейчас. Некоторые режимы пока
          закрыты и появятся позже.
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
        <button className="playBackBtn" onClick={() => nav("/")}>
          НАЗАД В МЕНЮ
        </button>
      </div>
    </div>
  );
}