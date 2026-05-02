// Player skills — pure data + lookup.
// v0.4.0 ships with just `melee` (the basic attack from v0.2.0). Per spec §3
// the v0.5.0 milestone is "1 skill → 4 skills" — this list grows then.

export interface SkillDef {
  readonly id: string;
  readonly name: string;
  readonly icon: string; // single character glyph until LPC art lands
}

export const SKILLS: ReadonlyArray<SkillDef> = [
  { id: 'melee', name: 'Strike', icon: '⚔' },
];

export function getSkill(id: string): SkillDef | undefined {
  return SKILLS.find((s) => s.id === id);
}
