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
  };
}

describe('SaveAdapter', () => {
  it('schema version is 2 in v0.7.0', () => {
    expect(SAVE_SCHEMA_VERSION).toBe(2);
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
    // SAVE_SCHEMA_VERSION === 2 right now and MIGRATIONS only covers 1→2.
    // schemaVersion 0 has no 0→1 migrator → fail-fast.
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

  it('MIGRATIONS table contains the 1→2 entry in v0.7.0', () => {
    expect(Object.keys(MIGRATIONS)).toEqual(['1']);
  });

  it('migrate() upgrades a v1 save to v2 with Furyborn defaults', () => {
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
      // SaveFile type, which expects the v2 shape.
      state: v1State as unknown as SaveState,
    };
    const migrated = migrate(file);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.state.classId).toBe('furyborn');
    expect(migrated.state.resource).toBe(0);
    // Legacy fields preserved.
    expect(migrated.state.zoneId).toBe('whitestone');
    expect(migrated.state.killCount).toBe(0);
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
