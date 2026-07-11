import type { CardInstance, MatchState, PlayerId, TargetRef } from "../core/types";
import { rollDie, shuffleWithSeed } from "./Random";
import { createInitialMatchState, resolveCaduceusBattleDraw } from "./MatchEngine";
import {
  getCardBoardMaxHp,
  getCardCurrentHp,
  getCardTitle,
  isValidSlotIndex,
  otherPlayer,
  playerLabel,
  slotsKey,
} from "./TurnManager";
import { FATE_ROULETTE_EVENTS } from "./Rules";

const LOG_LIMIT = 80;

type RawEffect = Record<string, unknown>;
type EffectTarget = "self" | "enemy" | "selfHero" | "enemyHero" | "frontEnemy" | "oppositeSlot" | "playedSlot";

type ResolvedDamageTarget =
  | { kind: "hero"; playerId: PlayerId }
  | { kind: "slot"; playerId: PlayerId; slotIndex: number };


type TacticalRevealCard = {
  id: string;
  title: string;
  image: string;
  cost: number;
  rarity: string;
};

type TacticalRevealEvent = {
  id: string;
  kind: "peek-hand" | "peek-card" | "steal-cast" | "reverse";
  viewer: PlayerId;
  owner: PlayerId;
  source: string;
  title: string;
  cards: TacticalRevealCard[];
  createdAt: number;
};

function log(state: MatchState, message: string): MatchState {
  return { ...state, log: [...state.log, message].slice(-LOG_LIMIT) };
}

function safeNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeKey(value: unknown) {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9_ -]+/gi, "")
    : "";
}

function normalizeCompact(value: unknown) {
  return normalizeKey(value).replace(/[_\s-]+/g, "");
}

function readString(effect: RawEffect, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = effect[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }

  return fallback;
}

function readAmount(effect: RawEffect, fallback = 1) {
  const keys = ["amount", "value", "power", "damage", "heal", "cards", "count", "will", "shield"];

  for (const key of keys) {
    const value = effect[key];
    const parsed = safeNumber(value, Number.NaN);
    if (Number.isFinite(parsed)) return Math.max(0, Math.floor(parsed));
  }

  return Math.max(0, Math.floor(fallback));
}

function readMin(effect: RawEffect, fallback = 1) {
  return Math.max(0, Math.floor(safeNumber(effect.min ?? effect.minimum, fallback)));
}

function readMax(effect: RawEffect, fallback = 1) {
  return Math.max(0, Math.floor(safeNumber(effect.max ?? effect.maximum, fallback)));
}

function readChance(effect: RawEffect, fallback = 100) {
  const raw = effect.chance ?? effect.percent ?? effect.probability;
  const parsed = safeNumber(raw, fallback);
  return clamp(Math.floor(parsed), 0, 100);
}

function readOp(effect: RawEffect) {
  return normalizeKey(effect.op ?? effect.type ?? effect.key ?? effect.action ?? effect.effect ?? effect.effectKey);
}

function readTarget(effect: RawEffect, fallback: EffectTarget): EffectTarget {
  const target = normalizeKey(effect.target ?? effect.targetType ?? effect.targetSide ?? effect.side);

  if (["self", "owner", "ally", "player"].includes(target)) return "self";
  if (["enemy", "opponent", "foe"].includes(target)) return "enemy";
  if (["selfhero", "ownhero", "hero_self", "own_hero"].includes(target)) return "selfHero";
  if (["enemyhero", "opponenthero", "hero_enemy", "enemy_hero"].includes(target)) return "enemyHero";
  if (["frontenemy", "front_enemy", "front"].includes(target)) return "frontEnemy";
  if (["oppositeslot", "opposite_slot", "lane"].includes(target)) return "oppositeSlot";
  if (["playedslot", "played_slot", "slot"].includes(target)) return "playedSlot";

  return fallback;
}

function getDefinitionRecord(card: CardInstance) {
  return card.definition as unknown as Record<string, unknown>;
}

function getPrintedAttack(card: CardInstance) {
  const definition = getDefinitionRecord(card);
  return Math.max(0, Math.floor(safeNumber(card.currentAttack ?? definition.attack, 0)));
}

function getDefinitionPower(card: CardInstance, fallback = 1) {
  const definition = getDefinitionRecord(card);
  return Math.max(
    0,
    Math.floor(
      safeNumber(
        definition.power ?? definition.amount ?? definition.value ?? definition.damage ?? definition.effectPower,
        fallback,
      ),
    ),
  );
}

function getCardSignature(card: CardInstance) {
  const definition = getDefinitionRecord(card);
  const values = [
    card.baseId,
    card.instanceId,
    definition.id,
    definition.code,
    definition.slug,
    definition.title,
    definition.ruTitle,
    definition.name,
    definition.effectKey,
    definition.description,
    definition.text,
    definition.effectText,
    definition.inventoryInstanceId,
  ];

  return values.map((value) => normalizeCompact(value)).filter(Boolean).join(" ");
}

function hasSig(card: CardInstance, tokens: string[]) {
  const signature = getCardSignature(card);
  return tokens.some((token) => signature.includes(normalizeCompact(token)));
}


function getCardImage(card: CardInstance) {
  const definition = getDefinitionRecord(card);
  const raw = definition.image ?? definition.imageUrl ?? definition.frontSrc ?? definition.src ?? definition.path;
  return typeof raw === "string" && raw.trim().length > 0 ? raw : "/cards/card-back.png";
}

function makeRevealCard(card: CardInstance): TacticalRevealCard {
  const definition = getDefinitionRecord(card);
  return {
    id: card.instanceId,
    title: getCardTitle(card),
    image: getCardImage(card),
    cost: Math.max(0, Math.floor(safeNumber(definition.cost ?? definition.willCost, 0))),
    rarity: typeof definition.rarity === "string" ? definition.rarity : "common",
  };
}

function appendRevealEvent(
  state: MatchState,
  event: Omit<TacticalRevealEvent, "id" | "createdAt">,
): MatchState {
  const record = state as unknown as Record<string, unknown>;
  const previous = Array.isArray(record.tacticalRevealEvents) ? record.tacticalRevealEvents as TacticalRevealEvent[] : [];
  const nextEvent: TacticalRevealEvent = {
    ...event,
    id: `reveal_${state.rngSeed}_${previous.length}`,
    createdAt: Date.now(),
  };

  return {
    ...(state as any),
    tacticalRevealEvents: [...previous, nextEvent].slice(-12),
  } as MatchState;
}

