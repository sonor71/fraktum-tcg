import type { CardDefinition } from "./types";

/** Search the market in both supported title languages, as well as by ID or collection. */
export function matchesMarketCardSearch(
  card: Pick<CardDefinition, "id" | "title" | "ruTitle" | "collection">,
  rawQuery: string,
): boolean {
  const query = rawQuery.trim().toLocaleLowerCase("ru-RU");
  if (!query) return true;

  return [card.ruTitle, card.title, card.id, card.collection].some((value) =>
    (value ?? "").toLocaleLowerCase("ru-RU").includes(query),
  );
}
