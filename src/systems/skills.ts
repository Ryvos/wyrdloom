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
export type SkillKind = 'basic' | 'aoe' | 'mobility' | 'buff' | 'finisher' | 'passive';

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
];

export function getSkill(id: string): SkillDef | undefined {
  return SKILLS.find((s) => s.id === id);
}

export function classSkills(classId: ClassId): ReadonlyArray<SkillDef> {
  return SKILLS.filter((s) => s.classId === classId);
}
