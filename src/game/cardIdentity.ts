import { CARDS_BY_ID } from "./cards";

function compactTitle(title: string) {
  return title.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export function getCardCode(baseId: string) {
  const digits = baseId.match(/\d+/)?.[0];
  const indexCode = digits ?? String(Object.keys(CARDS_BY_ID).indexOf(baseId) + 1 || 1);
  return indexCode.padStart(3, "0").slice(-3);
}

export function getCardPrefix(baseId: string) {
  const definition = CARDS_BY_ID[baseId];
  const source = compactTitle(definition?.title ?? definition?.type ?? baseId);
  return (source.slice(0, 3) || "FRK").padEnd(3, "X");
}

export function createUniqueCardId(baseId: string, serial: number) {
  const serialText = String(serial).padStart(6, "0");
  return `${getCardPrefix(baseId)}-${getCardCode(baseId)}-${serialText}`;
}

export function getDefinitionIdByUniqueId(uniqueId: string) {
  const [prefix, code] = uniqueId.split("-");
  return Object.keys(CARDS_BY_ID).find((baseId) => getCardPrefix(baseId) === prefix && getCardCode(baseId) === code) ?? null;
}