function getCardRarityRank(card: CardInstance) {
  const definition = getDefinitionRecord(card);
  const rarity = normalizeCompact(definition.rarity);

  if (["common", "обычная", "obychnaya"].includes(rarity)) return 1;
  if (["rare", "редкая", "redkaya"].includes(rarity)) return 2;
  if (["epic", "эпическая", "epicheskaya"].includes(rarity)) return 3;
  if (["mythic", "мифическая", "mificheskaya"].includes(rarity)) return 4;
  if (["legendary", "легендарная", "legendarnaya"].includes(rarity)) return 5;
  if (["chromatic", "хроматическая", "hromaticheskaya"].includes(rarity)) return 6;
  if (["exotic", "экзотическая", "ekzoticheskaya"].includes(rarity)) return 7;
  if (["divine", "божественная", "bozhestvennaya"].includes(rarity)) return 8;
  if (["forgotten", "забытая", "zabytaya"].includes(rarity)) return 9;
  if (["archaic", "архаичная", "arhaichnaya"].includes(rarity)) return 10;

  return 1;
}

function isBelowChromatic(card: CardInstance) {
  return getCardRarityRank(card) < 6;
}

function isReverseCard(card: CardInstance) {
  return hasSig(card, ["RVS", "reverse", "реверс"]);
}

export function isStunGunCard(card: CardInstance) {
  return hasSig(card, ["SGU", "stun gun", "stungun", "электрошокер", "электро шокер", "sun gun"]);
}

function isEffectHostileToOpponent(effect: RawEffect) {
  const op = readOp(effect);
  const target = readTarget(effect, "enemy");

  if (target === "self" || target === "selfHero" || target === "playedSlot") return false;

  return (
    op.includes("damage") ||
    op.includes("attack") ||
    op.includes("strike") ||
    op.includes("discard") ||
    op.includes("peek") ||
    op.includes("knowledge") ||
    op.includes("skip") ||
    op.includes("freeze") ||
    op.includes("halveenemywill") ||
    op.includes("reduceenemy") ||
    op.includes("psychological") ||
    op.includes("everysecondenemy") ||
    op.includes("stealandcast") ||
    op.includes("revealrandomenemycard")
  );
}

function consumeReverseReaction(state: MatchState, defenderId: PlayerId) {
  const defender = state[defenderId];
  const handIndex = defender.hand.findIndex(isReverseCard);

  if (handIndex >= 0) {
    const reverseCard = defender.hand[handIndex];
    return {
      state: updateSide(state, defenderId, {
        hand: defender.hand.filter((_, index) => index !== handIndex),
        discard: [...defender.discard, reverseCard],
      }),
      card: reverseCard,
      consumed: true,
    };
  }

  const effects = getSideEffects(state, defenderId);
  const reverseEffect = effects.find((effect) => normalizeKey(effect.id) === "reverse_incoming");
  if (!reverseEffect) return { state, card: undefined as CardInstance | undefined, consumed: false };

  return {
    state: setSideEffects(state, defenderId, effects.filter((effect) => effect !== reverseEffect)),
    card: undefined as CardInstance | undefined,
    consumed: true,
  };
}

function shouldReactiveReverse(state: MatchState, playerId: PlayerId, sourceCard: CardInstance, effects: RawEffect[]) {
  if (playerId !== "enemy") return false;
  if (isReverseCard(sourceCard)) return false;
  if (!isBelowChromatic(sourceCard)) return false;
  if (!effects.some(isEffectHostileToOpponent)) return false;

  const defender = state.player;
  return defender.hand.some(isReverseCard) || getSideEffects(state, "player").some((effect) => normalizeKey(effect.id) === "reverse_incoming");
}

function keyToEffects(effectKey: string, card: CardInstance): RawEffect[] {
  const key = normalizeKey(effectKey);
  if (!key) return [];

  const power = Math.max(1, getDefinitionPower(card, getPrintedAttack(card) || 1));

  if (key.includes("swap") && key.includes("hp")) return [{ op: "swapHeroHp" }];
  if (key.includes("restore")) return [{ op: "restoreLastTurnLostHp", amount: power }];
  if (key.includes("reverse")) return [{ op: "reverseIncoming", amount: 1 }];
  if (key.includes("peek")) return [{ op: "peekDeck", amount: power }];
  if (key.includes("force") && key.includes("draw")) return [{ op: "forceDrawMatch" }];
  if (key.includes("skip") || key.includes("freeze")) return [{ op: "skipTurnChance", chance: 100, target: "enemy" }];
  if (key.includes("draw")) return [{ op: "draw", amount: power, target: "self" }];
  if (key.includes("discard")) return [{ op: "discard", amount: power, target: "enemy" }];
  if (key.includes("heal")) return [{ op: "heal", amount: power, target: "selfHero" }];
  if (key.includes("shield") || key.includes("armor") || key.includes("block")) return [{ op: "shield", amount: power, target: "self" }];
  if (key.includes("will") || key.includes("resource")) return [{ op: "modifyWill", amount: power, target: "self" }];
  if (key.includes("power") || key.includes("buff")) return [{ op: "increaseNextCardPower", amount: power }];
  if (key.includes("damage") || key.includes("fire") || key.includes("flame") || key.includes("lightning") || key.includes("strike") || key.includes("attack")) {
    return [{ op: "damage", amount: power, target: "frontEnemy" }];
  }

  return [];
}

function getExplicitEffects(card: CardInstance): RawEffect[] {
  const definition = getDefinitionRecord(card);
  const rawEffects = definition.effects;

  if (!Array.isArray(rawEffects)) return [];

  return rawEffects
    .filter((effect): effect is RawEffect => typeof effect === "object" && effect !== null)
    .map((effect) => ({ ...effect }));
}

