// Base actor: player + enemy share this data shape.
// Pure data — no Pixi imports. The view layer reads this and renders.

import type { TileCoord } from '../engine/iso';
import type { Equipment } from '../systems/inventory';
import type { DerivedStats } from '../systems/inventory';

export type ActorKind = 'player' | 'enemy';

export interface ActorStats {
  readonly maxHp: number;
  readonly atk: number;
  readonly atkRange: number; // in tiles, Manhattan; 1 = adjacent only
  readonly atkCooldownMs: number;
  readonly aggroRange: number; // tiles before AI engages; ignored for player
  readonly moveCooldownMs: number;
}

export interface Actor {
  readonly id: string;
  readonly kind: ActorKind;
  readonly stats: ActorStats;       // base (unchanging)
  derivedStats: DerivedStats;       // base + equipment, recomputed on equip
  equipment: Equipment;             // slot -> Item (player only in v0.3.0)
  tile: TileCoord;
  hp: number;
  alive: boolean;
  lastAttackAt: number; // ms timestamp; 0 = never attacked
  lastMoveAt: number;
  goal: TileCoord | null;
  attackTarget: string | null; // id of actor we want to attack on contact
}

export const PLAYER_STATS: ActorStats = {
  maxHp: 100,
  atk: 25,
  atkRange: 1,
  atkCooldownMs: 400,
  aggroRange: 0, // player has no auto-aggro
  moveCooldownMs: 150,
};

export const ENEMY_STATS: ActorStats = {
  maxHp: 50,
  atk: 10,
  atkRange: 1,
  atkCooldownMs: 1000,
  aggroRange: 5,
  moveCooldownMs: 250, // slower than player so kiting is possible
};

export function makeActor(id: string, kind: ActorKind, stats: ActorStats, tile: TileCoord): Actor {
  return {
    id,
    kind,
    stats,
    derivedStats: { atk: stats.atk, maxHp: stats.maxHp, armor: 0 },
    equipment: {},
    tile,
    hp: stats.maxHp,
    alive: true,
    // -Infinity so a fresh actor's cooldown check always passes (now - (-Inf) = +Inf >= cooldown).
    lastAttackAt: Number.NEGATIVE_INFINITY,
    lastMoveAt: Number.NEGATIVE_INFINITY,
    goal: null,
    attackTarget: null,
  };
}
