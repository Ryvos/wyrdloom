// Loot roller. Pure functions — Vitest covers determinism (same seed → same roll).
// The drop pipeline:
//   1. roll a chance against monster's drop rate
//   2. pick a rarity (weighted) — or force 'unique' for act-bosses
//   3. unique → pick from data/uniques.json (filtered by ilvl ≤ monsterLevel)
//      else → pick a base item, roll affixes per rarity rules, roll sockets
//   4. compose name + return Item instance
//
// v0.8.0 additions:
//   - 'unique' rarity rolls land on a curated entry from data/uniques.json
//   - boss kills with `guaranteed: true` always force a unique
//   - non-unique items roll a small socket count (mostly 0)
//   - rollGemDrop is a separate small-chance path for loose gem pickups

import affixData from '@data/affixes.json';
import gemData from '@data/gems.json';
import itemData from '@data/items.json';
import uniqueData from '@data/uniques.json';
import type {
  AffixDef,
  AffixFile,
  BaseItem,
  Gem,
  GemDef,
  GemFile,
  Item,
  ItemFile,
  Rarity,
  RolledAffix,
  Slot,
  UniqueDef,
  UniqueFile,
} from '../types/items';
import { makeRng, weightedPick } from './rng';
import type { Rng } from './rng';

const AFFIXES = affixData as AffixFile;
const ITEMS = itemData as ItemFile;
const GEMS = gemData as GemFile;
const UNIQUES = uniqueData as UniqueFile;

// Drop chance + rarity weights. v0.8.0 reintroduces 'unique' at a low weight
// so it can occasionally roll off any monster — but the bulk of uniques come
// from act-boss `guaranteed` drops which force the rarity directly.
const DROP_CHANCE = 0.8;
const GEM_DROP_CHANCE = 0.05; // independent path; rolled per kill

const RARITY_WEIGHTS: ReadonlyArray<readonly [Rarity, number]> = [
  ['common', 50],
  ['magic', 35],
  ['rare', 12],
  ['unique', 3],
  // mythic stays deferred — see ADR 0002 lineage; targeted for v0.10.0.
];

const AFFIX_COUNT_BY_RARITY: Record<Rarity, { prefix: [number, number]; suffix: [number, number] }> = {
  common: { prefix: [0, 0], suffix: [0, 0] },
  magic: { prefix: [1, 1], suffix: [0, 1] },
  rare: { prefix: [1, 2], suffix: [1, 2] },
  unique: { prefix: [0, 0], suffix: [0, 0] }, // uniques use fixedAffixes, not rolled
  mythic: { prefix: [2, 3], suffix: [2, 3] },
};

// Socket-count weights for non-unique items. Sockets are scarce by design —
// they're the gem-economy bottleneck. Uniques sidestep this and use bonusSockets.
const SOCKET_WEIGHTS_BY_RARITY: Record<Rarity, ReadonlyArray<readonly [number, number]>> = {
  common: [
    [0, 90],
    [1, 10],
  ],
  magic: [
    [0, 70],
    [1, 25],
    [2, 5],
  ],
  rare: [
    [0, 45],
    [1, 35],
    [2, 17],
    [3, 3],
  ],
  unique: [[0, 1]], // unused — uniques set sockets directly from bonusSockets
  mythic: [[0, 1]], // unused
};

export interface DropContext {
  readonly monsterLevel: number;
  readonly seed: string;
  // Per spec §4.4: Act-final bosses always drop. Set to true for the Hollow
  // Bishop / Worm-Mother / Pact-Bearer kills; the chance roll is skipped AND
  // rarity is forced to 'unique' (guaranteed unique on act-boss kill).
  readonly guaranteed?: boolean;
}

