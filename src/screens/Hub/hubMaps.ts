export type HubMapId = "hub1" | "market" | "archive" | "arena";
export type HubDirection = "up" | "down" | "left" | "right";

export type HubPoint = {
  x: number;
  y: number;
};

export type HubBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type HubCollider = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type HubExit = {
  id: string;
  label: string;
  x: number;
  y: number;
  radius: number;
  prompt: string;
} & (
  | {
      type: "map-transition";
      targetMap: HubMapId;
      spawnOnTarget: HubPoint;
    }
  | {
      type: "route";
      route: string;
    }
);

export type HubMapConfig = {
  id: HubMapId;
  title: string;
  image: string;
  width: number;
  height: number;
  spawnPoint: HubPoint;
  allowedBounds?: HubBounds;
  colliders?: HubCollider[];
  exits: HubExit[];
};

export const HUB_MAPS: Record<HubMapId, HubMapConfig> = {
  hub1: {
    id: "hub1",
    title: "Fraktum Hub",
    image: "/assets/hub/hub1.png",
    width: 1536,
    height: 1536,
    spawnPoint: { x: 768, y: 1250 },
    colliders: [
      { id: "hub-central-fountain", x: 650, y: 690, width: 236, height: 118 },
      { id: "hub-east-pylon", x: 1120, y: 520, width: 150, height: 300 },
      { id: "hub-west-crystal", x: 250, y: 520, width: 150, height: 290 },
      { id: "hub-lower-console", x: 565, y: 1120, width: 410, height: 72 },
    ],
    exits: [
      {
        id: "to-market",
        type: "map-transition",
        label: "The Market",
        prompt: "Press E to enter The Market",
        targetMap: "market",
        x: 768,
        y: 1450,
        radius: 95,
        spawnOnTarget: { x: 864, y: 860 },
      },
      {
        id: "to-archive",
        type: "map-transition",
        label: "The Archive",
        prompt: "Press E to enter The Archive",
        targetMap: "archive",
        x: 768,
        y: 115,
        radius: 95,
        spawnOnTarget: { x: 512, y: 1360 },
      },
      {
        id: "to-arena",
        type: "map-transition",
        label: "The Arena",
        prompt: "Press E to enter The Arena",
        targetMap: "arena",
        x: 125,
        y: 768,
        radius: 100,
        spawnOnTarget: { x: 512, y: 1360 },
      },
    ],
  },
  market: {
    id: "market",
    title: "The Market",
    image: "/assets/hub/market.png",
    width: 1728,
    height: 1024,
    spawnPoint: { x: 864, y: 860 },
    colliders: [
      { id: "market-left-stalls", x: 165, y: 295, width: 390, height: 210 },
      { id: "market-right-stalls", x: 1170, y: 300, width: 395, height: 215 },
      { id: "market-center-counter", x: 735, y: 410, width: 260, height: 145 },
    ],
    exits: [
      {
        id: "market-to-hub",
        type: "map-transition",
        label: "Fraktum Hub",
        prompt: "Press E to return to Fraktum Hub",
        targetMap: "hub1",
        x: 864,
        y: 930,
        radius: 95,
        spawnOnTarget: { x: 768, y: 1350 },
      },
    ],
  },
  archive: {
    id: "archive",
    title: "The Archive",
    image: "/assets/hub/archive.png",
    width: 1024,
    height: 1536,
    spawnPoint: { x: 512, y: 1360 },
    colliders: [
      { id: "archive-left-shelves", x: 95, y: 250, width: 180, height: 760 },
      { id: "archive-right-shelves", x: 750, y: 250, width: 180, height: 760 },
      { id: "archive-reading-table", x: 350, y: 680, width: 324, height: 160 },
    ],
    exits: [
      {
        id: "archive-to-hub",
        type: "map-transition",
        label: "Fraktum Hub",
        prompt: "Press E to return to Fraktum Hub",
        targetMap: "hub1",
        x: 512,
        y: 1450,
        radius: 95,
        spawnOnTarget: { x: 768, y: 220 },
      },
    ],
  },
  arena: {
    id: "arena",
    title: "The Arena",
    image: "/assets/hub/arena.png",
    width: 1024,
    height: 1536,
    spawnPoint: { x: 512, y: 1360 },
    colliders: [
      { id: "arena-left-pillar", x: 170, y: 520, width: 128, height: 260 },
      { id: "arena-right-pillar", x: 725, y: 520, width: 128, height: 260 },
      { id: "arena-center-sigil", x: 380, y: 780, width: 264, height: 105 },
    ],
    exits: [
      {
        id: "arena-to-hub",
        type: "map-transition",
        label: "Fraktum Hub",
        prompt: "Press E to return to Fraktum Hub",
        targetMap: "hub1",
        x: 512,
        y: 1450,
        radius: 95,
        spawnOnTarget: { x: 230, y: 768 },
      },
      {
        id: "enter-match",
        type: "route",
        label: "Enter Match",
        prompt: "Press E to enter Match",
        route: "/match-launcher",
        x: 512,
        y: 260,
        radius: 110,
      },
    ],
  },
};

export const HUB_INTERACTION_DISTANCE = 1;
export const HUB_PLAYER_SPEED = 220;
