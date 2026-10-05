import { useNavigate } from "react-router-dom";
import "./core-menu.css";

const MAIN_ACTIONS = [
  { title: "АРЕНА", subtitle: "Матчи и рейтинговая игра", path: "/play", primary: true },
  { title: "ИНВЕНТАРЬ", subtitle: "Карты, коллекция и колоды", path: "/inventory" },
  { title: "МАРКЕТ", subtitle: "Торговля между игроками", path: "/market" },
  { title: "МАГАЗИН", subtitle: "Наборы и игровые товары", path: "/shop" },
  { title: "КЛУБЫ", subtitle: "Чат, войны и клубные карты", path: "/clubs" },
  { title: "ПРОФИЛЬ", subtitle: "Статистика и прогресс", path: "/profile" },
];

export default function Menu() {
  const navigate = useNavigate();

  return (
    <section className="coreMenuRoot">
      <div className="coreMenuBackdrop" aria-hidden="true" />
      <div className="coreMenuPanel">
        <div className="coreMenuHeading">
          <p>FRAKTUM TCG</p>
          <h1>Собери колоду. Выйди на арену.</h1>
          <span>Основная версия сфокусирована на карточных матчах и соревновательной игре.</span>
        </div>

        <div className="coreMenuGrid">
          {MAIN_ACTIONS.map((action) => (
            <button
              key={action.path}
              type="button"
              className={action.primary ? "coreMenuAction is-primary" : "coreMenuAction"}
              onClick={() => navigate(action.path)}
            >
              <strong>{action.title}</strong>
              <span>{action.subtitle}</span>
            </button>
          ))}
        </div>

        <button className="coreMenuSettings" type="button" onClick={() => navigate("/settings")}>
          НАСТРОЙКИ
        </button>
      </div>
    </section>
  );
}
