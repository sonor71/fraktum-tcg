export type Owner = "player" | "ai";
export type CardKind = "character" | "event" | "effect" | "tactic";
export type MatchPhase = "turn_intro" | "player_turn" | "ai_turn" | "finished";

export type EffectStep =
  | { kind: "damage_hero"; target: "self" | "enemy"; amount: number }
  | { kind: "heal_hero"; target: "self" | "enemy"; amount: number }
  | { kind: "draw_cards"; target: "self"; amount: number }
  | { kind: "gain_will"; target: "self"; amount: number }
  | { kind: "buff_board"; target: "friendly"; attack: number; health: number }
  | { kind: "damage_all_units"; target: "enemy" | "all"; amount: number }
  | { kind: "buff_self"; attack: number; health: number };

export interface PassiveDefinition {
  id: string;
  name: string;
  description: string;
  steps: EffectStep[];
}

export interface SpellDefinition {
  id: string;
  description: string;
  steps: EffectStep[];
}

export interface CardTemplate {
  baseId: string;
  name: string;
  kind: CardKind;
  willCost: number;
  attack?: number;
  health?: number;
  description: string;
  frontSrc: string;
  passive?: PassiveDefinition;
  spell?: SpellDefinition;
}

export interface MatchCard {
  instanceId: string;
  baseId: string;
  name: string;
  kind: CardKind;
  willCost: number;
  attack?: number;
  health?: number;
  description: string;
  frontSrc: string;
  passive?: PassiveDefinition;
  spell?: SpellDefinition;
}

export interface UnitState {
  instanceId: string;
  sourceCardInstanceId: string;
  baseId: string;
  owner: Owner;
  name: string;
  frontSrc: string;
  attack: number;
  health: number;
  maxHealth: number;
  exhausted: boolean;
  passive?: PassiveDefinition;
  passiveTriggersUsed: number;
}

export interface PlayerState {
  owner: Owner;
  hp: number;
  will: number;
  maxWill: number;
  deck: MatchCard[];
  hand: MatchCard[];
  board: UnitState[];
  graveyard: MatchCard[];
}

export interface TurnRules {
  round: number;
  roll: number | null;
  playLimit: number | null;
  playsMade: number;
  playedAnyCard: boolean;
  willMultiplier: number;
  graveyardPlayAvailable: boolean;
  enemyDeckPlayCardId: string | null;
  awakeningFreePlayAvailable: boolean;
  awakeningPassiveAvailable: boolean;
  rouletteEventId: string | null;
}

export interface SharedDeckState {
  active: boolean;
  cards: MatchCard[];
}

export interface MatchLogEntry {
  id: string;
  text: string;
}

export interface RouletteEventDefinition {
  id: string;
  title: string;
  description: string;
}

export interface MatchState {
  matchId: string;
  phase: MatchPhase;
  activePlayer: Owner;
  round: number;
  player: PlayerState;
  ai: PlayerState;
  sharedDeck: SharedDeckState;
  turn: TurnRules;
  log: MatchLogEntry[];
  winner: Owner | null;
  passiveSilencedUntilRound: number | null;
}

export type PlayCardSource = "hand" | "graveyard" | "enemy_deck";

export type MatchAction =
  | { type: "APPLY_ROLL"; owner: Owner; roll: number }
  | { type: "PLAY_CARD"; owner: Owner; source: PlayCardSource; cardInstanceId: string; free?: boolean }
  | {
      type: "ATTACK";
      owner: Owner;
      attackerId: string;
      target:
        | { kind: "hero" }
        | { kind: "unit"; unitId: string };
    }
  | { type: "USE_AWAKENING_PASSIVE"; owner: Owner }
  | { type: "END_TURN"; owner: Owner };
