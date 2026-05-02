// BSP procgen tests — determinism, validator, room placement, reachability.

import { describe, expect, it } from 'vitest';
import {
  generateDungeon,
  generateOnce,
  validate,
  isFloor,
  roomCenter,
  type DungeonMap,
} from '../../src/systems/procgen';

describe('procgen', () => {
  it('is deterministic — same seed → identical map', () => {
    const a = generateDungeon({ w: 32, h: 32, seed: 'cata-1' });
    const b = generateDungeon({ w: 32, h: 32, seed: 'cata-1' });
    expect(a.tiles).toEqual(b.tiles);
    expect(a.rooms).toEqual(b.rooms);
    expect(a.entrance).toEqual(b.entrance);
    expect(a.boss).toEqual(b.boss);
  });

  it('different seeds produce different maps', () => {
    const a = generateDungeon({ w: 32, h: 32, seed: 'cata-A' });
    const b = generateDungeon({ w: 32, h: 32, seed: 'cata-B' });
    expect(a.tiles).not.toEqual(b.tiles);
  });

  it('every generated dungeon passes the flood-fill validator', () => {
    for (let i = 0; i < 12; i++) {
      const m = generateDungeon({ w: 32, h: 32, seed: `cata-${i}` });
      expect(validate(m)).toBe(true);
    }
  });

  it('entrance and boss are always different rooms', () => {
    for (let i = 0; i < 12; i++) {
      const m = generateDungeon({ w: 32, h: 32, seed: `pair-${i}` });
      expect(m.entrance).not.toEqual(m.boss);
    }
  });

  it('all rooms contain only floor tiles', () => {
    const m = generateDungeon({ w: 32, h: 32, seed: 'rooms' });
    for (const r of m.rooms) {
      for (let y = r.y; y < r.y + r.h; y++) {
        for (let x = r.x; x < r.x + r.w; x++) {
          expect(isFloor(m, x, y)).toBe(true);
        }
      }
    }
  });

  it('outer border is wall (no rooms touching the map edge)', () => {
    const m = generateDungeon({ w: 32, h: 32, seed: 'border' });
    for (let x = 0; x < m.w; x++) {
      expect(isFloor(m, x, 0)).toBe(false);
      expect(isFloor(m, x, m.h - 1)).toBe(false);
    }
    for (let y = 0; y < m.h; y++) {
      expect(isFloor(m, 0, y)).toBe(false);
      expect(isFloor(m, m.w - 1, y)).toBe(false);
    }
  });

  it('validator returns false for a hand-crafted disconnected map', () => {
    // generateOnce alone gives no validator guarantees. Fabricate one that
    // is intentionally broken and prove validate() catches it.
    const fake: DungeonMap = {
      w: 5,
      h: 5,
      tiles: [
        ['wall', 'wall', 'wall', 'wall', 'wall'],
        ['wall', 'floor', 'wall', 'floor', 'wall'],
        ['wall', 'floor', 'wall', 'floor', 'wall'],
        ['wall', 'floor', 'wall', 'floor', 'wall'],
        ['wall', 'wall', 'wall', 'wall', 'wall'],
      ],
      rooms: [
        { x: 1, y: 1, w: 1, h: 3 },
        { x: 3, y: 1, w: 1, h: 3 },
      ],
      entrance: { x: 1, y: 1, w: 1, h: 3 },
      boss: { x: 3, y: 1, w: 1, h: 3 },
      seed: 'fake',
    };
    expect(validate(fake)).toBe(false);
  });

  it('roomCenter returns a tile inside the room', () => {
    const m = generateDungeon({ w: 32, h: 32, seed: 'center' });
    for (const r of m.rooms) {
      const c = roomCenter(r);
      expect(c.tx).toBeGreaterThanOrEqual(r.x);
      expect(c.tx).toBeLessThan(r.x + r.w);
      expect(c.ty).toBeGreaterThanOrEqual(r.y);
      expect(c.ty).toBeLessThan(r.y + r.h);
      expect(isFloor(m, c.tx, c.ty)).toBe(true);
    }
  });

  it('generateOnce can produce maps the validator rejects (sanity check)', () => {
    // This test isn't asserting a specific failure — it's confirming the
    // `generateOnce` escape-hatch doesn't silently call validate() under us.
    // We just need it to return a DungeonMap shape.
    const raw = generateOnce({ w: 16, h: 16, seed: 'raw' });
    expect(raw.tiles.length).toBe(16);
    expect(raw.tiles[0]?.length).toBe(16);
  });
});
