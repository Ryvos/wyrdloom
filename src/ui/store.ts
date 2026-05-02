// Tiny pub/sub bridge between the game loop (main.ts) and the Lit panels.
//
// The game loop owns the data; panels are read-only consumers. main.ts
// updates `gameState` and calls `notifyState()` after pickup/equip/unequip
// so panels can re-render. Avoids dragging Pixi imports into Lit modules.

import type { Equipment, DerivedStats } from '../systems/inventory';
import type { Inventory } from '../systems/bag';
import type { QuestState } from '../systems/quests';
import type { ZoneId } from '../systems/zone';
import type { ClassId } from '../types/class';

export const STATE_CHANGED_EVENT = 'wyrdloom:state-changed';

export interface GameState {
  inventory: Inventory | null;
  equipment: Equipment;
  derived: DerivedStats;
  baseMaxHp: number;
  baseAtk: number;
  hotbar: ReadonlyArray<HotbarBinding | null>;
  quests: QuestState | null;
  zoneId: ZoneId | null;
  classId: ClassId | null;
  resource: number;       // current resource value
  resourceMax: number;    // class-defined max
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
  quests: null,
  zoneId: null,
  classId: null,
  resource: 0,
  resourceMax: 0,
};

export function notifyState(): void {
  window.dispatchEvent(new CustomEvent(STATE_CHANGED_EVENT));
}

// User intents — emitted by panels, handled by main.ts.
export const INTENT_EQUIP_EVENT = 'wyrdloom:intent-equip';
export const INTENT_UNEQUIP_EVENT = 'wyrdloom:intent-unequip';
export const INTENT_DROP_EVENT = 'wyrdloom:intent-drop';
export const INTENT_IMBUE_EVENT = 'wyrdloom:intent-imbue';
export const INTENT_SOCKET_EVENT = 'wyrdloom:intent-socket';

export interface EquipIntent {
  readonly uid: string; // item uid in inventory
}
export interface UnequipIntent {
  readonly slot: 'weapon' | 'head' | 'chest' | 'ring';
}
export interface DropIntent {
  readonly uid: string; // item uid in inventory
}
export interface ImbueIntent {
  readonly uids: ReadonlyArray<string>; // exactly 3 magic same-slot uids
}
export interface SocketIntent {
  readonly gemUid: string;        // bag-wrapped gem to consume
  readonly targetUid: string;     // item with the empty socket (bag or equipped)
  readonly socketIx?: number;     // optional explicit socket index
}
