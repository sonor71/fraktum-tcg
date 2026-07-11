import type { CardInstance, MatchState, PlayerId, PlayerState } from "../core/types";
import { BOARD_SIZE } from "./Rules";
import { getCardBoardMaxHp, getCardTitle, otherPlayer, slotsKey } from "./TurnManager";

const LOG_LIMIT = 80;

export function damageHero(player: PlayerState, raw: number) {
  const amount = Math.max(0, Math.floor(raw));
  const blocked = Math.min(player.shield, amount);
  const dealt = Math.max(0, amount - blocked);
  return { player: { ...player, shield: Math.max(0, player.shield - amount), hp: Math.max(0, player.hp - dealt), lastTurnLostHp: player.lastTurnLostHp + dealt }, dealt };
}
export function healHero(player: PlayerState, amount: number) { return { ...player, hp: Math.min(player.maxHp, player.hp + Math.max(0, Math.floor(amount))) }; }

function attackValue(card: CardInstance | null) { return Math.max(0, Math.floor(Number(card?.currentAttack ?? card?.definition.attack ?? 0))); }
function canAttack(card: CardInstance | null, ownerPersonalTurnsTaken: number, ownerId: PlayerId, activeAttackerId: PlayerId) {
  if (!card || attackValue(card) <= 0 || card.definition.canAttack === false) return false;
  const readyFrom = card.attackReadyFromOwnerPersonalTurn ?? 0;
  if (activeAttackerId !== ownerId && card.ownerPersonalTurnPlayed !== undefined && ownerPersonalTurnsTaken <= readyFrom) return false;
  return ownerPersonalTurnsTaken >= readyFrom;
}

function applyDamageToCard(card: CardInstance, amount: number) {
  let remaining = Math.max(0, Math.floor(amount));
  const armor = Math.max(0, Math.floor(card.currentArmor ?? card.definition.armor ?? 0));
  const armorUsed = Math.min(armor, remaining);
  remaining -= armorUsed;
  const hp = Math.max(0, Math.floor(card.currentHealth ?? getCardBoardMaxHp(card)));
  const hpAfter = Math.max(0, hp - remaining);
  return { card: { ...card, currentArmor: armor - armorUsed, currentHealth: hpAfter }, overflow: Math.max(0, remaining - hp), previousHp: hp, nextHp: hpAfter };
}

function pushAttackLogs(
  logLines: string[],
  source: CardInstance | null,
  controller: PlayerId,
  target: CardInstance | null,
  targetOwner: PlayerId,
  slotIndex: number,
  damage: number,
  overflow: number,
  previousTargetHp?: number,
  nextTargetHp?: number,
) {
  if (!source || damage <= 0) return;
  const sourceName = getCardTitle(source);
  const targetText = target ? `${getCardTitle(target)} in ${targetOwner} slot ${slotIndex + 1}` : `${targetOwner} hero`;
  logLines.push(`[ATTACK_DECLARED] Source: ${sourceName}; Controller: ${controller}; Slot: ${slotIndex + 1}; Damage: ${damage}; Target: ${targetText}.`);
  if (target && typeof previousTargetHp === "number" && typeof nextTargetHp === "number" && previousTargetHp !== nextTargetHp) {
    logLines.push(`[CARD_DAMAGED] Source: ${sourceName}; Target: ${getCardTitle(target)}; HP: ${previousTargetHp} -> ${nextTargetHp}.`);
  }
  if (overflow > 0) {
    logLines.push(`[OVERFLOW_DAMAGE] Source: ${sourceName}; Target: ${targetOwner} hero; Damage: ${overflow}.`);
  }
  if (!target) {
    logLines.push(`[HERO_DAMAGED] Source: ${sourceName}; Target: ${targetOwner} hero; Damage: ${damage}.`);
  } else if (overflow > 0) {
    logLines.push(`[HERO_DAMAGED] Source: ${sourceName}; Target: ${targetOwner} hero; Damage: ${overflow}.`);
  }
  if (target && nextTargetHp === 0) {
    logLines.push(`[CARD_DESTROYED] Source: ${sourceName}; Target: ${getCardTitle(target)}; Slot: ${slotIndex + 1}.`);
  }
}

export function resolveFieldCombat(state: MatchState, attackerId: PlayerId): MatchState {
  const defenderId = otherPlayer(attackerId);
  const attackerKey = slotsKey(attackerId);
  const defenderKey = slotsKey(defenderId);
  const attackerSlots = [...state.board[attackerKey]];
  const defenderSlots = [...state.board[defenderKey]];
  let attackerHeroDamage = 0;
  let defenderHeroDamage = 0;
  const logLines: string[] = [`[FIELD_COMBAT_STARTED] Active: ${attackerId}.`];

  const declared = Array.from({ length: BOARD_SIZE }, (_, index) => ({
    index,
    attackerCard: attackerSlots[index] ?? null,
    defenderCard: defenderSlots[index] ?? null,
    attacker: canAttack(attackerSlots[index] ?? null, state[attackerId].personalTurnsTaken ?? 0, attackerId, attackerId) ? attackValue(attackerSlots[index] ?? null) : 0,
    defender: canAttack(defenderSlots[index] ?? null, state[defenderId].personalTurnsTaken ?? 0, defenderId, attackerId) ? attackValue(defenderSlots[index] ?? null) : 0,
  }));

  for (const hit of declared) {
    if (hit.attacker > 0) {
      const target = defenderSlots[hit.index] ?? null;
      if (target) {
        const result = applyDamageToCard(target, hit.attacker);
        defenderSlots[hit.index] = result.card;
        defenderHeroDamage += result.overflow;
        pushAttackLogs(logLines, hit.attackerCard, attackerId, target, defenderId, hit.index, hit.attacker, result.overflow, result.previousHp, result.nextHp);
      } else {
        defenderHeroDamage += hit.attacker;
        pushAttackLogs(logLines, hit.attackerCard, attackerId, null, defenderId, hit.index, hit.attacker, 0);
      }
    }
    if (hit.defender > 0) {
      const target = attackerSlots[hit.index] ?? null;
      if (target) {
        const result = applyDamageToCard(target, hit.defender);
        attackerSlots[hit.index] = result.card;
        attackerHeroDamage += result.overflow;
        pushAttackLogs(logLines, hit.defenderCard, defenderId, target, attackerId, hit.index, hit.defender, result.overflow, result.previousHp, result.nextHp);
      } else {
        attackerHeroDamage += hit.defender;
        pushAttackLogs(logLines, hit.defenderCard, defenderId, null, attackerId, hit.index, hit.defender, 0);
      }
    }
  }

  const attackerDamage = damageHero(state[attackerId], attackerHeroDamage).player;
  const defenderDamage = damageHero(state[defenderId], defenderHeroDamage).player;
  logLines.push(`[FIELD_COMBAT_COMPLETED] Active: ${attackerId}; ${attackerId} hero damage: ${attackerHeroDamage}; ${defenderId} hero damage: ${defenderHeroDamage}.`);

  return {
    ...state,
    [attackerId]: attackerDamage,
    [defenderId]: defenderDamage,
    board: { ...state.board, [attackerKey]: attackerSlots, [defenderKey]: defenderSlots },
    log: [...state.log, ...logLines].slice(-LOG_LIMIT),
  };
}
