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
import type { ClassId } from '../types/class';

// Bump this when the save shape changes; add a migrator to MIGRATIONS at the
// same time. Loaders fail-fast on unknown versions.
//
// Schema history:
//   1 (v0.6.0) — baseline. zone+seed+inventory+equipment+hotbar+quests.
//   2 (v0.7.0) — adds classId + resource. Legacy v1 saves migrate to a
//                Furyborn character with empty resource (the only class that
//                exists in v0.7.0).
//   3 (v0.8.0) — items may now carry `unique`, `sockets`, and `gem`.
//                These are all optional fields, so v2 saves load shape-clean
//                and the migrator is a version-stamp bump only. The bump
//                serves as a "writer understood v0.8.0 fields" marker so a
//                future shape-breaking change can branch on schemaVersion.
//   4 (v0.9.0) — adds `endingSeen: boolean` (Pact-Bearer one-shot gate).
//                Pre-v0.9.0 saves migrate to `endingSeen: false`.
//   5 (v0.10.0) — adds `echoTier?: number` + `echoFloor?: number` for
//                 active Echo runs. Pre-v0.10.0 saves get omitted fields
//                 (no active run); the migrator is a version-stamp bump.
//   6 (v0.11.0) — adds `hardcore: boolean` (permadeath flag, chosen at
//                 character creation). Pre-v0.11.0 saves migrate to false.
export const SAVE_SCHEMA_VERSION = 6;

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
  // Class + resource (v0.7.0+). Pre-v0.7.0 saves migrate to Furyborn / 0
  // resource via MIGRATIONS[1].
  readonly classId: ClassId;
  readonly resource: number;
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
  // v0.9.0+: flips true once the player dismisses the Pact-Bearer ending
  // overlay. Pre-v0.9.0 saves migrate to false (haven't reached Act III).
  readonly endingSeen: boolean;
  // v0.10.0+: active Echo run state. Both omitted means the player is not
  // mid-run. Tier ≥ 1 + floor 1..5 means resume into the Echo on load.
  readonly echoTier?: number;
  readonly echoFloor?: number;
  // v0.11.0+: hardcore (permadeath) flag. Set at character creation; on
  // player death, the save slot is deleted instead of respawning. Legacy
  // saves migrate to false.
  readonly hardcore: boolean;
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
  readonly hardcore: boolean;
}

export interface SaveAdapter {
  // Returns slot summaries that exist (sparse array — empty slots omitted).
  list(): Promise<SlotSummary[]>;
  load(slot: SlotIndex): Promise<SaveFile | null>;
  save(slot: SlotIndex, file: SaveFile): Promise<void>;
  remove(slot: SlotIndex): Promise<void>;
}

// Migration table — keyed by source schema version. Each migrator returns
// the next version's shape.
type AnyState = Record<string, unknown>;
export const MIGRATIONS: Record<number, (s: AnyState) => AnyState> = {
  // v0.6.0 → v0.7.0: introduces classId + resource. v0.6 saves are silently
  // promoted to Furyborn / 0 rage, since Furyborn is the only class wired in
  // v0.7.0 and there's no character-creation flow yet.
  1: (file): AnyState => {
    const oldState = (file.state as AnyState) ?? {};
    return {
      ...file,
      schemaVersion: 2,
      state: { ...oldState, classId: 'furyborn', resource: 0 },
    };
  },
  // v0.7.0 → v0.8.0: items gained optional unique/sockets/gem fields. No
  // legacy-state rewrite is needed — absence of the fields just means the
  // item was rolled before v0.8.0 and has no socket/unique data. We bump
  // the version so the loader can branch on it later.
  2: (file): AnyState => ({ ...file, schemaVersion: 3 }),
  // v0.8.0 → v0.9.0: state.endingSeen joins the SaveState. Pre-v0.9.0 saves
  // never reached Act III, so endingSeen=false is the correct default.
  3: (file): AnyState => {
    const oldState = (file.state as AnyState) ?? {};
    return {
      ...file,
      schemaVersion: 4,
      state: { ...oldState, endingSeen: false },
    };
  },
  // v0.9.0 → v0.10.0: echoTier / echoFloor are optional fields. Absence
  // means "no active Echo run" — the right default for v0.9.0 saves.
  // Version-stamp bump only.
  4: (file): AnyState => ({ ...file, schemaVersion: 5 }),
  // v0.10.0 → v0.11.0: state.hardcore is required. Existing characters
  // never opted in, so legacy saves migrate to hardcore=false.
  5: (file): AnyState => {
    const oldState = (file.state as AnyState) ?? {};
    return {
      ...file,
      schemaVersion: 6,
      state: { ...oldState, hardcore: false },
    };
  },
};

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
