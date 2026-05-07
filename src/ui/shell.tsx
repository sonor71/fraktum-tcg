import type { PropsWithChildren } from "react";
import { useLocation } from "react-router-dom";

export default function Shell({ children }: PropsWithChildren) {
  const location = useLocation();
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
            <div className="brand">
              <span className="brandDot" />
              FRAKTUM
            </div>

            <div className="topbarSpacer" />

            <div className="currencyRow">
              <div className="pill interactive" title="Платная валюта">
                <div className="pillIcon" />
                <div>
                  <div className="pillLabel">Платная</div>
                  <div className="pillValue">10</div>
                </div>
              </div>

              <div className="pill interactive" title="Бесплатная валюта">
                <div className="pillIcon" />
                <div>
                  <div className="pillLabel">Бесплатная</div>
                  <div className="pillValue">1000</div>
                </div>
              </div>
            </div>
          </div>

          <div className="rightbar">
            <button className="rbtn" data-tip="Профиль игрока" title="Профиль игрока">
              <svg className="iconSvg" viewBox="0 0 24 24">
                <path d="M20 21a8 8 0 0 0-16 0" />
                <circle cx="12" cy="8" r="4" className="iconFill" />
              </svg>
            </button>

            <button className="rbtn" data-tip="Друзья" title="Друзья">
              <svg className="iconSvg" viewBox="0 0 24 24">
                <path d="M16 21v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" />
                <circle cx="9" cy="8" r="3" className="iconFill" />
                <path d="M22 21v-1a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a3 3 0 0 1 0 5.74" />
              </svg>
            </button>

            <button className="rbtn" data-tip="Батл-пасс" title="Батл-пасс">
              <svg className="iconSvg" viewBox="0 0 24 24">
                <path d="M7 20l5-3 5 3V4H7v16z" />
                <path d="M9 7h6M9 10h6" />
              </svg>
            </button>

            <button className="rbtn" data-tip="Задание дня" title="Задание дня">
              <svg className="iconSvg" viewBox="0 0 24 24">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </button>

            <button className="rbtn" data-tip="Топ игроков" title="Топ игроков">
              <svg className="iconSvg" viewBox="0 0 24 24">
                <path d="M8 21h8" />
                <path d="M12 17V3" />
                <path d="M7 8l5-5 5 5" />
              </svg>
            </button>
          </div>
        </>
      ) : null}

      <div
        key={location.pathname}
        className="content pageEnter"
        style={isMatchRoute ? { top: 0, left: 0, right: 0, bottom: 0, padding: 0 } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
