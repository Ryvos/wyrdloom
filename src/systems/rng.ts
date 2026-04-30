// Deterministic PRNG wrapper. `seedrandom` (xorshift128, MIT) gives us a
// reproducible sequence so loot rolls + dungeon layouts can replay from a
// saved seed.

import seedrandom from 'seedrandom';

export interface Rng {
  next(): number; // [0, 1)
  int(maxExcl: number): number;
  range(minIncl: number, maxIncl: number): number;
  pick<T>(arr: ReadonlyArray<T>): T;
}

export function makeRng(seed: string | number): Rng {
  const s = typeof seed === 'number' ? String(seed) : seed;
  const gen = seedrandom(s);
  return {
    next: () => gen(),
    int(maxExcl) {
      return Math.floor(gen() * maxExcl);
    },
    range(minIncl, maxIncl) {
      return Math.floor(gen() * (maxIncl - minIncl + 1)) + minIncl;
    },
    pick(arr) {
      if (arr.length === 0) throw new Error('pick() on empty array');
      const ix = Math.floor(gen() * arr.length);
      const v = arr[ix];
      // arr.length > 0 + 0 <= ix < arr.length means v is defined.
      if (v === undefined) throw new Error('pick: undefined element');
      return v;
    },
  };
}

// Weighted pick: picks an entry by its weight; weights need not sum to 1.
export function weightedPick<T>(rng: Rng, entries: ReadonlyArray<readonly [T, number]>): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  if (total <= 0) throw new Error('weightedPick: total weight must be > 0');
  let r = rng.next() * total;
  for (const [val, w] of entries) {
    r -= w;
    if (r <= 0) return val;
  }
  // Floating-point drift — fall through to last.
  const last = entries[entries.length - 1];
  if (!last) throw new Error('weightedPick: empty entries');
  return last[0];
}
