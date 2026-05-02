# WYRDLOOM v0.7.0 — Week 7: Furyborn class + Frostvein zone + Worm-Mother Vyl + SaveAdapter v2

The player is no longer a generic "thing with HP and atk." Each session boots into a Furyborn — Strength stat, Rage resource, 120 HP, 28 atk, slower 450 ms swing. Landed hits build rage on the new resource bar above HP; idle drains it back. The bind panel filters to the player's class kit. Cleave is the implicit basic-strike (left-click); Whirlwind hits every adjacent enemy for 25 rage; Charge dashes 5 tiles along the A* path for 30 rage. Three more skills are reserved (Battle Roar, Frenzy, Execute) with placeholder costs and a grayed-out bind panel until v0.7.x ships their effects.

The Whitestone east doorway opens into the Frostvein caves — Act II's ice-cave biome, BSP-procgen with seed `frostvein-1` and a cool-blue color grade brighter than the catacombs. The boss room hosts Worm-Mother Vyl (240 HP, 16 atk), a 3-phase encounter tuned as an endurance fight that crushes you at the end (×1.7 atk + ×0.55 cooldown in phase 3). Killing her always drops a boss-tier item via the new `rollDrop({ guaranteed })` path.

SaveAdapter bumps to schema version 2 — adds `classId + resource` to the save state. The first entry in the `MIGRATIONS` table promotes legacy v1 saves to Furyborn / 0 rage automatically.

## What ships

### Class system (`src/types/class.ts`, `src/systems/class.ts`)

- `ClassId × ResourceId × ClassStat` — discriminated metadata for the four launch+unlock classes per spec §4.2. v0.7.0 wires only `furyborn`; the other three IDs reserve namespace so save-schema and skill-tagging code can be written ahead of v0.8.0–v0.9.0 implementations.
- `ClassDef` includes baseline `ActorStats`-equivalent fields (`baseHp`, `baseAtk`, `baseAtkCooldownMs`, `baseMoveCooldownMs`) so each class boots with its own HP/atk/swing-speed identity. Furyborn is bulky-and-slow: 120 HP, 28 atk, 450 ms cd, 150 ms move-cd.
- `makePlayerActor(classId, tile, resource = 0)` is the single boot-time factory. Pulls stats from the class def, sets `actor.classId` + `actor.resource` to wire the rest of the runtime.

### Furyborn kit (`src/systems/skills.ts`, `src/ui/bind_panel.ts`)

```
fb-cleave     0 rage     basic       1×       implicit left-click
fb-whirlwind  25 rage    aoe         0.7×     hit every adjacent enemy
fb-charge     30 rage    mobility    —        dash 5 tiles along the A* path
fb-roar       40 rage    buff        —        [stub] +atk for 5 s
fb-frenzy     25 rage    buff        —        [stub] attack-speed stack
fb-execute    50 rage    finisher    3×       [stub] huge dmg under 30% HP
```

- Skills carry `classId`, `cost`, `cooldownMs`, `damageMul`, and `implemented: boolean`. Stub skills surface in the bind panel grayed-out so the UI shape is visible during v0.7.0 ship.
- Bind panel filters to `classSkills(playerClassId)` and hides `kind: 'basic'` (Cleave is left-click).
- `executeSkill(W, skillId, nowMs)` is the central dispatcher: resource gate + per-skill cooldown gate (`skillCdAt: Map<string, number>`) + kind-driven effect. Whirlwind iterates `W.enemies` for 1-tile distance; Charge teleports to `playerPath[playerPathIx + 5]` (never warps through walls — reuses the live A* path).

### Resource bar HUD (`src/ui/resource_bar.ts`)

- DOM bar above the HP bar, styled to match. Shows `Rage 0 / 100` with a class-tinted fill (`#c44a2a` for Rage; future classes get `bone_shards` / `mana` / `vigil` palettes).
- `gainResourceOnHit(player)` runs after every landed Cleave; `tickResourceDrift(player, dtMs)` integrates `cls.resourceRegen` × dt each onTick. Both clamp [0, resourceMax].
- The bar updates via `syncStore(W)` whenever the floor of the resource value changes, so the DOM only repaints on integer ticks (16 ms × 3/s drain ≈ once every ~333 ms).

### Frostvein zone (`src/levels/frostvein.ts`, `src/systems/zone.ts`)

- `ZONES` extended with `'frostvein'`. Loader wraps `generateDungeon({ w: 32, h: 32, seed: 'frostvein-1' })` into a `Zone` with the doorway-back-to-Whitestone at the entrance-room center.
- Whitestone gains a second doorway at `(14, 8)` (east gate) targeting Frostvein. `entryFromZone.frostvein` returns the player to `(13, 8)`. The hub now lists two outbound dungeons.
- `applyZoneFilter(world, 'frostvein')` paints a cool-blue `ColorMatrixFilter`: `saturate(-0.15)` + `tint(0xb8d8f0)` + `brightness(1.05)`. Brighter than catacombs, distinctly icy.
- Same BSP procgen + flood-fill validator + 16-attempt salted reroll as catacombs. Determinism preserved across reloads.

