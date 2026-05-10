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
