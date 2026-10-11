import { describe, expect, it } from "vitest";
import { createInitialMatchState, dispatch } from "../engine/MatchEngine";
import { loadCardDefinitions } from "../data/cards";
import { cardRequiresBoardSlot } from "../engine/TurnManager";
import { getOnlineMatchSeeds } from "../../services/onlineMatchSeed";
import type { CardDefinition, MatchState, StartMatchPayload } from "../core/types";

function isMainCard(card: CardDefinition) {
  const type = String(card.type ?? "").toLowerCase();
  return !["character", "hero", "bonus", "upgrade"].includes(type);
}

function makeMirroredStates(seed = 1791745200000) {
  const mains = loadCardDefinitions().filter(isMainCard).slice(0, 20);
  expect(mains).toHaveLength(20);

  const deckA = mains;
  const deckB = [...mains].reverse();
  const aSeeds = getOnlineMatchSeeds(seed, "a");
  const bSeeds = getOnlineMatchSeeds(seed, "b");

  const hostPayload: StartMatchPayload = {
    seed,
    playerDeck: deckA,
    enemyDeck: deckB,
    startingPlayerId: "player",
    ...aSeeds,
  };

  const guestPayload: StartMatchPayload = {
    seed,
    playerDeck: deckB,
    enemyDeck: deckA,
    startingPlayerId: "enemy",
    ...bSeeds,
  };

  return {
    host: createInitialMatchState(hostPayload),
    guest: createInitialMatchState(guestPayload),
  };
}

function mirroredInstanceId(id: string) {
  return id.replace(/^player_/, "enemy_").replace(/^enemy_/, "player_");
}

describe("online PvP mirrored state", () => {
  it("builds the same physical hands and decks on host and joined client", () => {
    const { host, guest } = makeMirroredStates();

    expect(host.player.hand.map((card) => card.baseId)).toEqual(
      guest.enemy.hand.map((card) => card.baseId),
    );
    expect(host.enemy.hand.map((card) => card.baseId)).toEqual(
      guest.player.hand.map((card) => card.baseId),
    );
    expect(host.player.deck.map((card) => card.baseId)).toEqual(
      guest.enemy.deck.map((card) => card.baseId),
    );
    expect(host.enemy.deck.map((card) => card.baseId)).toEqual(
      guest.player.deck.map((card) => card.baseId),
    );
    expect(host.rngSeed).toBe(guest.rngSeed);
  });

  it("applies the same played card on both clients after player/enemy remapping", () => {
    let { host, guest } = makeMirroredStates(1791745201234);

    host = dispatch(host, { type: "ROLL_D20", playerId: "player", forcedRoll: 10 });
    guest = dispatch(guest, { type: "ROLL_D20", playerId: "enemy", forcedRoll: 10 });

    const card = host.player.hand[0];
    expect(card).toBeTruthy();

    host = {
      ...host,
      player: { ...host.player, will: 20 },
    } as MatchState;
    guest = {
      ...guest,
      enemy: { ...guest.enemy, will: 20 },
    } as MatchState;

    const target = cardRequiresBoardSlot(card)
      ? { type: "slot" as const, playerId: "player" as const, slotIndex: 0 }
      : undefined;
    const mirroredTarget = target
      ? { ...target, playerId: "enemy" as const }
      : undefined;

    const hostAfter = dispatch(host, {
      type: "PLAY_CARD",
      playerId: "player",
      cardInstanceId: card.instanceId,
      target,
    });

    const guestAfter = dispatch(guest, {
      type: "PLAY_CARD",
      playerId: "enemy",
      cardInstanceId: mirroredInstanceId(card.instanceId),
      target: mirroredTarget,
    });

    expect(hostAfter.player.hand.some((item) => item.instanceId === card.instanceId)).toBe(false);
    expect(
      guestAfter.enemy.hand.some((item) => item.instanceId === mirroredInstanceId(card.instanceId)),
    ).toBe(false);

    expect(hostAfter.player.hp).toBe(guestAfter.enemy.hp);
    expect(hostAfter.enemy.hp).toBe(guestAfter.player.hp);
    expect(hostAfter.player.will).toBe(guestAfter.enemy.will);
    expect(hostAfter.enemy.will).toBe(guestAfter.player.will);

    expect(hostAfter.board.playerSlots.map((item) => item?.baseId ?? null)).toEqual(
      guestAfter.board.enemySlots.map((item) => item?.baseId ?? null),
    );
  });
});
