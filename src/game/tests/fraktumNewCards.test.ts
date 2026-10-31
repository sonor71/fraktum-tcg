import { describe, expect, it } from "vitest";
import { CARDS_BY_ID } from "../cards";
import { PACKS } from "../../data/packs";
import { createInitialMatchState, playCard, rollD20 } from "../engine/MatchEngine";
import { resolveCardEffects } from "../engine/EffectResolver";
import { loadCardDefinitions } from "../data/cards";
import type { CardInstance, MatchState, PlayerId } from "../core/types";

const EXPECTED = {
  elite_knight: ["Elite Knight", "epic", 3],
  hero_silhouette: ["Hero Silhouette", "legendary", 5],
  healing: ["Healing", "common", 1],
  prime: ["Prime", "legendary", 5],
  clean_sheet: ["Clean Sheet", "legendary", 5],
  tsunami: ["Tsunami", "mythic", 4],
} as const;

const definitions = new Map(loadCardDefinitions().map((card) => [card.id, card]));
function instance(id: string, ownerId: PlayerId, suffix = id): CardInstance {
  const definition = definitions.get(id);
  if (!definition) throw new Error(`Missing ${id}`);
  return { instanceId: `${ownerId}_${suffix}`, baseId: id, definition, currentAttack: definition.attack, currentHealth: definition.health, ownerId };
}
function fixture(): MatchState {
  const state = createInitialMatchState({ startingPlayerId: "player" });
  return { ...state, phase: "main", activePlayerId: "player", player: { ...state.player, will: 10 }, currentTurn: { playerId: "player", d20Limit: "unlimited", playsUsed: 0, cardsPlayed: 0, destroyedOwnCard: false, freeCards: false, skipDamageApplied: false, timerSeconds: 60, playedCosts: [] } };
}

function cast(state: MatchState, id: string, target?: Parameters<typeof resolveCardEffects>[3]) {
  return resolveCardEffects(state, "player", instance(id, "player"), target, 0);
}

describe("six Fraktum cards", () => {
  it("registers canonical metadata, rarity Will costs and normal-pack availability", () => {
    const normal = PACKS.find((pack) => pack.id === "normal");
    for (const [id, [title, rarity, cost]] of Object.entries(EXPECTED)) {
      expect(CARDS_BY_ID[id]).toMatchObject({ id, title, rarity, cost });
      expect(CARDS_BY_ID[id].image).toBe(`/cards/fraktum-new/${id}.png`);
      expect(normal?.cardPool).toContain(id);
    }
  });

  it("Healing heals only the selected friendly card and clamps at max HP", () => {
    const ally = { ...instance("elite_knight", "player", "wounded"), currentHealth: 5 };
    const base = fixture();
    const state = { ...base, board: { ...base.board, playerSlots: [ally, null, null, null, null] } };
    const healed = cast(state, "healing", { type: "slot", playerId: "player", slotIndex: 0 });
    expect(healed.board.playerSlots[0]?.currentHealth).toBe(6);
  });

  it("Elite Knight damages only an opposing card", () => {
    const enemy = instance("prime", "enemy", "target");
    const base = fixture();
    const state = { ...base, board: { ...base.board, enemySlots: [enemy, null, null, null, null] } };
    const resolved = cast(state, "elite_knight");
    expect(resolved.board.enemySlots[0]?.currentHealth).toBe(2);
    expect(resolved.enemy.hp).toBe(state.enemy.hp);
  });

  it("Tsunami deals two to every enemy card and never to heroes or allies", () => {
    const enemyA = instance("prime", "enemy", "a");
    const enemyB = instance("elite_knight", "enemy", "b");
    const ally = instance("prime", "player", "ally");
    const base = fixture();
    const state = { ...base, board: { playerSlots: [ally, null, null, null, null], enemySlots: [enemyA, enemyB, null, null, null] } };
    const resolved = cast(state, "tsunami");
    expect(resolved.board.enemySlots.slice(0, 2).map((card) => card?.currentHealth)).toEqual([4, 4]);
    expect(resolved.board.playerSlots[0]?.currentHealth).toBe(6);
    expect(resolved.enemy.hp).toBe(state.enemy.hp);
  });

  it("Clean Sheet discards the selected other card and draws two", () => {
    const selected = instance("healing", "player", "selected");
    const drawA = instance("tsunami", "player", "draw-a");
    const drawB = instance("prime", "player", "draw-b");
    const base = fixture();
    const state = { ...base, player: { ...base.player, hand: [selected], deck: [drawA, drawB], discard: [] } };
    const resolved = cast(state, "clean_sheet", { type: "hand", playerId: "player", cardInstanceId: selected.instanceId });
    expect(resolved.player.discard.map((card) => card.instanceId)).toContain(selected.instanceId);
    expect(resolved.player.hand.map((card) => card.instanceId)).toEqual([drawA.instanceId, drawB.instanceId]);
  });

  it("Hero Silhouette creates a three-point shield and grants capped Will next own turn", () => {
    const base = fixture();
    const protectedState = cast({ ...base, player: { ...base.player, will: base.player.maxWill - 1 } }, "hero_silhouette");
    expect(protectedState.player.shield).toBe(3);
    const nextTurn = { ...protectedState, phase: "roll" as const, currentTurn: undefined, player: { ...protectedState.player, personalTurnsTaken: 1 } };
    const started = rollD20(nextTurn, "player", 4);
    expect(started.player.will).toBe(started.player.maxWill);
    expect(started.player.effects.some((effect) => effect.id === "hero_silhouette_next_will")).toBe(false);
  });

  it("Prime reduces only the first hero damage of a turn and stops after destruction", () => {
    const prime = instance("prime", "player");
    const base = fixture();
    const state = { ...base, player: { ...base.player, hand: [], effects: [] }, board: { ...base.board, playerSlots: [prime, null, null, null, null] } };
    const attackerBase = instance("elite_knight", "enemy", "spell");
    const attacker = { ...attackerBase, baseId: "test_hero_damage", definition: { ...attackerBase.definition, id: "test_hero_damage", attack: 0, effects: [{ op: "damageHero", target: "enemyHero", value: 4 }], effectKey: "" } };
    const first = resolveCardEffects(state, "enemy", attacker);
    const second = resolveCardEffects(first, "enemy", attacker);
    expect(state.player.hp - first.player.hp).toBe(2);
    expect(first.player.hp - second.player.hp).toBe(4);
    const destroyed = { ...state, board: { ...state.board, playerSlots: [{ ...prime, currentHealth: 0 }, null, null, null, null] } };
    expect(state.player.hp - resolveCardEffects(destroyed, "enemy", attacker).player.hp).toBe(4);
  });

  it("rejects Healing and Clean Sheet before spending Will when their target is invalid", () => {
    const healing = instance("healing", "player");
    const clean = instance("clean_sheet", "player");
    const base = fixture();
    const state = { ...base, player: { ...base.player, hand: [healing, clean] } };
    const invalidHealing = playCard(state, "player", healing.instanceId);
    const invalidClean = playCard(state, "player", clean.instanceId);
    expect(invalidHealing.player.will).toBe(state.player.will);
    expect(invalidClean.player.will).toBe(state.player.will);
    expect(invalidHealing.player.hand).toHaveLength(2);
    expect(invalidClean.player.hand).toHaveLength(2);
  });
});
