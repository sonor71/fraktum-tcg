import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createUniqueCardId } from "./game/cardIdentity";

// ✅ Экземпляр карты в инвентаре
export type OwnedCard = {
  instanceId: string;
  baseId: string;
  title: string;
  frontSrc: string;
  packId?: string;
  rarity?: string;
  type?: string;
  obtainedAt: number;
};

type GameState = {
  premium: number;
  free: number;

  ownedCards: OwnedCard[];
  addOwnedCards: (cards: OwnedCard[]) => void;
  grantCards: (cards: OwnedCard[]) => void;
  clearInventory: () => void;

  // ✅ Счётчик выпусков карт
  cardSerials: Record<string, number>;

  deckIds: string[];

  addToDeck: (id: string) => void;
  removeFromDeck: (id: string) => void;
  clearDeck: () => void;
  setDeckIds: (ids: string[]) => void;

  addPremium: (amount: number) => void;
  addFree: (amount: number) => void;
};

function createFallbackId(baseId: string, index: number) {
  return `${baseId}-${Date.now()}-${index}`;
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      premium: 10,
      free: 1000,

      ownedCards: [],
      cardSerials: {},

      addOwnedCards: (cards) => {
        const current = get().ownedCards;
        const serials = { ...get().cardSerials };

        const generatedCards = cards.map((card, index) => {
          const baseId = card.baseId;

          const nextSerial = (serials[baseId] ?? 0) + 1;
          serials[baseId] = nextSerial;

          let instanceId = "";

          try {
            instanceId = createUniqueCardId(baseId, nextSerial);
          } catch (error) {
            console.warn("Не удалось создать Unique ID для карты:", baseId, error);
            instanceId = createFallbackId(baseId, index);
          }

          return {
            ...card,
            instanceId,
            obtainedAt: card.obtainedAt || Date.now(),
          };
        });

        const existing = new Set(current.map((c) => c.instanceId));
        const uniqueIncoming = generatedCards.filter(
          (c) => !existing.has(c.instanceId)
        );

        const next = [...uniqueIncoming, ...current].sort(
          (a, b) => b.obtainedAt - a.obtainedAt
        );

        set({
          ownedCards: next,
          cardSerials: serials,
        });
      },

      grantCards: (cards) => {
        get().addOwnedCards(cards);
      },

      clearInventory: () =>
        set({
          ownedCards: [],
          deckIds: [],
          cardSerials: {},
        }),

      deckIds: [],

      addToDeck: (id) => {
        const cur = get().deckIds;
        if (cur.includes(id)) return;
        set({ deckIds: [...cur, id] });
      },

      removeFromDeck: (id) => {
        set({ deckIds: get().deckIds.filter((x) => x !== id) });
      },

      clearDeck: () => set({ deckIds: [] }),

      setDeckIds: (ids) => set({ deckIds: ids }),

      addPremium: (amount) => set({ premium: get().premium + amount }),
      addFree: (amount) => set({ free: get().free + amount }),
    }),
    {
      name: "fraktum-game-store",
      version: 4,
    }
  )
);