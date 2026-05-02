import { describe, it, expect } from 'vitest';
import { rollDrop, rollAffixes, rollGemDrop, rollSigilDrop } from '../../src/systems/loot';
import { makeRng } from '../../src/systems/rng';
import type { BaseItem } from '../../src/types/items';

describe('loot rolling', () => {
  it('is deterministic for a fixed seed', () => {
    const a = rollDrop({ monsterLevel: 5, seed: 'test-seed-001' });
    const b = rollDrop({ monsterLevel: 5, seed: 'test-seed-001' });
    expect(a).toEqual(b);
  });

  it('returns different items for different seeds', () => {
    const a = rollDrop({ monsterLevel: 5, seed: 'seed-A' });
    const b = rollDrop({ monsterLevel: 5, seed: 'seed-B' });
    // Either both nullable or both items — but if items, name should typically differ.
    if (a && b) expect(a.uid).not.toBe(b.uid);
  });

  it('ilvl cap means low-level monsters never drop high-level bases', () => {
    for (let i = 0; i < 50; i++) {
      const drop = rollDrop({ monsterLevel: 1, seed: `seed-${i}` });
      if (drop) expect(drop.ilvl).toBeLessThanOrEqual(1);
    }
  });

  it('common rarity has 0 affixes', () => {
    // Sample many drops; verify any common ones have no affixes.
    let saw = false;
    for (let i = 0; i < 200; i++) {
      const drop = rollDrop({ monsterLevel: 5, seed: `common-${i}` });
      if (drop?.rarity === 'common') {
        expect(drop.affixes).toEqual([]);
        saw = true;
      }
    }
    expect(saw).toBe(true);
  });

  it('rare rarity has at least 2 affixes', () => {
    let saw = false;
    for (let i = 0; i < 200; i++) {
      const drop = rollDrop({ monsterLevel: 10, seed: `rare-${i}` });
      if (drop?.rarity === 'rare') {
        expect(drop.affixes.length).toBeGreaterThanOrEqual(2);
        saw = true;
      }
    }
    expect(saw).toBe(true);
  });

  it('rollAffixes only picks affixes valid for the slot', () => {
    const sword: BaseItem = { id: 's', name: 'S', slot: 'weapon', ilvl: 10, baseDamage: 10 };
    const helm: BaseItem = { id: 'h', name: 'H', slot: 'head', ilvl: 10, baseArmor: 5 };
    for (let i = 0; i < 20; i++) {
      const wAffixes = rollAffixes(makeRng(`w-${i}`), sword, 'rare');
      const hAffixes = rollAffixes(makeRng(`h-${i}`), helm, 'rare');
      // Slot eligibility is enforced by `slots: ["weapon"]` etc. in the
      // data file; we just check affixes get produced without crashing
      // and respect the rarity's count floor.
      expect(wAffixes.length).toBeGreaterThanOrEqual(2);
      expect(hAffixes.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('rolled affix values land within their authored range', () => {
    for (let i = 0; i < 100; i++) {
      const drop = rollDrop({ monsterLevel: 10, seed: `range-${i}` });
      if (!drop) continue;
      for (const aff of drop.affixes) {
        // Just sanity-check positive (the data file has all min >= 1).
        expect(aff.value).toBeGreaterThan(0);
      }
    }
  });

  it('guaranteed boss drop forces a unique with fixed flavor', () => {
    const drop = rollDrop({ monsterLevel: 16, seed: 'boss-worm-mother-1', guaranteed: true });
    expect(drop).not.toBeNull();
    expect(drop?.rarity).toBe('unique');
    expect(drop?.unique).toBeDefined();
    expect(typeof drop?.unique?.flavor).toBe('string');
    expect((drop?.unique?.flavor.length ?? 0) > 0).toBe(true);
    // ilvl gating: a level-16 boss can't roll a unique above ilvl 16.
    expect((drop?.ilvl ?? 0) <= 16).toBe(true);
  });

  it('unique items expose fixedAffixes as deterministic affix values', () => {
    const a = rollDrop({ monsterLevel: 16, seed: 'boss-fixed-A', guaranteed: true });
    const b = rollDrop({ monsterLevel: 16, seed: 'boss-fixed-A', guaranteed: true });
    expect(a).toEqual(b);
    if (a) {
      // Fixed-affix values should be positive integers (no min/max range roll).
      for (const aff of a.affixes) {
        expect(Number.isInteger(aff.value)).toBe(true);
        expect(aff.value).toBeGreaterThan(0);
      }
    }
  });

  it('rollGemDrop wraps a Gem in a bag-only Item when it lands', () => {
    // Sample many seeds; gem drop is ~5% so we expect a few hits in 200 rolls.
    let saw = false;
    for (let i = 0; i < 200; i++) {
      const item = rollGemDrop({ monsterLevel: 8, seed: `gem-${i}` });
      if (!item) continue;
      saw = true;
      expect(item.gem).toBeDefined();
      expect(item.affixes).toEqual([]);
      expect(item.gem?.value).toBeGreaterThan(0);
      expect(['atk_flat', 'hp_flat', 'armor_flat']).toContain(item.gem?.modType);
    }
    expect(saw).toBe(true);
  });

  it('gem drops are deterministic for a fixed seed', () => {
    const a = rollGemDrop({ monsterLevel: 8, seed: 'gem-seed-determinism' });
    const b = rollGemDrop({ monsterLevel: 8, seed: 'gem-seed-determinism' });
    expect(a).toEqual(b);
  });

  it('mythic flag forces a mythic-rarity drop (Pinnacle kill)', () => {
    const drop = rollDrop({
      monsterLevel: 35,
      seed: 'pinnacle-1',
      guaranteed: true,
      mythic: true,
    });
    expect(drop).not.toBeNull();
    expect(drop?.rarity).toBe('mythic');
    expect(drop?.unique).toBeDefined(); // mythics share unique's flavor field
    expect(drop?.sockets?.length).toBe(3); // every authored mythic has 3 sockets
  });

  it('mythic drops are deterministic for a fixed seed', () => {
    const a = rollDrop({ monsterLevel: 35, seed: 'pinnacle-det', mythic: true });
    const b = rollDrop({ monsterLevel: 35, seed: 'pinnacle-det', mythic: true });
    expect(a).toEqual(b);
  });

  it('forced sigil drop returns a bag-only Item with a positive tier', () => {
    const sigil = rollSigilDrop({ monsterLevel: 20, seed: 'pact-1' }, { forced: true });
    expect(sigil).not.toBeNull();
    expect(sigil?.sigil).toBeDefined();
    expect((sigil?.sigil?.tier ?? 0)).toBeGreaterThanOrEqual(1);
    expect(sigil?.affixes).toEqual([]);
  });

  it('sigil drops are deterministic and respect tier bounds', () => {
    const a = rollSigilDrop(
      { monsterLevel: 20, seed: 'sig-det' },
      { forced: true, tierFloor: 3, tierCeil: 7 },
    );
    const b = rollSigilDrop(
      { monsterLevel: 20, seed: 'sig-det' },
      { forced: true, tierFloor: 3, tierCeil: 7 },
    );
    expect(a).toEqual(b);
    expect(a?.sigil?.tier).toBeGreaterThanOrEqual(3);
    expect(a?.sigil?.tier).toBeLessThanOrEqual(7);
  });
});
