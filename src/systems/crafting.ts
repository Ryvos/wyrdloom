// Crafting recipes — Imbuer NPC operations. Pure functions; main.ts wraps
// them in inventory mutations and store sync.
//
// v0.8.0 introduces two recipes:
//   1. Imbue: 3 magic same-slot items → 1 rare (sourced from items.json,
//      affixes rolled deterministically against a seed derived from the inputs).
//   2. Socket: insert a Gem from inventory into an Item's empty socket.
//
// The Imbuer is a sink. Inputs are consumed; the rare drops into the same bag
// they came from.

import affixData from '@data/affixes.json';
import itemData from '@data/items.json';
import type {
  AffixFile,
  BaseItem,
  Gem,
  Item,
  ItemFile,
  RolledAffix,
  Slot,
} from '../types/items';
import { makeRng } from './rng';
import { rollAffixes } from './loot';

const ITEMS = itemData as ItemFile;
// Module-load smoke check — affix data must parse so a missing/typo'd id in
// the data file fails loud at boot rather than silently producing 0-affix rares.
const _AFFIXES = affixData as AffixFile;
void _AFFIXES;

// Result of a recipe attempt. `null` outputs mean the recipe rejected the
// inputs (wrong rarity, mismatched slots, no empty socket, …) — the panel
// reads the reason and shows an error toast.
export interface ImbueResult {
  readonly ok: boolean;
  readonly reason?: string;
  readonly product?: Item;
}

export interface SocketResult {
  readonly ok: boolean;
  readonly reason?: string;
  readonly item?: Item; // mutated copy with the gem placed
}

// 3 magic same-slot items → 1 rare of the same slot. The rare's base is the
// highest-ilvl base from the inputs (so imbuing 3 magic Steel Blades yields
// a rare Steel Blade, not a downgrade). Affixes are freshly rolled — the
// inputs' affixes don't carry over.
export function imbueRare(inputs: ReadonlyArray<Item>): ImbueResult {
  if (inputs.length !== 3) {
    return { ok: false, reason: 'Imbuing requires exactly 3 items.' };
  }
  if (inputs.some((it) => it.rarity !== 'magic')) {
    return { ok: false, reason: 'All 3 items must be magic.' };
  }
  if (inputs.some((it) => it.gem)) {
    return { ok: false, reason: 'Gems cannot be imbued.' };
  }
  const slot: Slot = inputs[0]!.slot;
  if (inputs.some((it) => it.slot !== slot)) {
    return { ok: false, reason: 'All 3 items must share a slot.' };
  }

  // Resolve the highest-ilvl base from the inputs (each input's baseId is a
  // pointer into items.json). If a base id has been retired we fall back to
  // the highest ilvl base in the slot.
  const candidateBases = inputs
    .map((it) => ITEMS.bases.find((b) => b.id === it.baseId))
    .filter((b): b is BaseItem => Boolean(b));
  const base =
    candidateBases.sort((a, b) => b.ilvl - a.ilvl)[0] ??
    [...ITEMS.bases]
      .filter((b) => b.slot === slot)
      .sort((a, b) => b.ilvl - a.ilvl)[0];
  if (!base) {
    return { ok: false, reason: `No base item found for slot ${slot}.` };
  }

  // Deterministic seed: sort uids so order-of-selection doesn't matter.
  const seed = `imbue-${[...inputs.map((i) => i.uid)].sort().join('|')}`;
  const rng = makeRng(seed);
  const affixes = rollAffixes(rng, base, 'rare');

  const name = composeImbuedName(base, affixes);

  const product: Item = {
    uid: `item-imbue-${seed}-${rng.int(1_000_000)}`,
    baseId: base.id,
    name,
    rarity: 'rare',
    slot: base.slot,
    ilvl: base.ilvl,
    affixes,
    ...(base.baseDamage !== undefined ? { baseDamage: base.baseDamage } : {}),
    ...(base.baseArmor !== undefined ? { baseArmor: base.baseArmor } : {}),
  };

  return { ok: true, product };
}

// Place a gem into an Item's empty socket. Returns a new Item reference with
// the socket filled. `socketIx` is optional — if omitted, the first empty
// socket is used.
export function socketGem(item: Item, gem: Gem, socketIx?: number): SocketResult {
  if (!item.sockets || item.sockets.length === 0) {
    return { ok: false, reason: 'This item has no sockets.' };
  }
  const ix =
    socketIx !== undefined
      ? socketIx
      : item.sockets.findIndex((g) => g === null);
  if (ix < 0 || ix >= item.sockets.length) {
    return { ok: false, reason: 'No empty socket.' };
  }
  if (item.sockets[ix] !== null) {
    return { ok: false, reason: 'Socket is already filled.' };
  }
  // Mutate the array in place — `sockets` is intentionally mutable on Item
  // so socketing doesn't require re-rolling the rest of the gear.
  const newSockets = [...item.sockets];
  newSockets[ix] = gem;
  const updated: Item = { ...item, sockets: newSockets };
  return { ok: true, item: updated };
}

function composeImbuedName(base: BaseItem, affixes: ReadonlyArray<RolledAffix>): string {
  const prefix = affixes.find((a) => a.kind === 'prefix');
  const suffix = affixes.find((a) => a.kind === 'suffix');
  let name = base.name;
  if (prefix) name = `${prefix.name} ${name}`;
  if (suffix) name = `${name} ${suffix.name}`;
  return name;
}
