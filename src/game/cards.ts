import raw from "../data/cards.json";
import type { Card } from "./types";

export const CARDS: Card[] = raw as Card[];

export const CARDS_BY_ID: Record<string, Card> = Object.fromEntries(
  CARDS.map((c) => [c.id, c])
);
