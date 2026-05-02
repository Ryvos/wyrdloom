// Class identity — Strength/Will/Agility/Faith × Rage/Bone Shards/Mana/Vigil.
// Per spec §4.2: 3 launch classes (Bonecaller, Furyborn, Frostmark) + 1 unlock
// (Sealwarden, post Act III). v0.7.0 ships only Furyborn end-to-end; the other
// IDs reserve the namespace so save schemas + class-tagged skills can be
// written ahead of v0.8.0–v0.9.0 implementations.

export const CLASS_IDS = ['furyborn', 'bonecaller', 'frostmark', 'sealwarden'] as const;
export type ClassId = (typeof CLASS_IDS)[number];

export const RESOURCE_IDS = ['rage', 'bone_shards', 'mana', 'vigil'] as const;
export type ResourceId = (typeof RESOURCE_IDS)[number];

export type ClassStat = 'strength' | 'will' | 'agility' | 'faith';

export interface ClassDef {
  readonly id: ClassId;
  readonly name: string;
  readonly stat: ClassStat;
  readonly resource: ResourceId;
  readonly resourceMax: number;
  // Per-second drift when out of combat. Negative = drains, positive = regens,
  // zero = static. Furyborn drains; Frostmark (Mana) will regen in v0.9.0.
  readonly resourceRegen: number;
  // Resource gained per landed hit (Furyborn rage build); 0 if class doesn't
  // build resource from melee.
  readonly resourceOnHit: number;
  // Hex color for the resource bar fill.
  readonly resourceColor: string;
  // Six skill ids (display order). Stub skills are still listed — they're
  // hidden from the bind panel until they implement their effect.
  readonly skills: readonly string[];
  // Base actor stats for a fresh character of this class. Equipment + talents
  // layer on via DerivedStats later.
  readonly baseHp: number;
  readonly baseAtk: number;
  readonly baseAtkCooldownMs: number;
  readonly baseMoveCooldownMs: number;
}
