import type { PassportElement } from "./cardPassportTypes";

export interface CardPassportOverride {
  element?: PassportElement;
  usageRules?: string;
  history?: string;
}

/**
 * Здесь можно вручную уточнять стихию, правила и историю конкретных карт.
 * История отображается только тогда, когда поле history действительно заполнено.
 */
export const CARD_PASSPORT_OVERRIDES: Record<string, CardPassportOverride> = {
  fire: { element: "fire" },
  ice: { element: "ice" },
  spherical_lightning: { element: "lightning" },
  thunderer: { element: "lightning" },
  thunderbolts: { element: "lightning" },
  felix: { element: "lightning" },
  Stun_Gun: { element: "lightning" },
  titan_eye: { element: "lightning" },
  shadow_sword: { element: "void" },
  warlock: { element: "void" },
  brian: { element: "void" },
  hyper_night: { element: "void" },
  reverse_heart: { element: "void" },
  reverse: { element: "void" },
  fifteen_sixteen: { element: "void" },
  psychological_disorder: { element: "void" },
  unrequited_love: { element: "void" },
  excalibur: { element: "fire" },
  time_of_reckoning: { element: "fire" },
  dragon_eye: { element: "fire" },
  phoenix_feather: { element: "fire" },
  elite_knight: { element: "neutral", usageRules: "Разыграйте в свободный слот. При входе Элитный рыцарь наносит 4 урона только карте противника в противоположном слоте и остаётся на поле с 6 HP." },
  healing: { element: "neutral", usageRules: "Выберите союзную карту на поле. Она восстанавливает до 3 HP, не превышая напечатанный максимум." },
  tsunami: { element: "water", usageRules: "Наносит 2 урона каждой карте противника на поле. Герои и союзные карты не получают урон." },
  clean_sheet: { element: "neutral", usageRules: "При розыгрыше выберите другую карту в своей руке: она отправится в сброс, после чего вы доберёте до 2 карт из колоды." },
  hero_silhouette: { element: "neutral", usageRules: "Даёт герою щит на 3 урона. В начале следующего собственного хода даёт 1 Волю, не превышая максимума." },
  prime: { element: "neutral", usageRules: "Разыграйте в свободный слот. Пока Прайм с 6 HP находится на поле, первый урон герою в каждом ходе уменьшается на 2." },
};
