import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CARDS, CARDS_BY_ID, getRandomCards } from "./game/cards";
import { createUniqueCardId, getDefinitionIdByUniqueId } from "./game/cardIdentity";
import type {
  AuctionClaimResult,
  AuctionListing,
  AuctionStatus,
  CardDefinition,
  CardEdition,
  CardRarity,
  FriendEntry,
  MatchHistoryEntry,
  MatchResult,
  MarketPurchaseResult,
  OwnedCard,
  PendingPackPurchase,
  PlayerSettings,
} from "./game/types";

export type { OwnedCard } from "./game/types";

const DEFAULT_SETTINGS: PlayerSettings = { sound: true, music: true, reducedMotion: false };
const DEFAULT_FRIENDS: FriendEntry[] = [
  { id: "friend-astra", nickname: "Astra", status: "online" },
  { id: "friend-echo", nickname: "Echo-17", status: "in_match" },
  { id: "friend-orion", nickname: "Orion", status: "offline" },
];

const STARTER_COINS = 300;
const XP_PER_LEVEL = 100;
const CRAFT_COST = 10;
const MAX_DECK_SIZE = 20;
const MAX_SHOWCASE_SIZE = 3;
const MAX_MATCH_HISTORY = 20;
const MAX_PACK_HISTORY = 50;
const PACK_PURCHASE_TTL = 24 * 60 * 60 * 1000;
const MAX_AUCTION_HISTORY = 60;
export const AUCTION_HOUSE_FEE_RATE = 0.08;

const NPC_BIDDERS = [
  "Astra",
  "NullHunter",
  "Echo-17",
  "Orion",
  "Valkyrie",
  "Morrow",
  "Khepri",
  "Nox",
] as const;

const CRAFT_RARITY_CHAIN = [
  "common",
  "rare",
  "epic",
  "mythic",
  "legendary",
  "chromatic",
  "exotic",
  "divine",
  "forgotten",
  "archaic",
] as const satisfies readonly CardRarity[];

const FOIL_SERIAL_CHANCE: Record<CardRarity, number> = {
  common: 0.025,
  rare: 0.02,
  epic: 0.015,
  mythic: 0.01,
  legendary: 0.007,
  chromatic: 0.006,
  exotic: 0.005,
  divine: 0.0035,
  forgotten: 0.002,
  archaic: 0.001,
};

const RARITY_BASE_VALUE: Record<CardRarity, number> = {
  common: 10,
  rare: 35,
  epic: 120,
  mythic: 420,
  legendary: 1200,
  chromatic: 2600,
  exotic: 4200,
  divine: 9000,
  forgotten: 22000,
  archaic: 60000,
};

const FOIL_VALUE_MULTIPLIER: Record<CardRarity, number> = {
  common: 8,
  rare: 10,
  epic: 12,
  mythic: 16,
  legendary: 22,
  chromatic: 28,
  exotic: 35,
  divine: 50,
  forgotten: 80,
  archaic: 150,
};

const BATTLE_PASS_REWARDS: Record<
  number,
  | { kind: "coins"; amount: number }
  | { kind: "premium"; amount: number }
  | { kind: "card"; rarity: CardRarity }
> = {
  1: { kind: "coins", amount: 100 },
  2: { kind: "coins", amount: 200 },
  3: { kind: "premium", amount: 25 },
  4: { kind: "card", rarity: "rare" },
  5: { kind: "coins", amount: 500 },
  6: { kind: "premium", amount: 50 },
  7: { kind: "card", rarity: "epic" },
  8: { kind: "coins", amount: 750 },
  9: { kind: "premium", amount: 75 },
  10: { kind: "card", rarity: "mythic" },
};

type IncomingCardGrant = {
  baseId: string;
  packId?: string;
  obtainedAt?: number;
  edition?: CardEdition;
  isFoil?: boolean;
  isNew?: boolean;
};

type NormalizeOwnedOptions = {
  edition?: CardEdition;
  isFoil?: boolean;
  isNew?: boolean;
  marketValue?: number;
};

