import type { CardInstance, MatchState, PlayerId, PlayerState } from "../core/types";
import { BOARD_SIZE } from "./Rules";
import { getCardBoardMaxHp, otherPlayer, slotsKey } from "./TurnManager";

export function damageHero(player: PlayerState, raw: number) {
  const amount = Math.max(0, Math.floor(raw));
  const blocked = Math.min(player.shield, amount);
  const dealt = Math.max(0, amount - blocked);
  return { player: { ...player, shield: Math.max(0, player.shield - amount), hp: Math.max(0, player.hp - dealt), lastTurnLostHp: player.lastTurnLostHp + dealt }, dealt };
}
export function healHero(player: PlayerState, amount: number) { return { ...player, hp: Math.min(player.maxHp, player.hp + Math.max(0, Math.floor(amount))) }; }

function attackValue(card: CardInstance | null) { return Math.max(0, Math.floor(Number(card?.currentAttack ?? card?.definition.attack ?? 0))); }
function canAttack(card: CardInstance | null, ownerPersonalTurnsTaken: number) {
  if (!card || attackValue(card) <= 0 || card.definition.canAttack === false) return false;
  const readyFrom = card.attackReadyFromOwnerPersonalTurn ?? 0;
  return ownerPersonalTurnsTaken >= readyFrom;
}

function applyDamageToCard(card: CardInstance, amount: number) {
  let remaining = Math.max(0, Math.floor(amount));
  const armor = Math.max(0, Math.floor(card.currentArmor ?? card.definition.armor ?? 0));
  const armorUsed = Math.min(armor, remaining);
  remaining -= armorUsed;
  const hp = Math.max(0, Math.floor(card.currentHealth ?? getCardBoardMaxHp(card)));
  const hpAfter = Math.max(0, hp - remaining);
  return { card: { ...card, currentArmor: armor - armorUsed, currentHealth: hpAfter }, overflow: Math.max(0, remaining - hp) };
}

export function resolveFieldCombat(state: MatchState, attackerId: PlayerId): MatchState {
  const defenderId = otherPlayer(attackerId);
  const attackerKey = slotsKey(attackerId);
  const defenderKey = slotsKey(defenderId);
  const attackerSlots = [...state.board[attackerKey]];
  const defenderSlots = [...state.board[defenderKey]];
  let attackerHeroDamage = 0;
  let defenderHeroDamage = 0;

  const declared = Array.from({ length: BOARD_SIZE }, (_, index) => ({
    index,
    attacker: canAttack(attackerSlots[index], state[attackerId].personalTurnsTaken ?? 0) ? attackValue(attackerSlots[index]) : 0,
    defender: canAttack(defenderSlots[index], state[defenderId].personalTurnsTaken ?? 0) ? attackValue(defenderSlots[index]) : 0,
  }));

  for (const hit of declared) {
    if (hit.attacker > 0) {
      const target = defenderSlots[hit.index];
      if (target) {
        const result = applyDamageToCard(target, hit.attacker);
        defenderSlots[hit.index] = result.card;
        defenderHeroDamage += result.overflow;
      } else defenderHeroDamage += hit.attacker;
    }
    if (hit.defender > 0) {
      const target = attackerSlots[hit.index];
      if (target) {
        const result = applyDamageToCard(target, hit.defender);
        attackerSlots[hit.index] = result.card;
        attackerHeroDamage += result.overflow;
      } else attackerHeroDamage += hit.defender;
    }
  }

  const attackerDamage = damageHero(state[attackerId], attackerHeroDamage).player;
  const defenderDamage = damageHero(state[defenderId], defenderHeroDamage).player;
  return { ...state, [attackerId]: attackerDamage, [defenderId]: defenderDamage, board: { ...state.board, [attackerKey]: attackerSlots, [defenderKey]: defenderSlots } };
}
