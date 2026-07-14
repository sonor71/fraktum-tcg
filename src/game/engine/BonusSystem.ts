import type { CardDefinition, CardInstance, ScalableField } from "../core/types";
import { ELEMENT_BONUS_CAP } from "./Rules";

function readPercent(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.abs(number) > 1 ? number / 100 : number;
}
function extractPercent(text: string) { return readPercent(text.match(/(\d+)\s*%/)?.[1] ?? 0); }

export function getBonusPercent(cards: CardInstance[], hero?: CardInstance) {
  const heroElement = hero?.definition.element;
  return Math.min(ELEMENT_BONUS_CAP * 100, cards.reduce((sum, card) => {
    if (heroElement && card.definition.element && card.definition.element !== heroElement) return sum;
    return sum + ((readPercent(card.definition.effects?.find((e) => e.op === "bonus")?.percent) || extractPercent(card.definition.description) || 0) * 100);
  }, readPercent((hero?.definition as CardDefinition & { elementBonusPercent?: number } | undefined)?.elementBonusPercent ?? 0) * 100));
}

export function canScaleField(definition: CardDefinition, field: ScalableField) {
  const type = String(definition.type).toLowerCase();
  if (type !== "event" && type !== "attack") return false;
  if (definition.scalableByElementBonus === false) return false;
  return (definition.scalableFields ?? []).includes(field);
}

export function scaleByElementBonus(definition: CardDefinition, field: ScalableField, baseValue: number, bonusPercent: number) {
  if (!canScaleField(definition, field)) return baseValue;
  const fraction = bonusPercent > 1 ? bonusPercent / 100 : bonusPercent;
  return Math.round(baseValue * (1 + Math.min(ELEMENT_BONUS_CAP, Math.max(0, fraction))));
}