function getKnownCardEffects(card: CardInstance): RawEffect[] {
  const attack = Math.max(1, getPrintedAttack(card) || getDefinitionPower(card, 1));

  // Attack cards from the balancing table.
  if (hasSig(card, ["ENS", "energy sword", "энергетический меч"])) return [{ op: "damageFront", amount: 3 }, { op: "damageHero", amount: 2, target: "enemyHero" }];
  if (hasSig(card, ["SND", "sandstorm", "песчаная буря"])) return [{ op: "randomDamage", min: 3, max: 4, target: "enemy" }];
  if (hasSig(card, ["SHS", "shadow sword", "теневой меч"])) return [{ op: "damageFront", amount: 2 }, { op: "applyAilment", target: "enemy", amount: 1 }];
  if (hasSig(card, ["MAG", "маг", "mage"])) return [{ op: "randomDamage", min: 2, max: 3, target: "enemy" }];
  if (hasSig(card, ["EFS", "elven sword", "эльфийский меч", "the elven sword"])) return [{ op: "damage", amount: 3, target: "frontEnemy" }];
  if (hasSig(card, ["HNT", "охотник", "hunter"])) return [{ op: "damage", amount: 3, target: "frontEnemy" }];
  if (hasSig(card, ["LBL", "шаровая молния", "spherical lightning"])) return [{ op: "halfEnemyHeroHp" }];
  if (hasSig(card, ["VLK", "валькирия", "valkyrie"])) return [{ op: "damageFront", amount: 2 }, { op: "damageHero", amount: 1, target: "enemyHero" }];
  if (card.baseId === "thunderer" || hasSig(card, ["THD", "громовержец"])) return [{ op: "damageHero", amount: 4, target: "enemyHero" }, { op: "damageFront", amount: 3 }];
  if (card.baseId === "thunderbolts" || hasSig(card, ["THN", "раскаты молний", "thunder rolls", "thunderbolts", "thunderbolt"])) return [{ op: "randomDamage", min: 2, max: 3, target: "enemy" }];
  if (hasSig(card, ["WRL", "варлок", "warlock"])) return [{ op: "damageAllEnemySlots", min: 3, max: 4 }, { op: "damageHero", amount: 4, target: "enemyHero" }, { op: "applyFriday", target: "enemy" }];
  if (hasSig(card, ["EXC", "экскалибур", "excalibur"])) return [{ op: "damage", amount: 10, target: "frontEnemy" }, { op: "returnPlayedToDeck" }];
  if (hasSig(card, ["FIR", "огонь", "fire"])) return [{ op: "damageFront", amount: 2 }, { op: "damageHero", amount: 1, target: "enemyHero" }];
  if (hasSig(card, ["ICE", "лед", "лёд", "ice"])) return [{ op: "damageFront", amount: 2 }, { op: "damageHero", amount: 1, target: "enemyHero" }, { op: "freezeFront" }];

  // Tactic/effect cards.
  if (hasSig(card, ["HOG", "рука бога", "the hand of god", "hand of god"])) return [{ op: "stealAndCastRandom" }];
  if (hasSig(card, ["SVN", "71", "seventy one", "seventy-one"])) return [{ op: "addMatchTime", amount: 71 }];
  if (hasSig(card, ["TOR", "время расплаты", "time of reckoning"])) return [{ op: "halveEnemyWill" }, { op: "damageEnemyHeroPercent", amount: 25 }];
  if (hasSig(card, ["DRE", "драконий глаз", "dragon eye"])) return [{ op: "revealRandomEnemyCard", amount: 1, target: "enemy" }];
  if (hasSig(card, ["WLV", "древесные лозы", "wooden vines"])) return [{ op: "freezeFront" }];
  if (hasSig(card, ["TOL", "древо жизни", "tree of life"])) return [{ op: "restoreLastTurnLostHp", amount: 999 }];
  if (hasSig(card, ["CAD", "кадуцей", "caduceus"])) return [{ op: "forceDrawMatch" }];
  if (hasSig(card, ["BOK", "книга знаний", "book knowledge", "book of knowledge"])) return [{ op: "knowledge" }];
  if (hasSig(card, ["ORC", "оракул", "oracle"])) return [{ op: "peekHand", target: "enemy", amount: 99 }];
  if (hasSig(card, ["RVH", "реверсивное сердце", "reverse heart"])) return [{ op: "swapHeroHp" }];
  if (hasSig(card, ["DBL", "2x", "2х", "double speed"])) return [{ op: "doubleSpeed" }];
  if (hasSig(card, ["RVS", "реверс", "reverse"])) return [{ op: "reverseIncoming" }];
  if (hasSig(card, ["FST", "15-16", "рулетка судьбы", "roulette of fate"])) return [{ op: "roulette" }];

  // Later-table cards.
  if (hasSig(card, ["AOS", "амулет старого мудреца", "old sage amulet"])) return [{ op: "drawFromDiscardOrDeck", amount: 1 }];
  if (hasSig(card, ["HYN", "гиперночь", "hyper night", "hypernight"])) return [{ op: "skipTurnChanceOrDiscard", chance: 30, target: "enemy", amount: 2 }];
  if (hasSig(card, ["SOH", "щит надежды", "shield of hope"])) return [{ op: "shield", amount: Math.max(3, getCardBoardMaxHp(card) || 3), target: "self" }];
  if (hasSig(card, ["LGV", "легендарный вестник", "legendary messenger"])) return [{ op: "increaseNextCardPower", amount: 2 }, { op: "peekDeck", amount: 1, target: "self" }];
  if (hasSig(card, ["SFS", "печать забытых душ", "seal of the forgotten souls", "seal of forgotten souls"])) return [{ op: "everySecondEnemyCardSelfDamage" }];
  if (hasSig(card, ["PSD", "психологическое расстройство", "psychological disorder"])) return [{ op: "psychologicalDisorder", target: "enemy" }];
  if (hasSig(card, ["URL", "безответная любовь", "unrequited love"])) return [{ op: "unrequitedLove" }];
  if (hasSig(card, ["CHA", "броня хаоса", "armor of chaos", "armour of chaos"])) return [{ op: "blockSmallDamage", amount: 3, target: "self" }];
  if (hasSig(card, ["TTE", "глаз титана", "eye titan", "titan eye"])) return [{ op: "reduceNextEnemyCardPower", percent: 20 }];
  if (hasSig(card, ["SGU", "stun gun", "stungun", "электрошокер", "sun gun"])) return [{ op: "stunGunAura" }];
  if (hasSig(card, ["ELS", "электрошок", "electroshock"])) return [{ op: "reduceEnemyWillGain", percent: 50 }];

  // If a known attack card does not match a special rule, keep its printed attack.
  if (attack > 0) return [{ op: "damage", amount: attack, target: "frontEnemy" }];

  return [];
}

function hasDamageEffect(effects: RawEffect[]) {
  return effects.some((effect) => {
    const op = readOp(effect);
    return op.includes("damage") || op.includes("attack") || op.includes("strike") || op.includes("front") || op.includes("randomdamage") || op.includes("halfenemyhero");
  });
}

function getSideEffects(state: MatchState, playerId: PlayerId): RawEffect[] {
  return ((state[playerId].effects ?? []) as unknown as RawEffect[]).filter(Boolean);
}

function updateSide(state: MatchState, playerId: PlayerId, patch: Partial<MatchState[PlayerId]>): MatchState {
  return {
    ...state,
    [playerId]: {
      ...state[playerId],
      ...patch,
    },
  };
}

function setSideEffects(state: MatchState, playerId: PlayerId, effects: RawEffect[]) {
  return updateSide(state, playerId, { effects: effects as any });
}

function getNextPowerModifiers(state: MatchState, playerId: PlayerId) {
  const effects = getSideEffects(state, playerId);
  const powerBoost = effects.find((effect) => normalizeKey(effect.id) === "next_card_power");
  const powerMultiplier = effects.find((effect) => normalizeKey(effect.id) === "next_card_power_multiplier");

  const consumed = new Set<RawEffect>();
  let flatBonus = 0;
  let multiplier = 1;

  if (powerBoost) {
    flatBonus = readAmount(powerBoost, 1);
    consumed.add(powerBoost);
  }

  if (powerMultiplier) {
    const percent = clamp(safeNumber(powerMultiplier.percent, 0), -500, 500);
    multiplier = Math.max(0, 1 + percent / 100);
    consumed.add(powerMultiplier);
  }

  if (consumed.size === 0) return { state, flatBonus, multiplier };

  let next = setSideEffects(state, playerId, effects.filter((effect) => !consumed.has(effect)));
  if (flatBonus > 0) next = log(next, `${playerLabel(playerId)} consumed +${flatBonus} next-card power.`);
  if (multiplier !== 1) next = log(next, `${playerLabel(playerId)} consumed next-card power multiplier ${Math.round(multiplier * 100)}%.`);

  return { state: next, flatBonus, multiplier };
}

