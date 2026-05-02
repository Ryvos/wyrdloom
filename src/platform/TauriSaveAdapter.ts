// Tauri save backend — JSON files in $APPDATA/wyrdloom/saves/slot_<n>.json.
// Per spec §2.5 the FS capability is scoped to that exact directory.
//
// v0.6.0 ships the adapter as functional but untested at runtime — Tauri
// build verification rolls into v0.6.x. The web adapter is the live target
// for v0.6.0 ship.

import {
  type SaveAdapter,
  type SaveFile,
  type SlotIndex,
  type SlotSummary,
  isValidSlot,
  migrate,
  MAX_SLOTS,
} from './SaveAdapter';

const SAVES_DIR = 'saves';

function slotFile(slot: SlotIndex): string {
  return `${SAVES_DIR}/slot_${slot}.json`;
}

interface TauriFs {
  readTextFile(path: string, opts?: { baseDir?: number }): Promise<string>;
  writeTextFile(path: string, contents: string, opts?: { baseDir?: number }): Promise<void>;
  remove(path: string, opts?: { baseDir?: number }): Promise<void>;
  exists(path: string, opts?: { baseDir?: number }): Promise<boolean>;
  mkdir(path: string, opts?: { baseDir?: number; recursive?: boolean }): Promise<void>;
  BaseDirectory: { AppData: number };
}

// Lazy-imported so the web build doesn't drag @tauri-apps/plugin-fs into the
// bundle. We only resolve the import inside the Tauri runtime; the
// `/* @vite-ignore */` hint stops Vite from trying to statically resolve
// the optional dependency at dev-server start.
async function fs(): Promise<TauriFs> {
  const mod = '@tauri-apps/plugin-fs';
  return await import(/* @vite-ignore */ mod);
}

export class TauriSaveAdapter implements SaveAdapter {
  private async ensureDir(): Promise<void> {
    const f = await fs();
    const ok = await f.exists(SAVES_DIR, { baseDir: f.BaseDirectory.AppData });
    if (!ok) {
      await f.mkdir(SAVES_DIR, { baseDir: f.BaseDirectory.AppData, recursive: true });
    }
  }

  async list(): Promise<SlotSummary[]> {
    await this.ensureDir();
    const f = await fs();
    const out: SlotSummary[] = [];
    for (let slot = 1; slot <= MAX_SLOTS; slot++) {
      const path = slotFile(slot as SlotIndex);
      if (!(await f.exists(path, { baseDir: f.BaseDirectory.AppData }))) continue;
      const raw = await f.readTextFile(path, { baseDir: f.BaseDirectory.AppData });
      const parsed = JSON.parse(raw) as SaveFile;
      out.push({
        slot: slot as SlotIndex,
        characterName: parsed.characterName,
        zoneId: parsed.state.zoneId,
        updatedAt: parsed.updatedAt,
        version: parsed.version,
        // Legacy (pre-v0.11.0) saves don't carry hardcore; default to false
        // here. The same default is stamped in by MIGRATIONS[5] when the slot
        // is actually loaded — list() is a no-migrate fast scan.
        hardcore: parsed.state.hardcore ?? false,
      });
    }
    return out;
  }

  async load(slot: SlotIndex): Promise<SaveFile | null> {
    if (!isValidSlot(slot)) throw new Error(`invalid slot: ${slot}`);
    await this.ensureDir();
    const f = await fs();
    const path = slotFile(slot);
    if (!(await f.exists(path, { baseDir: f.BaseDirectory.AppData }))) return null;
    const raw = await f.readTextFile(path, { baseDir: f.BaseDirectory.AppData });
    const parsed = JSON.parse(raw) as SaveFile;
    return migrate(parsed);
  }

  async save(slot: SlotIndex, file: SaveFile): Promise<void> {
    if (!isValidSlot(slot)) throw new Error(`invalid slot: ${slot}`);
    await this.ensureDir();
    const f = await fs();
    await f.writeTextFile(slotFile(slot), JSON.stringify(file), {
      baseDir: f.BaseDirectory.AppData,
    });
  }

  async remove(slot: SlotIndex): Promise<void> {
    if (!isValidSlot(slot)) throw new Error(`invalid slot: ${slot}`);
    const f = await fs();
    const path = slotFile(slot);
    if (!(await f.exists(path, { baseDir: f.BaseDirectory.AppData }))) return;
    await f.remove(path, { baseDir: f.BaseDirectory.AppData });
  }
}
