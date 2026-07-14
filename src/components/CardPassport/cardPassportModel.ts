import rawCards from "../../data/cards.json";
import { CARDS } from "../../game/cards";
import { getWillCostByRarity } from "../../game/rarityWillCost";
import type { CardDefinition, OwnedCard } from "../../game/types";
import { CARD_PASSPORT_OVERRIDES } from "./cardPassportOverrides";
import type {
  CardPassportData,
  OpenPassportDetail,
  PassportElement,
  PassportKind,
} from "./cardPassportTypes";

type RawCardMeta = {
  id: string;
  title?: string;
  ruTitle?: string;
  type?: string;
  rarity?: string;
  cost?: number;
  attack?: number;
  health?: number;
  description?: string;
  image?: string;
  effectKey?: string;
  collection?: string;
  element?: PassportElement;
  usageRules?: string;
  history?: string;
};

type ExtendedCardDefinition = CardDefinition & {
  ruTitle?: string;
  element?: PassportElement;
  usageRules?: string;
  history?: string;
};

const RAW_CARDS = rawCards as RawCardMeta[];
const RAW_BY_ID = new Map(RAW_CARDS.map((card) => [card.id, card]));

const ELEMENT_LABELS: Record<PassportElement, string> = {
  void: "ПУСТОТА",
  fire: "ОГОНЬ",
  ice: "ЛЁД",
  lightning: "МОЛНИЯ",
  water: "ВОДА",
  neutral: "НЕЙТРАЛЬНАЯ",
};

const KIND_LABELS: Record<PassportKind, string> = {
  character: "ПЕРСОНАЖ",
  attack: "АТАКА",
  tactic: "ТАКТИКА",
  effect: "ЭФФЕКТ",
  bonus: "БОНУСНАЯ",
  event: "СОБЫТИЕ",
  upgrade: "УЛУЧШЕНИЕ",
  special: "ОСОБАЯ",
};

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePath(value: string) {
  try {
    const url = new URL(value, window.location.href);
    return decodeURIComponent(url.pathname).replace(/\\/g, "/").toLowerCase();
  } catch {
    return decodeURIComponent(value).replace(/\\/g, "/").toLowerCase();
  }
}

function normalizeTitle(value: string) {
  return value.trim().toLocaleLowerCase("ru-RU");
}

function normalizeKind(type: unknown): PassportKind {
  const value = String(type ?? "special").toLowerCase();
  if (value === "character") return "character";
  if (value === "attack") return "attack";
  if (value === "tactic") return "tactic";
  if (value === "effect") return "effect";
  if (value === "bonus") return "bonus";
  if (value === "event") return "event";
  if (value === "upgrade") return "upgrade";
  return "special";
}

function inferElement(card: ExtendedCardDefinition, raw: RawCardMeta | undefined): PassportElement {
  const override = CARD_PASSPORT_OVERRIDES[card.id]?.element;
  if (override) return override;
  if (card.element) return card.element;
  if (raw?.element) return raw.element;

  const source = [
    card.id,
    card.title,
    card.description,
    card.effectKey,
    card.collection,
    raw?.ruTitle,
    raw?.collection,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/lightning|electric|thunder|storm|молни|электр|гром/.test(source)) return "lightning";
  if (/flame|fire|ember|phoenix|огонь|плам|жар/.test(source)) return "fire";
  if (/ice|glacier|frost|л[её]д|мороз|замораж/.test(source)) return "ice";
  if (/water|ocean|tide|aqua|вода|водн|океан/.test(source)) return "water";
  if (/void|abyss|shadow|mirror depths|пустот|бездна|тенев|гиперноч/.test(source)) return "void";
  return "neutral";
}

function buildUsageRules(card: ExtendedCardDefinition, raw: RawCardMeta | undefined) {
  const override = CARD_PASSPORT_OVERRIDES[card.id]?.usageRules;
  if (override) return override;
  if (card.usageRules) return card.usageRules;
  if (raw?.usageRules) return raw.usageRules;

  const cost = Math.max(0, toFiniteNumber(card.cost));
  const health = Math.max(0, toFiniteNumber(card.health));
  const kind = normalizeKind(card.type);

  if (kind === "character") {
    return "Выбирается как персонаж колоды до начала матча. Не разыгрывается из обычной руки. Его запас HP и стихийные бонусы действуют по правилам выбранного режима.";
  }

  if (kind === "bonus") {
    return `Устанавливается в доступный бонусный слот. Для активации требуется ${cost} Воли, если эффект карты или режим матча не отменяет стоимость.`;
  }

  if (kind === "event") {
    return `Разыгрывается во время своего хода при наличии ${cost} Воли. После разрешения события карта покидает активную зону согласно правилам режима.`;
  }

  if (health > 0) {
    return `Разыгрывается во время своего хода в свободный слот поля при наличии ${cost} Воли. Карта имеет собственный запас HP и остаётся на поле до уничтожения или завершения раунда.`;
  }

  return `Разыгрывается из руки во время своего хода при наличии ${cost} Воли. После полного разрешения эффекта карта отправляется в сброс, если другой эффект не указывает обратное.`;
}

function findHistory(card: ExtendedCardDefinition, raw: RawCardMeta | undefined) {
  return (
    CARD_PASSPORT_OVERRIDES[card.id]?.history ??
    card.history ??
    raw?.history ??
    undefined
  );
}

function findDefinitionByImage(src: string) {
  const normalized = normalizePath(src);
  if (normalized.endsWith("/cards/card-back.png")) return undefined;

  return CARDS.find((card) => {
    const image = normalizePath(card.frontSrc ?? card.image);
    return image === normalized || normalized.endsWith(image) || image.endsWith(normalized);
  });
}

