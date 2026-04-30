// Combat math + state transitions. Pure functions: easy to unit-test.
// View layer (Pixi) and AI tick (also pure-ish) call into this.

import type { Actor } from '../actors/Actor';
import { tileDistance } from '../engine/iso';

export interface DamageEvent {
  readonly attackerId: string;
  readonly targetId: string;
  readonly amount: number;
  readonly killed: boolean;
}

// Manhattan distance between two actors.
export function distanceBetween(a: Actor, b: Actor): number {
  return tileDistance(a.tile, b.tile);
}

// Can `attacker` strike `target` right now?
// Range, cooldown, both alive. Pure — caller passes `nowMs`.
export function canAttack(attacker: Actor, target: Actor, nowMs: number): boolean {
  if (!attacker.alive || !target.alive) return false;
  if (attacker.id === target.id) return false;
  if (distanceBetween(attacker, target) > attacker.stats.atkRange) return false;
  if (nowMs - attacker.lastAttackAt < attacker.stats.atkCooldownMs) return false;
  return true;
}

// Apply an attack. Mutates `attacker.lastAttackAt` and `target.hp`/`target.alive`.
// Returns the event for the FX layer to render.
export function performAttack(attacker: Actor, target: Actor, nowMs: number): DamageEvent {
  const amount = attacker.stats.atk;
  attacker.lastAttackAt = nowMs;
  target.hp = Math.max(0, target.hp - amount);
  const killed = target.hp === 0 && target.alive;
  if (killed) {
    target.alive = false;
    target.attackTarget = null;
    target.goal = null;
  }
  return { attackerId: attacker.id, targetId: target.id, amount, killed };
}

// Reset an actor to alive at a respawn tile. Used for player death/respawn.
export function respawn(actor: Actor, tile: { tx: number; ty: number }): void {
  actor.tile = { ...tile };
  actor.hp = actor.stats.maxHp;
  actor.alive = true;
  actor.lastAttackAt = Number.NEGATIVE_INFINITY;
  actor.lastMoveAt = Number.NEGATIVE_INFINITY;
  actor.goal = null;
  actor.attackTarget = null;
}
