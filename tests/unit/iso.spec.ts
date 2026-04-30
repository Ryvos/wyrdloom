import { describe, it, expect } from 'vitest';
import {
  TILE_W,
  TILE_H,
  tileToScreen,
  screenToTile,
  roundTile,
  tileDistance,
  depthFor,
} from '../../src/engine/iso';

describe('iso math', () => {
  it('tileToScreen origin', () => {
    expect(tileToScreen(0, 0)).toEqual({ sx: 0, sy: 0 });
  });

  it('tileToScreen +tx is south-east, +ty is south-west', () => {
    expect(tileToScreen(1, 0)).toEqual({ sx: TILE_W / 2, sy: TILE_H / 2 });
    expect(tileToScreen(0, 1)).toEqual({ sx: -TILE_W / 2, sy: TILE_H / 2 });
  });

  it('tileToScreen / screenToTile round-trip on integer tiles', () => {
    for (let tx = -10; tx <= 10; tx++) {
      for (let ty = -10; ty <= 10; ty++) {
        const { sx, sy } = tileToScreen(tx, ty);
        const back = roundTile(...Object.values(screenToTile(sx, sy)) as [number, number]);
        expect(back).toEqual({ tx, ty });
      }
    }
  });

  it('depthFor sorts south-of-something on top', () => {
    // (5, 5) is north of (5, 6) — south tile draws on top
    expect(depthFor(5, 6)).toBeGreaterThan(depthFor(5, 5));
    expect(depthFor(6, 5)).toBeGreaterThan(depthFor(5, 5));
  });

  it('tileDistance is Manhattan', () => {
    expect(tileDistance({ tx: 0, ty: 0 }, { tx: 3, ty: 4 })).toBe(7);
    expect(tileDistance({ tx: 2, ty: 2 }, { tx: 2, ty: 2 })).toBe(0);
  });
});