### Worm-Mother Vyl boss (`src/actors/Actor.ts`, `src/fx/sprites.ts`)

- `WORM_MOTHER_STATS`: 240 HP, 16 atk, 1100 ms cd, 8-tile aggro, 240 ms move-cd. Bulkier and slower than Hollow Bishop's 200 HP / 12 atk / 900 ms baseline.
- 3 phase mods on the same 67%/33% HP gates as Bishop, but a different curve:
  - **Phase 1 (100%→67%)**: ×1.0 atk / ×1.0 cd — 16 atk, 1100 ms.
  - **Phase 2 (67%→33%)**: ×1.2 atk / ×0.85 cd — 19 atk, 935 ms. Mild ramp.
  - **Phase 3 (33%→0%)**: ×1.7 atk / ×0.55 cd — 27 atk, 605 ms. Brutal.
- Phase advancement now flows through a generic `BOSS_CONFIG` registry; adding the next boss in v0.9.0 (Pact-Bearer) is a one-row extension.
- `makeWormMotherSprite()` — segmented worm body, mandibles, cluster of glowing eyes. Procedural Pixi `Graphics()` per ADR 0003.
- Drops a guaranteed item with seed `boss-worm-mother-${killCount}`, monster level 16.

### Boss-drop guarantee (`src/systems/loot.ts`)

- `DropContext.guaranteed?: boolean` skips the `rng.next() > DROP_CHANCE` early-return. Set true for both Hollow Bishop and Worm-Mother kills in `handleKill`. Per spec §4.4: "Act boss → 1 unique guaranteed."
- Old per-grunt drops still respect `DROP_CHANCE`; only act-final bosses are guaranteed.

### Quest chain extends to Act II

- `data/quests.json` adds `q-act2-vyl` (boss_kill `worm-mother`, count: 1, order: 4). Activates after `q-act1-bishop` via `activateNextMainAfter`.
- The 5-quest sequential main-quest chain spans both acts: descend → 3 grunts → relic → bishop → vyl.

### SaveAdapter v2 (`src/platform/SaveAdapter.ts`)

- `SAVE_SCHEMA_VERSION = 2`. New `SaveState` fields: `classId: ClassId`, `resource: number`. `resourceMax` derives from class lookup at load time, not serialized.
- First entry in `MIGRATIONS`: `1 → 2` defaults legacy v1 saves to `{ classId: 'furyborn', resource: 0 }`. v0.6.0-era saves load cleanly.
- Schema-history block in the header documents the migration path; v0.8.0+ entries layer on without touching the existing migrator.
- `snapshotSaveState` + `loadSaveAndApply` round-trip class + resource (load applies `classId` first so the resource bar paints with the right color before the zone loader fires).

## Verification

| Layer | Result |
|---|---|
| Vitest unit (combat, AI, iso, loot, inventory, bag, procgen, pathfinding, quests, save_adapter +1 migration) | **68/68 pass** |
| Playwright e2e (chromium + webkit, 43 specs each) | **86/86 pass** |
| ESLint, max-warnings 0 | clean |
| TypeScript strict + `noUncheckedIndexedAccess` | clean |
| License + capability gate | clean (no new assets, no new permissions) |

Live verification through the dedicated Playwright runner:

- Boot drops Furyborn into Whitestone (8, 8) with HP 120 / 120 and Rage 0 / 100.
- Resource bar paints the rage color (`rgb(196, 74, 42)`) and reads `Rage 0 / 100`.
- Catacombs entry triggers intro completion + bones activation; basic-attack on a grunt builds rage > 0 within 3 s.
- Frostvein entry produces the same procgen layout across reloads (deterministic seed). Worm-Mother spawns at 240 HP at the boss-room center.
- Worm-Mother kill (with weapon equipped) finishes in ~5 s and drops a guaranteed boss-tier item.
- Save in Frostvein → page reload → loadSlot → class survives + zone restored to Frostvein.

## Caveats

