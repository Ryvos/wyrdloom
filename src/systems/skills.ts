// Player skills — pure data + lookup.
// v0.7.0 introduces the Furyborn kit (6 skills, 3 implemented). The basic
// attack (`fb-cleave`) is the implicit left-click strike; the other five
// are bind-and-trigger-via-hotbar.
//
// Per spec §4.2: six active skills per class. Resource costs gate the
// non-basic skills; cooldowns are per-skill (independent of attack cd).

import type { ClassId } from '../types/class';

// Activation kind picks the executor in main.ts. `passive` means the skill
// is referenced (e.g., for talent grids) but doesn't fire from the hotbar.
// v0.9.0 adds 'projectile' for Frostmark's ranged-feel basic attack — for
// now mechanically identical to a tile-adjacent strike, with ranged combat
// proper deferred to v0.10.0+ once a Pixi missile system lands.
export type SkillKind =
  | 'basic'
  | 'aoe'
  | 'mobility'
  | 'buff'
  | 'finisher'
  | 'passive'
  | 'projectile';

export interface SkillDef {
  readonly id: string;
  readonly name: string;
  readonly icon: string; // single character glyph until LPC art lands
  readonly classId: ClassId;
  readonly kind: SkillKind;
  readonly cost: number;        // resource cost; 0 = free
  readonly cooldownMs: number;  // 0 = limited only by global atk cd
  readonly damageMul: number;   // multiplier on derivedStats.atk
  readonly summary: string;     // shown in bind panel + tooltip
  // True only for skills that actually run effects in v0.7.0. Stubs are
  // listed in the bind panel grayed out.
  readonly implemented: boolean;
}

export const SKILLS: ReadonlyArray<SkillDef> = [
  // Furyborn kit — 3 working, 3 stubbed.
  {
    id: 'fb-cleave',
    name: 'Cleave',
    icon: '⚔',
    classId: 'furyborn',
    kind: 'basic',
    cost: 0,
    cooldownMs: 0,
    damageMul: 1.0,
    summary: 'Basic strike. Builds Rage on every landed hit. Left-click.',
    implemented: true,
  },
  {
    id: 'fb-whirlwind',
    name: 'Whirlwind',
    icon: '🌀',
    classId: 'furyborn',
    kind: 'aoe',
    cost: 25,
    cooldownMs: 1500,
    damageMul: 0.7,
    summary: 'Spin and strike every enemy in adjacent tiles. Costs 25 Rage.',
    implemented: true,
  },
  {
    id: 'fb-charge',
    name: 'Charge',
    icon: '➤',
    classId: 'furyborn',
    kind: 'mobility',
    cost: 30,
    cooldownMs: 4000,
    damageMul: 0,
    summary: 'Dash up to 5 tiles toward your goal tile. Costs 30 Rage.',
    implemented: true,
  },
  {
    id: 'fb-roar',
    name: 'Battle Roar',
    icon: '✦',
    classId: 'furyborn',
    kind: 'buff',
    cost: 40,
    cooldownMs: 8000,
    damageMul: 0,
    summary: '[v0.7.x] Buff atk for 5 s. Defined; effect lands in v0.7.x.',
    implemented: false,
  },
  {
    id: 'fb-frenzy',
    name: 'Frenzy',
    icon: '⚡',
    classId: 'furyborn',
    kind: 'buff',
    cost: 25,
    cooldownMs: 6000,
    damageMul: 0,
    summary: '[v0.7.x] Stack attack speed on hits. Defined; effect lands in v0.7.x.',
    implemented: false,
  },
  {
    id: 'fb-execute',
    name: 'Execute',
    icon: '☠',
    classId: 'furyborn',
    kind: 'finisher',
    cost: 50,
    cooldownMs: 5000,
    damageMul: 3.0,
    summary: '[v0.7.x] Massive damage to enemies under 30% HP. Effect lands in v0.7.x.',
    implemented: false,
  },

  // Frostmark kit — v0.9.0. 3 working (Volley basic / Ice Nova aoe / Blink
  // mobility), 3 stubbed (Aspect / Shatter / Piercing). Mana regenerates
  // passively rather than building from hits — a different rotation feel
  // from Furyborn.
  {
    id: 'fm-volley',
    name: 'Volley',
    icon: '➹',
    classId: 'frostmark',
    kind: 'basic',
    cost: 0,
    cooldownMs: 0,
    damageMul: 1.0,
    summary: 'Frost-tipped strike. Faster than Cleave; mana regenerates idle. Left-click.',
    implemented: true,
  },
  {
    id: 'fm-icenova',
    name: 'Ice Nova',
    icon: '❄',
    classId: 'frostmark',
    kind: 'aoe',
    cost: 30,
    cooldownMs: 1800,
    damageMul: 0.6,
    summary: 'Burst of ice — strikes every adjacent enemy. Costs 30 Mana.',
    implemented: true,
  },
  {
    id: 'fm-blink',
    name: 'Blink',
    icon: '✦',
    classId: 'frostmark',
    kind: 'mobility',
    cost: 25,
    cooldownMs: 4500,
    damageMul: 0,
    summary: 'Step through frost — dash up to 5 tiles toward your goal. Costs 25 Mana.',
    implemented: true,
  },
  {
    id: 'fm-aspect',
    name: 'Frost Aspect',
    icon: '◆',
    classId: 'frostmark',
    kind: 'buff',
    cost: 40,
    cooldownMs: 9000,
    damageMul: 0,
    summary: '[v0.9.x] +30% move speed for 4 s. Defined; effect lands in v0.9.x.',
    implemented: false,
  },
  {
    id: 'fm-shatter',
    name: 'Shatter',
    icon: '✺',
    classId: 'frostmark',
    kind: 'finisher',
    cost: 45,
    cooldownMs: 5000,
    damageMul: 2.5,
    summary: '[v0.9.x] Massive damage to chilled enemies. Effect lands in v0.9.x.',
    implemented: false,
  },
  {
    id: 'fm-piercing',
    name: 'Piercing Shot',
    icon: '➶',
    classId: 'frostmark',
    kind: 'projectile',
    cost: 35,
    cooldownMs: 3500,
    damageMul: 1.4,
    summary: '[v0.9.x] Pierces through enemies in a line. Effect lands in v0.9.x.',
    implemented: false,
  },
];

export function getSkill(id: string): SkillDef | undefined {
  return SKILLS.find((s) => s.id === id);
}

export function classSkills(classId: ClassId): ReadonlyArray<SkillDef> {
  return SKILLS.filter((s) => s.classId === classId);
}
