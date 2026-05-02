# WYRDLOOM v0.9.0 — Week 9: Cinderfall + The Pact-Bearer + ending. Frostmark playable.

The west gate of Whitestone now opens onto Cinderfall — the Ruined Keep biome of Act III, lit by warm amber ember-glow. BSP-procgen with seed `cinderfall-1`, doorway-back-to-Whitestone, and a boss room that holds The Pact-Bearer: 320 HP, 22 atk, 1000 ms cd, three phases, mlvl 20. The fight curves between the Hollow Bishop's steady ramp and the Worm-Mother's late explosion — phase 2 already hits hard, phase 3 hits very hard but the cooldown crush is gentler so the read rewards positioning. Killing them always drops a unique through the existing `rollDrop({ guaranteed: true })` path.

When the Pact-Bearer falls for the first time, an ending overlay fades in over the world: four lines of late-act lore in serif type, a "Continue" button after the last line settles, then dismissal flips a one-shot `endingSeen` flag onto the SaveState so reloads after credits don't replay the moment. The game world stays loaded — you can walk back to Whitestone and continue playing.

Frostmark joins Furyborn as a playable class. Agility / Mana / Ice-ranger archetype: 95 HP, 18 atk, 320 ms swing, faster move-cd. Mana regenerates passively (+5/s, no on-hit gain) — a different rotation feel from Furyborn's hits-build-rage loop. Six skills authored, three implemented (Volley basic, Ice Nova aoe, Blink mobility); three stubbed (Frost Aspect, Shatter, Piercing Shot) for v0.9.x polish. Switch via the new `__wyrdloom.dev.setClass('frostmark')` hook until character creation lands in v0.11.0.

