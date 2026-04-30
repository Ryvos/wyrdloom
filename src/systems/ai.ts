// Enemy AI tick. Pure-ish: mutates actor.tile but takes the world as input.
// Strategy: if player in aggro range, step one tile toward player on cooldown.
// If adjacent (Manhattan 1), attack instead of moving.

import type { Actor } from '../actors/Actor';
import { canAttack, distanceBetween, performAttack } from './combat';
import type { DamageEvent } from './combat';

// Step `enemy` one tile toward `player`. Pure direction picker.
// Returns the new tile (caller decides whether to commit it via cooldown).
export function stepToward(from: { tx: number; ty: number }, to: { tx: number; ty: number }): {
  tx: number;
  ty: number;
} {
  const dx = Math.sign(to.tx - from.tx);
  const dy = Math.sign(to.ty - from.ty);
  if (dx === 0 && dy === 0) return { ...from };
  // Step on the axis with the larger remaining gap (matches player movement).
  if (Math.abs(to.tx - from.tx) >= Math.abs(to.ty - from.ty)) {
    return { tx: from.tx + dx, ty: from.ty };
  }
  return { tx: from.tx, ty: from.ty + dy };
}

export interface AiTickResult {
  moved: boolean;
  damage: DamageEvent | null;
}

// Run one AI tick for an enemy. Mutates enemy.tile and enemy.lastMoveAt as needed.
export function tickEnemy(enemy: Actor, player: Actor, nowMs: number): AiTickResult {
  if (!enemy.alive || !player.alive) return { moved: false, damage: null };

  const dist = distanceBetween(enemy, player);
  if (dist > enemy.stats.aggroRange) return { moved: false, damage: null };

  // In melee range — attack if cooldown allows.
  if (canAttack(enemy, player, nowMs)) {
    const dmg = performAttack(enemy, player, nowMs);
    return { moved: false, damage: dmg };
  }

  // Move on cooldown.
  if (nowMs - enemy.lastMoveAt < enemy.stats.moveCooldownMs) {
    return { moved: false, damage: null };
  }

  const next = stepToward(enemy.tile, player.tile);
  if (next.tx === enemy.tile.tx && next.ty === enemy.tile.ty) {
    return { moved: false, damage: null };
  }
  enemy.tile = next;
  enemy.lastMoveAt = nowMs;
  return { moved: true, damage: null };
}