// Returns null if no drop. Otherwise an Item instance with composed name + rolled affixes.
// v0.8.0: Item may be a unique (fixed affixes from data/uniques.json) when rarity hits.
export function rollDrop(ctx: DropContext): Item | null {
  const rng = makeRng(ctx.seed);

  if (!ctx.guaranteed && rng.next() > DROP_CHANCE) return null;

  const rarity: Rarity = ctx.guaranteed ? 'unique' : weightedPick(rng, RARITY_WEIGHTS);

  if (rarity === 'unique') {
    const uniq = rollUniqueItem(rng, ctx);
    if (uniq) return uniq;
    // No unique fits the monster level → fall back to rare so the player still
    // sees a drop. Happens at very low monsterLevel only if uniques all gate higher.
  }

  const fallbackRarity: Rarity = rarity === 'unique' ? 'rare' : rarity;
  const base = pickBase(rng, ctx.monsterLevel);
  if (!base) return null;

  const affixes = rollAffixes(rng, base, fallbackRarity);
  const name = composeName(base, affixes);
  const socketCount = rollSocketCount(rng, fallbackRarity);

  const item: Item = {
    uid: `item-${ctx.seed}-${rng.int(1_000_000)}`,
    baseId: base.id,
    name,
    rarity: fallbackRarity,
    slot: base.slot,
    ilvl: base.ilvl,
    affixes,
    ...(base.baseDamage !== undefined ? { baseDamage: base.baseDamage } : {}),
    ...(base.baseArmor !== undefined ? { baseArmor: base.baseArmor } : {}),
    ...(socketCount > 0 ? { sockets: new Array<Gem | null>(socketCount).fill(null) } : {}),
  };
  return item;
}

// Roll a loose gem as a ground-droppable Item. Returns null most of the time;
// kept separate from rollDrop so callers can let a single kill drop both gear
// AND a gem (Diablo-style mixed loot).
export function rollGemDrop(ctx: DropContext): Item | null {
  const rng = makeRng(`${ctx.seed}-gem`);
  if (rng.next() > GEM_DROP_CHANCE) return null;

  const def = pickGemDef(rng, ctx.monsterLevel);
  if (!def) return null;

  const gem: Gem = {
    uid: `gem-${ctx.seed}-${rng.int(1_000_000)}`,
    defId: def.id,
    kind: def.kind,
    quality: def.quality,
    name: def.name,
    modType: def.modType,
    value: def.value,
  };

  // Wrap the gem in an Item so it can ride the existing ground-spawn / pickup
  // pipeline. Slot is a placeholder; equip flow gates on `gem` being set.
  const item: Item = {
    uid: `item-${ctx.seed}-gem-${rng.int(1_000_000)}`,
    baseId: 'gem',
    name: def.name,
    rarity: 'magic',
    slot: 'ring',
    ilvl: 1,
    affixes: [],
    gem,
  };
  return item;
}

function rollUniqueItem(rng: Rng, ctx: DropContext): Item | null {
  const eligible = UNIQUES.uniques.filter((u) => u.ilvl <= ctx.monsterLevel);
  if (eligible.length === 0) return null;

  // Same shape as pickBase: bias toward closest-ilvl uniques so low-level
  // monsters tend to drop low-level uniques.
  const weighted: Array<readonly [UniqueDef, number]> = eligible.map((u) => {
    const gap = ctx.monsterLevel - u.ilvl;
    return [u, 1 / (1 + gap)];
  });
  const def = weightedPick(rng, weighted);
  const base = ITEMS.bases.find((b) => b.id === def.baseId);
  if (!base) return null;

  const affixes: RolledAffix[] = def.fixedAffixes.map((fa, ix) => ({
    id: fa.affixId,
    name: fa.affixName,
    // Uniques don't have prefix/suffix semantics — name-composition is the
    // unique's own name. Tag the first affix prefix and the rest suffix so
    // existing readers that filter on `kind` still see something sensible.
    kind: ix === 0 ? 'prefix' : 'suffix',
    modType: fa.modType,
    value: fa.value,
  }));

  const socketCount = def.bonusSockets ?? 0;

  const item: Item = {
    uid: `item-${ctx.seed}-${rng.int(1_000_000)}`,
    baseId: base.id,
    name: def.name,
    rarity: 'unique',
    slot: base.slot,
    ilvl: def.ilvl,
    affixes,
    unique: { id: def.id, flavor: def.flavor },
    ...(base.baseDamage !== undefined ? { baseDamage: base.baseDamage } : {}),
    ...(base.baseArmor !== undefined ? { baseArmor: base.baseArmor } : {}),
    ...(socketCount > 0 ? { sockets: new Array<Gem | null>(socketCount).fill(null) } : {}),
  };
  return item;
}

