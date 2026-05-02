// Web save backend — IndexedDB via idb. Object store: `wyrdloom.saves`,
// keyed by slot index (1..5). One record per slot.

import { openDB, type IDBPDatabase } from 'idb';
import {
  type SaveAdapter,
  type SaveFile,
  type SlotIndex,
  type SlotSummary,
  isValidSlot,
  migrate,
  MAX_SLOTS,
} from './SaveAdapter';

const DB_NAME = 'wyrdloom';
const DB_VERSION = 1;
const STORE = 'saves';

interface DbSchema {
  saves: {
    key: number;
    value: SaveFile;
  };
}

let cached: IDBPDatabase<DbSchema> | null = null;

async function getDb(): Promise<IDBPDatabase<DbSchema>> {
  if (cached) return cached;
  cached = await openDB<DbSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    },
  });
  return cached;
}

export class WebSaveAdapter implements SaveAdapter {
  async list(): Promise<SlotSummary[]> {
    const db = await getDb();
    const out: SlotSummary[] = [];
    for (let slot = 1; slot <= MAX_SLOTS; slot++) {
      const file = await db.get(STORE, slot);
      if (!file) continue;
      out.push({
        slot: slot as SlotIndex,
        characterName: file.characterName,
        zoneId: file.state.zoneId,
        updatedAt: file.updatedAt,
        version: file.version,
        // Legacy (pre-v0.11.0) saves don't carry hardcore; default to false
        // here. The same default is stamped in by MIGRATIONS[5] when the slot
        // is actually loaded — list() is a no-migrate fast scan.
        hardcore: file.state.hardcore ?? false,
      });
    }
    return out;
  }

  async load(slot: SlotIndex): Promise<SaveFile | null> {
    if (!isValidSlot(slot)) throw new Error(`invalid slot: ${slot}`);
    const db = await getDb();
    const raw = await db.get(STORE, slot);
    if (!raw) return null;
    return migrate(raw);
  }

  async save(slot: SlotIndex, file: SaveFile): Promise<void> {
    if (!isValidSlot(slot)) throw new Error(`invalid slot: ${slot}`);
    const db = await getDb();
    await db.put(STORE, file, slot);
  }

  async remove(slot: SlotIndex): Promise<void> {
    if (!isValidSlot(slot)) throw new Error(`invalid slot: ${slot}`);
    const db = await getDb();
    await db.delete(STORE, slot);
  }
}
