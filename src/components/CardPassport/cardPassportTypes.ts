export type PassportElement =
  | "void"
  | "fire"
  | "ice"
  | "lightning"
  | "water"
  | "neutral";

export type PassportKind =
  | "character"
  | "attack"
  | "tactic"
  | "effect"
  | "bonus"
  | "event"
  | "upgrade"
  | "special";

export interface CardPassportData {
  baseId: string;
  code: string;
  name: string;
  frontImage: string;
  backImage: string;
  element: PassportElement;
  elementLabel: string;
  kind: PassportKind;
  kindLabel: string;
  willCost: number;
  effectText: string;
  usageRules: string;
  history?: string;
  onlinePrice?: number | null;
  currencyLabel: string;
  rarity: string;
  collection?: string;
}

export interface OpenPassportDetail {
  baseId: string;
  instanceId?: string;
  frontImage?: string;
  code?: string;
  onlinePrice?: number | null;
}
