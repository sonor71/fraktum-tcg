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
    width: 1315,
    height: 1196,
    spawnPoint: { x: 640, y: 493 },
    colliders: [
      { id: "hub-fountain-placeholder", x: 570, y: 430, width: 150, height: 88 },
      { id: "hub-north-planter-placeholder", x: 360, y: 245, width: 210, height: 54 },
      { id: "hub-east-statue-placeholder", x: 1035, y: 610, width: 92, height: 150 },
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
      { id: "market-left-stall-placeholder", x: 315, y: 445, width: 260, height: 120 },
      { id: "market-right-stall-placeholder", x: 1145, y: 440, width: 270, height: 130 },
      { id: "market-center-crates-placeholder", x: 800, y: 585, width: 120, height: 90 },
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
      { id: "archive-left-shelf-placeholder", x: 120, y: 360, width: 170, height: 650 },
      { id: "archive-right-shelf-placeholder", x: 735, y: 360, width: 170, height: 650 },
      { id: "archive-reading-table-placeholder", x: 390, y: 790, width: 245, height: 110 },
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
      { id: "arena-left-pillar-placeholder", x: 170, y: 575, width: 120, height: 180 },
      { id: "arena-right-pillar-placeholder", x: 735, y: 575, width: 120, height: 180 },
      { id: "arena-center-obstacle-placeholder", x: 430, y: 815, width: 165, height: 105 },
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
