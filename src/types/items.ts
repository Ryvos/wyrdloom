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
// v0.8.0 adds `armor_flat` — used by Emerald gems (no affix in data/affixes.json
// uses it yet; that gap is fine — affix data is authored, gems are computed).
export type ItemMod =
  | { type: 'atk_flat'; min: number; max: number }
  | { type: 'hp_flat'; min: number; max: number }
  | { type: 'armor_flat'; min: number; max: number };

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
//
// `sockets` is mutable on purpose — slotting a gem replaces a `null` entry
// with a Gem. Length of the array == socket count baked at roll time.
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
  readonly unique?: { readonly id: string; readonly flavor: string };
  sockets?: Array<Gem | null>;
  // When set, this Item is a bag-only wrapper for a loose Gem awaiting
  // socketing. `affixes` is empty, base damage/armor are absent, and
  // equip flow refuses it. Slot is a placeholder ('ring' is conventional).
  readonly gem?: Gem;
  // When set, this Item is a bag-only Echo sigil. Consumed at the
  // Wyrdkeeper to enter the Echo at the given tier (v0.10.0+).
  // Like `gem`, `affixes` is empty and the slot is a placeholder.
  readonly sigil?: { readonly tier: number };
}

// Gems — slot into items' empty sockets, grant a flat stat. v0.8.0 ships:
//   5 kinds × 5 quality tiers = 25 gems.
//   Quality scales the granted stat; kind picks the modType.
//
// Gems are also bag items (`asBagItem`) so they can be picked up and stored
// before being socketed. Inventory holds them as Items with `gem: GemRef`
// and no affixes (treated as bag-only).

export const GEM_KINDS = ['ruby', 'sapphire', 'emerald', 'topaz', 'diamond'] as const;
export type GemKind = (typeof GEM_KINDS)[number];

export const GEM_QUALITIES = ['chipped', 'flawed', 'normal', 'flawless', 'perfect'] as const;
export type GemQuality = (typeof GEM_QUALITIES)[number];

export interface GemDef {
  readonly id: string;       // e.g. 'ruby-flawless'
  readonly kind: GemKind;
  readonly quality: GemQuality;
  readonly name: string;     // "Flawless Ruby"
  readonly modType: ItemModType;
  readonly value: number;    // flat amount granted when socketed
}

// A persistable gem instance. Lives in inventory before socketing; lives
// inside `Item.sockets` after.
export interface Gem {
  readonly uid: string;
  readonly defId: string;    // FK to GemDef.id
  readonly kind: GemKind;
  readonly quality: GemQuality;
  readonly name: string;
  readonly modType: ItemModType;
  readonly value: number;
}

// Unique-tier item definition. Fixed affixes (deterministic values, no
// min/max roll). Optionally adds bonus sockets above the base.
export interface UniqueDef {
  readonly id: string;
  readonly name: string;
  readonly baseId: string;
  readonly ilvl: number;
  readonly flavor: string;          // shown in tooltip in italic
  readonly fixedAffixes: ReadonlyArray<{
    readonly modType: ItemModType;
    readonly value: number;
    readonly affixId: string;       // human-readable id, e.g. 'unique-cleave-rage'
    readonly affixName: string;     // tooltip line
  }>;
  readonly bonusSockets?: number;   // overrides socket count when present
}

// JSON file shapes — match data/affixes.json + data/items.json exactly.
export interface AffixFile {
  readonly prefixes: ReadonlyArray<AffixDef>;
  readonly suffixes: ReadonlyArray<AffixDef>;
}

export interface ItemFile {
  readonly bases: ReadonlyArray<BaseItem>;
}

export interface GemFile {
  readonly gems: ReadonlyArray<GemDef>;
}

export interface UniqueFile {
  readonly uniques: ReadonlyArray<UniqueDef>;
}

// Mythic-tier item definition. Same shape as UniqueDef — fixed affixes,
// flavor, baked sockets. v0.10.0 ships 5 entries in data/mythics.json,
// dropped exclusively by the Pinnacle (spec §4.7).
export interface MythicFile {
  readonly mythics: ReadonlyArray<UniqueDef>;
}