function scaleDamageAmount(effect: RawEffect, fallback: number, flatBonus: number, multiplier: number) {
  const keys = ["amount", "value", "power", "damage"];
  const current = readAmount(effect, fallback);
  const scaled = Math.max(0, Math.floor((current + flatBonus) * multiplier));
  const next = { ...effect };
  let assigned = false;

  for (const key of keys) {
    if (typeof next[key] !== "undefined") {
      next[key] = scaled;
      assigned = true;
      break;
    }
  }

  if (!assigned) next.amount = scaled;

  if (typeof next.min !== "undefined") next.min = Math.max(0, Math.floor((readMin(effect, current) + flatBonus) * multiplier));
  if (typeof next.max !== "undefined") next.max = Math.max(0, Math.floor((readMax(effect, current) + flatBonus) * multiplier));

  return next;
}

function buildEffects(state: MatchState, playerId: PlayerId, card: CardInstance): { state: MatchState; effects: RawEffect[] } {
  const definition = getDefinitionRecord(card);
  let effects = getKnownCardEffects(card);

  if (effects.length === 0) {
    effects = getExplicitEffects(card);
  }

  if (effects.length === 0) {
    effects = keyToEffects(String(definition.effectKey ?? ""), card);
  }

  const printedAttack = getPrintedAttack(card);
  if (printedAttack > 0 && !hasDamageEffect(effects)) {
    effects.push({ op: "damage", amount: printedAttack, target: "frontEnemy" });
  }

  if (!hasDamageEffect(effects)) {
    return { state, effects };
  }

  const modifiers = getNextPowerModifiers(state, playerId);
  if (modifiers.flatBonus <= 0 && modifiers.multiplier === 1) return { state, effects };

  let modifiedOne = false;
  const modifiedEffects = effects.map((effect) => {
    if (modifiedOne) return effect;

    const op = readOp(effect);
    if (!op.includes("damage") && !op.includes("attack") && !op.includes("strike") && !op.includes("front") && !op.includes("randomdamage") && !op.includes("halfenemyhero")) return effect;

    modifiedOne = true;
    return scaleDamageAmount(effect, printedAttack || 1, modifiers.flatBonus, modifiers.multiplier);
  });

  return {
    state: modifiers.state,
    effects: modifiedEffects,
  };
}

function getSlotFromTarget(target: TargetRef | undefined, playerId: PlayerId) {
  const maybeTarget = target as unknown as Record<string, unknown> | undefined;
  if (!maybeTarget || maybeTarget.type !== "slot") return undefined;
  if (maybeTarget.playerId !== playerId) return undefined;

  const slotIndex = safeNumber(maybeTarget.slotIndex, Number.NaN);
  return Number.isInteger(slotIndex) ? slotIndex : undefined;
}

function findFirstOccupiedSlot(state: MatchState, playerId: PlayerId) {
  return state.board[slotsKey(playerId)].findIndex(Boolean);
}

function findDamageSlot(
  state: MatchState,
  sourcePlayerId: PlayerId,
  targetPlayerId: PlayerId,
  target: TargetRef | undefined,
  playedSlotIndex: number,
  effectTarget: EffectTarget,
) {
  const targetSlots = state.board[slotsKey(targetPlayerId)];

  if (effectTarget === "playedSlot" && targetPlayerId === sourcePlayerId) {
    return isValidSlotIndex(playedSlotIndex, targetSlots.length) ? playedSlotIndex : -1;
  }

  const explicitSlot = getSlotFromTarget(target, targetPlayerId);
  if (typeof explicitSlot === "number" && targetSlots[explicitSlot]) return explicitSlot;

  if ((effectTarget === "oppositeSlot" || effectTarget === "frontEnemy") && targetSlots[playedSlotIndex]) {
    return playedSlotIndex;
  }

  return findFirstOccupiedSlot(state, targetPlayerId);
}

function hasBlockSmallDamage(state: MatchState, targetPlayerId: PlayerId, amount: number) {
  const effects = getSideEffects(state, targetPlayerId);
  const blocker = effects.find((effect) => normalizeKey(effect.id) === "block_small_damage" && amount < readAmount(effect, 3));
  return blocker ? readAmount(blocker, 3) : 0;
}

function consumeReverseIncoming(state: MatchState, targetPlayerId: PlayerId) {
  const effects = getSideEffects(state, targetPlayerId);
  const reverse = effects.find((effect) => normalizeKey(effect.id) === "reverse_incoming");

  if (!reverse) return { state, reversed: false };

  return {
    reversed: true,
    state: setSideEffects(state, targetPlayerId, effects.filter((effect) => effect !== reverse)),
  };
}

function resolveDamageTarget(
  state: MatchState,
  playerId: PlayerId,
  target: TargetRef | undefined,
  playedSlotIndex: number,
  effect: RawEffect,
): ResolvedDamageTarget {
  const targetHint = readTarget(effect, "frontEnemy");
  const enemyId = otherPlayer(playerId);

  if (targetHint === "selfHero") return { kind: "hero", playerId };
  if (targetHint === "enemyHero" || targetHint === "enemy") return { kind: "hero", playerId: enemyId };

  const targetPlayerId = targetHint === "playedSlot" || targetHint === "self" ? playerId : enemyId;
  const slotIndex = findDamageSlot(state, playerId, targetPlayerId, target, playedSlotIndex, targetHint);

  if (slotIndex >= 0) return { kind: "slot", playerId: targetPlayerId, slotIndex };
  return { kind: "hero", playerId: targetPlayerId };
}

