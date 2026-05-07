export type CardIdentity = {
  definitionId: string;
  ruName: string;
  enName: string;
  image: string;
  rarity: string;
  code: string;
  number: number;
};

export const CARD_IDENTITIES: Record<string, CardIdentity> = {
  energy_sword: {
    definitionId: "energy_sword",
    ruName: "Энергетический меч",
    enName: "Energy Sword",
    image: "/cards/energy-sword.png",
    rarity: "редкий",
    code: "ENS",
    number: 31,
  },
  seventy_one: {
    definitionId: "seventy_one",
    ruName: "71",
    enName: "Seventy One",
    image: "/cards/seventy-one.png",
    rarity: "редкий",
    code: "SVN",
    number: 71,
  },
  amulet_of_old_sage: {
    definitionId: "amulet_of_old_sage",
    ruName: "Амулет Старого Мудреца",
    enName: "Amulet of Old Sage",
    image: "/cards/amulet-of-old-sage.png",
    rarity: "мифический",
    code: "AOS",
    number: 25,
  },
  time_of_reckoning: {
    definitionId: "time_of_reckoning",
    ruName: "Время расплаты",
    enName: "Time of Reckoning",
    image: "/cards/time-of-reckoning.png",
    rarity: "хроматическая",
    code: "TOR",
    number: 19,
  },
  hyper_night: {
    definitionId: "hyper_night",
    ruName: "Гиперночь",
    enName: "Hyper Night",
    image: "/cards/hyper-night.png",
    rarity: "хроматическая",
    code: "HYN",
    number: 7,
  },
  dragon_eye: {
    definitionId: "dragon_eye",
    ruName: "Драконий глаз",
    enName: "Dragon Eye",
    image: "/cards/dragon-eye.png",
    rarity: "эпическая",
    code: "DRE",
    number: 12,
  },
  wood_vines: {
    definitionId: "wood_vines",
    ruName: "Древесные Лозы",
    enName: "Wood Vines",
    image: "/cards/wood-vines.png",
    rarity: "эпическая",
    code: "WLV",
    number: 13,
  },
  tree_of_life: {
    definitionId: "tree_of_life",
    ruName: "Древо Жизни",
    enName: "Tree of Life",
    image: "/cards/tree-of-life.png",
    rarity: "легендарная",
    code: "TOL",
    number: 18,
  },
  caduceus: {
    definitionId: "caduceus",
    ruName: "Кадуцей",
    enName: "Caduceus",
    image: "/cards/caduceus.png",
    rarity: "обычная",
    code: "CAD",
    number: 32,
  },
  book_knowledge: {
    definitionId: "book_knowledge",
    ruName: "Книга Знаний",
    enName: "Book Knowledge",
    image: "/cards/book-knowledge.png",
    rarity: "редкая",
    code: "BOK",
    number: 37,
  },
  oracle: {
    definitionId: "oracle",
    ruName: "Оракул",
    enName: "Oracle",
    image: "/cards/oracle.png",
    rarity: "легендарная",
    code: "ORC",
    number: 4,
  },
  sandstorm: {
    definitionId: "sandstorm",
    ruName: "Песчаная Буря",
    enName: "Sandstorm",
    image: "/cards/sandstorm.png",
    rarity: "эпическая",
    code: "SND",
    number: 15,
  },
  reverse_heart: {
    definitionId: "reverse_heart",
    ruName: "Реверсивное Сердце",
    enName: "Reverse Heart",
    image: "/cards/reverse-heart.png",
    rarity: "мифическая",
    code: "RVH",
    number: 17,
  },
  shadow_sword: {
    definitionId: "shadow_sword",
    ruName: "Теневой Меч",
    enName: "Shadow Sword",
    image: "/cards/shadow-sword.png",
    rarity: "эпическая",
    code: "SHS",
    number: 21,
  },
  shield_hope: {
    definitionId: "shield_hope",
    ruName: "Щит Надежды",
    enName: "Shield of Hope",
    image: "/cards/shield-hope.png",
    rarity: "эпическая",
    code: "SOH",
    number: 14,
  },
  double_speed: {
    definitionId: "double_speed",
    ruName: "2X",
    enName: "Double Speed",
    image: "/cards/double-speed.png",
    rarity: "редкая",
    code: "DBL",
    number: 9,
  },
};

export function createUniqueCardId(definitionId: string, serial: number) {
  const card = CARD_IDENTITIES[definitionId];

  if (!card) {
    throw new Error(`Unknown card definitionId: ${definitionId}`);
  }

  const number = String(card.number).padStart(3, "0");
  const serialText = String(serial).padStart(6, "0");

  return `${card.code}-${number}-${serialText}`;
}

export function getCardByUniqueId(uniqueId: string) {
  const code = uniqueId.split("-")[0];

  return Object.values(CARD_IDENTITIES).find((card) => card.code === code);
}

export function getDefinitionIdByUniqueId(uniqueId: string) {
  return getCardByUniqueId(uniqueId)?.definitionId ?? null;
}