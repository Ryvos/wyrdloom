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

export const CLASSES: ReadonlyArray<ClassDef> = [FURYBORN];

export function getClass(id: ClassId): ClassDef | undefined {
  return CLASSES.find((c) => c.id === id);
}

// Default class for new characters in v0.7.0 — character creation arrives
// alongside Bonecaller/Frostmark in v0.8.0–v0.9.0.
export const DEFAULT_CLASS_ID: ClassId = 'furyborn';
