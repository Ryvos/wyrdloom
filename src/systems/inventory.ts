// Equipped-gear management + stat recalc. Pure functions.
// Player keeps a `Partial<Record<Slot, Item>>`; equipping replaces the
// slot's previous item (returned to caller, who may put it on the ground).

import type { Item, Slot } from '../types/items';

export type Equipment = Partial<Record<Slot, Item>>;

export interface DerivedStats {
  readonly atk: number;
  readonly maxHp: number;
  readonly armor: number;
}

// Compute total derived stats from base + every equipped item.
// Pure — caller passes baseAtk/maxHp; this returns the total.
export function computeDerivedStats(
  baseAtk: number,
  baseMaxHp: number,
  equipment: Equipment,
): DerivedStats {
  let atk = baseAtk;
  let maxHp = baseMaxHp;
  let armor = 0;
  for (const item of Object.values(equipment)) {
    if (!item) continue;
    if (item.baseDamage) atk += item.baseDamage;
    if (item.baseArmor) armor += item.baseArmor;
    for (const aff of item.affixes) {
      switch (aff.modType) {
        case 'atk_flat':
          atk += aff.value;
          break;
        case 'hp_flat':
          maxHp += aff.value;
          break;
        // Add new modType cases here. The switch is exhaustive against
        // ItemMod['type'] — TS will error if a new variant is missed.
      }
    }
  }
  return { atk, maxHp, armor };
}

// Equip an item; returns the previously-equipped item in that slot (if any).
export function equip(equipment: Equipment, item: Item): Item | undefined {
  const prev = equipment[item.slot];
  equipment[item.slot] = item;
  return prev;
}

export function unequip(equipment: Equipment, slot: Slot): Item | undefined {
  const prev = equipment[slot];
  delete equipment[slot];
  return prev;
}