SaveAdapter bumps to schema v4 — adds `endingSeen: boolean`. Pre-v0.9.0 saves migrate to false (haven't reached Act III). The migration table now has three entries (1→2, 2→3, 3→4), the longest walk in the game's history.

## What ships

### Frostmark class (`src/systems/class.ts`, `src/systems/skills.ts`)

```
fm-volley     0 mana    basic       1.0×    Frost-tipped strike. Faster than Cleave; mana regenerates idle.
fm-icenova    30 mana   aoe         0.6×    Hits every adjacent enemy. 1800 ms cd.
fm-blink      25 mana   mobility    —       Dash up to 5 tiles toward goal. 4500 ms cd.
fm-aspect     40 mana   buff        —       [v0.9.x] +30% move speed for 4 s.
fm-shatter    45 mana   finisher    2.5×    [v0.9.x] Massive damage to chilled enemies.
fm-piercing   35 mana   projectile  1.4×    [v0.9.x] Pierces through enemies in a line.
```

- `FROSTMARK` ClassDef in the registry: `stat: 'agility'`, `resource: 'mana'`, `resourceMax: 100`, `resourceRegen: 5`, `resourceOnHit: 0`, `resourceColor: '#3a6ec9'`. Lower HP/atk than Furyborn balanced by faster swing + faster move-cd.
- `SkillKind` gains a `'projectile'` variant for Frostmark's stub piercing shot. Mechanically not yet distinct from a tile-adjacent strike — proper ranged combat is deferred to v0.10.0+ once a Pixi missile system lands.
- The kind-driven `executeSkill` dispatcher in main.ts handles Frostmark's `aoe` (Ice Nova) and `mobility` (Blink) automatically — no new branches needed because the executor already keys off skill kind, not skill id. v0.7.0's design paying off again.
- `__wyrdloom.dev.setClass(classId)` rebuilds the player actor's baseline stats in place (preserves equipment + position). Closure-captured actor refs stay valid because the actor object is mutated, not replaced.

### Cinderfall zone (`src/levels/cinderfall.ts`, `src/systems/zone.ts`)

- `ZONES` extended with `'cinderfall'`. Same BSP-procgen scaffolding as Catacombs / Frostvein — 32×32 grid, default seed `cinderfall-1`.
- `applyZoneFilter` adds a Cinderfall case: `saturate(+0.05)`, `tint(0xffb070)`, `brightness(0.95)` — warm amber ember-glow with a faint red bias. Reads as cinder-light through broken stone, distinct from Whitestone's golden hub light, the catacombs' cold blue, and the frostvein's icy cyan.
- Whitestone gets a third doorway at `(1, 8)` (west wall) labeled "Cinderfall ruins". Returning from Cinderfall drops the player at `(2, 8)` — one tile inside the doorway.
- Lasthold (Act III hub per spec §5) stays reserved for v0.10.0; the descent goes directly from Whitestone for v0.9.0, mirroring the Frostvein pattern.

### The Pact-Bearer boss (`src/actors/Actor.ts`, `src/fx/sprites.ts`, `src/main.ts`)

- `PACT_BEARER_STATS`: maxHp 320, atk 22, atkCooldownMs 1000, aggroRange 9, moveCooldownMs 230. Highest baseline of any boss because the player should arrive geared from Act II uniques + sockets.
- `PACT_BEARER_PHASE_MODS`: `[1.0/1.0, 1.5/0.8, 2.0/0.65]`. Phase 2 already hits 50% harder; phase 3 doubles atk but the cooldown only drops to 0.65 — gentler than the Worm-Mother's 0.55 crush. Rewards positioning over twitch.
- `BossId` extended with `PACT_BEARER_ID`. `BOSS_CONFIG` registry takes a one-row addition with `phaseField: 'pactBearerPhase'`. `isBossId` lights up red across every consumer (kill seed, monsterLevel lookup, phase advancement) — discriminated-union design from v0.7.0 paying out.
- New `makePactBearerSprite` in `fx/sprites.ts`: cathedral-armored figure with a dark cape, plate cuirass with an amber pact-flame sigil on the chest, sealed visor with a red slit, and a halberd silhouette to the right (vertical shaft + angled blade). Renders cleanly against the warm zone tint.
- `handleKill` monsterLevel branch: 20 for Pact-Bearer (Act III final), 16 for Worm-Mother (Act II), 12 for Hollow Bishop (Act I), 5 for grunts. Uniques from `data/uniques.json` filter by `ilvl ≤ monsterLevel` — Pact-Bearer kills can roll any of the 20 unique entries.
- Added to `data/quests.json` as `q-act3-pact` (boss_kill objective, order 5, act 3) — the new act-final main quest.

### Ending overlay (`src/ui/ending_overlay.ts`)

- `<wyrd-ending>` Lit element. Centered overlay with a serif-styled frame, dim backdrop with a 2 px backdrop-blur, four lore lines that fade in staggered (0.4 s, 1.0 s, 1.6 s, 2.4 s delays), then a "Continue" button that fades in at 3.0 s.
- Triggered from `handleKill` via `ENDING_SHOW_EVENT` when `id === PACT_BEARER_ID && !W.endingSeen`. The world keeps ticking underneath — the overlay is a one-shot lore moment, not a hard pause.
- Dismiss fires `ENDING_DISMISS_EVENT`; main.ts's listener flips `W.endingSeen = true` and triggers an autoSave so the flag persists immediately.

### SaveAdapter v4 (`src/platform/SaveAdapter.ts`)

- `SAVE_SCHEMA_VERSION` bumps from 3 → 4.
- `SaveState` gains `readonly endingSeen: boolean`.
- `MIGRATIONS[3]` defaults pre-v0.9.0 saves to `endingSeen: false` (legacy saves never reached Act III, so false is the correct stamp).
- Migration walk now: v1 → v2 (classId/resource defaults to Furyborn / 0) → v3 (no shape change, version stamp) → v4 (endingSeen: false). The schema-versioning discipline established in v0.7.0 is paying full interest.

### Tests

- `tests/unit/save_adapter.spec.ts` — schema version assertion bumped to 4; `MIGRATIONS` table assertion expects `['1', '2', '3']`; new test walks v2 → v4 verifying `endingSeen: false` defaults; new test for v3 → v4 stamp; existing v1 → v4 walk-through preserved (now ends at v4).
- All pre-existing tests still pass after the version bump — 85/85 unit tests green (1623 expect calls).

## File tree

New:
- `src/levels/cinderfall.ts` (~30 lines)
- `src/ui/ending_overlay.ts` (~110 lines)
- `RELEASE_NOTES_v0.9.md`

Touched:
- `src/systems/class.ts` — `FROSTMARK` def added; `CLASSES` array now exports both classes.
- `src/systems/skills.ts` — `SkillKind` gains `'projectile'`; 6 Frostmark skills appended.
- `src/systems/zone.ts` — `ZONES` extended with `'cinderfall'`.
- `src/levels/whitestone.ts` — west gate doorway + entryFromZone for cinderfall.
- `src/actors/Actor.ts` — `PACT_BEARER_STATS` + `PACT_BEARER_PHASE_MODS`.
- `src/fx/sprites.ts` — `makePactBearerSprite`.
- `src/main.ts` — APP_VERSION bump, header rewrite, Cinderfall zone load, Pact-Bearer spawn + phase tracking + monsterLevel branch + ending dispatch, ending dismiss listener, `setClass` dev hook, `endingSeen` on World + snapshotSaveState + loadSaveAndApply.
- `src/platform/SaveAdapter.ts` — SCHEMA_VERSION 4, `endingSeen` on SaveState, MIGRATIONS[3].
- `data/quests.json` — q-act3-pact entry.
- `tests/types/wyrdloom-global.d.ts` — `pactBearerPhase`, `setClass`, `'cinderfall'` zone id.
- `tests/unit/save_adapter.spec.ts` — v4 assertions + v2→v4 / v3→v4 migration tests.
- `tests/e2e/*.spec.ts` — VERSION / TARGET_VERSION constants bumped to '0.9.0'.

## Numbers

- 85 unit tests pass (1623 expect calls).
- TypeScript strict + `noUncheckedIndexedAccess` clean across src + tests.
- Production build: 132.94 kB gzip 39.61 kB (game bundle, +1.9 kB gzip from v0.8.0 — Frostmark + Cinderfall + ending overlay + Pact-Bearer wiring); 519.53 kB gzip 150.23 kB (Pixi vendored, unchanged).
- Save schema: v4. Migration table covers v1 → v4 end-to-end.
- Class roster: 2 of 4 implemented (Furyborn, Frostmark). Bonecaller + Sealwarden remain ClassId tags; Bonecaller targets v0.10.0–v0.11.0, Sealwarden post Act III per spec §4.2.

## Known gaps (carry into v0.10.0+)

- Lasthold (Act III hub per spec §5) is still reserved — Cinderfall is reached directly from Whitestone for now.
- Frostmark's three stub skills (Frost Aspect, Shatter, Piercing Shot) are bind-panel-visible but grayed out. Effects ship in v0.9.x.
- Bonecaller stays a ClassId tag — its kit is a v0.10.0–v0.11.0 target.
- Character creation is still a dev hook (`setClass`); the v0.11.0 settings/accessibility milestone owns the real flow.
- The ending is a single moment, not a credits roll — credits proper land in v1.0.0 ship prep (week 12).
- "The Echo" endgame (sigils, Mythic, Pinnacle) targets v0.10.0.
