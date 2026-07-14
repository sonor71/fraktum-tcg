import { describe, expect, it } from "vitest";
import {
  HUB_MAPS,
  getHubTransitionSpawnPoint,
  type HubMapId,
} from "../../screens/Hub/hubMaps";
import { getPlayerCollisionRect } from "../../screens/Hub/useHubMovement";

const MAP_IDS: HubMapId[] = ["hub1", "market", "archive", "arena"];

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

describe("hub quick travel spawn points", () => {
  it("uses the same entrance coordinates as manual hub exits", () => {
    const manualMarketSpawn = HUB_MAPS.hub1.exits.find(
      (exit) => exit.type === "map-transition" && exit.targetMap === "market",
    );
    const manualArchiveSpawn = HUB_MAPS.hub1.exits.find(
      (exit) => exit.type === "map-transition" && exit.targetMap === "archive",
    );
    const manualArenaSpawn = HUB_MAPS.hub1.exits.find(
      (exit) => exit.type === "map-transition" && exit.targetMap === "arena",
    );

    expect(manualMarketSpawn?.type).toBe("map-transition");
    expect(manualArchiveSpawn?.type).toBe("map-transition");
    expect(manualArenaSpawn?.type).toBe("map-transition");

    if (
      manualMarketSpawn?.type !== "map-transition" ||
      manualArchiveSpawn?.type !== "map-transition" ||
      manualArenaSpawn?.type !== "map-transition"
    ) {
      throw new Error("Hub room exits are not configured correctly.");
    }

    expect(getHubTransitionSpawnPoint("hub1", "market")).toEqual(
      manualMarketSpawn.spawnOnTarget,
    );
    expect(getHubTransitionSpawnPoint("hub1", "archive")).toEqual(
      manualArchiveSpawn.spawnOnTarget,
    );
    expect(getHubTransitionSpawnPoint("hub1", "arena")).toEqual(
      manualArenaSpawn.spawnOnTarget,
    );
  });

  it("uses the room's manual return point when fast travelling back to the hub", () => {
    for (const sourceMapId of ["market", "archive", "arena"] as const) {
      const returnExit = HUB_MAPS[sourceMapId].exits.find(
        (exit) => exit.type === "map-transition" && exit.targetMap === "hub1",
      );

      expect(returnExit?.type).toBe("map-transition");
      if (returnExit?.type !== "map-transition") {
        throw new Error(`${sourceMapId} has no return exit.`);
      }

      expect(getHubTransitionSpawnPoint(sourceMapId, "hub1")).toEqual(
        returnExit.spawnOnTarget,
      );
    }
  });

  it("never places the player inside a collider", () => {
    for (const sourceMapId of MAP_IDS) {
      for (const targetMapId of MAP_IDS) {
        if (sourceMapId === targetMapId) continue;

        const spawn = getHubTransitionSpawnPoint(sourceMapId, targetMapId);
        const playerRect = getPlayerCollisionRect(spawn);
        const collidingCollider = HUB_MAPS[targetMapId].colliders?.find((collider) =>
          overlaps(playerRect, collider),
        );

        expect(
          collidingCollider,
          `${sourceMapId} -> ${targetMapId} spawns inside ${collidingCollider?.id}`,
        ).toBeUndefined();
      }
    }
  });
});
