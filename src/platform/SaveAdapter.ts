// Save/load adapter — abstract interface + shared schema. Two impls:
//   - WebSaveAdapter (IndexedDB via idb)
//   - TauriSaveAdapter (FS via @tauri-apps/api/fs)
//
// Per spec §8: 5 character slots, JSON, schema_version: int, fail-fast on
// unknown version, manual save in hubs only, auto-save on zone-change /
// level-up / quest-complete / 5-min interval.
//
// The schema lives here so both impls + the migrator + tests all read the
// same shape.

import type { Equipment } from '../systems/inventory';
import type { Inventory } from '../systems/bag';
import type { QuestState } from '../systems/quests';
import type { ZoneId } from '../systems/zone';

// Bump this when the save shape changes; add a migrator to MIGRATIONS at the
// same time. Loaders fail-fast on unknown versions.
export const SAVE_SCHEMA_VERSION = 1;

// Slots are 1..MAX_SLOTS (slot 0 reserved for "current/auto" if we ever
// split auto vs manual saves; v0.6.0 ships 5 manual slots only).
export const MAX_SLOTS = 5;

export interface SaveFile {
  readonly schemaVersion: number;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly characterName: string;
  readonly version: string; // app version that wrote this file
  readonly state: SaveState;
}

export interface SaveState {
  // Player core
  readonly playerHp: number;
  readonly playerStatsAtk: number;
  readonly playerStatsMaxHp: number;
  // Inventory + equipment
  readonly inventory: Inventory;
  readonly equipment: Equipment;
  // Hotbar bindings
  readonly hotbar: ReadonlyArray<{ skillId: string; label: string } | null>;
  // World state
  readonly zoneId: ZoneId;
  readonly catacombsSeed: string;
  readonly killCount: number;
  // Quest state
  readonly quests: QuestState;
}

export type SlotIndex = 1 | 2 | 3 | 4 | 5;

export function isValidSlot(n: number): n is SlotIndex {
  return Number.isInteger(n) && n >= 1 && n <= MAX_SLOTS;
}

// One-line summary shown in the title-screen "Continue" list.
export interface SlotSummary {
  readonly slot: SlotIndex;
  readonly characterName: string;
  readonly zoneId: ZoneId;
  readonly updatedAt: number;
  readonly version: string;
}

export interface SaveAdapter {
  // Returns slot summaries that exist (sparse array — empty slots omitted).
  list(): Promise<SlotSummary[]>;
  load(slot: SlotIndex): Promise<SaveFile | null>;
  save(slot: SlotIndex, file: SaveFile): Promise<void>;
  remove(slot: SlotIndex): Promise<void>;
}

// Migration table — keyed by source schema version. Each migrator returns
// the next version's shape. Empty in v0.6.0; populated when we bump.
type AnyState = Record<string, unknown>;
export const MIGRATIONS: Record<number, (s: AnyState) => AnyState> = {};

// Apply migrations until current version is reached, or throw on unknown.
export function migrate(file: SaveFile): SaveFile {
  if (file.schemaVersion === SAVE_SCHEMA_VERSION) return file;
  if (file.schemaVersion > SAVE_SCHEMA_VERSION) {
    throw new Error(
      `Save file is from a newer build (schema ${file.schemaVersion}, ` +
        `this build expects ≤ ${SAVE_SCHEMA_VERSION}). Update the game first.`,
    );
  }
  // Walk forward.
  let cur: AnyState = file as unknown as AnyState;
  let v = file.schemaVersion;
  while (v < SAVE_SCHEMA_VERSION) {
    const fn = MIGRATIONS[v];
    if (!fn) {
      throw new Error(
        `No migrator from schema ${v} → ${v + 1}. ` +
          'Add an entry to MIGRATIONS in SaveAdapter.ts before bumping.',
      );
    }
    cur = fn(cur);
    v += 1;
  }
  return cur as unknown as SaveFile;
}

// Build a SaveFile from current game state. Caller passes the raw pieces;
// this just stamps schema/timestamps/version.
export function buildSaveFile(args: {
  characterName: string;
  appVersion: string;
  state: SaveState;
  createdAt: number;
}): SaveFile {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    createdAt: args.createdAt,
    updatedAt: Date.now(),
    characterName: args.characterName,
    version: args.appVersion,
    state: args.state,
  };
}
