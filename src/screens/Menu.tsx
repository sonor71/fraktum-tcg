import { useNavigate } from "react-router-dom";

export default function Menu() {
  const nav = useNavigate();

  return (
    <div className="menuRoot">
      <div className="menuCenter">
        <button className="menuBtn top" onClick={() => nav("/inventory")}>
          ИНВЕНТАРЬ
        </button>

        <button className="menuBtn left" onClick={() => nav("/collection")}>
          КОЛЛЕКЦИЯ
        </button>

        <button className="menuBtn center" onClick={() => nav("/shop")}>
          МАГАЗИН
        </button>

        <button className="menuBtn right" onClick={() => alert("Рынок — скоро")}>
          РЫНОК
        </button>

        <button className="menuBtn bottom" onClick={() => nav("/play")}>
          ИГРАТЬ
        </button>
      </div>
    </div>
  );
}
