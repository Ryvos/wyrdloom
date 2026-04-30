// Loot roller. Pure functions — Vitest covers determinism (same seed → same roll).
// The drop pipeline:
//   1. roll a chance against monster's drop rate
//   2. pick a rarity (weighted)
//   3. pick a base item eligible for monster level
//   4. roll affixes per rarity rules
//   5. compose name + return Item instance

import affixData from '@data/affixes.json';
import itemData from '@data/items.json';
import type {
  AffixDef,
  AffixFile,
  BaseItem,
  Item,
  ItemFile,
  Rarity,
  RolledAffix,
  Slot,
} from '../types/items';
import { makeRng, weightedPick } from './rng';
import type { Rng } from './rng';

const AFFIXES = affixData as AffixFile;
const ITEMS = itemData as ItemFile;

// Drop chance + rarity weights. Tuned for v0.3.0 spike — feels rewarding without
// drowning the player. Real numbers tune in v0.6.0 with the campaign-pacing pass.
const DROP_CHANCE = 0.8;

const RARITY_WEIGHTS: ReadonlyArray<readonly [Rarity, number]> = [
  ['common', 50],
  ['magic', 35],
  ['rare', 15],
  // unique + mythic are deferred — see ADR 0002 lineage; uniques arrive in v0.5.0.
];

const AFFIX_COUNT_BY_RARITY: Record<Rarity, { prefix: [number, number]; suffix: [number, number] }> = {
  common: { prefix: [0, 0], suffix: [0, 0] },
  magic: { prefix: [1, 1], suffix: [0, 1] },
  rare: { prefix: [1, 2], suffix: [1, 2] },
  unique: { prefix: [2, 3], suffix: [2, 3] }, // placeholder — unique affixes are authored in v0.5.0
  mythic: { prefix: [2, 3], suffix: [2, 3] },
};

export interface DropContext {
  readonly monsterLevel: number;
  readonly seed: string;
}

// Returns null if no drop. Otherwise an Item instance with composed name + rolled affixes.
export function rollDrop(ctx: DropContext): Item | null {
  const rng = makeRng(ctx.seed);

  if (rng.next() > DROP_CHANCE) return null;

  const rarity = weightedPick(rng, RARITY_WEIGHTS);
  const base = pickBase(rng, ctx.monsterLevel);
  if (!base) return null;

  const affixes = rollAffixes(rng, base, rarity);
  const name = composeName(base, affixes);

  const item: Item = {
    uid: `item-${ctx.seed}-${rng.int(1_000_000)}`,
    baseId: base.id,
    name,
    rarity,
    slot: base.slot,
    ilvl: base.ilvl,
    affixes,
    ...(base.baseDamage !== undefined ? { baseDamage: base.baseDamage } : {}),
    ...(base.baseArmor !== undefined ? { baseArmor: base.baseArmor } : {}),
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
