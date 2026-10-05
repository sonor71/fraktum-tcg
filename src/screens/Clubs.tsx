import { useState } from "react";
import "./clubs.css";

type ClubTab = "chat" | "wars" | "cards";

const TABS: { id: ClubTab; label: string }[] = [
  { id: "chat", label: "Клубный чат" },
  { id: "wars", label: "Клубные войны" },
  { id: "cards", label: "Клубные карты" },
];

export default function Clubs() {
  const [tab, setTab] = useState<ClubTab>("chat");

  return (
    <section className="clubsPage">
      <header className="clubsHeader">
        <div>
          <p>СОЦИАЛЬНАЯ ИГРА</p>
          <h1>Клубы</h1>
          <span>Минимальная клубная система без отдельного хаба и комнат.</span>
        </div>
      </header>

      <div className="clubsTabs" role="tablist" aria-label="Разделы клуба">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? "clubsTab is-active" : "clubsTab"}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="clubsPanel">
        {tab === "chat" ? (
          <>
            <h2>Клубный чат</h2>
            <p>Здесь будет общий чат участников клуба. Серверная отправка сообщений подключается отдельно.</p>
            <div className="clubsPlaceholder">ЧАТ КЛУБА</div>
          </>
        ) : null}

        {tab === "wars" ? (
          <>
            <h2>Клубные войны</h2>
            <p>Соревновательный раздел для противостояний клубов и общего клубного рейтинга.</p>
            <div className="clubsPlaceholder">КЛУБ A&nbsp;&nbsp; VS &nbsp;&nbsp;КЛУБ B</div>
          </>
        ) : null}

        {tab === "cards" ? (
          <>
            <h2>Клубные карты</h2>
            <p>Отдельный раздел для карт и механик, связанных с клубной системой.</p>
            <div className="clubsPlaceholder">КЛУБНЫЕ КАРТЫ</div>
          </>
        ) : null}
      </div>
    </section>
  );
}
