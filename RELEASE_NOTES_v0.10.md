# WYRDLOOM v0.10.0 — Week 10: The Echo + sigils + Mythic + Pinnacle. Sealwarden unlocks.

The endgame opens. The Pact-Bearer's first death drops a tier 1–3 sigil; bring it to The Wyrdkeeper, who has set up at the south-west of Whitestone's courtyard. Click a sigil in their portal panel and the world shifts — the Echo zone loads, BSP-procgen seeded by tier and floor, lit by an unstable violet color grade. Floors 1–4 are tier-scaled grunt packs; floor 5 hosts the Pinnacle. Killing the Pinnacle drops a Mythic — the rarity that has waited in the type system since v0.3.0 finally lights up. Five mythic items ship in `data/mythics.json`, every one with three baked sockets, ilvl 30, and a place in the chase.

Sealwarden joins the playable roster — Faith / Vigil / Paladin per spec §4.2. Vigil regenerates passively + builds modestly on hit (+2/s + 6 per hit), making the rotation feel like a paladin who steadies between strikes rather than Furyborn's hits-build-rage burst or Frostmark's idle-mana sustain. Six skills authored, three implemented (Smite basic, Consecrate aoe, Aegis Step mobility). The class is **gated on `endingSeen === true`** — `setClass('sealwarden')` returns false with a console hint until the Pact-Bearer's ending overlay has been dismissed at least once. v0.9.0's one-shot ending flag earning double duty.

SaveAdapter bumps to schema v5 — adds optional `echoTier` + `echoFloor` so an in-progress Echo run survives a save/load cycle. Pre-v0.10.0 saves leave the fields absent (no active run). The migrator is a version-stamp bump only, but the new fields persist seamlessly through the snapshot/restore plumbing in main.ts.

## What ships

### Sealwarden class (`src/systems/class.ts`, `src/systems/skills.ts`)

```
sw-smite        0 vigil    basic       1.0×    Sealed strike. Builds Vigil on every landed hit.
sw-consecrate   30 vigil   aoe         0.7×    Hallowed pulse — every adjacent enemy. 1700 ms cd.
sw-aegis        30 vigil   mobility    —       Step under your aegis, dash 4 tiles. 5000 ms cd.
sw-sanctify     50 vigil   buff        —       [v0.10.x] Vigil ground — heal-over-time.
sw-wrath        55 vigil   finisher    2.8×    [v0.10.x] Verdict — colossal damage.
sw-final-verse  0 vigil    passive     —       [v0.10.x] Low-HP Vigil x3 regen.
```

- `SEALWARDEN` ClassDef: `stat: 'faith'`, `resource: 'vigil'`, `resourceMax: 100`, `resourceRegen: 2`, `resourceOnHit: 6`, `resourceColor: '#c8b878'`. Bulkiest of the three implemented classes — 145 HP / 24 atk / 520 ms swing / 170 ms move-cd.
- Locked behind `W.endingSeen` per spec §4.2 ("unlock post Act III"). The dev hook `__wyrdloom.dev.setClass('sealwarden')` returns `false` and logs a warning if the player hasn't dismissed the Pact-Bearer ending yet.

### Sigils + The Wyrdkeeper (`src/levels/whitestone.ts`, `src/actors/Npc.ts`, `src/ui/echo_portal_panel.ts`)

- `Item.sigil?: { tier: number }` — bag-only Item shape (mirrors `Item.gem`). Empty affixes, ring-slot placeholder, equip flow refuses.
- `rollSigilDrop(ctx, opts?)` exported from `loot.ts`: 8% drop chance off any boss; `opts.forced` makes it deterministic-tier (used by Pact-Bearer). `tierFloor`/`tierCeil` clamp the rolled tier so future content (deeper Pinnacle drops at higher tiers) just calls in with bigger numbers.
- Pact-Bearer kill always rolls a tier 1–3 sigil alongside the guaranteed unique. Other boss kills get the 8% chance.
- **Wyrdkeeper NPC** at Whitestone `(4, 10)` (south-west courtyard). New `'wyrdkeeper'` NpcKind, sprite is a hooded figure cradling a violet rune-light, dialog teaser: "Bring me a sigil. The Echo will hear."
- **`<wyrd-echo-portal>` Lit panel** (PanelId `'echo-portal'`): lists bag sigils sorted by tier descending, each row consumes the sigil and triggers `INTENT_ECHO_ENTER_EVENT`. main.ts's `handleEchoEnter` removes the sigil from the bag, sets `W.echoTier` + `W.echoFloor = 1`, autosaves, and loads the Echo zone.
- Tooltip renders sigils as a compact card with tier-scaled color (gold ≤ tier 4, amber 5–9, red ≥ 10) — same pattern as the gem-as-bag-item card.

