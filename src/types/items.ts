// Item, affix, and rarity types. JSON in data/ mirrors these shapes 1:1.
//
// Discriminated unions on `ItemMod['type']` mean every consumer
// (loot roller, inventory recalc, tooltip) gets exhaustive switches —
// adding a new mod type fails the typecheck on every site that doesn't
// handle it.

export const RARITIES = ['common', 'magic', 'rare', 'unique', 'mythic'] as const;
export type Rarity = (typeof RARITIES)[number];

export const RARITY_COLOR: Record<Rarity, number> = {
  common: 0xc8c2af,
  magic: 0x6e8fc9,
  rare: 0xc7b27a,
  unique: 0xb88a3a,
  mythic: 0xb84a3a,
};

export const SLOTS = ['weapon', 'head', 'chest', 'ring'] as const;
export type Slot = (typeof SLOTS)[number];

// Modifiers an affix can grant. Add a new variant → every switch lights up red.
export type ItemMod =
  | { type: 'atk_flat'; min: number; max: number }
  | { type: 'hp_flat'; min: number; max: number };

export type ItemModType = ItemMod['type'];

// Authored affix from data/affixes.json.
export interface AffixDef {
  readonly id: string;
  readonly name: string;
  readonly kind: 'prefix' | 'suffix';
  readonly slots: ReadonlyArray<Slot>;
  readonly tier: number; // 1..5; needs ilvl >= tier*5
  readonly mod: ItemMod;
}

// A rolled affix instance — `value` is sampled from `mod.min..mod.max`.
export interface RolledAffix {
  readonly id: string;
  readonly name: string;
  readonly kind: 'prefix' | 'suffix';
  readonly modType: ItemModType;
  readonly value: number;
}

// Authored base item from data/items.json.
export interface BaseItem {
  readonly id: string;
  readonly name: string;
  readonly slot: Slot;
  readonly ilvl: number;
  readonly baseDamage?: number;
  readonly baseArmor?: number;
}

// A rolled, persistable item instance.
export interface Item {
  readonly uid: string;
  readonly baseId: string;
  readonly name: string; // composed: "Sharp Iron Sword of the Bear"
  readonly rarity: Rarity;
  readonly slot: Slot;
  readonly ilvl: number;
  readonly baseDamage?: number;
  readonly baseArmor?: number;
  readonly affixes: ReadonlyArray<RolledAffix>;
}

// JSON file shapes — match data/affixes.json + data/items.json exactly.
export interface AffixFile {
  readonly prefixes: ReadonlyArray<AffixDef>;
  readonly suffixes: ReadonlyArray<AffixDef>;
}

export interface ItemFile {
  readonly bases: ReadonlyArray<BaseItem>;
}
