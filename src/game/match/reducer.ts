import { ROULETTE_EVENTS } from "./catalog";
import type {
  EffectStep,
  MatchAction,
  MatchCard,
  MatchLogEntry,
  MatchState,
  Owner,
  PlayerState,
  UnitState,
} from "./types";

const MAX_BOARD_SIZE = 5;
const MAX_HAND_SIZE = 10;

function makeLog(text: string): MatchLogEntry {
  return { id: crypto.randomUUID(), text };
}

function addLog(state: MatchState, text: string): MatchState {
  return { ...state, log: [...state.log, makeLog(text)] };
}

function getSide(state: MatchState, owner: Owner): PlayerState {
  return owner === "player" ? state.player : state.ai;
}

function getEnemyOwner(owner: Owner): Owner {
  return owner === "player" ? "ai" : "player";
}

function setSide(state: MatchState, owner: Owner, side: PlayerState): MatchState {
  return owner === "player" ? { ...state, player: side } : { ...state, ai: side };
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function isPassiveSilenced(state: MatchState) {
  return state.passiveSilencedUntilRound === state.round;
}

function getPlayCost(state: MatchState, card: MatchCard, free = false) {
  return free ? 0 : card.willCost * state.turn.willMultiplier;
}

function canStillPlay(state: MatchState) {
  return state.turn.playLimit === null || state.turn.playsMade < state.turn.playLimit;
}

function markTurnCardPlayed(state: MatchState): MatchState {
  return {
    ...state,
    turn: {
      ...state.turn,
      playsMade: state.turn.playsMade + 1,
      playedAnyCard: true,
    },
  };
}

function adjustHeroHp(side: PlayerState, delta: number): PlayerState {
  return { ...side, hp: side.hp + delta };
}

function adjustWill(side: PlayerState, delta: number): PlayerState {
  return { ...side, will: Math.max(0, Math.min(side.maxWill, side.will + delta)) };
}

function moveCardToGraveyard(side: PlayerState, card: MatchCard): PlayerState {
  return { ...side, graveyard: [...side.graveyard, card] };
}

function drawCards(state: MatchState, owner: Owner, amount: number): MatchState {
  if (amount <= 0) return state;

  let nextState = state;
  let nextSide = getSide(nextState, owner);

  for (let count = 0; count < amount; count += 1) {
    if (nextState.sharedDeck.active) {
      if (nextState.sharedDeck.cards.length === 0) break;
      const card = nextState.sharedDeck.cards[0];
      nextState = {
        ...nextState,
        sharedDeck: {
          ...nextState.sharedDeck,
          cards: nextState.sharedDeck.cards.slice(1),
        },
      };
      nextSide = getSide(nextState, owner);
      nextSide = { ...nextSide, hand: [...nextSide.hand, card] };
      nextState = setSide(nextState, owner, nextSide);
      continue;
    }

    if (nextSide.deck.length === 0) break;
    const card = nextSide.deck[0];
    nextSide = {
      ...nextSide,
      deck: nextSide.deck.slice(1),
      hand: [...nextSide.hand, card],
    };
    nextState = setSide(nextState, owner, nextSide);
  }

  return nextState;
}

function drawToHandLimit(state: MatchState, owner: Owner, limit: number): MatchState {
  const side = getSide(state, owner);
  const need = Math.max(0, limit - side.hand.length);
  return drawCards(state, owner, need);
}

function findCardInSource(state: MatchState, owner: Owner, source: "hand" | "graveyard" | "enemy_deck", cardInstanceId: string) {
  if (source === "hand") {
    return getSide(state, owner).hand.find((card) => card.instanceId === cardInstanceId) ?? null;
  }
  if (source === "graveyard") {
    return getSide(state, owner).graveyard.find((card) => card.instanceId === cardInstanceId) ?? null;
  }

  const enemyOwner = getEnemyOwner(owner);
  const enemySide = getSide(state, enemyOwner);
  const fromEnemyDeck = enemySide.deck.find((card) => card.instanceId === cardInstanceId);
  if (fromEnemyDeck) return fromEnemyDeck;
  return state.sharedDeck.cards.find((card) => card.instanceId === cardInstanceId) ?? null;
}

function removeCardFromSource(state: MatchState, owner: Owner, source: "hand" | "graveyard" | "enemy_deck", cardInstanceId: string): MatchState {
  if (source === "hand") {
    const side = getSide(state, owner);
    return setSide(state, owner, {
      ...side,
      hand: side.hand.filter((card) => card.instanceId !== cardInstanceId),
    });
  }

  if (source === "graveyard") {
    const side = getSide(state, owner);
    return setSide(state, owner, {
      ...side,
      graveyard: side.graveyard.filter((card) => card.instanceId !== cardInstanceId),
    });
  }

  const enemyOwner = getEnemyOwner(owner);
  const enemySide = getSide(state, enemyOwner);
  const enemyHasCard = enemySide.deck.some((card) => card.instanceId === cardInstanceId);

  if (enemyHasCard) {
    return setSide(state, enemyOwner, {
      ...enemySide,
      deck: enemySide.deck.filter((card) => card.instanceId !== cardInstanceId),
    });
  }

  return {
    ...state,
    sharedDeck: {
      ...state.sharedDeck,
      cards: state.sharedDeck.cards.filter((card) => card.instanceId !== cardInstanceId),
    },
  };
}

function applySteps(
  state: MatchState,
  owner: Owner,
  steps: EffectStep[],
  unitInstanceId?: string
): MatchState {
  let nextState = state;

  for (const step of steps) {
    switch (step.kind) {
      case "damage_hero": {
        const targetOwner = step.target === "self" ? owner : getEnemyOwner(owner);
        const targetSide = adjustHeroHp(getSide(nextState, targetOwner), -step.amount);
        nextState = setSide(nextState, targetOwner, targetSide);
        break;
      }
      case "heal_hero": {
        const targetOwner = step.target === "self" ? owner : getEnemyOwner(owner);
        const side = getSide(nextState, targetOwner);
        const healed = { ...side, hp: Math.min(30, side.hp + step.amount) };
        nextState = setSide(nextState, targetOwner, healed);
        break;
      }
      case "draw_cards": {
        nextState = drawCards(nextState, owner, step.amount);
        break;
      }
      case "gain_will": {
        const side = adjustWill(getSide(nextState, owner), step.amount);
        nextState = setSide(nextState, owner, side);
        break;
      }
      case "buff_board": {
        const side = getSide(nextState, owner);
        const board = side.board.map((unit) => ({
          ...unit,
          attack: unit.attack + step.attack,
          health: unit.health + step.health,
          maxHealth: unit.maxHealth + step.health,
        }));
        nextState = setSide(nextState, owner, { ...side, board });
        break;
      }
      case "damage_all_units": {
        if (step.target === "all") {
          const playerSide = getSide(nextState, "player");
          const aiSide = getSide(nextState, "ai");
          nextState = {
            ...nextState,
            player: {
              ...playerSide,
              board: playerSide.board.map((unit) => ({ ...unit, health: unit.health - step.amount })),
            },
            ai: {
              ...aiSide,
              board: aiSide.board.map((unit) => ({ ...unit, health: unit.health - step.amount })),
            },
          };
        } else {
          const targetOwner = getEnemyOwner(owner);
          const targetSide = getSide(nextState, targetOwner);
          nextState = setSide(nextState, targetOwner, {
            ...targetSide,
            board: targetSide.board.map((unit) => ({ ...unit, health: unit.health - step.amount })),
          });
        }
        nextState = cleanupDeadUnits(nextState);
        break;
      }
      case "buff_self": {
        if (!unitInstanceId) break;
        const side = getSide(nextState, owner);
        nextState = setSide(nextState, owner, {
          ...side,
          board: side.board.map((unit) =>
            unit.instanceId === unitInstanceId
              ? {
                  ...unit,
                  attack: unit.attack + step.attack,
                  health: unit.health + step.health,
                  maxHealth: unit.maxHealth + step.health,
                }
              : unit
          ),
        });
        break;
      }
      default:
        break;
    }
  }

  return nextState;
}

function cleanupDeadUnits(state: MatchState): MatchState {
  let nextState = state;

  for (const owner of ["player", "ai"] as const) {
    const side = getSide(nextState, owner);
    const dead = side.board.filter((unit) => unit.health <= 0);
    if (dead.length === 0) continue;

    const survivors = side.board.filter((unit) => unit.health > 0);
    const graveyardCards = dead.map((unit) => ({
      instanceId: unit.sourceCardInstanceId,
      baseId: unit.baseId,
      name: unit.name,
      kind: "character" as const,
      willCost: 0,
      attack: unit.attack,
      health: unit.maxHealth,
      description: unit.passive?.description ?? unit.name,
      frontSrc: unit.frontSrc,
      passive: unit.passive,
    }));

    nextState = setSide(nextState, owner, {
      ...side,
      board: survivors,
      graveyard: [...side.graveyard, ...graveyardCards],
    });

    dead.forEach((unit) => {
      nextState = addLog(nextState, `${unit.name} (${owner}) отправляется в сброс.`);
    });
  }

  return nextState;
}

function checkWinner(state: MatchState): MatchState {
  const playerDead = state.player.hp <= 0;
  const aiDead = state.ai.hp <= 0;

  if (!playerDead && !aiDead) return state;

  let winner: Owner;
  if (playerDead && aiDead) {
    winner = state.activePlayer;
  } else {
    winner = playerDead ? "ai" : "player";
  }

  return {
    ...state,
    phase: "finished",
    winner,
  };
}

function triggerUnitPassive(state: MatchState, owner: Owner, unitId: string, reason: string): MatchState {
  if (isPassiveSilenced(state)) {
    return addLog(state, `Пассивка подавлена эффектом «Тишина Сфер» (${reason}).`);
  }

  const side = getSide(state, owner);
  const unit = side.board.find((entry) => entry.instanceId === unitId);
  if (!unit?.passive) return state;

  let nextState = addLog(state, `${unit.name} активирует пассивку «${unit.passive.name}».`);
  nextState = applySteps(nextState, owner, unit.passive.steps, unitId);

  const refreshedSide = getSide(nextState, owner);
  nextState = setSide(nextState, owner, {
    ...refreshedSide,
    board: refreshedSide.board.map((entry) =>
      entry.instanceId === unitId
        ? { ...entry, passiveTriggersUsed: entry.passiveTriggersUsed + 1 }
        : entry
    ),
  });

  return cleanupDeadUnits(checkWinner(nextState));
}

function resolveCardPlay(
  state: MatchState,
  owner: Owner,
  source: "hand" | "graveyard" | "enemy_deck",
  cardInstanceId: string,
  free: boolean,
  countsTowardTurn: boolean
): MatchState {
  const card = findCardInSource(state, owner, source, cardInstanceId);
  if (!card) return state;
  if (countsTowardTurn && !canStillPlay(state)) return state;

  const side = getSide(state, owner);
  const cost = getPlayCost(state, card, free);
  if (side.will < cost) return state;
  if (card.kind === "character" && side.board.length >= MAX_BOARD_SIZE) return state;
  if (source === "graveyard" && !state.turn.graveyardPlayAvailable && !free) return state;
  if (source === "enemy_deck" && state.turn.enemyDeckPlayCardId !== card.instanceId) return state;
  if (free && !state.turn.awakeningFreePlayAvailable) return state;

  let nextState = removeCardFromSource(state, owner, source, card.instanceId);
  let nextSide = getSide(nextState, owner);
  nextSide = adjustWill(nextSide, -cost);
  nextState = setSide(nextState, owner, nextSide);

  if (card.kind === "character") {
    const unit: UnitState = {
      instanceId: `unit_${card.instanceId}`,
      sourceCardInstanceId: card.instanceId,
      baseId: card.baseId,
      owner,
      name: card.name,
      frontSrc: card.frontSrc,
      attack: card.attack ?? 1,
      health: card.health ?? 1,
      maxHealth: card.health ?? 1,
      exhausted: true,
      passive: card.passive,
      passiveTriggersUsed: 0,
    };

    nextSide = getSide(nextState, owner);
    nextState = setSide(nextState, owner, {
      ...nextSide,
      board: [...nextSide.board, unit],
    });
    nextState = addLog(nextState, `${owner} разыгрывает персонажа ${card.name}.`);

    if (card.passive) {
      nextState = triggerUnitPassive(nextState, owner, unit.instanceId, "при входе на поле");
    }
  } else {
    nextSide = getSide(nextState, owner);
    nextState = setSide(nextState, owner, moveCardToGraveyard(nextSide, card));
    nextState = addLog(nextState, `${owner} использует карту ${card.name}.`);
    if (card.spell) {
      nextState = applySteps(nextState, owner, card.spell.steps);
    }
  }

  nextState = {
    ...nextState,
    turn: {
      ...nextState.turn,
      graveyardPlayAvailable: source === "graveyard" ? false : nextState.turn.graveyardPlayAvailable,
      enemyDeckPlayCardId: source === "enemy_deck" ? null : nextState.turn.enemyDeckPlayCardId,
      awakeningFreePlayAvailable: free ? false : nextState.turn.awakeningFreePlayAvailable,
      awakeningPassiveAvailable: free ? false : nextState.turn.awakeningPassiveAvailable,
    },
  };

  if (countsTowardTurn) {
    nextState = markTurnCardPlayed(nextState);
  }

  return cleanupDeadUnits(checkWinner(nextState));
}

function moveRandomGraveCardToHand(state: MatchState, owner: Owner): MatchState {
  const side = getSide(state, owner);
  if (side.graveyard.length === 0) return addLog(state, `У ${owner} нет карты в сбросе для возврата.`);

  const randomIndex = Math.floor(Math.random() * side.graveyard.length);
  const card = side.graveyard[randomIndex];
  const updatedSide: PlayerState = {
    ...side,
    graveyard: side.graveyard.filter((entry) => entry.instanceId !== card.instanceId),
    hand: [...side.hand, card],
  };

  return addLog(setSide(state, owner, updatedSide), `${owner} возвращает ${card.name} из сброса в руку.`);
}

function getBlindEnemyDeckCardId(state: MatchState, owner: Owner): string | null {
  const enemyOwner = getEnemyOwner(owner);
  const enemySide = getSide(state, enemyOwner);
  if (enemySide.deck.length > 0) {
    return enemySide.deck[Math.floor(Math.random() * enemySide.deck.length)].instanceId;
  }
  if (state.sharedDeck.active && state.sharedDeck.cards.length > 0) {
    return state.sharedDeck.cards[Math.floor(Math.random() * state.sharedDeck.cards.length)].instanceId;
  }
  return null;
}

function tryAutoPlayTopDeckCard(state: MatchState, owner: Owner): MatchState {
  const side = getSide(state, owner);
  const card = state.sharedDeck.active ? state.sharedDeck.cards[0] : side.deck[0];
  if (!card) {
    return addLog(state, `Зов Эха: у ${owner} нет карты для автопроигрывания.`);
  }

  if (card.kind === "character" && side.board.length >= MAX_BOARD_SIZE) {
    return addLog(state, `Зов Эха: ${owner} не может сыграть ${card.name}, стол заполнен.`);
  }

  const cost = getPlayCost(state, card, false);
  if (side.will < cost) {
    return addLog(state, `Зов Эха: ${owner} не хватает Воли на ${card.name}.`);
  }

  const source = state.sharedDeck.active ? "enemy_deck" : "hand";
  let working = state;

  if (state.sharedDeck.active) {
    working = {
      ...working,
      turn: {
        ...working.turn,
        enemyDeckPlayCardId: card.instanceId,
      },
    };
    return resolveCardPlay(working, owner, source, card.instanceId, false, owner === state.activePlayer);
  }

  const updatedSide: PlayerState = {
    ...side,
    hand: [card, ...side.hand],
    deck: side.deck.slice(1),
  };
  working = setSide(working, owner, updatedSide);
  working = addLog(working, `Зов Эха раскрывает верхнюю карту ${owner}.`);
  return resolveCardPlay(working, owner, "hand", card.instanceId, false, owner === state.activePlayer);
}

function countEffectCards(side: PlayerState) {
  return [...side.hand, ...side.graveyard].filter((card) => card.kind === "effect").length;
}

function buffRandomFriendlyUnit(state: MatchState, owner: Owner): MatchState {
  const side = getSide(state, owner);
  if (side.board.length === 0) return addLog(state, `У ${owner} нет персонажей для усиления.`);
  const randomUnit = side.board[Math.floor(Math.random() * side.board.length)];
  return setSide(state, owner, {
    ...side,
    board: side.board.map((unit) =>
      unit.instanceId === randomUnit.instanceId
        ? { ...unit, attack: unit.attack + 1, health: unit.health + 1, maxHealth: unit.maxHealth + 1 }
        : unit
    ),
  });
}

function applyRouletteEvent(state: MatchState, owner: Owner, eventId: string): MatchState {
  let nextState = addLog(state, `Рулетка Судьбы активирует событие: ${ROULETTE_EVENTS.find((event) => event.id === eventId)?.title ?? eventId}.`);

  switch (eventId) {
    case "deck_unity": {
      nextState = {
        ...nextState,
        sharedDeck: {
          active: true,
          cards: shuffle([
            ...nextState.sharedDeck.cards,
            ...nextState.player.deck,
            ...nextState.ai.deck,
          ]),
        },
        player: { ...nextState.player, deck: [] },
        ai: { ...nextState.ai, deck: [] },
      };
      return addLog(nextState, "Обе колоды объединены в общий пул добора.");
    }
    case "echo_call": {
      nextState = tryAutoPlayTopDeckCard(nextState, "player");
      nextState = tryAutoPlayTopDeckCard(nextState, "ai");
      return nextState;
    }
    case "eternal_pain": {
      const playerLoss = countEffectCards(nextState.player);
      const aiLoss = countEffectCards(nextState.ai);
      nextState = {
        ...nextState,
        player: adjustHeroHp(nextState.player, -playerLoss),
        ai: adjustHeroHp(nextState.ai, -aiLoss),
      };
      nextState = addLog(nextState, `Проклятие Вечной Боли: игрок теряет ${playerLoss} HP, ИИ теряет ${aiLoss} HP.`);
      return checkWinner(nextState);
    }
    case "sphere_silence": {
      return {
        ...nextState,
        passiveSilencedUntilRound: nextState.round,
      };
    }
    case "eternity_blessing": {
      return moveRandomGraveCardToHand(nextState, owner);
    }
    case "blood_tithe": {
      nextState = {
        ...nextState,
        player: adjustHeroHp(nextState.player, -2),
        ai: adjustHeroHp(nextState.ai, -2),
      };
      return checkWinner(addLog(nextState, "Оба героя теряют по 2 HP."));
    }
    case "lucky_stream":
      return addLog(drawCards(nextState, owner, 2), `${owner} добирает 2 карты.`);
    case "broken_hourglass": {
      const ownerSide = adjustWill(getSide(nextState, owner), 1);
      return addLog(setSide(nextState, owner, ownerSide), `${owner} восстанавливает 1 Волю.`);
    }
    case "ashen_rain":
      return addLog(applySteps(nextState, owner, [{ kind: "damage_all_units", target: "all", amount: 1 }]), "Пепельный дождь обрушивается на всех персонажей.");
    case "mirror_flare": {
      nextState = {
        ...nextState,
        player: { ...nextState.player, hp: Math.min(30, nextState.player.hp + 1) },
        ai: { ...nextState.ai, hp: Math.min(30, nextState.ai.hp + 1) },
      };
      return addLog(nextState, "Оба героя восстанавливают по 1 HP.");
    }
    case "rage_of_void":
      return addLog(applySteps(nextState, owner, [{ kind: "buff_board", target: "friendly", attack: 1, health: 0 }]), `${owner} получает Ярость Бездны.`);
    case "iron_mercy": {
      const ownerSide = getSide(nextState, owner);
      return addLog(setSide(nextState, owner, { ...ownerSide, hp: Math.min(30, ownerSide.hp + 3) }), `${owner} восстанавливает 3 HP.`);
    }
    case "deep_memory":
      return moveRandomGraveCardToHand(nextState, owner);
    case "frayed_signal": {
      nextState = drawCards(nextState, "player", 1);
      nextState = drawCards(nextState, "ai", 1);
      return addLog(nextState, "Оба игрока добирают по 1 карте.");
    }
    case "cold_contract":
      return addLog(applySteps(nextState, owner, [{ kind: "damage_hero", target: "enemy", amount: 2 }]), `${owner} наносит 2 урона герою врага.`);
    case "fading_echo":
      return addLog(buffRandomFriendlyUnit(nextState, owner), `${owner} усиливает случайного персонажа.`);
    case "rift_whisper": {
      nextState = applySteps(nextState, owner, [
        { kind: "damage_hero", target: "enemy", amount: 1 },
        { kind: "gain_will", target: "self", amount: 1 },
      ]);
      return addLog(nextState, `${owner} слышит Шёпот Разлома.`);
    }
    case "moon_reserve": {
      nextState = setSide(nextState, "player", adjustWill(nextState.player, 1));
      nextState = setSide(nextState, "ai", adjustWill(nextState.ai, 1));
      return addLog(nextState, "Оба игрока получают по 1 Воле.");
    }
    case "glass_comet":
      return addLog(applySteps(nextState, owner, [{ kind: "damage_all_units", target: "enemy", amount: 1 }]), "Стеклянная комета бьёт по вражескому столу.");
    case "last_oath": {
      nextState = drawCards(nextState, owner, 1);
      const side = getSide(nextState, owner);
      nextState = setSide(nextState, owner, { ...side, hp: Math.min(30, side.hp + 1) });
      return addLog(nextState, `${owner} добирает карту и восстанавливает 1 HP.`);
    }
    default:
      return nextState;
  }
}

function hasPassiveToReactivate(state: MatchState, owner: Owner) {
  return getSide(state, owner).board.some((unit) => Boolean(unit.passive));
}

function applyRoll(state: MatchState, owner: Owner, roll: number): MatchState {
  if (state.phase !== "turn_intro" || state.activePlayer !== owner || state.winner) return state;

  let nextState: MatchState = {
    ...state,
    phase: owner === "player" ? "player_turn" : "ai_turn",
    turn: {
      ...state.turn,
      roll,
      playLimit: 1,
      playsMade: 0,
      playedAnyCard: false,
      willMultiplier: 1,
      graveyardPlayAvailable: false,
      enemyDeckPlayCardId: null,
      awakeningFreePlayAvailable: false,
      awakeningPassiveAvailable: false,
      rouletteEventId: null,
    },
  };

  nextState = addLog(nextState, `${owner} бросает D20 и получает ${roll}.`);

  if (roll >= 1 && roll <= 10) {
    nextState = addLog(
      {
        ...nextState,
        turn: { ...nextState.turn, playLimit: roll },
      },
      `Лимит карт на ход: ${roll}.`
    );
  } else if (roll >= 11 && roll <= 14) {
    nextState = {
      ...nextState,
      turn: {
        ...nextState.turn,
        playLimit: 1,
        graveyardPlayAvailable: getSide(nextState, owner).graveyard.length > 0,
      },
    };
    nextState = addLog(nextState, "Можно сыграть 1 карту из своего сброса.");
  } else if (roll >= 15 && roll <= 16) {
    const event = ROULETTE_EVENTS[Math.floor(Math.random() * ROULETTE_EVENTS.length)];
    nextState = {
      ...nextState,
      turn: {
        ...nextState.turn,
        playLimit: 1,
        rouletteEventId: event.id,
      },
    };
    nextState = applyRouletteEvent(nextState, owner, event.id);
  } else if (roll >= 17 && roll <= 18) {
    nextState = {
      ...nextState,
      turn: {
        ...nextState.turn,
        playLimit: null,
        willMultiplier: 2,
      },
    };
    nextState = addLog(nextState, "Можно сыграть любое количество карт, но стоимость по Воле удваивается.");
  } else if (roll === 19) {
    const enemyDeckPlayCardId = getBlindEnemyDeckCardId(nextState, owner);
    nextState = {
      ...nextState,
      turn: {
        ...nextState.turn,
        playLimit: 1,
        enemyDeckPlayCardId,
      },
    };
    nextState = addLog(nextState, enemyDeckPlayCardId ? "Можно сыграть одну случайную карту из колоды противника вслепую." : "У противника нет доступной карты в колоде.");
  } else if (roll === 20) {
    nextState = {
      ...nextState,
      turn: {
        ...nextState.turn,
        playLimit: 1,
        awakeningFreePlayAvailable: true,
        awakeningPassiveAvailable: hasPassiveToReactivate(nextState, owner),
      },
    };
    nextState = addLog(nextState, "Пробуждение: сыграй 1 карту бесплатно или повторно активируй пассивку.");
  }

  return checkWinner(nextState);
}

function performAttack(
  state: MatchState,
  owner: Owner,
  attackerId: string,
  target: { kind: "hero" } | { kind: "unit"; unitId: string }
): MatchState {
  if (state.winner || state.activePlayer !== owner || (owner === "player" ? state.phase !== "player_turn" : state.phase !== "ai_turn")) {
    return state;
  }

  const side = getSide(state, owner);
  const attacker = side.board.find((unit) => unit.instanceId === attackerId);
  if (!attacker || attacker.exhausted) return state;

  let nextState = state;

  if (target.kind === "hero") {
    const enemyOwner = getEnemyOwner(owner);
    const enemySide = getSide(nextState, enemyOwner);
    nextState = setSide(nextState, enemyOwner, adjustHeroHp(enemySide, -attacker.attack));
    nextState = addLog(nextState, `${attacker.name} атакует героя ${enemyOwner} на ${attacker.attack}.`);
  } else {
    const enemyOwner = getEnemyOwner(owner);
    const enemySide = getSide(nextState, enemyOwner);
    const defender = enemySide.board.find((unit) => unit.instanceId === target.unitId);
    if (!defender) return state;

    const updatedAttackerBoard = side.board.map((unit) =>
      unit.instanceId === attackerId ? { ...unit, health: unit.health - defender.attack } : unit
    );
    const updatedDefenderBoard = enemySide.board.map((unit) =>
      unit.instanceId === defender.instanceId ? { ...unit, health: unit.health - attacker.attack } : unit
    );

    nextState = setSide(nextState, owner, { ...side, board: updatedAttackerBoard });
    nextState = setSide(nextState, enemyOwner, { ...enemySide, board: updatedDefenderBoard });
    nextState = addLog(nextState, `${attacker.name} атакует ${defender.name}.`);
    nextState = cleanupDeadUnits(nextState);
  }

  const refreshedSide = getSide(nextState, owner);
  nextState = setSide(nextState, owner, {
    ...refreshedSide,
    board: refreshedSide.board.map((unit) =>
      unit.instanceId === attackerId ? { ...unit, exhausted: true } : unit
    ),
  });

  return checkWinner(nextState);
}

function endTurn(state: MatchState, owner: Owner): MatchState {
  if (state.winner || state.activePlayer !== owner || state.phase === "turn_intro" || state.phase === "finished") {
    return state;
  }

  let nextState = state;
  const activeSide = getSide(nextState, owner);

  if (!nextState.turn.playedAnyCard) {
    nextState = setSide(nextState, owner, adjustHeroHp(activeSide, -2));
    nextState = addLog(nextState, `${owner} не сыграл ни одной карты и теряет 2 HP.`);
  }

  nextState = drawToHandLimit(nextState, owner, MAX_HAND_SIZE);

  const ownerAfterDraw = getSide(nextState, owner);
  const drawSourceEmpty = nextState.sharedDeck.active
    ? nextState.sharedDeck.cards.length === 0
    : ownerAfterDraw.deck.length === 0;

  if (drawSourceEmpty) {
    nextState = setSide(nextState, owner, adjustHeroHp(ownerAfterDraw, -1));
    nextState = addLog(nextState, `${owner} страдает от пустой колоды и теряет 1 HP.`);
  }

  nextState = checkWinner(nextState);
  if (nextState.phase === "finished") return nextState;

  const nextOwner = getEnemyOwner(owner);
  const nextRound = nextOwner === "player" ? nextState.round + 1 : nextState.round;
  const nextSide = getSide(nextState, nextOwner);
  const readiedBoard = nextSide.board.map((unit) => ({ ...unit, exhausted: false }));
  const restoredWill = Math.min(nextSide.maxWill, nextSide.will + 1);

  nextState = setSide(nextState, nextOwner, {
    ...nextSide,
    board: readiedBoard,
    will: restoredWill,
  });

  nextState = {
    ...nextState,
    activePlayer: nextOwner,
    phase: "turn_intro",
    round: nextRound,
    turn: {
      round: nextRound,
      roll: null,
      playLimit: 1,
      playsMade: 0,
      playedAnyCard: false,
      willMultiplier: 1,
      graveyardPlayAvailable: false,
      enemyDeckPlayCardId: null,
      awakeningFreePlayAvailable: false,
      awakeningPassiveAvailable: false,
      rouletteEventId: null,
    },
  };

  return addLog(nextState, `Ход переходит к ${nextOwner}.`);
}

export function matchReducer(state: MatchState, action: MatchAction): MatchState {
  switch (action.type) {
    case "APPLY_ROLL":
      return applyRoll(state, action.owner, action.roll);
    case "PLAY_CARD":
      return resolveCardPlay(state, action.owner, action.source, action.cardInstanceId, Boolean(action.free), true);
    case "ATTACK":
      return performAttack(state, action.owner, action.attackerId, action.target);
    case "USE_AWAKENING_PASSIVE": {
      if (!state.turn.awakeningPassiveAvailable || state.activePlayer !== action.owner) return state;
      const targetUnit = getSide(state, action.owner).board.find((unit) => Boolean(unit.passive));
      if (!targetUnit) return addLog(state, `У ${action.owner} нет доступной пассивки для пробуждения.`);
      const nextState = {
        ...state,
        turn: {
          ...state.turn,
          awakeningFreePlayAvailable: false,
          awakeningPassiveAvailable: false,
        },
      };
      return triggerUnitPassive(nextState, action.owner, targetUnit.instanceId, "пробуждение");
    }
    case "END_TURN":
      return endTurn(state, action.owner);
    default:
      return state;
  }
}