function damageHero(
  state: MatchState,
  targetPlayerId: PlayerId,
  amount: number,
  sourcePlayerId: PlayerId,
  sourceName: string,
): MatchState {
  if (amount <= 0) return state;

  if (targetPlayerId !== sourcePlayerId) {
    const reverseCheck = consumeReverseIncoming(state, targetPlayerId);
    if (reverseCheck.reversed) {
      const reflected = log(reverseCheck.state, `${playerLabel(targetPlayerId)} reversed incoming damage.`);
      return damageHero(reflected, sourcePlayerId, amount, sourcePlayerId, sourceName);
    }
  }

  const blockedBySmallDamage = hasBlockSmallDamage(state, targetPlayerId, amount);
  if (blockedBySmallDamage > 0) {
    return log(state, `${playerLabel(targetPlayerId)} blocked ${sourceName}: damage ${amount} is lower than ${blockedBySmallDamage}.`);
  }

  const side = state[targetPlayerId];
  const shieldBlocked = Math.min(Math.max(0, side.shield ?? 0), amount);
  const damageAfterShield = Math.max(0, amount - shieldBlocked);
  const nextShield = Math.max(0, (side.shield ?? 0) - shieldBlocked);
  const nextHp = Math.max(0, side.hp - damageAfterShield);

  let next = updateSide(state, targetPlayerId, {
    hp: nextHp,
    shield: nextShield,
    lastTurnLostHp: (side.lastTurnLostHp ?? 0) + damageAfterShield,
  });

  if (shieldBlocked > 0) next = log(next, `${playerLabel(targetPlayerId)} shield blocked ${shieldBlocked} damage.`);
  next = log(next, damageAfterShield > 0 ? `${sourceName} dealt ${damageAfterShield} damage to ${playerLabel(targetPlayerId)} hero.` : `${sourceName} dealt no hero damage.`);
  return next;
}

function damageSlot(state: MatchState, playerId: PlayerId, slotIndex: number, amount: number, sourceName: string): MatchState {
  if (amount <= 0) return state;

  const blockedBySmallDamage = hasBlockSmallDamage(state, playerId, amount);
  if (blockedBySmallDamage > 0) {
    return log(state, `${playerLabel(playerId)} blocked ${sourceName}: damage ${amount} is lower than ${blockedBySmallDamage}.`);
  }

  const key = slotsKey(playerId);
  const slots = [...state.board[key]];
  const targetCard = slots[slotIndex];

  if (!targetCard) return log(state, `${sourceName} had no card target.`);

  const currentHp = getCardCurrentHp(targetCard);
  const nextHp = Math.max(0, currentHp - amount);

  slots[slotIndex] = { ...targetCard, currentHealth: nextHp };

  return log(
    { ...state, board: { ...state.board, [key]: slots } },
    `${sourceName} dealt ${amount} damage to ${getCardTitle(targetCard)} (${nextHp}/${getCardBoardMaxHp(targetCard)} HP).`,
  );
}

function damageFrontSlotOrHero(state: MatchState, playerId: PlayerId, playedSlotIndex: number, amount: number, sourceName: string) {
  const enemyId = otherPlayer(playerId);
  const enemySlots = state.board[slotsKey(enemyId)];
  const front = isValidSlotIndex(playedSlotIndex, enemySlots.length) && enemySlots[playedSlotIndex]
    ? playedSlotIndex
    : enemySlots.findIndex(Boolean);

  if (front >= 0) return damageSlot(state, enemyId, front, amount, sourceName);
  return damageHero(state, enemyId, amount, playerId, sourceName);
}

function healHero(state: MatchState, targetPlayerId: PlayerId, amount: number, sourceName: string): MatchState {
  if (amount <= 0) return state;

  const side = state[targetPlayerId];
  const before = side.hp;
  const after = Math.min(side.maxHp, before + amount);
  const healed = Math.max(0, after - before);

  return log(updateSide(state, targetPlayerId, { hp: after }), `${sourceName} healed ${playerLabel(targetPlayerId)} hero for ${healed}.`);
}

function healSlot(state: MatchState, playerId: PlayerId, slotIndex: number, amount: number, sourceName: string): MatchState {
  if (amount <= 0) return state;

  const key = slotsKey(playerId);
  const slots = [...state.board[key]];
  const card = slots[slotIndex];

  if (!card) return log(state, `${sourceName} had no card to heal.`);

  const maxHp = getCardBoardMaxHp(card);
  if (maxHp <= 0) return log(state, `${getCardTitle(card)} cannot be healed because it has no HP.`);

  const before = getCardCurrentHp(card);
  const after = Math.min(maxHp, before + amount);
  slots[slotIndex] = { ...card, currentHealth: after };

  return log({ ...state, board: { ...state.board, [key]: slots } }, `${sourceName} healed ${getCardTitle(card)} for ${after - before}.`);
}

function drawCardsForSide(state: MatchState, playerId: PlayerId, count: number, sourceName: string): MatchState {
  if (count <= 0) return state;

  const side = state[playerId];
  const drawn = side.deck.slice(0, count);
  const deck = side.deck.slice(drawn.length);

  if (drawn.length === 0) return log(state, `${playerLabel(playerId)} could not draw from an empty deck.`);

  return log(updateSide(state, playerId, { deck, hand: [...side.hand, ...drawn] }), `${sourceName} drew ${drawn.length} card${drawn.length === 1 ? "" : "s"} for ${playerLabel(playerId)}.`);
}

function drawFromDiscardOrDeck(state: MatchState, playerId: PlayerId, count: number, sourceName: string) {
  let next = state;
  for (let index = 0; index < count; index += 1) {
    const side = next[playerId];
    if (side.discard.length > 0) {
      const card = side.discard[side.discard.length - 1];
      next = updateSide(next, playerId, { discard: side.discard.slice(0, -1), hand: [...side.hand, card] });
      next = log(next, `${sourceName} returned ${getCardTitle(card)} from discard to ${playerLabel(playerId)} hand.`);
      continue;
    }

    if (side.deck.length > 0) {
      const card = side.deck[0];
      next = updateSide(next, playerId, { deck: side.deck.slice(1), hand: [...side.hand, card] });
      next = log(next, `${sourceName} drew ${getCardTitle(card)} from deck because discard was empty.`);
      continue;
    }

    next = log(next, `${sourceName} found no card in discard or deck.`);
  }

  return next;
}

function discardRandomFromHand(state: MatchState, playerId: PlayerId, count: number, sourceName: string): MatchState {
  if (count <= 0) return state;
  let next = state;

  for (let index = 0; index < count; index += 1) {
    const side = next[playerId];
    if (side.hand.length === 0) return log(next, `${playerLabel(playerId)} had no cards to discard.`);

    const roll = rollDie(next.rngSeed, side.hand.length);
    const cardIndex = roll.value - 1;
    const card = side.hand[cardIndex];
    const hand = side.hand.filter((_, candidateIndex) => candidateIndex !== cardIndex);

    next = log(updateSide({ ...next, rngSeed: roll.seed }, playerId, { hand, discard: [...side.discard, card] }), `${sourceName} forced ${playerLabel(playerId)} to discard ${getCardTitle(card)}.`);
  }

  return next;
}

function addShield(state: MatchState, playerId: PlayerId, amount: number, sourceName: string): MatchState {
  if (amount <= 0) return state;
  return log(updateSide(state, playerId, { shield: Math.max(0, state[playerId].shield ?? 0) + amount }), `${sourceName} gave ${playerLabel(playerId)} +${amount} Shield.`);
}

