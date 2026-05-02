// Enemy AI tick. Pure-ish: mutates actor.tile but takes the world as input.
// Strategy: if player in aggro range, A* toward player and step the first tile
// on cooldown. If adjacent (Manhattan 1), attack instead of moving.

import type { Actor } from '../actors/Actor';
import { canAttack, distanceBetween, performAttack } from './combat';
import type { DamageEvent } from './combat';
import { findPath, type PathfindGrid } from './pathfinding';

// Greedy direction picker — used in unit tests + as the v0.4.0 fallback when
// no grid is supplied. With a grid (v0.5.0+) prefer A* via tickEnemy.
export function stepToward(from: { tx: number; ty: number }, to: { tx: number; ty: number }): {
  tx: number;
  ty: number;
} {
  const dx = Math.sign(to.tx - from.tx);
  const dy = Math.sign(to.ty - from.ty);
  if (dx === 0 && dy === 0) return { ...from };
  if (Math.abs(to.tx - from.tx) >= Math.abs(to.ty - from.ty)) {
    return { tx: from.tx + dx, ty: from.ty };
  }
  return { tx: from.tx, ty: from.ty + dy };
}

export interface AiTickResult {
  moved: boolean;
  damage: DamageEvent | null;
}

// Run one AI tick for an enemy. Mutates enemy.tile and enemy.lastMoveAt.
// `grid` is optional so the existing combat tests (which use no grid) keep
// working; the live game always passes a grid in v0.5.0+.
export function tickEnemy(
  enemy: Actor,
  player: Actor,
  nowMs: number,
  grid?: PathfindGrid,
): AiTickResult {
  if (!enemy.alive || !player.alive) return { moved: false, damage: null };

  const dist = distanceBetween(enemy, player);
  if (dist > enemy.stats.aggroRange) return { moved: false, damage: null };

  if (canAttack(enemy, player, nowMs)) {
    const dmg = performAttack(enemy, player, nowMs);
    return { moved: false, damage: dmg };
  }

  if (nowMs - enemy.lastMoveAt < enemy.stats.moveCooldownMs) {
    return { moved: false, damage: null };
  }

  // With a grid: A* one step. Without: greedy direction picker.
  let next: { tx: number; ty: number };
  if (grid) {
    const path = findPath(grid, enemy.tile, player.tile);
    // path[0] is the current tile; path[1] is the first step. If no path
    // exists or we're already there, idle this tick.
    if (!path || path.length < 2) return { moved: false, damage: null };
    next = path[1]!;
  } else {
    next = stepToward(enemy.tile, player.tile);
  }
  if (next.tx === enemy.tile.tx && next.ty === enemy.tile.ty) {
    return { moved: false, damage: null };
  }
  enemy.tile = next;
  enemy.lastMoveAt = nowMs;
  return { moved: true, damage: null };
}