export type GameState = {
  playerName: string;
  avatar: string;
  level: number;
  xp: number;
  coins: number;
  premium: number;
  /** @deprecated Legacy alias for the free currency. Use coins. */
  free: number;
  ownedCards: OwnedCard[];
  deckIds: string[];
  showcaseCardIds: string[];
  openedPacksCount: number;
  matchHistory: MatchHistoryEntry[];
  settings: PlayerSettings;
  cardSerials: Record<string, number>;

  friends: FriendEntry[];
  battlePassXp: number;
  claimedBattlePassRewards: number[];
  claimedDailyQuestIds: string[];
  craftedCardsCount: number;
  wins: number;

  pendingPackPurchases: Record<string, PendingPackPurchase>;
  packOpenHistory: Record<string, string[]>;

  auctionListings: AuctionListing[];
  auctionSalesTotal: number;

  setPlayerName: (name: string) => void;
  setAvatar: (avatar: string) => void;
  setSettings: (settings: Partial<PlayerSettings>) => void;
  addCoins: (amount: number) => void;
  spendCoins: (amount: number) => boolean;
  addXp: (amount: number) => void;
  addPremium: (amount: number) => void;
  spendPremium: (amount: number) => boolean;
  purchaseMarketCard: (baseId: string, edition?: CardEdition) => MarketPurchaseResult;
  addFree: (amount: number) => void;
  addOwnedCards: (cards: IncomingCardGrant[]) => OwnedCard[];
  grantCards: (cards: IncomingCardGrant[]) => OwnedCard[];
  grantCardByBaseId: (baseId: string, packId?: string) => OwnedCard;
  grantCardsByBaseIds: (baseIds: string[], packId?: string) => OwnedCard[];
  openPack: (definitions: CardDefinition[], packId?: string) => OwnedCard[];
  openPackByBaseIds: (baseIds: string[], packId?: string) => OwnedCard[];
  purchasePack: (packId: string, price: number) => string | null;
  openPurchasedPack: (sessionId: string, packId: string, baseIds: string[]) => OwnedCard[] | null;
  createAuctionListing: (
    instanceId: string,
    startingPrice: number,
    durationMinutes: number,
    buyoutPrice?: number
  ) => string | null;
  cancelAuctionListing: (listingId: string) => boolean;
  simulateAuctionBid: (listingId: string) => boolean;
  processAuctionMarket: (now?: number) => void;
  claimAuctionResult: (listingId: string) => AuctionClaimResult | null;
  addToDeck: (id: string) => void;
  removeFromDeck: (id: string) => void;
  clearDeck: () => void;
  setDeckIds: (ids: string[]) => void;
  setShowcaseCard: (slot: number, id: string) => void;
  applyMatchResultToProgress: (result: MatchResult) => void;
  giveDemoCoins: () => void;
  giveStarterCards: () => void;
  clearInventory: () => void;
  craftCardsByRarity: (rarity: CardRarity, edition?: CardEdition) => OwnedCard | null;
  markAllCardsAsSeen: () => void;
  addFriendByNickname: (nickname: string) => boolean;
  claimBattlePassReward: (level: number) => boolean;
  claimDailyQuestReward: (questId: string, battlePassXp: number, coins: number) => boolean;
  resetProgress: () => void;
};

const INSTANCE_ID_PATTERN = /^[A-Z0-9]{3}-\d{3}-\d{6}$/;

function toNonNegativeInteger(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
}

function normalizeRarity(value: unknown): CardRarity {
  const rarity = String(value ?? "common").trim().toLowerCase();
  if ((CRAFT_RARITY_CHAIN as readonly string[]).includes(rarity)) return rarity as CardRarity;
  return "common";
}

function getNextCraftRarity(sourceRarity: CardRarity) {
  const index = CRAFT_RARITY_CHAIN.indexOf(sourceRarity);
  return CRAFT_RARITY_CHAIN[index + 1] ?? null;
}

function pickRandomCard(cards: readonly CardDefinition[]) {
  if (cards.length === 0) return null;
  return cards[Math.floor(Math.random() * cards.length)];
}

function rollFoilSerial(rarity: CardRarity) {
  return Math.random() < FOIL_SERIAL_CHANCE[rarity];
}

export function getMarketCardPrice(rarity: CardRarity, edition: CardEdition = "serial") {
  const baseValue = RARITY_BASE_VALUE[rarity];
  return edition === "foil_serial"
    ? Math.round(baseValue * FOIL_VALUE_MULTIPLIER[rarity])
    : baseValue;
}

function calculateCardMarketValue(rarity: CardRarity, isFoil: boolean) {
  return getMarketCardPrice(rarity, isFoil ? "foil_serial" : "serial");
}

function normalizeOwned(
  definition: CardDefinition,
  instanceId: string,
  obtainedAt = Date.now(),
  packId?: string,
  options: NormalizeOwnedOptions = {}
): OwnedCard {
  const rarity = normalizeRarity(definition.rarity);
  const isFoil = Boolean(options.isFoil ?? options.edition === "foil_serial");
  const edition: CardEdition = isFoil ? "foil_serial" : "serial";

  return {
    instanceId,
    baseId: definition.id,
    title: definition.title,
    rarity,
    type: definition.type,
    image: definition.image,
    frontSrc: definition.frontSrc ?? definition.image,
    packId,
    obtainedAt,
    isNew: options.isNew ? true : undefined,
    edition,
    isFoil,
    foilColor: isFoil ? rarity : undefined,
    marketValue: options.marketValue ?? calculateCardMarketValue(rarity, isFoil),
    cost: definition.cost,
    attack: definition.attack,
    health: definition.health,
    description: definition.description,
    effectKey: definition.effectKey,
    collection: definition.collection,
  };
}

function getSerialFromInstanceId(instanceId: string) {
  if (!INSTANCE_ID_PATTERN.test(instanceId)) return 0;
  const serial = Number(instanceId.split("-")[2]);
  return Number.isFinite(serial) ? serial : 0;
}

function isCanonicalInstanceId(instanceId: string, baseId: string) {
  return INSTANCE_ID_PATTERN.test(instanceId) && getDefinitionIdByUniqueId(instanceId) === baseId;
}

function createPackSessionId(packId: string) {
  const randomPart = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `${packId}-${Date.now()}-${randomPart}`;
}

function prunePendingPurchases(purchases: Record<string, PendingPackPurchase>) {
  const threshold = Date.now() - PACK_PURCHASE_TTL;
  return Object.fromEntries(
    Object.entries(purchases).filter(([, purchase]) => purchase.createdAt >= threshold && purchase.packId)
  );
}

function createAuctionId(instanceId: string) {
  const randomPart = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `auction-${instanceId}-${Date.now()}-${randomPart}`;
}