function modifyWill(state: MatchState, playerId: PlayerId, amount: number, sourceName: string): MatchState {
  const side = state[playerId];
  const nextWill = clamp(side.will + amount, 0, Math.max(1, side.maxWill));
  const delta = nextWill - side.will;

  if (delta === 0) return log(state, `${sourceName} did not change ${playerLabel(playerId)} Will.`);

  return log(updateSide(state, playerId, { will: nextWill }), `${sourceName} changed ${playerLabel(playerId)} Will by ${delta > 0 ? "+" : ""}${delta}.`);
}

function swapHeroHp(state: MatchState, sourceName: string): MatchState {
  const playerHp = state.player.hp;
  const enemyHp = state.enemy.hp;
  return log({ ...state, player: { ...state.player, hp: clamp(enemyHp, 0, state.player.maxHp) }, enemy: { ...state.enemy, hp: clamp(playerHp, 0, state.enemy.maxHp) } }, `${sourceName} swapped hero HP values.`);
}

function addTimedEffect(state: MatchState, playerId: PlayerId, effect: RawEffect, message: string): MatchState {
  return log(setSideEffects(state, playerId, [...getSideEffects(state, playerId), effect]), message);
}

function getEffectTargetPlayer(playerId: PlayerId, effect: RawEffect, fallback: "self" | "enemy") {
  const target = readTarget(effect, fallback === "self" ? "self" : "enemy");
  if (target === "self" || target === "selfHero" || target === "playedSlot") return playerId;
  return otherPlayer(playerId);
}

function maybeSkipTurn(state: MatchState, playerId: PlayerId, effect: RawEffect, sourceName: string): MatchState {
  const targetPlayerId = getEffectTargetPlayer(playerId, effect, "enemy");
  const chance = readChance(effect, 100);
  const roll = rollDie(state.rngSeed, 100);
  const nextSeedState = { ...state, rngSeed: roll.seed };

  if (roll.value > chance) return log(nextSeedState, `${sourceName} tried to skip ${playerLabel(targetPlayerId)} turn, but failed (${roll.value}/${chance}).`);

  return addTimedEffect(nextSeedState, targetPlayerId, { id: "skip_next_turn", source: sourceName, remainingTurns: 1 }, `${sourceName} applied skip-turn to ${playerLabel(targetPlayerId)}.`);
}

function restoreLastTurnLostHp(state: MatchState, playerId: PlayerId, effect: RawEffect, sourceName: string): MatchState {
  const cap = readAmount(effect, Number.POSITIVE_INFINITY);
  const lost = Math.max(0, state[playerId].lastTurnLostHp ?? 0);
  const amount = Math.min(lost, cap);
  if (amount <= 0) return log(state, `${sourceName} found no lost HP to restore.`);
  return healHero(state, playerId, amount, sourceName);
}

function damageRandomEnemyTarget(state: MatchState, playerId: PlayerId, min: number, max: number, sourceName: string) {
  const enemyId = otherPlayer(playerId);
  const enemySlots = state.board[slotsKey(enemyId)];
  const availableTargets: ResolvedDamageTarget[] = [{ kind: "hero", playerId: enemyId }];
  enemySlots.forEach((card, slotIndex) => {
    if (card) availableTargets.push({ kind: "slot", playerId: enemyId, slotIndex });
  });

  const rollTarget = rollDie(state.rngSeed, availableTargets.length);
  const rollAmount = rollDie(rollTarget.seed, Math.max(1, max - min + 1));
  const amount = min + rollAmount.value - 1;
  const target = availableTargets[rollTarget.value - 1];
  const seededState = { ...state, rngSeed: rollAmount.seed };

  return target.kind === "hero"
    ? damageHero(seededState, target.playerId, amount, playerId, sourceName)
    : damageSlot(seededState, target.playerId, target.slotIndex, amount, sourceName);
}

function damageAllEnemySlots(state: MatchState, playerId: PlayerId, min: number, max: number, sourceName: string) {
  const enemyId = otherPlayer(playerId);
  const enemySlots = state.board[slotsKey(enemyId)];
  let next = state;

  enemySlots.forEach((card, slotIndex) => {
    if (!card) return;
    const roll = rollDie(next.rngSeed, Math.max(1, max - min + 1));
    next = damageSlot({ ...next, rngSeed: roll.seed }, enemyId, slotIndex, min + roll.value - 1, sourceName);
  });

  return next;
}

function returnPlayedToDeck(state: MatchState, playerId: PlayerId, playedSlotIndex: number, sourceCard: CardInstance, sourceName: string) {
  const key = slotsKey(playerId);
  const slots = [...state.board[key]];
  if (!slots[playedSlotIndex]) return state;

  slots[playedSlotIndex] = null;
  return log(updateSide({ ...state, board: { ...state.board, [key]: slots } }, playerId, { deck: [...state[playerId].deck, { ...sourceCard, temporaryUntilRoundEnd: false }] }), `${sourceName} returned to ${playerLabel(playerId)} deck.`);
}

function stealAndCastRandom(state: MatchState, playerId: PlayerId, sourceName: string) {
  const enemyId = otherPlayer(playerId);
  const enemy = state[enemyId];
  const fromHand = enemy.hand.length > 0;
  const pool = fromHand ? enemy.hand : enemy.deck;

  if (pool.length === 0) return log(state, `${sourceName} found no enemy card to steal.`);

  const roll = rollDie(state.rngSeed, pool.length);
  const cardIndex = roll.value - 1;
  const stolen = pool[cardIndex];
  const enemyPatch = fromHand
    ? { hand: enemy.hand.filter((_, index) => index !== cardIndex), discard: [...enemy.discard, stolen] }
    : { deck: enemy.deck.filter((_, index) => index !== cardIndex), discard: [...enemy.discard, stolen] };

  let next = updateSide({ ...state, rngSeed: roll.seed }, enemyId, enemyPatch);
  next = appendRevealEvent(next, {
    kind: "steal-cast",
    viewer: playerId,
    owner: enemyId,
    source: sourceName,
    title: `${sourceName}: stolen card`,
    cards: [makeRevealCard(stolen)],
  });
  next = log(next, `${sourceName} stole ${getCardTitle(stolen)} from ${playerLabel(enemyId)} and cast it against them.`);

  const virtualCard = { ...stolen, ownerId: playerId, instanceId: `${playerId}_stolen_${stolen.instanceId}` };
  return resolveCardEffects(next, playerId, virtualCard, undefined, 0, { skipReactiveReverse: true, virtualCast: true });
}

function forceDrawMatch(state: MatchState, sourceName: string): MatchState {
  return resolveCaduceusBattleDraw(state, sourceName);
}