function pickBase(rng: Rng, monsterLevel: number): BaseItem | null {
  // Eligible bases: ilvl <= monsterLevel. Slight bias toward the closest ilvl.
  const eligible = ITEMS.bases.filter((b) => b.ilvl <= monsterLevel);
  if (eligible.length === 0) return null;
  // Weight inversely by gap to monster level — closer ilvl = more likely.
  const weighted: Array<readonly [BaseItem, number]> = eligible.map((b) => {
    const gap = monsterLevel - b.ilvl;
    return [b, 1 / (1 + gap)];
  });
  return weightedPick(rng, weighted);
}

function pickGemDef(rng: Rng, monsterLevel: number): GemDef | null {
  if (GEMS.gems.length === 0) return null;
  // Quality weights ramp by monster level. Below ilvl 5 you get chipped/flawed;
  // by ilvl 15 perfects start showing up.
  const qualityWeight: Record<string, number> = (() => {
    if (monsterLevel <= 4) return { chipped: 70, flawed: 25, normal: 5, flawless: 0, perfect: 0 };
    if (monsterLevel <= 9) return { chipped: 30, flawed: 45, normal: 20, flawless: 5, perfect: 0 };
    if (monsterLevel <= 13) return { chipped: 10, flawed: 30, normal: 40, flawless: 18, perfect: 2 };
    return { chipped: 5, flawed: 15, normal: 35, flawless: 35, perfect: 10 };
  })();
  // Topaz + Diamond are exotic — half the weight of ruby/sapphire/emerald.
  const kindWeight: Record<string, number> = {
    ruby: 2,
    sapphire: 2,
    emerald: 2,
    topaz: 1,
    diamond: 1,
  };
  const weighted: Array<readonly [GemDef, number]> = GEMS.gems.map((g) => {
    const qw = qualityWeight[g.quality] ?? 0;
    const kw = kindWeight[g.kind] ?? 1;
    return [g, qw * kw] as const;
  });
  const total = weighted.reduce((s, [, w]) => s + w, 0);
  if (total <= 0) return null;
  return weightedPick(rng, weighted);
}

function rollSocketCount(rng: Rng, rarity: Rarity): number {
  const weights = SOCKET_WEIGHTS_BY_RARITY[rarity];
  if (!weights || weights.length === 0) return 0;
  return weightedPick(rng, weights);
}

export function rollAffixes(rng: Rng, base: BaseItem, rarity: Rarity): RolledAffix[] {
  const counts = AFFIX_COUNT_BY_RARITY[rarity];
  const prefixCount = rng.range(counts.prefix[0], counts.prefix[1]);
  const suffixCount = rng.range(counts.suffix[0], counts.suffix[1]);

  const eligibleTier = Math.max(1, Math.floor(base.ilvl / 5) + 1);

  const out: RolledAffix[] = [];
  out.push(...rollFrom(rng, AFFIXES.prefixes, base.slot, eligibleTier, prefixCount));
  out.push(...rollFrom(rng, AFFIXES.suffixes, base.slot, eligibleTier, suffixCount));
  return out;
}

function rollFrom(
  rng: Rng,
  pool: ReadonlyArray<AffixDef>,
  slot: Slot,
  maxTier: number,
  count: number,
): RolledAffix[] {
  const filtered = pool.filter((a) => a.slots.includes(slot) && a.tier <= maxTier);
  const picked: AffixDef[] = [];
  // Sample without replacement.
  const work = [...filtered];
  for (let i = 0; i < count && work.length > 0; i++) {
    const ix = rng.int(work.length);
    const taken = work[ix];
    if (!taken) continue;
    picked.push(taken);
    work.splice(ix, 1);
  }
  return picked.map((a) => ({
    id: a.id,
    name: a.name,
    kind: a.kind,
    modType: a.mod.type,
    value: rng.range(a.mod.min, a.mod.max),
  }));
}

function composeName(base: BaseItem, affixes: ReadonlyArray<RolledAffix>): string {
  const prefix = affixes.find((a) => a.kind === 'prefix');
  const suffix = affixes.find((a) => a.kind === 'suffix');
  let name = base.name;
  if (prefix) name = `${prefix.name} ${name}`;
  if (suffix) name = `${name} ${suffix.name}`;
  return name;
}
