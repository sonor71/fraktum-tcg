export type PackId = "egypt" | "ice" | "void" | "electric" | "flame" | "normal";

export type PackMeta = {
  id: PackId;
  title: string;
  description: string;
  artSrc: string;
  fallbackArtSrc: string;
  price: number;
  cardPool: string[];
};

export const PACKS: PackMeta[] = [
  {
    id: "egypt",
    title: "Египетский пак",
    description: "Карты древних символов, пророчеств и артефактов.",
    artSrc: "/packs/egypt.png",
    fallbackArtSrc: "/packs/normal.png",
    price: 100,
    cardPool: ["oracle", "caduceus", "sandstorm", "dragon_eye", "amulet_of_old_sage", "time_of_reckoning", "book_knowledge"],
  },
  {
    id: "ice",
    title: "Ледниковый пак",
    description: "Холодные тактики, контроль темпа и защитные эффекты.",
    artSrc: "/packs/glacier pack.png",
    fallbackArtSrc: "/packs/normal.png",
    price: 100,
    cardPool: ["ice", "titan_eye", "shield_hope", "double_speed", "wood_vines", "tree_of_life", "crystal_of_time"],
  },
  {
    id: "void",
    title: "Пак Бездны",
    description: "Тёмные эффекты, обратные тактики и карты Бездны.",
    artSrc: "/packs/abyss pack.png",
    fallbackArtSrc: "/packs/normal.png",
    price: 120,
    cardPool: ["warlock", "fifteen_sixteen", "reverse_heart", "shadow_sword", "hyper_night", "reverse", "psychological_disorder", "unrequited_love", "seal_of_forgotten_souls", "brian"],
  },
  {
    id: "electric",
    title: "Электрический пак",
    description: "Молнии, перегрузка, электрический урон и карты Феликса.",
    artSrc: "/packs/electric pack.png",
    fallbackArtSrc: "/packs/normal.png",
    price: 100,
    cardPool: ["thunderbolts", "electroshocker", "spherical_lightning", "energy_sword", "thunderer", "seventy_one", "felix", "crystal_of_time"],
  },
  {
    id: "flame",
    title: "Огненный пак",
    description: "Огонь, свет, давление и разрушительные атаки.",
    artSrc: "/packs/flame pack.png",
    fallbackArtSrc: "/packs/normal.png",
    price: 100,
    cardPool: ["fire", "excalibur", "phoenix_feather", "hand_of_god", "legendary_messenger", "valkyrie"],
  },
  {
    id: "normal",
    title: "Обычный пак",
    description: "Смешанный набор карт для пополнения инвентаря и колоды.",
    artSrc: "/packs/normal.png",
    fallbackArtSrc: "/packs/egypt.png",
    price: 80,
    cardPool: [
      "energy_sword",
      "sandstorm",
      "shadow_sword",
      "magician",
      "elven_sword",
      "hunter",
      "spherical_lightning",
      "valkyrie",
      "thunderer",
      "thunderbolts",
      "warlock",
      "excalibur",
      "fire",
      "ice",
      "brian",
      "sam",
      "felix",
      "hand_of_god",
      "seventy_one",
      "time_of_reckoning",
      "dragon_eye",
      "wood_vines",
      "tree_of_life",
      "caduceus",
      "book_knowledge",
      "oracle",
      "reverse_heart",
      "double_speed",
      "reverse",
      "fifteen_sixteen",
      "crystal_of_time",
      "phoenix_feather",
      "amulet_of_old_sage",
      "hyper_night",
      "shield_hope",
      "legendary_messenger",
      "seal_of_forgotten_souls",
      "psychological_disorder",
      "unrequited_love",
      "armor_of_chaos",
      "titan_eye",
      "electroshocker"
],
  },
];

export function getPackById(id?: string | null) {
  const normalizedId = id === "abyss" ? "void" : id;
  return PACKS.find((pack) => pack.id === normalizedId) ?? PACKS.find((pack) => pack.id === "normal") ?? PACKS[0];
}
