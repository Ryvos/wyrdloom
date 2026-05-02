// SaveAdapter unit tests — schema constants, slot validation, migrate()
// passthrough at current version, fail-fast on unknown versions, and
// buildSaveFile shape.

import { describe, expect, it } from 'vitest';
import {
  SAVE_SCHEMA_VERSION,
  MAX_SLOTS,
  isValidSlot,
  migrate,
  buildSaveFile,
  type SaveFile,
  type SaveState,
  MIGRATIONS,
} from '../../src/platform/SaveAdapter';
import { makeInventory } from '../../src/systems/bag';
import { makeQuestState } from '../../src/systems/quests';

function fakeState(): SaveState {
  return {
    playerHp: 120,
    playerStatsAtk: 28,
    playerStatsMaxHp: 120,
    classId: 'furyborn',
    resource: 0,
    inventory: makeInventory(),
    equipment: {},
    hotbar: [null, null, null, null],
    zoneId: 'whitestone',
    catacombsSeed: 'catacombs-1',
    killCount: 0,
    quests: makeQuestState(),
    endingSeen: false,
    hardcore: false,
  };
}

describe('SaveAdapter', () => {
  it('schema version is 6 in v0.11.0', () => {
    expect(SAVE_SCHEMA_VERSION).toBe(6);
  });

  it('5 character slots, 1-indexed', () => {
    expect(MAX_SLOTS).toBe(5);
    expect(isValidSlot(1)).toBe(true);
    expect(isValidSlot(5)).toBe(true);
    expect(isValidSlot(0)).toBe(false);
    expect(isValidSlot(6)).toBe(false);
    expect(isValidSlot(2.5)).toBe(false);
  });

  it('migrate() is a no-op at the current schema version', () => {
    const file: SaveFile = {
      schemaVersion: SAVE_SCHEMA_VERSION,
      createdAt: 0,
      updatedAt: 0,
      characterName: 'X',
      version: '0.6.0',
      state: fakeState(),
    };
    expect(migrate(file)).toBe(file); // identity at current version
  });

  it('migrate() throws when a save is from a newer build', () => {
    const file: SaveFile = {
      schemaVersion: SAVE_SCHEMA_VERSION + 1,
      createdAt: 0,
      updatedAt: 0,
      characterName: 'X',
      version: '99.0.0',
      state: fakeState(),
    };
    expect(() => migrate(file)).toThrow(/newer build/);
  });

  it('migrate() throws when no migrator exists for an older schema', () => {
    // schemaVersion 0 has no 0→1 migrator → fail-fast. (MIGRATIONS starts
    // at key 1, so anything older has no path forward.)
    const file: SaveFile = {
      schemaVersion: 0,
      createdAt: 0,
      updatedAt: 0,
      characterName: 'X',
      version: '0.5.0',
      state: fakeState(),
    };
    expect(() => migrate(file)).toThrow(/migrator from schema 0/);
  });

  it('MIGRATIONS table contains 1→2, 2→3, 3→4, 4→5, and 5→6 entries in v0.11.0', () => {
    expect(Object.keys(MIGRATIONS).sort()).toEqual(['1', '2', '3', '4', '5']);
  });

  it('migrate() upgrades a v1 save all the way to current with Furyborn + hardcore=false defaults', () => {
    // v0.6.0-shaped save (no classId, no resource).
    const v1State = {
      playerHp: 100,
      playerStatsAtk: 25,
      playerStatsMaxHp: 100,
      inventory: makeInventory(),
      equipment: {},
      hotbar: [null, null, null, null],
      zoneId: 'whitestone',
      catacombsSeed: 'catacombs-1',
      killCount: 0,
      quests: makeQuestState(),
    };
    const file: SaveFile = {
      schemaVersion: 1,
      createdAt: 0,
      updatedAt: 0,
      characterName: 'Legacy',
      version: '0.6.0',
      // The migrator treats `state` opaquely; we cast just to satisfy the
      // SaveFile type, which expects the latest shape.
      state: v1State as unknown as SaveState,
    };
    const migrated = migrate(file);
    expect(migrated.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated.state.classId).toBe('furyborn');
    expect(migrated.state.resource).toBe(0);
    // v0.11.0 default — legacy characters were never given the choice.
    expect(migrated.state.hardcore).toBe(false);
    // Legacy fields preserved.
    expect(migrated.state.zoneId).toBe('whitestone');
    expect(migrated.state.killCount).toBe(0);
  });

  it('migrate() upgrades a v2 save to current (gem fields no-op + endingSeen default + hardcore=false)', () => {
    // A v2-shaped save (no endingSeen). We lie to the type system since the
    // SaveState type is the latest-version shape.
    const v2State = {
      playerHp: 120,
      playerStatsAtk: 28,
      playerStatsMaxHp: 120,
      classId: 'furyborn',
      resource: 0,
      inventory: makeInventory(),
      equipment: {},
      hotbar: [null, null, null, null],
      zoneId: 'whitestone',
      catacombsSeed: 'catacombs-1',
      killCount: 0,
      quests: makeQuestState(),
    };
    const file: SaveFile = {
      schemaVersion: 2,
      createdAt: 0,
      updatedAt: 0,
      characterName: 'Pre-Imbuer',
      version: '0.7.0',
      state: v2State as unknown as SaveState,
    };
    const migrated = migrate(file);
    expect(migrated.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated.state.endingSeen).toBe(false);
    expect(migrated.state.hardcore).toBe(false);
    expect(migrated.state.zoneId).toBe('whitestone');
    expect(migrated.state.classId).toBe('furyborn');
  });

  it('migrate() upgrades a v4 save through v5 to v6 (echo no-op + hardcore default)', () => {
    // v4-shaped state has no echo fields and no hardcore flag.
    const v4State = {
      playerHp: 120,
      playerStatsAtk: 28,
      playerStatsMaxHp: 120,
      classId: 'furyborn',
      resource: 0,
      inventory: makeInventory(),
      equipment: {},
      hotbar: [null, null, null, null],
      zoneId: 'whitestone',
      catacombsSeed: 'catacombs-1',
      killCount: 0,
      quests: makeQuestState(),
      endingSeen: false,
    };
    const file: SaveFile = {
      schemaVersion: 4,
      createdAt: 0,
      updatedAt: 0,
      characterName: 'Pre-Echo',
      version: '0.9.0',
      state: v4State as unknown as SaveState,
    };
    const migrated = migrate(file);
    expect(migrated.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    // echoTier / echoFloor stay absent — no active run on a pre-v0.10.0 save.
    expect(migrated.state.echoTier).toBeUndefined();
    expect(migrated.state.echoFloor).toBeUndefined();
    // v5→v6 stamps hardcore=false.
    expect(migrated.state.hardcore).toBe(false);
  });

  it('migrate() upgrades a v5 save to v6 (hardcore default only)', () => {
    // v5-shaped state has every v0.10.0 field but no hardcore flag.
    const v5State = {
      playerHp: 120,
      playerStatsAtk: 28,
      playerStatsMaxHp: 120,
      classId: 'furyborn',
      resource: 0,
      inventory: makeInventory(),
      equipment: {},
      hotbar: [null, null, null, null],
      zoneId: 'whitestone',
      catacombsSeed: 'catacombs-1',
      killCount: 0,
      quests: makeQuestState(),
      endingSeen: false,
    };
    const file: SaveFile = {
      schemaVersion: 5,
      createdAt: 0,
      updatedAt: 0,
      characterName: 'Pre-Hardcore',
      version: '0.10.0',
      state: v5State as unknown as SaveState,
    };
    const migrated = migrate(file);
    expect(migrated.schemaVersion).toBe(6);
    expect(migrated.state.hardcore).toBe(false);
    // Pre-existing fields preserved.
    expect(migrated.state.endingSeen).toBe(false);
    expect(migrated.state.classId).toBe('furyborn');
  });

  it('migrate() upgrades a v3 save to current (endingSeen + echo + hardcore defaults)', () => {
    const v3State = {
      playerHp: 120,
      playerStatsAtk: 28,
      playerStatsMaxHp: 120,
      classId: 'furyborn',
      resource: 0,
      inventory: makeInventory(),
      equipment: {},
      hotbar: [null, null, null, null],
      zoneId: 'whitestone',
      catacombsSeed: 'catacombs-1',
      killCount: 0,
      quests: makeQuestState(),
    };
    const file: SaveFile = {
      schemaVersion: 3,
      createdAt: 0,
      updatedAt: 0,
      characterName: 'Pre-Pact',
      version: '0.8.0',
      state: v3State as unknown as SaveState,
    };
    const migrated = migrate(file);
    expect(migrated.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(migrated.state.endingSeen).toBe(false);
    expect(migrated.state.echoTier).toBeUndefined();
    expect(migrated.state.hardcore).toBe(false);
  });

  it('buildSaveFile stamps schema + timestamps', () => {
    const before = Date.now();
    const file = buildSaveFile({
      characterName: 'Wyrdling',
      appVersion: '0.6.0',
      state: fakeState(),
      createdAt: 12345,
    });
    expect(file.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(file.characterName).toBe('Wyrdling');
    expect(file.version).toBe('0.6.0');
    expect(file.createdAt).toBe(12345);
    expect(file.updatedAt).toBeGreaterThanOrEqual(before);
  });
});
