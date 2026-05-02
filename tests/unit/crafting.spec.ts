import { describe, it, expect } from 'vitest';
import { imbueRare, socketGem } from '../../src/systems/crafting';
import type { Gem, Item } from '../../src/types/items';

function magicItem(uid: string, slot: Item['slot'], baseId: string, ilvl = 5): Item {
  return {
    uid,
    baseId,
    name: `Magic ${baseId}`,
    rarity: 'magic',
    slot,
    ilvl,
    affixes: [],
    ...(slot === 'weapon' ? { baseDamage: 8 } : {}),
    ...(slot !== 'weapon' && slot !== 'ring' ? { baseArmor: 3 } : {}),
  };
}

function ruby(): Gem {
  return {
    uid: 'gem-1',
    defId: 'ruby-normal',
    kind: 'ruby',
    quality: 'normal',
    name: 'Ruby',
    modType: 'atk_flat',
    value: 8,
  };
}

describe('imbueRare', () => {
  it('rejects non-3 inputs', () => {
    expect(imbueRare([]).ok).toBe(false);
    expect(imbueRare([magicItem('a', 'weapon', 'iron-sword')]).ok).toBe(false);
  });

  it('rejects when any input is not magic', () => {
    const a = magicItem('a', 'weapon', 'iron-sword');
    const b = magicItem('b', 'weapon', 'iron-sword');
    const c: Item = { ...a, uid: 'c', rarity: 'rare' };
    const r = imbueRare([a, b, c]);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/magic/i);
  });

  it('rejects when slots mismatch', () => {
    const a = magicItem('a', 'weapon', 'iron-sword');
    const b = magicItem('b', 'weapon', 'iron-sword');
    const c = magicItem('c', 'head', 'iron-helm');
    const r = imbueRare([a, b, c]);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/slot/i);
  });

  it('produces a rare on valid 3-magic same-slot input', () => {
    const a = magicItem('a', 'weapon', 'iron-sword');
    const b = magicItem('b', 'weapon', 'iron-sword');
    const c = magicItem('c', 'weapon', 'iron-sword');
    const r = imbueRare([a, b, c]);
    expect(r.ok).toBe(true);
    expect(r.product?.rarity).toBe('rare');
    expect(r.product?.slot).toBe('weapon');
    expect(r.product?.affixes.length).toBeGreaterThanOrEqual(2);
  });

  it('result is deterministic for the same set of input uids', () => {
    const items = [
      magicItem('det-a', 'weapon', 'iron-sword'),
      magicItem('det-b', 'weapon', 'iron-sword'),
      magicItem('det-c', 'weapon', 'iron-sword'),
    ];
    const a = imbueRare(items);
    const b = imbueRare(items);
    expect(a.product?.uid).toBe(b.product?.uid);
    expect(a.product?.affixes).toEqual(b.product?.affixes);
  });

  it('selects the highest-ilvl base from the inputs', () => {
    // Steel Blade ilvl 10 should win over Iron Sword ilvl 5.
    const a = magicItem('a', 'weapon', 'iron-sword', 5);
    const b = magicItem('b', 'weapon', 'iron-sword', 5);
    const c = magicItem('c', 'weapon', 'steel-blade', 10);
    const r = imbueRare([a, b, c]);
    expect(r.ok).toBe(true);
    expect(r.product?.baseId).toBe('steel-blade');
    expect(r.product?.ilvl).toBe(10);
  });
});

describe('socketGem', () => {
  it('rejects items with no sockets', () => {
    const item = magicItem('a', 'weapon', 'iron-sword');
    const r = socketGem(item, ruby());
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/socket/i);
  });

  it('places gem in first empty socket', () => {
    const item: Item = { ...magicItem('a', 'weapon', 'iron-sword'), sockets: [null, null] };
    const r = socketGem(item, ruby());
    expect(r.ok).toBe(true);
    expect(r.item?.sockets?.[0]?.kind).toBe('ruby');
    expect(r.item?.sockets?.[1]).toBe(null);
  });

  it('rejects when target socket is already filled', () => {
    const item: Item = { ...magicItem('a', 'weapon', 'iron-sword'), sockets: [ruby(), null] };
    const r = socketGem(item, ruby(), 0);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/already/i);
  });

  it('respects an explicit socket index', () => {
    const item: Item = {
      ...magicItem('a', 'weapon', 'iron-sword'),
      sockets: [null, null, null],
    };
    const r = socketGem(item, ruby(), 2);
    expect(r.ok).toBe(true);
    expect(r.item?.sockets?.[2]?.kind).toBe('ruby');
    expect(r.item?.sockets?.[0]).toBe(null);
  });

  it('returns a new item reference (does not mutate the original)', () => {
    const item: Item = { ...magicItem('a', 'weapon', 'iron-sword'), sockets: [null] };
    const before = item.sockets!.slice();
    const r = socketGem(item, ruby());
    expect(r.ok).toBe(true);
    // Original unchanged.
    expect(item.sockets).toEqual(before);
    // New item has the gem.
    expect(r.item?.sockets?.[0]?.kind).toBe('ruby');
  });
});
