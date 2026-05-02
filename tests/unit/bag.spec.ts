// Inventory grid (bag) tests — placement, removal, occupancy.

import { describe, expect, it } from 'vitest';
import {
  makeInventory,
  addItem,
  removeItem,
  hasRoomFor,
  isEmpty,
  INV_W,
  INV_H,
} from '../../src/systems/bag';
import type { Item } from '../../src/types/items';

function fakeItem(uid: string): Item {
  return {
    uid,
    baseId: 'rusty-dagger',
    name: 'Rusty Dagger',
    rarity: 'common',
    slot: 'weapon',
    ilvl: 1,
    baseDamage: 5,
    affixes: [],
  };
}

describe('bag', () => {
  it('starts empty', () => {
    const inv = makeInventory();
    expect(inv.w).toBe(INV_W);
    expect(inv.h).toBe(INV_H);
    expect(inv.slots).toHaveLength(0);
    expect(isEmpty(inv)).toBe(true);
  });

  it('places the first item at (0,0)', () => {
    const inv = makeInventory();
    const slot = addItem(inv, fakeItem('a'));
    expect(slot).not.toBeNull();
    expect(slot!.x).toBe(0);
    expect(slot!.y).toBe(0);
    expect(slot!.w).toBe(1);
    expect(slot!.h).toBe(1);
  });

  it('packs row-major into adjacent free cells', () => {
    const inv = makeInventory();
    addItem(inv, fakeItem('a'));
    const second = addItem(inv, fakeItem('b'));
    expect(second!.x).toBe(1);
    expect(second!.y).toBe(0);
  });

  it('rejects an add when the grid is full', () => {
    const inv = makeInventory();
    const cap = INV_W * INV_H;
    for (let i = 0; i < cap; i++) {
      const r = addItem(inv, fakeItem(`u${i}`));
      expect(r).not.toBeNull();
    }
    expect(hasRoomFor(inv, fakeItem('overflow'))).toBe(false);
    expect(addItem(inv, fakeItem('overflow'))).toBeNull();
    expect(inv.slots).toHaveLength(cap);
  });

  it('removes by uid and frees the cell', () => {
    const inv = makeInventory();
    addItem(inv, fakeItem('a'));
    addItem(inv, fakeItem('b'));
    const removed = removeItem(inv, 'a');
    expect(removed).toBeDefined();
    expect(removed!.item.uid).toBe('a');
    expect(inv.slots).toHaveLength(1);
    // Re-add and verify it lands in the freed (0,0) cell.
    const c = addItem(inv, fakeItem('c'));
    expect(c!.x).toBe(0);
    expect(c!.y).toBe(0);
  });

  it('returns undefined when removing an unknown uid', () => {
    const inv = makeInventory();
    expect(removeItem(inv, 'ghost')).toBeUndefined();
  });

  it('hasRoomFor flips false at exact capacity and true after a remove', () => {
    const inv = makeInventory();
    const cap = INV_W * INV_H;
    for (let i = 0; i < cap; i++) addItem(inv, fakeItem(`u${i}`));
    expect(hasRoomFor(inv, fakeItem('x'))).toBe(false);
    removeItem(inv, 'u5');
    expect(hasRoomFor(inv, fakeItem('x'))).toBe(true);
  });
});
