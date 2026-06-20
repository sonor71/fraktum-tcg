import type { CardEffect, CardInstance, MatchState, PlayerId } from "../core/types";
import { damageHero, healHero } from "./DamageSystem";
import { drawCards } from "./DrawSystem";
import { rollDie } from "./Random";
const other = (p: PlayerId): PlayerId => (p === "player" ? "enemy" : "player");
const slotsKey = (p: PlayerId) => (p === "player" ? "playerSlots" : "enemySlots");
const addLog = (s: MatchState, m: string): MatchState => ({ ...s, log: [...s.log, m].slice(-50) });
export function resolveCardEffects(state: MatchState, playerId: PlayerId, card: CardInstance): MatchState { let next = state; const effects = card.definition.effects?.length ? card.definition.effects : legacy(card.definition.effectKey); for (const effect of effects) next = resolveEffect(next, playerId, card, effect); return next; }
function resolveEffect(state: MatchState, playerId: PlayerId, card: CardInstance, effect: CardEffect): MatchState {
  const enemyId = other(playerId); let next = state;
  if (effect.op === "damage") { let value = effect.value ?? 0; if (effect.target === "randomEnemy") { const r = rollDie(next.rngSeed, 2); next = { ...next, rngSeed: r.seed }; if (r.value === 1) return hitHero(next, enemyId, value, card.definition.title); value = Math.max(2, value - 1); }
    if (effect.target === "frontEnemyCard") { const key = slotsKey(enemyId); const slots = [...next.board[key]]; const target = slots.find(Boolean); if (target) { target.currentHealth -= value; next = { ...next, board: { ...next.board, [key]: slots.map((c) => c && c.currentHealth <= 0 ? null : c) } }; return addLog(next, `${card.definition.title}: ${value} damage to ${target.definition.title}.`); } }
    return hitHero(next, enemyId, value, card.definition.title); }
  if (effect.op === "heal") { next = { ...next, [playerId]: healHero(next[playerId], effect.value ?? 0) }; return addLog(next, `${card.definition.title}: healed ${effect.value ?? 0}.`); }
  if (effect.op === "draw") return { ...addLog(next, `${card.definition.title}: drew ${effect.value ?? 1}.`), [playerId]: drawCards(next[playerId], effect.value ?? 1) };
  if (effect.op === "swapHeroHp") { const p = next.player.hp; return addLog({ ...next, player: { ...next.player, hp: next.enemy.hp }, enemy: { ...next.enemy, hp: p } }, `${card.definition.title}: hero HP swapped.`); }
  if (effect.op === "drawGame") return addLog({ ...next, phase: "ended", winner: "draw" }, `${card.definition.title}: match ended in a draw.`);
  if (effect.op === "restoreLastTurnLostHp") { const amount = next[playerId].lastTurnLostHp || effect.value || 5; return { ...addLog(next, `${card.definition.title}: restored ${amount} HP.`), [playerId]: healHero(next[playerId], amount) }; }
  if (effect.op === "shield") return addLog({ ...next, [playerId]: { ...next[playerId], effects: [...next[playerId].effects, { id: "armor_of_chaos", sourceId: card.instanceId, label: "Armor of Chaos", value: effect.value }] } }, `${card.definition.title}: damage below 3 is prevented.`);
  if (effect.op === "peekDeck") return addLog(next, `${card.definition.title}: top enemy deck is ${next[enemyId].deck[0]?.definition.title ?? "empty"}.`);
  if (effect.op === "activeEffect" || effect.op === "increaseNextCardPower") return addLog({ ...next, [playerId]: { ...next[playerId], effects: [...next[playerId].effects, { id: effect.key ?? card.baseId, sourceId: card.instanceId, label: card.definition.title, value: effect.percent }] } }, `${card.definition.title}: active effect added.`);
  return addLog(next, `${card.definition.title}: ${effect.op} resolved.`);
}
function hitHero(state: MatchState, target: PlayerId, value: number, title: string) { const result = damageHero(state[target], value); return addLog({ ...state, [target]: result.player }, `${title}: ${result.dealt} damage to ${target} hero.`); }
function legacy(key?: string): CardEffect[] { return key ? [{ op: key }] : []; }
