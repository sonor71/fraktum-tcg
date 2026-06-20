import type { CardEffect, CardInstance, MatchState, PlayerId } from "../core/types";
import { damageHero, healHero } from "./DamageSystem";
import { drawCards } from "./DrawSystem";
import { rollDie } from "./Random";

const other = (playerId: PlayerId): PlayerId => (playerId === "player" ? "enemy" : "player");
const slotsKey = (playerId: PlayerId) => (playerId === "player" ? "playerSlots" : "enemySlots");
const addLog = (state: MatchState, message: string): MatchState => ({ ...state, log: [...state.log, message].slice(-50) });

export function resolveCardEffects(state: MatchState, playerId: PlayerId, card: CardInstance): MatchState {
  let next = state;
  const effects = card.definition.effects?.length ? card.definition.effects : legacy(card.definition.effectKey);
  for (const effect of effects) next = resolveEffect(next, playerId, card, effect);
  return next;
}

function resolveEffect(state: MatchState, playerId: PlayerId, card: CardInstance, effect: CardEffect): MatchState {
  const enemyId = other(playerId);
  let next = state;

  if (effect.op === "damage") {
    let value = effect.value ?? 0;

    if (effect.target === "randomEnemy") {
      const roll = rollDie(next.rngSeed, 2);
      next = { ...next, rngSeed: roll.seed };
      if (roll.value === 1) return hitHero(next, enemyId, value, card.definition.title);
      value = Math.max(2, value - 1);
    }

    if (effect.target === "frontEnemyCard") {
      const key = slotsKey(enemyId);
      const slots = [...next.board[key]];
      const targetIndex = slots.findIndex(Boolean);
      const target = targetIndex >= 0 ? slots[targetIndex] : null;

      if (target) {
        const damaged = { ...target, currentHealth: target.currentHealth - value };
        slots[targetIndex] = damaged.currentHealth <= 0 ? null : damaged;
        next = { ...next, board: { ...next.board, [key]: slots } };
        next = addLog(next, `${card.definition.title}: ${value} damage to ${target.definition.title}.`);

        if (damaged.currentHealth <= 0) {
          next = {
            ...next,
            [enemyId]: { ...next[enemyId], discard: [...next[enemyId].discard, damaged] },
          };
          next = addLog(next, `${target.definition.title} was destroyed and moved to discard.`);
        }

        return next;
      }
    }

    return hitHero(next, enemyId, value, card.definition.title);
  }

  if (effect.op === "heal") {
    next = { ...next, [playerId]: healHero(next[playerId], effect.value ?? 0) };
    return addLog(next, `${card.definition.title}: healed ${effect.value ?? 0}.`);
  }

  if (effect.op === "draw") {
    return { ...addLog(next, `${card.definition.title}: drew ${effect.value ?? 1}.`), [playerId]: drawCards(next[playerId], effect.value ?? 1) };
  }

  if (effect.op === "swapHeroHp") {
    const playerHp = next.player.hp;
    return addLog({ ...next, player: { ...next.player, hp: next.enemy.hp }, enemy: { ...next.enemy, hp: playerHp } }, `${card.definition.title}: hero HP swapped.`);
  }

  if (effect.op === "drawGame") return addLog({ ...next, phase: "ended", winner: "draw" }, `${card.definition.title}: match ended in a draw.`);

  if (effect.op === "restoreLastTurnLostHp") {
    const amount = next[playerId].lastTurnLostHp || effect.value || 5;
    return { ...addLog(next, `${card.definition.title}: restored ${amount} HP.`), [playerId]: healHero(next[playerId], amount) };
  }

  if (effect.op === "shield") {
    return addLog({ ...next, [playerId]: { ...next[playerId], effects: [...next[playerId].effects, { id: "armor_of_chaos", sourceId: card.instanceId, label: "Armor of Chaos", value: effect.value }] } }, `${card.definition.title}: damage below 3 is prevented.`);
  }

  if (effect.op === "peekDeck") return addLog(next, `${card.definition.title}: top enemy deck is ${next[enemyId].deck[0]?.definition.title ?? "empty"}.`);

  if (effect.op === "activeEffect" || effect.op === "increaseNextCardPower") {
    return addLog({ ...next, [playerId]: { ...next[playerId], effects: [...next[playerId].effects, { id: effect.key ?? card.baseId, sourceId: card.instanceId, label: card.definition.title, value: effect.percent }] } }, `${card.definition.title}: active effect added.`);
  }

  return addLog(next, `${card.definition.title}: ${effect.op} resolved.`);
}

function hitHero(state: MatchState, target: PlayerId, value: number, title: string) {
  const result = damageHero(state[target], value);
  return addLog({ ...state, [target]: result.player }, `${title}: ${result.dealt} damage to ${target} hero.`);
}

function legacy(key?: string): CardEffect[] {
  return key ? [{ op: key }] : [];
}
