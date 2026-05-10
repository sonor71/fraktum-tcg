import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CARDS, CARDS_BY_ID, getRandomCards } from "./game/cards";
import { createUniqueCardId } from "./game/cardIdentity";
import type { CardDefinition, MatchHistoryEntry, MatchResult, OwnedCard, PlayerSettings } from "./game/types";

export type { OwnedCard } from "./game/types";

const DEFAULT_SETTINGS: PlayerSettings = { sound: true, music: true, reducedMotion: false };
const STARTER_COINS = 300;
const XP_PER_LEVEL = 100;

type IncomingCardGrant = { baseId: string; obtainedAt?: number; [key: string]: unknown };

type GameState = {
  playerName: string;
  avatar: string;
  level: number;
  xp: number;
  coins: number;
  premium: number;
  free: number;
  ownedCards: OwnedCard[];
  deckIds: string[];
  showcaseCardIds: string[];
  openedPacksCount: number;
  matchHistory: MatchHistoryEntry[];
  settings: PlayerSettings;
  cardSerials: Record<string, number>;

  setPlayerName: (name: string) => void;
  setAvatar: (avatar: string) => void;
  setSettings: (settings: Partial<PlayerSettings>) => void;
  addCoins: (amount: number) => void;
  spendCoins: (amount: number) => boolean;
  addXp: (amount: number) => void;
  addPremium: (amount: number) => void;
  addFree: (amount: number) => void;
  addOwnedCards: (cards: IncomingCardGrant[]) => OwnedCard[];
  grantCards: (cards: IncomingCardGrant[]) => OwnedCard[];
  openPack: (definitions: CardDefinition[]) => OwnedCard[];
  addToDeck: (id: string) => void;
  removeFromDeck: (id: string) => void;
  clearDeck: () => void;
  setDeckIds: (ids: string[]) => void;
  setShowcaseCard: (slot: number, id: string) => void;
  applyMatchResultToProgress: (result: MatchResult) => void;
  giveDemoCoins: () => void;
  giveStarterCards: () => void;
  clearInventory: () => void;
  resetProgress: () => void;
};

function normalizeOwned(definition: CardDefinition, instanceId: string, obtainedAt = Date.now()): OwnedCard {
  return {
    instanceId,
    baseId: definition.id,
    title: definition.title,
    rarity: definition.rarity,
    type: definition.type,
    image: definition.image,
    frontSrc: definition.image,
    obtainedAt,
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
    settings: DEFAULT_SETTINGS,
    cardSerials: {} as Record<string, number>,
  };
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      ...createInitialState(),

      setPlayerName: (playerName) => set({ playerName }),
      setAvatar: (avatar) => set({ avatar }),
      setSettings: (settings) => set({ settings: { ...get().settings, ...settings } }),
      addCoins: (amount) => set({ coins: Math.max(0, get().coins + amount), free: Math.max(0, get().free + amount) }),
      spendCoins: (amount) => {
        if (get().coins < amount) return false;
        set({ coins: get().coins - amount, free: Math.max(0, get().free - amount) });
        return true;
      },
      addXp: (amount) => {
        const totalXp = get().xp + amount;
        set({ xp: totalXp, level: Math.max(1, Math.floor(totalXp / XP_PER_LEVEL) + 1) });
      },
      addPremium: (amount) => set({ premium: get().premium + amount }),
      addFree: (amount) => get().addCoins(amount),

      addOwnedCards: (cards) => {
        const serials = { ...get().cardSerials };
        const issued = cards.map((incoming) => {
          const definition = CARDS_BY_ID[incoming.baseId];
          if (!definition) throw new Error(`Unknown card baseId: ${incoming.baseId}`);
          const nextSerial = (serials[incoming.baseId] ?? 0) + 1;
          serials[incoming.baseId] = nextSerial;
          return normalizeOwned(definition, createUniqueCardId(incoming.baseId, nextSerial), incoming.obtainedAt ?? Date.now());
        });

        set({
          ownedCards: [...issued, ...get().ownedCards].sort((a, b) => b.obtainedAt - a.obtainedAt),
          cardSerials: serials,
        });
        return issued;
      },
      grantCards: (cards) => get().addOwnedCards(cards),
      openPack: (definitions) => {
        const issued = get().addOwnedCards(definitions.map((card) => ({ baseId: card.id })));
        set({ openedPacksCount: get().openedPacksCount + 1 });
        return issued;
      },

      addToDeck: (id) => {
        const owned = get().ownedCards.some((card) => card.instanceId === id);
        const deck = get().deckIds;
        if (!owned || deck.includes(id) || deck.length >= 20) return;
        set({ deckIds: [...deck, id] });
      },
      removeFromDeck: (id) => set({ deckIds: get().deckIds.filter((deckId) => deckId !== id) }),
      clearDeck: () => set({ deckIds: [] }),
      setDeckIds: (ids) => {
        const ownedIds = new Set(get().ownedCards.map((card) => card.instanceId));
        set({ deckIds: ids.filter((id, index, arr) => ownedIds.has(id) && arr.indexOf(id) === index).slice(0, 20) });
      },
      setShowcaseCard: (slot, id) => {
        const ownedIds = new Set(get().ownedCards.map((card) => card.instanceId));
        if (!ownedIds.has(id) || slot < 0 || slot > 2) return;
        const next = [...get().showcaseCardIds];
        next[slot] = id;
        set({ showcaseCardIds: next.slice(0, 3) });
      },
      applyMatchResultToProgress: (result) => {
        get().addCoins(result.coins);
        get().addXp(result.xp);
        set({
          matchHistory: [{ ...result, id: `match-${result.finishedAt}`, appliedAt: Date.now() }, ...get().matchHistory].slice(0, 20),
        });
      },
      giveDemoCoins: () => get().addCoins(1000),
      giveStarterCards: () => get().addOwnedCards(getRandomCards(15).map((card) => ({ baseId: card.id }))),
      clearInventory: () => set({ ownedCards: [], deckIds: [], showcaseCardIds: [], cardSerials: {} }),
      resetProgress: () => set(createInitialState()),
    }),
    {
      name: "fraktum-game-store",
      version: 5,
      migrate: (persisted) => ({ ...createInitialState(), ...(persisted as Partial<GameState>) }),
    }
  )
);

export { CARDS };