function normalizeAuctionStatus(value: unknown): AuctionStatus {
  if (value === "sold" || value === "expired" || value === "cancelled") return value;
  return "active";
}

function getAuctionNetProceeds(gross: number) {
  const safeGross = toNonNegativeInteger(gross);
  const fee = safeGross > 0 ? Math.max(1, Math.ceil(safeGross * AUCTION_HOUSE_FEE_RATE)) : 0;
  return { gross: safeGross, fee, net: Math.max(0, safeGross - fee) };
}

function getNextNpcBidAt(now: number) {
  return now + 7000 + Math.floor(Math.random() * 14000);
}

function getBidChance(listing: AuctionListing) {
  const referenceValue = Math.max(1, listing.card.marketValue);
  const priceRatio = listing.startingPrice / referenceValue;
  const foilBonus = listing.card.isFoil || listing.card.edition === "foil_serial" ? 0.08 : 0;

  if (priceRatio <= 0.65) return Math.min(0.96, 0.88 + foilBonus);
  if (priceRatio <= 0.95) return Math.min(0.9, 0.7 + foilBonus);
  if (priceRatio <= 1.2) return Math.min(0.78, 0.48 + foilBonus);
  if (priceRatio <= 1.6) return Math.min(0.52, 0.24 + foilBonus);
  return 0.1 + foilBonus;
}

function placeNpcBid(listing: AuctionListing, now: number, force = false): AuctionListing {
  if (listing.status !== "active" || now >= listing.endsAt) return listing;

  const chance = getBidChance(listing);
  if (!force && Math.random() > chance) {
    return { ...listing, nextNpcBidAt: getNextNpcBidAt(now) };
  }

  const current = listing.currentBid > 0 ? listing.currentBid : listing.startingPrice;
  const minimumBid = listing.currentBid > 0
    ? current + Math.max(1, Math.ceil(current * 0.05))
    : listing.startingPrice;
  const willingness = Math.max(
    force ? minimumBid : 0,
    Math.round(listing.card.marketValue * (0.82 + Math.random() * 0.78))
  );

  if (minimumBid > willingness && !force) {
    return { ...listing, nextNpcBidAt: getNextNpcBidAt(now) };
  }

  const spread = Math.max(1, Math.round(minimumBid * (0.03 + Math.random() * 0.08)));
  let bid = Math.max(minimumBid, Math.min(willingness, minimumBid + spread));
  const bidder = NPC_BIDDERS[Math.floor(Math.random() * NPC_BIDDERS.length)];

  if (listing.buyoutPrice && bid >= Math.floor(listing.buyoutPrice * 0.92)) {
    bid = listing.buyoutPrice;
    return {
      ...listing,
      currentBid: bid,
      bidCount: listing.bidCount + 1,
      highestBidder: bidder,
      salePrice: bid,
      status: "sold",
      endsAt: now,
      nextNpcBidAt: undefined,
    };
  }

  return {
    ...listing,
    currentBid: bid,
    bidCount: listing.bidCount + 1,
    highestBidder: bidder,
    nextNpcBidAt: getNextNpcBidAt(now),
  };
}

function finishAuction(listing: AuctionListing, now: number): AuctionListing {
  if (listing.status !== "active") return listing;

  if (listing.currentBid > 0) {
    return {
      ...listing,
      status: "sold",
      salePrice: listing.currentBid,
      endsAt: now,
      nextNpcBidAt: undefined,
    };
  }

  const priceRatio = listing.card.marketValue / Math.max(1, listing.startingPrice);
  const lastSecondSaleChance = Math.max(0.08, Math.min(0.86, priceRatio * 0.48));

  if (Math.random() < lastSecondSaleChance) {
    const bidder = NPC_BIDDERS[Math.floor(Math.random() * NPC_BIDDERS.length)];
    return {
      ...listing,
      currentBid: listing.startingPrice,
      bidCount: 1,
      highestBidder: bidder,
      status: "sold",
      salePrice: listing.startingPrice,
      endsAt: now,
      nextNpcBidAt: undefined,
    };
  }

  return {
    ...listing,
    status: "expired",
    endsAt: now,
    nextNpcBidAt: undefined,
  };
}

function createInitialState() {
  return {
    playerName: "Pilot FRAKTUM",
    avatar: "/vite.svg",
    level: 1,
    xp: 0,
    coins: STARTER_COINS,
    premium: 10,
    free: STARTER_COINS,
    ownedCards: [] as OwnedCard[],
    deckIds: [] as string[],
    showcaseCardIds: [] as string[],
    openedPacksCount: 0,
    matchHistory: [] as MatchHistoryEntry[],
    settings: { ...DEFAULT_SETTINGS },
    cardSerials: {} as Record<string, number>,
    friends: DEFAULT_FRIENDS.map((friend) => ({ ...friend })),
    battlePassXp: 0,
    claimedBattlePassRewards: [] as number[],
    claimedDailyQuestIds: [] as string[],
    craftedCardsCount: 0,
    wins: 0,
    pendingPackPurchases: {} as Record<string, PendingPackPurchase>,
    packOpenHistory: {} as Record<string, string[]>,
    auctionListings: [] as AuctionListing[],
    auctionSalesTotal: 0,
  };
}

