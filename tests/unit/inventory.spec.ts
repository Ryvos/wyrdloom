import { describe, it, expect } from 'vitest';
import { computeDerivedStats, equip, unequip } from '../../src/systems/inventory';
import type { Item } from '../../src/types/items';

const sword: Item = {
  uid: 'i-1',
  baseId: 'iron-sword',
  name: 'Sharp Iron Sword of Malice',
  rarity: 'magic',
  slot: 'weapon',
  ilvl: 5,
  baseDamage: 10,
  affixes: [
    { id: 'sharp', name: 'Sharp', kind: 'prefix', modType: 'atk_flat', value: 4 },
    { id: 'of-malice', name: 'of Malice', kind: 'suffix', modType: 'atk_flat', value: 2 },
  ],
};

const helm: Item = {
  uid: 'i-2',
  baseId: 'iron-helm',
  name: 'Sturdy Iron Helm',
  rarity: 'magic',
  slot: 'head',
  ilvl: 5,
  baseArmor: 5,
  affixes: [{ id: 'sturdy', name: 'Sturdy', kind: 'prefix', modType: 'hp_flat', value: 8 }],
};

describe('inventory', () => {
  it('computeDerivedStats with no equipment returns base values', () => {
    const stats = computeDerivedStats(25, 100, {});
    expect(stats).toEqual({ atk: 25, maxHp: 100, armor: 0 });
  });

  it('weapon adds baseDamage + atk_flat affixes to atk', () => {
    const stats = computeDerivedStats(25, 100, { weapon: sword });
    expect(stats.atk).toBe(25 + 10 + 4 + 2); // 41
  });

  it('helm adds baseArmor + hp_flat affixes to maxHp', () => {
    const stats = computeDerivedStats(25, 100, { head: helm });
    expect(stats.armor).toBe(5);
    expect(stats.maxHp).toBe(108);
  });

  it('equip replaces previous slot occupant and returns it', () => {
    const eq = {};
    expect(equip(eq, sword)).toBeUndefined();
    const replaced = equip(eq, { ...sword, uid: 'i-3', name: 'Sharper Sword' });
    expect(replaced?.uid).toBe('i-1');
  });

  it('unequip removes and returns', () => {
    const eq = { weapon: sword };
    const removed = unequip(eq, 'weapon');
    expect(removed?.uid).toBe('i-1');
    expect(eq.weapon).toBeUndefined();
  });

  it('full equipment stacks all sources', () => {
    const stats = computeDerivedStats(25, 100, { weapon: sword, head: helm });
    expect(stats.atk).toBe(41);
    expect(stats.maxHp).toBe(108);
    expect(stats.armor).toBe(5);
  });
});
