import type { PlayerState } from "../core/types";
export const gainWillFromRoll = (p: PlayerState, roll: number): PlayerState => ({ ...p, will: Math.min(p.maxWill, p.will + Math.max(1, Math.ceil(roll / 4))) });
export const canPayWill = (p: PlayerState, cost: number) => p.will >= cost;
export const payWill = (p: PlayerState, cost: number): PlayerState => ({ ...p, will: Math.max(0, p.will - cost) });