function normalizePersistedState(persisted: unknown): ReturnType<typeof createInitialState> {
  const base = createInitialState();
  const incoming = typeof persisted === "object" && persisted !== null ? (persisted as Partial<GameState>) : {};
  const rawOwnedCards = Array.isArray(incoming.ownedCards) ? incoming.ownedCards : [];
  const serials: Record<string, number> = { ...(incoming.cardSerials ?? {}) };
  const usedIds = new Set<string>();
  const idMap = new Map<string, string>();
  const ownedCards: OwnedCard[] = [];

  for (const rawCard of rawOwnedCards) {
    if (!rawCard?.baseId) continue;
    const definition = CARDS_BY_ID[rawCard.baseId];
    if (!definition) continue;

    let instanceId = rawCard.instanceId;
    if (!isCanonicalInstanceId(instanceId, rawCard.baseId) || usedIds.has(instanceId)) {
      const nextSerial = (serials[rawCard.baseId] ?? 0) + 1;
      serials[rawCard.baseId] = nextSerial;
      const previousId = instanceId;
      instanceId = createUniqueCardId(rawCard.baseId, nextSerial);
      if (previousId) idMap.set(previousId, instanceId);
    }

    const isFoil = rawCard.edition === "foil_serial" || rawCard.isFoil === true;
    usedIds.add(instanceId);
    serials[rawCard.baseId] = Math.max(serials[rawCard.baseId] ?? 0, getSerialFromInstanceId(instanceId));

    ownedCards.push(
      normalizeOwned(definition, instanceId, rawCard.obtainedAt, rawCard.packId, {
        edition: isFoil ? "foil_serial" : "serial",
        isFoil,
        isNew: rawCard.isNew,
        marketValue:
          typeof rawCard.marketValue === "number"
            ? rawCard.marketValue
            : calculateCardMarketValue(definition.rarity, isFoil),
      })
    );
  }

  const rawAuctionListings = Array.isArray(incoming.auctionListings) ? incoming.auctionListings : [];
  const auctionListings: AuctionListing[] = [];

  for (const rawListing of rawAuctionListings.slice(0, MAX_AUCTION_HISTORY)) {
    if (!rawListing?.id || !rawListing.card?.baseId) continue;
    const definition = CARDS_BY_ID[rawListing.card.baseId];
    if (!definition) continue;

    let instanceId = rawListing.card.instanceId;
    const rawStatus = normalizeAuctionStatus(rawListing.status);
    const isHistoricalDuplicate = usedIds.has(instanceId) && Boolean(rawListing.claimedAt || rawStatus === "cancelled");
    if (usedIds.has(instanceId) && !isHistoricalDuplicate) continue;
    if (!isCanonicalInstanceId(instanceId, rawListing.card.baseId)) {
      const nextSerial = (serials[rawListing.card.baseId] ?? 0) + 1;
      serials[rawListing.card.baseId] = nextSerial;
      instanceId = createUniqueCardId(rawListing.card.baseId, nextSerial);
    }

    const isFoil = rawListing.card.edition === "foil_serial" || rawListing.card.isFoil === true;
    const card = normalizeOwned(definition, instanceId, rawListing.card.obtainedAt, rawListing.card.packId, {
      edition: isFoil ? "foil_serial" : "serial",
      isFoil,
      isNew: rawListing.card.isNew,
      marketValue:
        typeof rawListing.card.marketValue === "number"
          ? rawListing.card.marketValue
          : calculateCardMarketValue(definition.rarity, isFoil),
    });

    if (!isHistoricalDuplicate) usedIds.add(instanceId);
    serials[rawListing.card.baseId] = Math.max(
      serials[rawListing.card.baseId] ?? 0,
      getSerialFromInstanceId(instanceId)
    );

    const listedAt = toNonNegativeInteger(rawListing.listedAt, Date.now());
    const endsAt = Math.max(listedAt + 1000, toNonNegativeInteger(rawListing.endsAt, listedAt + 60 * 60 * 1000));
    const startingPrice = Math.max(1, toNonNegativeInteger(rawListing.startingPrice, card.marketValue));
    const currentBid = toNonNegativeInteger(rawListing.currentBid);
    const buyoutPrice = rawListing.buyoutPrice === undefined
      ? undefined
      : Math.max(startingPrice + 1, toNonNegativeInteger(rawListing.buyoutPrice));

    let listing: AuctionListing = {
      id: String(rawListing.id),
      sellerId: String(rawListing.sellerId || "player"),
      sellerName: String(rawListing.sellerName || incoming.playerName || base.playerName),
      card,
      startingPrice,
      currentBid,
      buyoutPrice,
      bidCount: toNonNegativeInteger(rawListing.bidCount),
      listedAt,
      endsAt,
      status: rawStatus,
      highestBidder: rawListing.highestBidder ? String(rawListing.highestBidder) : undefined,
      nextNpcBidAt: rawListing.nextNpcBidAt ? toNonNegativeInteger(rawListing.nextNpcBidAt) : undefined,
      salePrice: rawListing.salePrice ? toNonNegativeInteger(rawListing.salePrice) : undefined,
      claimedAt: rawListing.claimedAt ? toNonNegativeInteger(rawListing.claimedAt) : undefined,
    };

    if (listing.status === "active" && Date.now() >= listing.endsAt) {
      listing = finishAuction(listing, Date.now());
    }

    auctionListings.push(listing);
  }

  const ownedIds = new Set(ownedCards.map((card) => card.instanceId));
  const mapOwnedId = (id: string) => {
    if (ownedIds.has(id)) return id;
    const mapped = idMap.get(id);
    if (mapped && ownedIds.has(mapped)) return mapped;
    return ownedCards.find((card) => card.baseId === id)?.instanceId ?? null;
  };

  const deckIds = (incoming.deckIds ?? [])
    .map(mapOwnedId)
    .filter((id): id is string => id !== null)
    .filter((id, index, ids) => ids.indexOf(id) === index)
    .slice(0, MAX_DECK_SIZE);

  const showcaseCardIds = (incoming.showcaseCardIds ?? [])
    .map(mapOwnedId)
    .filter((id): id is string => id !== null)
    .slice(0, MAX_SHOWCASE_SIZE);

  const rawPackHistory = incoming.packOpenHistory ?? {};
  const packOpenHistory = Object.fromEntries(
    Object.entries(rawPackHistory)
      .map(([sessionId, ids]) => [
        sessionId,
        Array.isArray(ids) ? ids.map(mapOwnedId).filter((id): id is string => id !== null) : [],
      ])
      .filter(([, ids]) => (ids as string[]).length > 0)
      .slice(-MAX_PACK_HISTORY)
  ) as Record<string, string[]>;

  const friends = Array.isArray(incoming.friends)
    ? incoming.friends
        .filter((friend): friend is FriendEntry => Boolean(friend?.id && friend?.nickname))
        .map((friend): FriendEntry => ({
          id: String(friend.id),
          nickname: String(friend.nickname),
          status: friend.status === "online" || friend.status === "in_match" ? friend.status : "offline",
        }))
    : base.friends;

  const xp = toNonNegativeInteger(incoming.xp, base.xp);

  return {
    ...base,
    playerName: typeof incoming.playerName === "string" ? incoming.playerName : base.playerName,
    avatar: typeof incoming.avatar === "string" ? incoming.avatar : base.avatar,
    xp,
    level: Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1),
    coins: toNonNegativeInteger(incoming.coins ?? incoming.free, base.coins),
    free: toNonNegativeInteger(incoming.coins ?? incoming.free, base.free),
    premium: toNonNegativeInteger(incoming.premium, base.premium),
    ownedCards,
    deckIds,
    showcaseCardIds,
    openedPacksCount: toNonNegativeInteger(incoming.openedPacksCount),
    matchHistory: Array.isArray(incoming.matchHistory) ? incoming.matchHistory.slice(0, MAX_MATCH_HISTORY) : [],
    settings: { ...base.settings, ...(incoming.settings ?? {}) },
    cardSerials: serials,
    friends,
    battlePassXp: toNonNegativeInteger(incoming.battlePassXp),
    claimedBattlePassRewards: Array.isArray(incoming.claimedBattlePassRewards)
      ? [...new Set(incoming.claimedBattlePassRewards.map((value) => toNonNegativeInteger(value)).filter(Boolean))]
      : [],
    claimedDailyQuestIds: Array.isArray(incoming.claimedDailyQuestIds)
      ? [...new Set(incoming.claimedDailyQuestIds.map(String))]
      : [],
    craftedCardsCount: toNonNegativeInteger(incoming.craftedCardsCount),
    wins: toNonNegativeInteger(incoming.wins),
    pendingPackPurchases: prunePendingPurchases(incoming.pendingPackPurchases ?? {}),
    packOpenHistory,
    auctionListings,
    auctionSalesTotal: toNonNegativeInteger(incoming.auctionSalesTotal),
  };
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      ...createInitialState(),

      setPlayerName: (playerName) => set({ playerName }),
      setAvatar: (avatar) => set({ avatar }),
      setSettings: (settings) => set({ settings: { ...get().settings, ...settings } }),

      addCoins: (amount) => {
        const safeAmount = Math.floor(Number(amount));
        if (!Number.isFinite(safeAmount) || safeAmount === 0) return;
        const coins = Math.max(0, get().coins + safeAmount);
        set({ coins, free: coins });
      },

      spendCoins: (amount) => {
        const safeAmount = toNonNegativeInteger(amount);
        if (safeAmount <= 0 || get().coins < safeAmount) return false;
        const coins = get().coins - safeAmount;
        set({ coins, free: coins });
        return true;
      },

      addXp: (amount) => {
        const totalXp = Math.max(0, get().xp + Math.floor(Number(amount) || 0));
        set({ xp: totalXp, level: Math.max(1, Math.floor(totalXp / XP_PER_LEVEL) + 1) });
      },

      addPremium: (amount) => {
        const premium = Math.max(0, get().premium + Math.floor(Number(amount) || 0));
        set({ premium });
      },

      spendPremium: (amount) => {
        const safeAmount = toNonNegativeInteger(amount);
        if (safeAmount <= 0 || get().premium < safeAmount) return false;
        set({ premium: get().premium - safeAmount });
        return true;
      },

      purchaseMarketCard: (baseId, edition = "serial") => {
        const definition = CARDS_BY_ID[baseId];
        if (!definition) return { ok: false, reason: "unknown_card" };

        const normalizedEdition: CardEdition = edition === "foil_serial" ? "foil_serial" : "serial";
        const price = getMarketCardPrice(definition.rarity, normalizedEdition);
        if (!Number.isFinite(price) || price <= 0) {
          return { ok: false, reason: "invalid_price" };
        }
        if (get().premium < price) {
          return { ok: false, reason: "insufficient_premium", price };
        }

        const serials = { ...get().cardSerials };
        const nextSerial = (serials[baseId] ?? 0) + 1;
        serials[baseId] = nextSerial;
        const isFoil = normalizedEdition === "foil_serial";
        const card = normalizeOwned(
          definition,
          createUniqueCardId(baseId, nextSerial),
          Date.now(),
          "market",
          {
            edition: normalizedEdition,
            isFoil,
            isNew: true,
            marketValue: price,
          }
        );

        set({
          premium: get().premium - price,
          ownedCards: [card, ...get().ownedCards],
          cardSerials: serials,
        });

        return { ok: true, card, price };
      },

      addFree: (amount) => get().addCoins(amount),

      addOwnedCards: (cards) => {
        const serials = { ...get().cardSerials };
        const now = Date.now();
        const issued = cards.map((incoming, index) => {
          const definition = CARDS_BY_ID[incoming.baseId];
          if (!definition) throw new Error(`Unknown card baseId: ${incoming.baseId}`);

          const forcedEdition = incoming.edition !== undefined || incoming.isFoil !== undefined;
          const isFoil = forcedEdition
            ? incoming.edition === "foil_serial" || incoming.isFoil === true
            : rollFoilSerial(definition.rarity);

          const nextSerial = (serials[incoming.baseId] ?? 0) + 1;
          serials[incoming.baseId] = nextSerial;

          return normalizeOwned(
            definition,
            createUniqueCardId(incoming.baseId, nextSerial),
            incoming.obtainedAt ?? now + index,
            incoming.packId,
            {
              edition: isFoil ? "foil_serial" : "serial",
              isFoil,
              isNew: incoming.isNew,
            }
          );
        });

        set({
          ownedCards: [...issued, ...get().ownedCards].sort((a, b) => b.obtainedAt - a.obtainedAt),
          cardSerials: serials,
        });
        return issued;
      },

      grantCards: (cards) => get().addOwnedCards(cards),
      grantCardByBaseId: (baseId, packId) => get().addOwnedCards([{ baseId, packId }])[0],
      grantCardsByBaseIds: (baseIds, packId) => get().addOwnedCards(baseIds.map((baseId) => ({ baseId, packId }))),

      openPack: (definitions, packId) => {
        const issued = get().addOwnedCards(definitions.map((card) => ({ baseId: card.id, packId })));
        set({ openedPacksCount: get().openedPacksCount + 1 });
        return issued;
      },

      openPackByBaseIds: (baseIds, packId) => {
        const issued = get().grantCardsByBaseIds(baseIds, packId);
        set({ openedPacksCount: get().openedPacksCount + 1 });
        return issued;
      },

      purchasePack: (packId, price) => {
        const safePrice = toNonNegativeInteger(price);
        if (!packId || safePrice <= 0 || get().coins < safePrice) return null;

        const sessionId = createPackSessionId(packId);
        const coins = get().coins - safePrice;
        const pendingPackPurchases = {
          ...prunePendingPurchases(get().pendingPackPurchases),
          [sessionId]: { packId, createdAt: Date.now() },
        };

        set({ coins, free: coins, pendingPackPurchases });
        return sessionId;
      },

      openPurchasedPack: (sessionId, packId, baseIds) => {
        const previousIds = get().packOpenHistory[sessionId];
        if (previousIds) {
          const ownedById = new Map(get().ownedCards.map((card) => [card.instanceId, card]));
          const previousCards = previousIds.map((id) => ownedById.get(id)).filter((card): card is OwnedCard => Boolean(card));
          return previousCards.length === previousIds.length ? previousCards : null;
        }

        const purchase = get().pendingPackPurchases[sessionId];
        if (!purchase || purchase.packId !== packId || baseIds.length === 0) return null;

        const validBaseIds = baseIds.filter((baseId) => Boolean(CARDS_BY_ID[baseId]));
        if (validBaseIds.length !== baseIds.length) return null;

        const issued = get().addOwnedCards(validBaseIds.map((baseId) => ({ baseId, packId })));
        const pendingPackPurchases = { ...get().pendingPackPurchases };
        delete pendingPackPurchases[sessionId];

        const nextHistoryEntries = [
          ...Object.entries(get().packOpenHistory),
          [sessionId, issued.map((card) => card.instanceId)] as [string, string[]],
        ].slice(-MAX_PACK_HISTORY);

        set({
          pendingPackPurchases,
          packOpenHistory: Object.fromEntries(nextHistoryEntries),
          openedPacksCount: get().openedPacksCount + 1,
        });
        return issued;
      },

      createAuctionListing: (instanceId, startingPrice, durationMinutes, buyoutPrice) => {
        const card = get().ownedCards.find((entry) => entry.instanceId === instanceId);
        if (!card) return null;

        const safeStartingPrice = Math.min(100_000_000, Math.max(1, toNonNegativeInteger(startingPrice)));
        const safeDurationMinutes = Math.min(10_080, Math.max(1, toNonNegativeInteger(durationMinutes, 60)));
        const requestedBuyout = buyoutPrice === undefined ? 0 : toNonNegativeInteger(buyoutPrice);
        const safeBuyoutPrice = requestedBuyout > safeStartingPrice
          ? Math.min(100_000_000, requestedBuyout)
          : undefined;
        const now = Date.now();
        const listingId = createAuctionId(card.instanceId);
        const listing: AuctionListing = {
          id: listingId,
          sellerId: "player",
          sellerName: get().playerName,
          card,
          startingPrice: safeStartingPrice,
          currentBid: 0,
          buyoutPrice: safeBuyoutPrice,
          bidCount: 0,
          listedAt: now,
          endsAt: now + safeDurationMinutes * 60 * 1000,
          status: "active",
          nextNpcBidAt: getNextNpcBidAt(now),
        };

        set({
          auctionListings: [listing, ...get().auctionListings].slice(0, MAX_AUCTION_HISTORY),
          ownedCards: get().ownedCards.filter((entry) => entry.instanceId !== instanceId),
          deckIds: get().deckIds.filter((id) => id !== instanceId),
          showcaseCardIds: get().showcaseCardIds.filter((id) => id !== instanceId),
        });

        return listingId;
      },

      cancelAuctionListing: (listingId) => {
        const listing = get().auctionListings.find((entry) => entry.id === listingId);
        if (!listing || listing.status !== "active" || listing.bidCount > 0) return false;
        if (get().ownedCards.some((card) => card.instanceId === listing.card.instanceId)) return false;

        const now = Date.now();
        set({
          ownedCards: [listing.card, ...get().ownedCards].sort((a, b) => b.obtainedAt - a.obtainedAt),
          auctionListings: get().auctionListings.map((entry) =>
            entry.id === listingId
              ? { ...entry, status: "cancelled" as const, claimedAt: now, nextNpcBidAt: undefined }
              : entry
          ),
        });
        return true;
      },

      simulateAuctionBid: (listingId) => {
        const now = Date.now();
        let changed = false;
        const auctionListings = get().auctionListings.map((listing) => {
          if (listing.id !== listingId || listing.status !== "active") return listing;
          const updated = placeNpcBid(listing, now, true);
          changed = updated !== listing;
          return updated;
        });

        if (changed) set({ auctionListings });
        return changed;
      },

      processAuctionMarket: (requestedNow) => {
        const now = toNonNegativeInteger(requestedNow, Date.now());
        let changed = false;
        const auctionListings = get().auctionListings.map((listing) => {
          if (listing.status !== "active") return listing;

          if (now >= listing.endsAt) {
            changed = true;
            return finishAuction(listing, now);
          }

          if (listing.nextNpcBidAt && now >= listing.nextNpcBidAt) {
            changed = true;
            return placeNpcBid(listing, now);
          }

          return listing;
        });

        if (changed) set({ auctionListings });
      },

      claimAuctionResult: (listingId) => {
        const listing = get().auctionListings.find((entry) => entry.id === listingId);
        if (!listing || listing.claimedAt) return null;
        const now = Date.now();

        if (listing.status === "sold") {
          const proceeds = getAuctionNetProceeds(listing.salePrice ?? listing.currentBid);
          set({
            premium: get().premium + proceeds.net,
            auctionSalesTotal: get().auctionSalesTotal + proceeds.net,
            auctionListings: get().auctionListings.map((entry) =>
              entry.id === listingId ? { ...entry, claimedAt: now } : entry
            ),
          });
          return { kind: "sold", ...proceeds };
        }

        if (listing.status === "expired") {
          const alreadyOwned = get().ownedCards.some((card) => card.instanceId === listing.card.instanceId);
          set({
            ownedCards: alreadyOwned
              ? get().ownedCards
              : [listing.card, ...get().ownedCards].sort((a, b) => b.obtainedAt - a.obtainedAt),
            auctionListings: get().auctionListings.map((entry) =>
              entry.id === listingId ? { ...entry, claimedAt: now } : entry
            ),
          });
          return { kind: "returned", card: listing.card };
        }

        return null;
      },

      addToDeck: (id) => {
        const owned = get().ownedCards.some((card) => card.instanceId === id);
        const deck = get().deckIds;
        if (!owned || deck.includes(id) || deck.length >= MAX_DECK_SIZE) return;
        set({ deckIds: [...deck, id] });
      },

      removeFromDeck: (id) => set({ deckIds: get().deckIds.filter((deckId) => deckId !== id) }),
      clearDeck: () => set({ deckIds: [] }),

      setDeckIds: (ids) => {
        const ownedIds = new Set(get().ownedCards.map((card) => card.instanceId));
        set({
          deckIds: ids
            .filter((id, index, values) => ownedIds.has(id) && values.indexOf(id) === index)
            .slice(0, MAX_DECK_SIZE),
        });
      },

      setShowcaseCard: (slot, id) => {
        const ownedIds = new Set(get().ownedCards.map((card) => card.instanceId));
        if (!ownedIds.has(id) || slot < 0 || slot >= MAX_SHOWCASE_SIZE) return;
        const next = [...get().showcaseCardIds];
        next[slot] = id;
        set({ showcaseCardIds: next.slice(0, MAX_SHOWCASE_SIZE) });
      },

      applyMatchResultToProgress: (result) => {
        const historyId = `match-${result.finishedAt}`;
        if (get().matchHistory.some((entry) => entry.id === historyId)) return;

        const rewardCoins = toNonNegativeInteger(result.coins);
        const rewardXp = toNonNegativeInteger(result.xp);
        const totalXp = get().xp + rewardXp;
        const coins = get().coins + rewardCoins;
        const resultText = String(result.result ?? "").toLowerCase();
        const isWin = result.winner === "player" || resultText === "win" || resultText === "victory";

        set({
          coins,
          free: coins,
          xp: totalXp,
          level: Math.max(1, Math.floor(totalXp / XP_PER_LEVEL) + 1),
          battlePassXp: get().battlePassXp + rewardXp,
          wins: get().wins + (isWin ? 1 : 0),
          matchHistory: [
            { ...result, id: historyId, appliedAt: Date.now() },
            ...get().matchHistory,
          ].slice(0, MAX_MATCH_HISTORY),
        });
      },

      giveDemoCoins: () => get().addCoins(1000),
      giveStarterCards: () => get().addOwnedCards(getRandomCards(15).map((card) => ({ baseId: card.id, isNew: true }))),

      clearInventory: () =>
        set({
          ownedCards: [],
          deckIds: [],
          showcaseCardIds: [],
          cardSerials: {},
          packOpenHistory: {},
          auctionListings: [],
          auctionSalesTotal: 0,
        }),

      craftCardsByRarity: (rarity, edition = "serial") => {
        const sourceRarity = normalizeRarity(rarity);
        const targetRarity = getNextCraftRarity(sourceRarity);
        if (!targetRarity) return null;

        const craftFoil = edition === "foil_serial";
        const candidates = get()
          .ownedCards.filter(
            (card) => card.rarity === sourceRarity && (card.edition === "foil_serial" || card.isFoil) === craftFoil
          )
          .sort((a, b) => a.marketValue - b.marketValue || a.obtainedAt - b.obtainedAt);

        if (candidates.length < CRAFT_COST) return null;

        const targetDefinition = pickRandomCard(CARDS.filter((card) => card.rarity === targetRarity));
        if (!targetDefinition) return null;

        const serials = { ...get().cardSerials };
        const nextSerial = (serials[targetDefinition.id] ?? 0) + 1;
        serials[targetDefinition.id] = nextSerial;

        const consumedIds = new Set(candidates.slice(0, CRAFT_COST).map((card) => card.instanceId));
        const craftedCard = normalizeOwned(
          targetDefinition,
          createUniqueCardId(targetDefinition.id, nextSerial),
          Date.now(),
          craftFoil ? "foil-craft" : "craft",
          {
            edition: craftFoil ? "foil_serial" : "serial",
            isFoil: craftFoil,
            isNew: true,
          }
        );

        set({
          ownedCards: [craftedCard, ...get().ownedCards.filter((card) => !consumedIds.has(card.instanceId))],
          deckIds: get().deckIds.filter((id) => !consumedIds.has(id)),
          showcaseCardIds: get().showcaseCardIds.filter((id) => !consumedIds.has(id)),
          cardSerials: serials,
          craftedCardsCount: get().craftedCardsCount + 1,
        });

        return craftedCard;
      },

      markAllCardsAsSeen: () => {
        if (!get().ownedCards.some((card) => card.isNew)) return;
        set({ ownedCards: get().ownedCards.map((card) => ({ ...card, isNew: undefined })) });
      },

      addFriendByNickname: (nickname) => {
        const normalized = nickname.trim();
        if (normalized.length < 3) return false;
        if (get().friends.some((friend) => friend.nickname.toLowerCase() === normalized.toLowerCase())) return false;
        if (get().playerName.trim().toLowerCase() === normalized.toLowerCase()) return false;

        const id = `friend-${normalized.toLowerCase().replace(/[^a-z0-9а-яё_-]+/gi, "-")}-${Date.now()}`;
        set({ friends: [...get().friends, { id, nickname: normalized, status: "offline" }] });
        return true;
      },

      claimBattlePassReward: (level) => {
        const safeLevel = toNonNegativeInteger(level);
        const currentLevel = Math.min(10, Math.floor(get().battlePassXp / 100) + 1);
        const reward = BATTLE_PASS_REWARDS[safeLevel];
        if (!reward || safeLevel > currentLevel || get().claimedBattlePassRewards.includes(safeLevel)) return false;

        if (reward.kind === "coins") get().addCoins(reward.amount);
        if (reward.kind === "premium") get().addPremium(reward.amount);
        if (reward.kind === "card") {
          const definition = pickRandomCard(CARDS.filter((card) => card.rarity === reward.rarity));
          if (!definition) return false;
          get().addOwnedCards([{ baseId: definition.id, packId: "battle-pass", isNew: true }]);
        }

        set({ claimedBattlePassRewards: [...get().claimedBattlePassRewards, safeLevel].sort((a, b) => a - b) });
        return true;
      },

      claimDailyQuestReward: (questId, battlePassXp, rewardCoins) => {
        const normalizedId = questId.trim();
        if (!normalizedId || get().claimedDailyQuestIds.includes(normalizedId)) return false;

        const coins = get().coins + toNonNegativeInteger(rewardCoins);
        set({
          coins,
          free: coins,
          battlePassXp: get().battlePassXp + toNonNegativeInteger(battlePassXp),
          claimedDailyQuestIds: [...get().claimedDailyQuestIds, normalizedId],
        });
        return true;
      },

      resetProgress: () => set(createInitialState()),
    }),
    {
      name: "fraktum-game-store",
      version: 11,
      migrate: (persisted) => normalizePersistedState(persisted),
      merge: (persisted, current) => ({ ...current, ...normalizePersistedState(persisted) }),
    }
  )
);

export { CARDS };
