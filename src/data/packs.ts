export type PackId = "egypt" | "normal" | "ice" | "abyss";

export type PackMeta = {
  id: PackId;
  title: string;
  imageSrc: string;     // текстура пака (иконка/обложка)
  // опционально:
  // bgSrc?: string;    // если захочешь фон/рамку
};

export const PACKS: Record<PackId, PackMeta> = {
  egypt: {
    id: "egypt",
    title: "Египетский пак",
    imageSrc: "/packs/pack-egypt.png",
  },
  normal: {
    id: "normal",
    title: "Обычный пак",
    imageSrc: "/packs/pack-normal.png",
  },
  ice: {
    id: "ice",
    title: "Ледниковый пак",
    imageSrc: "/packs/pack-ice.png",
  },
  abyss: {
    id: "abyss",
    title: "Пак Бездны",
    imageSrc: "/packs/pack-abyss.png",
  },
};
