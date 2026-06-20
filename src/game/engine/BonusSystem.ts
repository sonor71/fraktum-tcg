import type { CardInstance } from "../core/types";
export function getBonusPercent(cards: CardInstance[]) { return cards.reduce((sum, card) => sum + (card.definition.effects?.find((e) => e.op === "bonus")?.percent ?? extractPercent(card.definition.description) ?? 10), 0); }
function extractPercent(text: string) { return Number(text.match(/(\d+)\s*%/)?.[1] ?? 0) || undefined; }
