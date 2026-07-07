import type { CardDefinition, CardRarity, CardType } from "../core/types";

const card = (partial: Partial<CardDefinition> & { id: string; title: string; image: string }): CardDefinition => ({
  cost: 1, attack: 0, health: 0, description: "", ...partial,
  type: (partial.type ?? "effect") as CardType, rarity: (partial.rarity ?? "common") as CardRarity,
});

export const cardDefinitions: CardDefinition[] = [
  card({ id: "brian", title: "Brian", type: "character", cost: 0, attack: 2, health: 30, image: "/cards/Brian.png", rarity: "rare", description: "Player hero." }),
  card({ id: "felix", title: "Felix", type: "character", cost: 0, attack: 2, health: 30, image: "/cards/Felix.png", rarity: "rare", description: "AI hero." }),
  card({ id: "energy_sword", title: "Energy Sword", type: "attack", rarity: "rare", cost: 2, attack: 3, health: 4, image: "/cards/energy-sword.png", description: "3 to front enemy card and 2 to enemy hero.", effects: [{ op: "damage", target: "frontEnemyCard", value: 3 }, { op: "damage", target: "enemyHero", value: 2 }] }),
  card({ id: "fire", title: "Fire", type: "attack", cost: 1, image: "/cards/fire.png", description: "2 to front card, 1 to enemy hero.", effects: [{ op: "damage", target: "frontEnemyCard", value: 2 }, { op: "damage", target: "enemyHero", value: 1 }] }),
  card({ id: "ice", title: "Ice", type: "attack", cost: 1, image: "/cards/ice.png", description: "2 to front card, 1 to enemy hero.", effects: [{ op: "damage", target: "frontEnemyCard", value: 2 }, { op: "damage", target: "enemyHero", value: 1 }] }),
  card({ id: "thunderbolts", title: "Thunderbolts", type: "attack", cost: 2, image: "/cards/thunderbolts.png", description: "2-3 damage to random enemy target.", effects: [{ op: "damage", target: "randomEnemy", value: 3 }] }),
  card({ id: "reverse_heart", title: "Reverse Heart", type: "effect", cost: 2, image: "/cards/reverse-heart.png", description: "Swap hero HP.", effects: [{ op: "swapHeroHp" }] }),
  card({ id: "caduceus", title: "Caduceus", type: "effect", rarity: "legendary", cost: 3, image: "/cards/Caduceus.png", description: "Ends the match in a draw.", effects: [{ op: "drawGame" }] }),
  card({ id: "tree_of_life", title: "Tree of Life", type: "effect", cost: 2, image: "/cards/tree-of-life.png", description: "Restore last lost HP or heal 5.", effects: [{ op: "restoreLastTurnLostHp", value: 5 }] }),
  card({ id: "crystal_of_time", title: "Crystal of Time", type: "bonus", cost: 0, image: "/cards/THE CRYSTAL OF TIME.png", description: "+10% Felix bonus.", effects: [{ op: "bonus", percent: 10 }] }),
  card({ id: "phoenix_feather", title: "Phoenix Feather", type: "bonus", cost: 0, image: "/cards/Phoenix feather.png", description: "+10% bonus.", effects: [{ op: "bonus", percent: 10 }] }),
  card({ id: "armor_of_chaos", title: "Armor of Chaos", type: "effect", cost: 2, image: "/cards/Armor of chaos.png", description: "Prevents damage below 3.", effects: [{ op: "shield", target: "self", value: 3 }] }),
  card({ id: "titan_eye", title: "Titan Eye", type: "effect", cost: 2, image: "/cards/eye titan.png", description: "Enemy next card is 20% weaker.", effects: [{ op: "increaseNextCardPower", target: "enemy", percent: -20 }] }),
  card({ id: "dragon_eye", title: "Dragon Eye", type: "tactic", cost: 1, image: "/cards/dragon-eye.png", description: "Peek top enemy deck card.", effects: [{ op: "peekDeck", target: "opponentDeck", value: 1 }] }),
  card({ id: "double_speed", title: "Double Speed", type: "tactic", cost: 1, image: "/cards/double-speed.png", description: "Adds Double Speed active effect.", effects: [{ op: "activeEffect", key: "double_speed" }] }),
];
export function loadCardDefinitions() { return cardDefinitions; }
export function normalizeCardDefinition(input: Partial<CardDefinition> & { id?: string; title?: string; name?: string; image?: string }): CardDefinition { const title = input.title ?? input.name ?? input.id ?? "Card"; return card({ id: input.id ?? title.toLowerCase().replaceAll(" ", "_"), title, image: input.image ?? `/cards/${title}.png`, ...input }); }
export const getCardDefinition = (id: string) => cardDefinitions.find((c) => c.id === id) ?? cardDefinitions[0];
