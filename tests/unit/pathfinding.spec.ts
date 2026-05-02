// A* pathfinding tests — straight line, wall navigation, blocked, identity.

import { describe, expect, it } from 'vitest';
import { findPath, type PathfindGrid } from '../../src/systems/pathfinding';

// Helper: build a grid from a string layout.
//   '.' = walkable, '#' = wall.
function makeGrid(rows: string[]): PathfindGrid {
  const w = rows[0]!.length;
  const h = rows.length;
  return {
    w,
    h,
    isWalkable(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= w || ty >= h) return false;
      return rows[ty]?.[tx] === '.';
    },
  };
}

describe('A* pathfinding', () => {
  it('returns a single-element path when start == goal', () => {
    const g = makeGrid([
      '.....',
      '.....',
      '.....',
    ]);
    const p = findPath(g, { tx: 2, ty: 1 }, { tx: 2, ty: 1 });
    expect(p).toEqual([{ tx: 2, ty: 1 }]);
  });

  it('finds a straight horizontal path', () => {
    const g = makeGrid([
      '.....',
      '.....',
      '.....',
    ]);
    const p = findPath(g, { tx: 0, ty: 1 }, { tx: 4, ty: 1 });
    expect(p).not.toBeNull();
    expect(p!.length).toBe(5);
    expect(p![0]).toEqual({ tx: 0, ty: 1 });
    expect(p!.at(-1)).toEqual({ tx: 4, ty: 1 });
  });

  it('navigates around a wall (corner pathing)', () => {
    const g = makeGrid([
      '.....',
      '.###.',
      '.....',
    ]);
    const p = findPath(g, { tx: 0, ty: 1 }, { tx: 4, ty: 1 });
    expect(p).not.toBeNull();
    // Manhattan distance is 4; with the wall, the shortest path goes up or
    // down a row and back — length 7 (start + 6 steps).
    expect(p!.length).toBe(7);
  });

  it('returns null when the goal is fully walled off', () => {
    const g = makeGrid([
      '...#.',
      '...#.',
      '...#.',
    ]);
    const p = findPath(g, { tx: 0, ty: 1 }, { tx: 4, ty: 1 });
    expect(p).toBeNull();
  });

  it('returns null when the start tile is not walkable', () => {
    const g = makeGrid([
      '#....',
      '.....',
    ]);
    const p = findPath(g, { tx: 0, ty: 0 }, { tx: 4, ty: 1 });
    expect(p).toBeNull();
  });

  it('returns null when the goal tile is not walkable', () => {
    const g = makeGrid([
      '....#',
      '.....',
    ]);
    const p = findPath(g, { tx: 0, ty: 0 }, { tx: 4, ty: 0 });
    expect(p).toBeNull();
  });

  it('every step in the returned path is adjacent to the next', () => {
    const g = makeGrid([
      '..........',
      '.######...',
      '......#...',
      '......#...',
      '..........',
    ]);
    const p = findPath(g, { tx: 0, ty: 0 }, { tx: 9, ty: 4 });
    expect(p).not.toBeNull();
    for (let i = 1; i < p!.length; i++) {
      const a = p![i - 1]!;
      const b = p![i]!;
      const dx = Math.abs(a.tx - b.tx);
      const dy = Math.abs(a.ty - b.ty);
      expect(dx + dy).toBe(1); // 4-connected, no diagonals
    }
  });
});
