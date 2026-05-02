// Class registry — pure data + lookup. New classes get a row here; the bind
// panel + character sheet read this to render skill names + colors.

import type { ClassDef, ClassId } from '../types/class';

export const FURYBORN: ClassDef = {
  id: 'furyborn',
  name: 'Furyborn',
  stat: 'strength',
  resource: 'rage',
  resourceMax: 100,
  // Rage drains out of combat (no in-combat detection yet — drain runs always,
  // and hits build it back faster than the drain).
  resourceRegen: -3,
  resourceOnHit: 12,
  resourceColor: '#c44a2a',
  skills: [
    'fb-cleave',
    'fb-whirlwind',
    'fb-charge',
    'fb-roar',
    'fb-frenzy',
    'fb-execute',
  ],
  // Baseline Furyborn — slightly bulkier than v0.6.0 generic (HP 100, atk 25).
  // Strength theme: higher HP, harder hits, slower swing.
  baseHp: 120,
  baseAtk: 28,
  baseAtkCooldownMs: 450,
  baseMoveCooldownMs: 150,
};

export const FROSTMARK: ClassDef = {
  id: 'frostmark',
  name: 'Frostmark',
  stat: 'agility',
  resource: 'mana',
  resourceMax: 100,
  // Mana regenerates passively — no on-hit gain. Frostmark sustains casting
  // through downtime + skill rotations rather than the Furyborn rage build-up.
  resourceRegen: 5,
  resourceOnHit: 0,
  resourceColor: '#3a6ec9',
  skills: [
    'fm-volley',
    'fm-icenova',
    'fm-blink',
    'fm-aspect',
    'fm-shatter',
    'fm-piercing',
  ],
  // Agile glass-cannon: lower HP, lower per-hit atk, much faster swing speed
  // and faster movement. The DPS rate ends up close to Furyborn's via cadence
  // rather than per-hit weight.
  baseHp: 95,
  baseAtk: 18,
  baseAtkCooldownMs: 320,
  baseMoveCooldownMs: 130,
};

export const SEALWARDEN: ClassDef = {
  id: 'sealwarden',
  name: 'Sealwarden',
  stat: 'faith',
  resource: 'vigil',
  resourceMax: 100,
  // Vigil regenerates slowly out of combat AND builds modestly on hit — a
  // hybrid pattern between Furyborn (rage from hits) and Frostmark (passive
  // mana). Reads as a paladin who steadies between strikes.
  resourceRegen: 2,
  resourceOnHit: 6,
  resourceColor: '#c8b878',
  skills: [
    'sw-smite',
    'sw-consecrate',
    'sw-aegis',
    'sw-sanctify',
    'sw-wrath',
    'sw-final-verse',
  ],
  // Bulkiest of the three implemented classes — paladin theme: heaviest HP,
  // measured swing, slowest movement. Atk per swing sits between Furyborn
  // (28) and Frostmark (18).
  baseHp: 145,
  baseAtk: 24,
  baseAtkCooldownMs: 520,
  baseMoveCooldownMs: 170,
};

export const CLASSES: ReadonlyArray<ClassDef> = [FURYBORN, FROSTMARK, SEALWARDEN];

export function getClass(id: ClassId): ClassDef | undefined {
  return CLASSES.find((c) => c.id === id);
}

// Default class for new characters until character-creation lands in v0.11.0.
// Furyborn ships v0.7.0; Frostmark joins in v0.9.0 and is selectable via the
// dev hook (`__wyrdloom.dev.setClass('frostmark')` after a fresh save).
export const DEFAULT_CLASS_ID: ClassId = 'furyborn';
