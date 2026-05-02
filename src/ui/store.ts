// Tiny pub/sub bridge between the game loop (main.ts) and the Lit panels.
//
// The game loop owns the data; panels are read-only consumers. main.ts
// updates `gameState` and calls `notifyState()` after pickup/equip/unequip
// so panels can re-render. Avoids dragging Pixi imports into Lit modules.

import type { Equipment, DerivedStats } from '../systems/inventory';
import type { Inventory } from '../systems/bag';

export const STATE_CHANGED_EVENT = 'wyrdloom:state-changed';

export interface GameState {
  inventory: Inventory | null;
  equipment: Equipment;
  derived: DerivedStats;
  baseMaxHp: number;
  baseAtk: number;
  hotbar: ReadonlyArray<HotbarBinding | null>;
}

export interface HotbarBinding {
  readonly skillId: string;
  readonly label: string;
}

export const gameState: GameState = {
  inventory: null,
  equipment: {},
  derived: { atk: 0, maxHp: 0, armor: 0 },
  baseMaxHp: 0,
  baseAtk: 0,
  hotbar: [null, null, null, null],
};

export function notifyState(): void {
  window.dispatchEvent(new CustomEvent(STATE_CHANGED_EVENT));
}

// User intents — emitted by panels, handled by main.ts.
export const INTENT_EQUIP_EVENT = 'wyrdloom:intent-equip';
export const INTENT_UNEQUIP_EVENT = 'wyrdloom:intent-unequip';
export const INTENT_DROP_EVENT = 'wyrdloom:intent-drop';

export interface EquipIntent {
  readonly uid: string; // item uid in inventory
}
export interface UnequipIntent {
  readonly slot: 'weapon' | 'head' | 'chest' | 'ring';
}
export interface DropIntent {
  readonly uid: string; // item uid in inventory
}
