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
};
