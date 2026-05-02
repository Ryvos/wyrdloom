// Base actor: player + enemy share this data shape.
// Pure data — no Pixi imports. The view layer reads this and renders.

import type { TileCoord } from '../engine/iso';
import type { Equipment } from '../systems/inventory';
import type { DerivedStats } from '../systems/inventory';
import type { ClassId } from '../types/class';
import { getClass } from '../systems/class';

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
  // Player-only: class identity + current resource value (rage/mana/etc).
  // Enemies leave both undefined. resourceMax lives in the class def — saves
  // serialize only classId + resource and look up max at load time.
  classId?: ClassId;
  resource?: number;
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

// Hollow Bishop — Act I final boss. Three phases per spec §5 (3 phases each
// for designed boss fights). HP-gated transitions; phase logic flips atk +
// cooldown so the fight reads visually different each third of HP.
export const HOLLOW_BISHOP_STATS: ActorStats = {
  maxHp: 200,
  atk: 12,           // phase 1 baseline (gets buffed at phase shifts)
  atkRange: 1,
  atkCooldownMs: 900,
  aggroRange: 8,
  moveCooldownMs: 220,
};

// Phase thresholds (HP fraction). Phase 1: 100..67%, Phase 2: 67..33%, Phase 3: 33..0%.
// Both Act-I and Act-II bosses currently share the same gates.
export const BOSS_PHASE_THRESHOLDS = [0.67, 0.33] as const;
export const HOLLOW_BISHOP_PHASE_THRESHOLDS = BOSS_PHASE_THRESHOLDS;

// Phase modifier — multiplies atk and shrinks cooldown per phase.
export interface PhaseMod {
  readonly atkMul: number;
  readonly cooldownMul: number;
}
export const HOLLOW_BISHOP_PHASE_MODS: readonly [PhaseMod, PhaseMod, PhaseMod] = [
  { atkMul: 1.0, cooldownMul: 1.0 },   // phase 1 — baseline
  { atkMul: 1.4, cooldownMul: 0.8 },   // phase 2 — faster + harder
  { atkMul: 1.8, cooldownMul: 0.65 },  // phase 3 — desperate, dangerous
];

// Worm-Mother Vyl — Act II final boss. Per spec §5 (3 phases). Different
// mechanical curve than the Hollow Bishop: bulkier baseline, lighter mid-
// fight ramp, brutal phase-3 cooldown crush. Reads as an endurance fight
// rather than the Bishop's steady scaling.
export const WORM_MOTHER_STATS: ActorStats = {
  maxHp: 240,
  atk: 16,
  atkRange: 1,
  atkCooldownMs: 1100,
  aggroRange: 8,
  moveCooldownMs: 240,
};

export const WORM_MOTHER_PHASE_MODS: readonly [PhaseMod, PhaseMod, PhaseMod] = [
  { atkMul: 1.0, cooldownMul: 1.0 },   // phase 1 — slow, heavy
  { atkMul: 1.2, cooldownMul: 0.85 },  // phase 2 — mild ramp
  { atkMul: 1.7, cooldownMul: 0.55 },  // phase 3 — desperation, short cd
];

// The Pact-Bearer — Act III final boss. Per spec §5 (3 phases). Highest
// baseline of any boss — the player should arrive geared from Act II uniques
// + sockets, so the wall is meaningfully larger. Curve splits the difference
// between the Bishop's steady ramp and the Worm-Mother's late explosion:
// phase 2 already hits hard, phase 3 hits very hard but the cooldown crush
// is gentler so the fight rewards positioning over twitch.
export const PACT_BEARER_STATS: ActorStats = {
  maxHp: 320,
  atk: 22,
  atkRange: 1,
  atkCooldownMs: 1000,
  aggroRange: 9,
  moveCooldownMs: 230,
};

export const PACT_BEARER_PHASE_MODS: readonly [PhaseMod, PhaseMod, PhaseMod] = [
  { atkMul: 1.0, cooldownMul: 1.0 },   // phase 1 — measured, brutal-but-fair
  { atkMul: 1.5, cooldownMul: 0.8 },   // phase 2 — pact-flame ignites
  { atkMul: 2.0, cooldownMul: 0.65 },  // phase 3 — desperate covenant
];

// The Pinnacle — Echo floor-5 boss (spec §4.7: "drops Mythic exclusively").
// Baseline values scale at runtime with sigil tier; the constants below are
// the tier-1 floor. Curve mirrors the Pact-Bearer's shape but with a slightly
// faster phase-3 cooldown crush — the Pinnacle is the spec's hardest fight,
// arriving when the player has act-3 uniques + sockets + a Frostmark or
// Sealwarden in their roster.
export const PINNACLE_STATS: ActorStats = {
  maxHp: 400,
  atk: 28,
  atkRange: 1,
  atkCooldownMs: 950,
  aggroRange: 10,
  moveCooldownMs: 220,
};

export const PINNACLE_PHASE_MODS: readonly [PhaseMod, PhaseMod, PhaseMod] = [
  { atkMul: 1.0, cooldownMul: 1.0 },   // phase 1 — overwhelming presence
  { atkMul: 1.55, cooldownMul: 0.75 }, // phase 2 — echo-rift opens
  { atkMul: 2.1, cooldownMul: 0.6 },   // phase 3 — pinnacle's wrath
];

export function bossPhase(hp: number, maxHp: number): 1 | 2 | 3 {
  if (maxHp <= 0) return 1;
  const frac = hp / maxHp;
  if (frac > BOSS_PHASE_THRESHOLDS[0]) return 1;
  if (frac > BOSS_PHASE_THRESHOLDS[1]) return 2;
  return 3;
}

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

// Player factory — pulls baseline stats from the class definition and wires
// up the resource pool. Save/load uses this on character restore (with
// optional `resource` override to restore mid-fight rage state).
export function makePlayerActor(classId: ClassId, tile: TileCoord, resource = 0): Actor {
  const cls = getClass(classId);
  if (!cls) throw new Error(`unknown class: ${classId}`);
  const stats: ActorStats = {
    maxHp: cls.baseHp,
    atk: cls.baseAtk,
    atkRange: 1,
    atkCooldownMs: cls.baseAtkCooldownMs,
    aggroRange: 0,
    moveCooldownMs: cls.baseMoveCooldownMs,
  };
  const actor = makeActor('player', 'player', stats, tile);
  actor.classId = classId;
  actor.resource = resource;
  return actor;
}