function findDefinitionByTitle(title: string) {
  const normalized = normalizeTitle(title);
  if (!normalized || normalized === "рубашка карты") return undefined;

  return CARDS.find((card) => {
    const raw = RAW_BY_ID.get(card.id);
    return [card.title, card.name, raw?.ruTitle]
      .filter((value): value is string => Boolean(value))
      .some((value) => normalizeTitle(value) === normalized);
  });
}

function findImageTarget(target: Element) {
  if (target instanceof HTMLImageElement) return target;

  const explicitRoot = target.closest<HTMLElement>("[data-card-base-id]");
  if (explicitRoot) return explicitRoot.querySelector<HTMLImageElement>("img");

  let current: HTMLElement | null = target instanceof HTMLElement ? target : target.parentElement;
  for (let depth = 0; current && depth < 6; depth += 1) {
    const className = String(current.className ?? "").toLowerCase();
    const likelyCardRoot = /(tiltcard|cardview|cardvisual|deckcard|inventorycard|marketcard|collectioncard|summary-card|showcase)/.test(className);
    if (likelyCardRoot) {
      const image = current.querySelector<HTMLImageElement>("img");
      if (image) return image;
    }
    current = current.parentElement;
  }

  return null;
}

function resolveDefinition(target: Element) {
  const explicitRoot = target.closest<HTMLElement>("[data-card-base-id]");
  const baseId = explicitRoot?.dataset.cardBaseId;
  if (baseId) {
    const byId = CARDS.find((card) => card.id === baseId);
    if (byId) return { definition: byId, image: findImageTarget(target), root: explicitRoot };
  }

  const image = findImageTarget(target);
  if (!image) return null;

  const byImage = findDefinitionByImage(image.currentSrc || image.src);
  if (byImage) return { definition: byImage, image, root: explicitRoot ?? image.parentElement };

  const byTitle = findDefinitionByTitle(image.alt);
  if (byTitle) return { definition: byTitle, image, root: explicitRoot ?? image.parentElement };

  return null;
}

function selectOwnedCard(
  definition: CardDefinition,
  ownedCards: readonly OwnedCard[],
  instanceId?: string,
) {
  if (instanceId) {
    const exact = ownedCards.find((card) => card.instanceId === instanceId);
    if (exact) return exact;
  }

  return ownedCards.find((card) => card.baseId === definition.id);
}

function selectOnlinePrice(definition: CardDefinition, ownedCards: readonly OwnedCard[]) {
  const prices = ownedCards
    .filter((card) => card.baseId === definition.id)
    .map((card) => card.marketValue)
    .filter((value) => Number.isFinite(value) && value >= 0);

  return prices.length > 0 ? Math.min(...prices) : undefined;
}

export function buildPassportData(
  definition: CardDefinition,
  ownedCards: readonly OwnedCard[],
  options: {
    instanceId?: string;
    frontImage?: string;
    code?: string;
    onlinePrice?: number | null;
    runtimeCost?: number;
  } = {},
): CardPassportData {
  const extended = definition as ExtendedCardDefinition;
  const raw = RAW_BY_ID.get(definition.id);
  const owned = selectOwnedCard(definition, ownedCards, options.instanceId);
  const element = inferElement(extended, raw);
  const kind = normalizeKind(definition.type);
  const resolvedPrice =
    options.onlinePrice !== undefined
      ? options.onlinePrice
      : owned?.marketValue ?? selectOnlinePrice(definition, ownedCards);

  return {
    baseId: definition.id,
    code: options.code ?? owned?.instanceId ?? options.instanceId ?? definition.id.toUpperCase(),
    name: raw?.ruTitle ?? definition.name ?? definition.title,
    frontImage: options.frontImage ?? owned?.frontSrc ?? definition.frontSrc ?? definition.image,
    backImage: "/cards/card-back.png",
    element,
    elementLabel: ELEMENT_LABELS[element],
    kind,
    kindLabel: KIND_LABELS[kind],
    willCost: getWillCostByRarity(definition.rarity),
    effectText: definition.description,
    usageRules: buildUsageRules(extended, raw),
    history: findHistory(extended, raw),
    onlinePrice: resolvedPrice,
    currencyLabel: "МОНЕТ",
    rarity: String(definition.rarity),
    collection: definition.collection,
  };
}

export function resolvePassportFromElement(
  target: Element,
  ownedCards: readonly OwnedCard[],
): CardPassportData | null {
  const resolved = resolveDefinition(target);
  if (!resolved) return null;

  const root = target.closest<HTMLElement>("[data-card-base-id]") ?? resolved.root;
  const instanceId = root?.dataset.cardId;
  const runtimeCostRaw = root?.dataset.cardCost;
  const runtimeCost = runtimeCostRaw === undefined ? undefined : toFiniteNumber(runtimeCostRaw);
  const imageSrc = resolved.image?.currentSrc || resolved.image?.src;

  return buildPassportData(resolved.definition, ownedCards, {
    instanceId,
    code: instanceId,
    frontImage: imageSrc,
    runtimeCost,
  });
}

export function resolvePassportFromDetail(
  detail: OpenPassportDetail,
  ownedCards: readonly OwnedCard[],
): CardPassportData | null {
  const definition = CARDS.find((card) => card.id === detail.baseId);
  if (!definition) return null;

  return buildPassportData(definition, ownedCards, {
    instanceId: detail.instanceId,
    frontImage: detail.frontImage,
    code: detail.code,
    onlinePrice: detail.onlinePrice,
  });
}