function roulette(state: MatchState, _playerId: PlayerId, sourceName: string) {
  const roll = rollDie(state.rngSeed, FATE_ROULETTE_EVENTS.length);
  const event = FATE_ROULETTE_EVENTS[roll.value - 1];
  let next: MatchState = { ...state, rngSeed: roll.seed, activeRouletteEvent: event };

  if (event === "MERGED_DECKS") {
    const merged = shuffleWithSeed([...next.player.deck, ...next.enemy.deck], next.rngSeed);
    const half = Math.ceil(merged.items.length / 2);
    next = {
      ...next,
      rngSeed: merged.seed,
      player: { ...next.player, deck: merged.items.slice(0, half) },
      enemy: { ...next.enemy, deck: merged.items.slice(half) },
    };
  } else if (event === "WORLD_WITHOUT_WILL") {
    next = { ...next, currentTurn: next.currentTurn ? { ...next.currentTurn, freeCards: true } : next.currentTurn };
  } else if (event === "FULL_MATCH_RESET") {
    const reset = createInitialMatchState({ seed: next.rngSeed });
    next = { ...reset, id: state.id };
  }

  return log(next, `[ROULETTE] ${sourceName} resolved official event ${event}.`);
}

function logKnowledge(state: MatchState, targetPlayerId: PlayerId, sourceName: string) {
  const side = state[targetPlayerId];
  const costs = side.hand.map((card) => `${getCardTitle(card)}:${Math.max(0, Number(card.definition.cost ?? 0))}`).join(", ") || "empty hand";
  return log(state, `${sourceName} revealed ${playerLabel(targetPlayerId)} Will ${side.will}/${side.maxWill}; hand costs: ${costs}.`);
}

function revealHand(state: MatchState, viewerId: PlayerId, targetPlayerId: PlayerId, sourceName: string) {
  const handCards = state[targetPlayerId].hand;
  const hand = handCards.map(getCardTitle).join(", ") || "empty hand";
  const next = appendRevealEvent(state, {
    kind: "peek-hand",
    viewer: viewerId,
    owner: targetPlayerId,
    source: sourceName,
    title: `${sourceName}: ${playerLabel(targetPlayerId)} hand`,
    cards: handCards.map(makeRevealCard),
  });

  return log(next, `${sourceName} revealed ${playerLabel(targetPlayerId)} hand: ${hand}.`);
}

function revealRandomEnemyCard(state: MatchState, playerId: PlayerId, sourceName: string) {
  const enemyId = otherPlayer(playerId);
  const enemy = state[enemyId];
  const fromHand = enemy.hand.length > 0;
  const pool = fromHand ? enemy.hand : enemy.deck;

  if (pool.length === 0) return log(state, `${sourceName} found no enemy card to reveal.`);

  const roll = rollDie(state.rngSeed, pool.length);
  const revealed = pool[roll.value - 1];
  let next = { ...state, rngSeed: roll.seed };

  next = appendRevealEvent(next, {
    kind: "peek-card",
    viewer: playerId,
    owner: enemyId,
    source: sourceName,
    title: `${sourceName}: random enemy card`,
    cards: [makeRevealCard(revealed)],
  });

  return log(next, `${sourceName} revealed one random ${fromHand ? "hand" : "deck"} card from ${playerLabel(enemyId)}: ${getCardTitle(revealed)}.`);
}

function addMatchNote(state: MatchState, key: string, amount: number, sourceName: string) {
  const record = state as unknown as Record<string, unknown>;
  const current = Math.max(0, safeNumber(record[key], 0));
  return log({ ...(state as any), [key]: current + amount } as MatchState, `${sourceName} changed ${key} by +${amount}.`);
}