- **3 of 6 Furyborn skills are stubbed.** Battle Roar (atk-buff), Frenzy (attack-speed stack), and Execute (low-HP finisher) are reserved in the bind panel but inert. v0.7.x will land their effects; the data shape + UI surface ship now so save schemas don't churn.
- **Bonecaller / Frostmark / Sealwarden classes are name-only.** ID is reserved in `CLASS_IDS`; only Furyborn has a `ClassDef` in `CLASSES`. Bonecaller arrives with v0.8.0, Frostmark with v0.9.0 (per spec §10).
- **No character creation flow.** Every new game is Furyborn / "Wyrdling". Class select + name input land alongside the title screen in v0.8.0+.
- **No talent grid.** The 4×4 / 12-node passive tree per class (spec §4.2) lands in v0.8.0.
- **Frostmoor town hub deferred.** Per spec §5 each act has its own town (Whitestone I, Frostmoor II, Lasthold III). v0.7.0 ships the Frostvein dungeon directly off Whitestone east; the Frostmoor mountain-town hub lands in v0.7.x.
- **Side quests still deferred.** v0.6.0 shipped 4 main quests; v0.7.0 adds the Act-II finale main quest. The 6 + 6 + 7 side quests across Acts I-III come in v0.7.x–v0.8.0.
- **Tauri save adapter still untested at runtime.** Same status as v0.6.0 — code path wired, web is the live ship target.
- **Procedural Pixi sprites everywhere.** Worm-Mother joins Hollow Bishop in the procedural-art club. ADR 0003 stands.

## Notable design decisions

### Class identity stored on the actor, max derived from the def

```ts
interface Actor {
  // ...
  classId?: ClassId;
  resource?: number;
}
```

`resourceMax` is **not** stored on the actor — it's looked up via `getClass(actor.classId)?.resourceMax`. This kept the SaveState delta to two fields (`classId + resource`) instead of three, and means future talent-tree mods that boost `resourceMax` can layer on as a `derivedStats` field rather than mutating the actor base. The same principle as `derivedStats.atk` deriving from base + equipment, just for class-resourced state.

### Skill executor is a kind-driven switch, not polymorphism

```ts
if (skill.kind === 'aoe') { ... }
else if (skill.kind === 'mobility') { ... }
```

24 total skills (6 × 4 classes) at v1.0. A discriminated `kind` tag with inline branches is more readable than per-skill executor classes for that volume. When v0.8.0 adds skill modifiers + crafting + talent passives, the obvious factoring is per-`kind` modules — that's the right time to split, not now.

### Boss config registry pattern

```ts
const BOSS_CONFIG: Record<BossId, { baseStats; mods; phaseField }> = { ... };
```

Each new boss is a one-row extension. `maybeAdvanceBossPhase` reads the registry, `handleKill` checks `isBossId(view.actor.id)` for guaranteed drops + autosave + onBossKilled. The string-union `BossId = 'hollow-bishop' | 'worm-mother'` keeps everything type-checked: forgetting to add the next boss to `BOSS_CONFIG` fails the TypeScript build.

### Migration table populated, not empty

v0.6.0's `MIGRATIONS = {}` was scaffolding. v0.7.0 fills the first entry:

```ts
1: (file) => ({
  ...file,
  schemaVersion: 2,
  state: { ...file.state, classId: 'furyborn', resource: 0 },
}),
```

The walker (`while (v < SAVE_SCHEMA_VERSION)`) picks up `MIGRATIONS[v]` per step, so v0.8.0 can drop in `2 → 3` without touching anything else. Critically, the migrator returns the *next* version's shape — callers that pass the result into another migrator chain forward without explicit recursion.

### Boss-drop guarantee is a flag, not a separate code path

`DropContext.guaranteed` defaults false; the early-return `if (!guaranteed && rng.next() > DROP_CHANCE)` is the only change. Existing tests (which never set it) keep working. Boss code paths flip it true. No new function, no new module — the loot pipeline already had the rarity bias + base-pick logic, the guarantee just skips the "did anything drop at all" coin flip.

### Cleave as the implicit left-click attack, not a hotbar binding

Right-click + middle-click are taken (right = drop, middle = unused). Hotbar slots 1-4 belong to the player's *active* skills. Making Cleave the implicit left-click action means:
- The bind panel doesn't waste a slot showing "Strike → bound to slot 0."
- Every class gets its basic-strike "for free" without burning a hotbar slot.
- v0.8.0 classes (Bonecaller's Bone Spear, Frostmark's Bow Shot) will be their own classes' "basic" skills and inherit the same left-click contract.

## Next: v0.8.0 (Week 8)

Per spec §10:

- Class balance pass (per-class scalars, skill-damage curves)
- 20 unique-tier items (named, fixed-affix items per `data/items.json`)
- Crafting via Imbuer NPC: 3 magic same-slot → 1 rare
- Sockets (0–3 per item) + 5 gem types × 5 quality tiers
- Bonecaller class (Will / Bone Shards) — second class playable
- Probably: Furyborn stub-skills (Roar / Frenzy / Execute) flesh out

ADR 0003 (procedural sprites vs real art) likely revisits at the v0.8.0 → v0.9.0 boundary. Once we have multiple classes, multiple acts, and multiple boss silhouettes, the placeholder strain crosses a perceptual threshold.