### The Echo zone (`src/levels/echo.ts`, `src/main.ts`)

- New `'echo'` zone in `ZONES`. Distinct seed per `(tier, floor)` pair — `echo-t{tier}-f{floor}` — so a tier-5 floor-3 always lays out the same.
- `applyZoneFilter` Echo case: `saturate(-0.3)`, `tint(0x9a8ad0)`, `brightness(0.75)` — high-contrast violet, brightness pulled down so each floor reads as an unstable echo of the surface world.
- `spawnEchoActors`: floors 1–4 spawn a tier-scaled grunt pack (count `1 + (tier+floor)/2`, capped at 6). ENEMY_STATS scaled by `1 + tier × 0.15` for HP + atk; cooldown drops `30 ms × tier` for real difficulty. Floor 5 spawns the Pinnacle alone with stats scaled by `1 + tier × 0.2` for HP / `1 + tier × 0.12` for atk.
- Doorway at the entry tile leads back to Whitestone — the player can always bail. Pinnacle kill auto-bounces the player back after 800 ms (lets the death animation land first), clearing `echoTier`/`echoFloor` so the run is recoverable on reload.

### The Pinnacle boss (`src/actors/Actor.ts`, `src/fx/sprites.ts`)

- `PINNACLE_STATS`: maxHp 400, atk 28, atkCooldownMs 950, aggroRange 10, moveCooldownMs 220 (highest baseline of any boss).
- `PINNACLE_PHASE_MODS`: `[1.0/1.0, 1.55/0.75, 2.1/0.6]`. Phase 3 doubles atk and crushes cooldown to 0.6 — the spec's hardest fight, designed for tier-15+ Echo runs.
- New `PINNACLE_ID` joins `BossId`. `BOSS_CONFIG` registry takes a one-row addition with `phaseField: 'pinnaclePhase'`. Same pattern that absorbed the Pact-Bearer in v0.9.0.
- `makePinnacleSprite`: cathedral-knight silhouette like the Pact-Bearer but the cape fragments into shards along its hem, the chest sigil is a circle of violet light, the visor glows violet, and two echo-shards float beside the figure. Reads as an unstable echo of the act-final boss.
- Pinnacle kill calls `rollDrop({ ..., mythic: true })` — a new `DropContext` flag that routes through `rollMythicItem`. monsterLevel = `20 + W.echoTier`, so a tier-15 Pinnacle is mlvl 35 (above every Mythic's ilvl 30 gate).

### Mythic items (`data/mythics.json`, `src/types/items.ts`, `src/systems/loot.ts`)

- 5 mythic items, all ilvl 30, all 3 sockets, all named to tie back to the Pinnacle's identity:
  - **Pinnacle Shard** (Steel Blade, +36/+18 atk, +80 hp)
  - **Broken Oath** (Gold Signet, +28 atk, +60 hp, +12 armor)
  - **The Echo-Thread** (Chain Hauberk, +32 armor, +100 hp, +12 atk)
  - **Helm of the Pinnacle** (Winged Helm, +80 hp, +14 armor, +16 atk)
  - **Wyrdblade** (Steel Blade, +44/+22 atk, +50 hp, +8 armor)
- `MythicFile` type alias (re-uses `UniqueDef` shape — same fixed-affix / flavor / bonus-sockets layout).
- `rollMythicItem` is a separate path from `rollUniqueItem`: equal weights across the 5 mythics (ilvl-bias would barely shift anything with only 5 entries, and the spec wants every Mythic to feel like a chase). Tooltip + character sheet + ground-item code already render mythic-rarity items correctly via `RARITY_COLOR.mythic = #b84a3a` (authored back in v0.3.0).

### SaveAdapter v5 (`src/platform/SaveAdapter.ts`)

- `SAVE_SCHEMA_VERSION` bumps from 4 → 5.
- `SaveState` gains `readonly echoTier?: number` and `readonly echoFloor?: number` — both optional. Snapshot only writes them when `W.echoTier > 0` (no active run = absence of fields = clean payload).
- `MIGRATIONS[4]` is a version-stamp bump (the new fields are optional).
- Migration walk now: v1 → v2 → v3 → v4 → v5. Four migrators, each tiny.

### Tests

- `tests/unit/loot.spec.ts` — 15 tests total (4 new): mythic flag forces mythic-rarity drop with 3 sockets and flavor; mythic drops are seed-deterministic; forced sigil returns a bag-only Item with positive tier; sigil drops respect tier bounds + are deterministic.
- `tests/unit/save_adapter.spec.ts` — schema version assertion bumped to 5; MIGRATIONS keys assertion now expects `['1', '2', '3', '4']`; new test for v4 → v5 (no shape change, echoTier stays undefined); v3 → v5 walk-through preserved.
- All pre-existing tests still pass after the additions — 90/90 unit tests green (1639 expect calls).

## File tree

New:
- `src/levels/echo.ts` (~30 lines)
- `src/ui/echo_portal_panel.ts` (~140 lines)
- `data/mythics.json` (5 mythic entries)
- `RELEASE_NOTES_v0.10.md`

Touched:
- `src/systems/class.ts` — `SEALWARDEN` def added; `CLASSES` array now lists three classes.
- `src/systems/skills.ts` — 6 Sealwarden skills appended.
- `src/systems/zone.ts` — `ZONES` extended with `'echo'`.
- `src/levels/whitestone.ts` — Wyrdkeeper NPC entry.
- `src/actors/Npc.ts` — `'wyrdkeeper'` NpcKind + dialog teaser.
- `src/actors/Actor.ts` — `PINNACLE_STATS` + `PINNACLE_PHASE_MODS`.
- `src/fx/sprites.ts` — `makePinnacleSprite`.
- `src/fx/npc_sprite.ts` — wyrdkeeper case (hooded figure + rune-light).
- `src/types/items.ts` — `Item.sigil?` + `MythicFile` type.
- `src/systems/loot.ts` — `rollMythicItem`, `rollSigilDrop`, `DropContext.mythic` flag, mythic data import.
- `src/main.ts` — APP_VERSION bump, header rewrite, Echo zone load + spawn block, Pinnacle wiring across BossId / BOSS_CONFIG / handleKill / monsterLevel branch / mythic flag, sigil drop in handleKill, Sealwarden gate in setClass, handleEchoEnter, Wyrdkeeper → portal-panel routing, echoTier/echoFloor on World + snapshotSaveState + loadSaveAndApply.
- `src/platform/SaveAdapter.ts` — SCHEMA_VERSION 5, echoTier/echoFloor optional fields, MIGRATIONS[4].
- `src/ui/store.ts` — `INTENT_ECHO_ENTER_EVENT` + `EchoEnterIntent` type.
- `src/ui/panel.ts` — `'echo-portal'` PanelId.
- `tests/types/wyrdloom-global.d.ts` — Echo-related fields, wyrdkeeper, echo-portal, sealwarden in dev signatures.
- `tests/unit/loot.spec.ts` — mythic + sigil coverage.
- `tests/unit/save_adapter.spec.ts` — v5 assertions + v4→v5 / v3→v5 migration tests.
- `tests/e2e/*.spec.ts` — VERSION / TARGET_VERSION constants bumped to '0.10.0'.

## Numbers

- 90 unit tests pass (1639 expect calls).
- TypeScript strict + `noUncheckedIndexedAccess` clean across src + tests.
- Production build: 144.36 kB gzip 42.26 kB (game bundle, +11.42 kB / +2.65 kB gzip from v0.9.0 — Sealwarden + Echo zone + Pinnacle + Mythic data + Wyrdkeeper panel + sprite); 519.53 kB gzip 150.23 kB (Pixi vendored, unchanged).
- Save schema: v5. Migration table covers v1 → v5 end-to-end.
- Class roster: 3 of 4 implemented (Furyborn, Frostmark, Sealwarden). Bonecaller remains a ClassId tag — v0.11.0+ target.
- Rarity tiers: all 5 are now reachable (common / magic / rare / unique / mythic). Spec target met for v0.10.0.

## Known gaps (carry into v0.11.0+)

- The Echo currently terminates on Pinnacle kill — there is no "next sigil" continuation flow yet. Floor-5 clear bounces back to Whitestone. v0.11.0 may add an "endless tier" mode that consumes the next sigil automatically.
- Sigil-tier scaling is linear — no magic-find multiplier yet. Spec §4.7 mentions "Tier scales monster level + magic find + boss difficulty"; v0.10.0 hits 2 of 3.
- Bonecaller stays a ClassId tag — last class to ship its kit; targets v0.11.0 alongside settings/accessibility per the v1.0.0 plan.
- Sealwarden's three stub skills (Sanctify / Verdict / Final Verse) are bind-panel-visible but grayed out. Effects ship in v0.10.x.
- The Echo only goes through floor 5 in a single sigil consume — "Pinnacle every 5 floors" with rolling sigil-tier increments waits for v0.11.0.