function applyEffect(
  state: MatchState,
  playerId: PlayerId,
  sourceCard: CardInstance,
  target: TargetRef | undefined,
  playedSlotIndex: number,
  effect: RawEffect,
): MatchState {
  const op = readOp(effect);
  const sourceName = getCardTitle(sourceCard);
  const amount = readAmount(effect, getPrintedAttack(sourceCard) || 1);

  if (op.includes("damagefront")) return damageFrontSlotOrHero(state, playerId, playedSlotIndex, amount, sourceName);
  if (op.includes("damagehero")) return damageHero(state, getEffectTargetPlayer(playerId, effect, "enemy"), amount, playerId, sourceName);
  if (op.includes("damageenemyheropercent")) return damageHero(state, otherPlayer(playerId), Math.max(1, Math.floor(state[otherPlayer(playerId)].hp * amount / 100)), playerId, sourceName);
  if (op.includes("halfenemyherohp")) return damageHero(state, otherPlayer(playerId), Math.max(1, Math.floor(state[otherPlayer(playerId)].hp / 2)), playerId, sourceName);
  if (op.includes("randomdamage")) return damageRandomEnemyTarget(state, playerId, readMin(effect, amount), readMax(effect, amount), sourceName);
  if (op.includes("damageallenemyslots")) return damageAllEnemySlots(state, playerId, readMin(effect, amount), readMax(effect, amount), sourceName);

  if (op.includes("damage") || op.includes("attack") || op.includes("strike")) {
    const resolved = resolveDamageTarget(state, playerId, target, playedSlotIndex, effect);
    return resolved.kind === "hero"
      ? damageHero(state, resolved.playerId, amount, playerId, sourceName)
      : damageSlot(state, resolved.playerId, resolved.slotIndex, amount, sourceName);
  }

  if (op.includes("heal")) {
    const targetHint = readTarget(effect, "selfHero");
    if (targetHint === "playedSlot") return healSlot(state, playerId, playedSlotIndex, amount, sourceName);
    return healHero(state, getEffectTargetPlayer(playerId, effect, "self"), amount, sourceName);
  }

  if (op.includes("drawfromdiscardordeck")) return drawFromDiscardOrDeck(state, playerId, amount, sourceName);
  if (op.includes("force") && op.includes("draw") && !op.includes("forcedrawmatch")) return forceDrawMatch(state, sourceName);
  if (op.includes("draw")) return drawCardsForSide(state, getEffectTargetPlayer(playerId, effect, "self"), amount, sourceName);
  if (op.includes("discard")) return discardRandomFromHand(state, getEffectTargetPlayer(playerId, effect, "enemy"), amount, sourceName);

  if (op.includes("shield") || op.includes("armor") || op.includes("block")) return addShield(state, getEffectTargetPlayer(playerId, effect, "self"), amount, sourceName);
  if (op.includes("will") || op.includes("resource") || op.includes("modifywill")) {
    const signedAmount = effect.mode === "spend" || effect.sign === "negative" ? -amount : amount;
    return modifyWill(state, getEffectTargetPlayer(playerId, effect, "self"), signedAmount, sourceName);
  }

  if (op.includes("halveenemywill")) return modifyWill(state, otherPlayer(playerId), -Math.ceil(state[otherPlayer(playerId)].will / 2), sourceName);
  if (op.includes("swapherohp") || (op.includes("swap") && op.includes("hp"))) return swapHeroHp(state, sourceName);
  if (op.includes("skipturnchanceordiscard")) {
    const attempt = maybeSkipTurn(state, playerId, effect, sourceName);
    const skipped = attempt !== state && attempt.log[attempt.log.length - 1]?.includes("applied skip-turn");
    return skipped ? attempt : discardRandomFromHand(attempt, otherPlayer(playerId), amount, sourceName);
  }
  if (op.includes("skip") || op.includes("freeze") && !op.includes("freezefront")) return maybeSkipTurn(state, playerId, effect, sourceName);

  if (op.includes("freezefront")) {
    const enemyId = otherPlayer(playerId);
    const slotIndex = findDamageSlot(state, playerId, enemyId, target, playedSlotIndex, "frontEnemy");
    if (slotIndex < 0) return log(state, `${sourceName} found no front card to freeze.`);
    return addTimedEffect(state, enemyId, { id: "skip_next_turn", source: sourceName, remainingTurns: 1 }, `${sourceName} froze ${playerLabel(enemyId)} next turn.`);
  }

  if (op.includes("applyailment")) return addTimedEffect(state, otherPlayer(playerId), { id: "ailment", source: sourceName, remainingTurns: 1 }, `${sourceName} applied a random ailment.`);
  if (op.includes("applyfriday")) return addTimedEffect(state, otherPlayer(playerId), { id: "friday", source: sourceName, remainingTurns: 1 }, `${sourceName} applied Friday curse.`);
  if (op.includes("reverse")) return addTimedEffect(state, playerId, { id: "reverse_incoming", source: sourceName, remainingTurns: 1 }, `${sourceName} will reverse the next incoming damage.`);
  if (op.includes("restore")) return restoreLastTurnLostHp(state, playerId, effect, sourceName);
  if (op.includes("reducenextenemycardpower")) return addTimedEffect(state, otherPlayer(playerId), { id: "next_card_power_multiplier", source: sourceName, percent: -readChance(effect, 20) }, `${sourceName} reduced ${playerLabel(otherPlayer(playerId))} next card effectiveness by ${readChance(effect, 20)}%.`);
  if (op.includes("increase") || op.includes("power") || op.includes("buff")) return addTimedEffect(state, playerId, { id: "next_card_power", source: sourceName, amount, remainingTurns: 1 }, `${sourceName} gave ${playerLabel(playerId)} next card +${amount} power.`);

  if (op.includes("revealrandomenemycard")) return revealRandomEnemyCard(state, playerId, sourceName);
  if (op.includes("peekhand")) return revealHand(state, playerId, getEffectTargetPlayer(playerId, effect, "enemy"), sourceName);

  if (op.includes("peek")) {
    const targetPlayerId = getEffectTargetPlayer(playerId, effect, "self");
    const topCards = state[targetPlayerId].deck.slice(0, Math.max(1, amount)).map(getCardTitle);
    return log(state, topCards.length > 0 ? `${sourceName} peeked ${playerLabel(targetPlayerId)} deck: ${topCards.join(", ")}.` : `${sourceName} peeked an empty deck.`);
  }

  if (op.includes("stungunaura")) return log(state, `${sourceName} is active: enemy Will gain is halved while this card remains on board.`);
  if (op.includes("stealandcastrandom")) return stealAndCastRandom(state, playerId, sourceName);
  if (op.includes("addmatchtime")) return addMatchNote(state, "matchSecondsBonus", amount, sourceName);
  if (op.includes("forcedrawmatch")) return forceDrawMatch(state, sourceName);
  if (op.includes("knowledge")) return logKnowledge(state, otherPlayer(playerId), sourceName);
  if (op.includes("doublespeed")) return addMatchNote(state, "matchSpeedMultiplierBonus", 1, sourceName);
  if (op.includes("roulette")) return roulette(state, playerId, sourceName);
  if (op.includes("returnplayedtodeck")) return returnPlayedToDeck(state, playerId, playedSlotIndex, sourceCard, sourceName);

  if (op.includes("everysecondenemycardselfdamage")) return addTimedEffect(state, otherPlayer(playerId), { id: "every_second_card_self_damage", source: sourceName, cardCount: 0 }, `${sourceName} marked ${playerLabel(otherPlayer(playerId))}: every second played card deals 1 self-damage.`);
  if (op.includes("psychologicaldisorder")) return addTimedEffect(state, getEffectTargetPlayer(playerId, effect, "enemy"), { id: "psychological_disorder", source: sourceName }, `${sourceName} applied psychological disorder.`);
  if (op.includes("unrequitedlove")) {
    const enemyId = otherPlayer(playerId);
    if (state[enemyId].hp <= state[playerId].hp) return log(state, `${sourceName} did nothing: enemy HP is not higher.`);
    return damageAllEnemySlots(state, playerId, 2, 2, sourceName);
  }
  if (op.includes("blocksmalldamage")) return addTimedEffect(state, getEffectTargetPlayer(playerId, effect, "self"), { id: "block_small_damage", source: sourceName, amount }, `${sourceName} blocks incoming damage lower than ${amount}.`);
  if (op.includes("reduceenemywillgain")) return addTimedEffect(state, otherPlayer(playerId), { id: "will_gain_multiplier", source: sourceName, percent: -readChance(effect, 50), remainingTurns: 3 }, `${sourceName} reduced ${playerLabel(otherPlayer(playerId))} future Will gain by ${readChance(effect, 50)}%.`);

  return log(state, `${sourceName} effect "${readString(effect, ["op", "type", "key"], "unknown")}" has no resolver yet.`);
}

export function resolveCardEffects(
  state: MatchState,
  playerId: PlayerId,
  sourceCard: CardInstance,
  target?: TargetRef,
  playedSlotIndex = 0,
  options: { skipReactiveReverse?: boolean; virtualCast?: boolean } = {},
): MatchState {
  const built = buildEffects(state, playerId, sourceCard);
  let next = built.state;

  if (built.effects.length === 0) return log(next, `${getCardTitle(sourceCard)} has no active effect.`);

  if (!options.skipReactiveReverse && shouldReactiveReverse(next, playerId, sourceCard, built.effects)) {
    const defenderId = otherPlayer(playerId);
    const reaction = consumeReverseReaction(next, defenderId);

    if (reaction.consumed) {
      let reversedState = appendRevealEvent(reaction.state, {
        kind: "reverse",
        viewer: defenderId,
        owner: playerId,
        source: reaction.card ? getCardTitle(reaction.card) : "Reverse",
        title: `Reverse reflected ${getCardTitle(sourceCard)}`,
        cards: [makeRevealCard(sourceCard)],
      });

      reversedState = log(
        reversedState,
        `Reverse reflected ${getCardTitle(sourceCard)} because its rarity is below Chromatic.`,
      );

      const reflectedCard = {
        ...sourceCard,
        ownerId: defenderId,
        instanceId: `${defenderId}_reflected_${sourceCard.instanceId}`,
      };

      return resolveCardEffects(reversedState, defenderId, reflectedCard, target, playedSlotIndex, {
        skipReactiveReverse: true,
        virtualCast: true,
      });
    }
  }

  for (const effect of built.effects) {
    next = applyEffect(next, playerId, sourceCard, target, playedSlotIndex, effect);
  }

  return next;
}
