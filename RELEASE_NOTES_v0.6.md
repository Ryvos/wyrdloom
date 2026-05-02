# WYRDLOOM v0.6.0 — Week 6: Whitestone hub + zone system + Act-I quest spine + Hollow Bishop boss + SaveAdapter

The game is no longer "spawn into a dungeon." Each session boots into the Whitestone hub — a hand-authored 16×16 town courtyard — where the Quest-board NPC greets the player with the active intro quest. Stepping onto the south doorway transitions the world to the procedurally-generated catacombs. Three Act-I main quests gate progression in order: descend → kill 3 grunts → recover a relic → defeat the Hollow Bishop. The boss has 3-phase combat with escalating attack and shrinking cooldown. Save state persists to IndexedDB on web (5 character slots, schema-versioned).

## What ships

### Zone system (`src/systems/zone.ts`, `src/levels/whitestone.ts`, `src/levels/catacombs.ts`)

- `Zone` is a frozen handle: `id`, `map`, `playerEntry`, `doorways[]`, optional `entryFromZone` map for "where to drop the player when they came from zone X."
- A `Doorway` is a tagged floor tile in the parent zone; walking onto it triggers `loadZone(target, fromZone)`. Doorways only fire on path completion — not on spawn placement — so the player doesn't bounce back instantly when they land on the catacombs entrance from the hub.
- `clearZone()` tears down old tile sprites + actors before `loadZone()` builds the new map. Old visual children are explicitly destroyed; without this, the world container would accumulate stale geometry across transitions.
- Whitestone is a hand-authored hub: outer wall border, full-floor courtyard, doorway at (8, 14) → catacombs, return entry tile at (8, 13) for re-entry from the catacombs.
- Catacombs reuses v0.5.0 BSP procgen verbatim; `makeCatacombsZone(seed)` adds the doorway-back-to-hub at the entrance-room center.

### NPCs (`src/actors/Npc.ts`, `src/fx/npc_sprite.ts`, `src/ui/npc_dialog.ts`)

- Four NPC kinds defined: `questboard`, `smith`, `imbuer`, `stash`. Only `questboard` is wired in v0.6.0; the other three are placeholders for v0.7.0+ vendor / crafting work per spec §10.
- Click-to-talk: clicking an NPC tile sets a goal to a 4-connected adjacent floor tile. On path arrival, `wyrdloom:npc-dialog-open` fires with `{ kind, npcName }` and the Lit `<wyrd-npcdialog>` panel pops centered.
- Quest-board renders the active + completed quest list with progress (`x/n · Reward: ...`). Other NPC kinds show greeting + teaser text only.
- Procedural Pixi sprites per kind: tall billboard (questboard), anvil-and-figure (smith), robed silhouette (imbuer), chest (stash). Real art still deferred per ADR 0003.

### Quest system (`src/types/quests.ts`, `src/systems/quests.ts`, `data/quests.json`)

- Discriminated union `QuestObjective`: `enter_zone`, `kill_count` (zone-tagged), `boss_kill` (specific boss id), `rare_pickup`. Pure-functional state transitions: `onEnterZone`, `onEnemyKilled`, `onBossKilled`, `onRarePickup` each return the list of quest IDs they completed.
- Sequential main-quest unlock: `activateNextMainAfter(state, completedQuestId)` finds the next-order main quest and flips it to `active`. Only the lowest-`order` main quest is shown in the compact tracker; expanded view (Q key) shows everything.
- Four authored quests in `data/quests.json`:
  - `q-intro-descend` — auto-active at construction; completes on first catacombs entry.
  - `q-act1-bones` — kill 3 grunts in catacombs; activates after intro.
  - `q-act1-relic` — pick up any rare-tier item; activates after bones.
  - `q-act1-bishop` — slay the Hollow Bishop; activates after relic.
- `makeQuestState()` builds the initial state with `q-intro-descend` already active. New characters never start with an empty quest log.

### Quest tracker HUD (`src/ui/quest_tracker.ts`)

- `<wyrd-questtracker>` Lit component, anchored to the right edge of the HUD layer.
- Compact mode: shows the lowest-order active main quest with progress (`Whispers from below · 0/1`).
- Expanded mode: full quest list with status, progress, and reward. Toggled by the `Q` key or by clicking the compact tracker.

### Hollow Bishop boss (`src/actors/Actor.ts`, `src/fx/sprites.ts`)

- Stats: 200 HP, 12 atk, 1-tile range, 900 ms cooldown, 8-tile aggro, 220 ms move-cd.
- 3 phases gated on remaining HP:
  - **Phase 1 (100% → 67%)**: baseline.
  - **Phase 2 (67% → 33%)**: atk × 1.4 (12 → 17), cd × 0.8 (900 → 720 ms).
  - **Phase 3 (33% → 0%)**: atk × 1.8 (12 → 22), cd × 0.65 (900 → 585 ms).
- Phase advance fires inside `tickPlayer` after a non-killing hit lands; `maybeAdvanceBossPhase` re-stats the actor in place.
- Drops a guaranteed item with seed `boss-${id}-${killCount}`, monsterLevel 12 (vs 5 for grunts) — biases towards rare-tier rolls.
- No respawn. Bosses stay dead.

### SaveAdapter v1 (`src/platform/SaveAdapter.ts`)

- 5 character slots, 1-indexed. `isValidSlot()` is the single source of truth.
- Schema-versioned: `SAVE_SCHEMA_VERSION = 1`. `migrate()` walks `MIGRATIONS[fromVersion]` until the file matches the current version. Empty migration table in v0.6.0 — fail-fast on unknown older versions ("no migrator from schema 0") and refuses to load saves from a newer build ("save is from a newer build").
- `SaveFile` records `{ schemaVersion, createdAt, updatedAt, characterName, version (app), state }`. `SaveState` carries player HP + stats, inventory, equipment, hotbar, current zone id, catacombs seed, kill count, full quest state.
- `WebSaveAdapter` (`src/platform/WebSaveAdapter.ts`) — IndexedDB via `idb`. DB `wyrdloom`, store `saves`, keyed by slot. The live target for the v0.6.0 web ship.
- `TauriSaveAdapter` (`src/platform/TauriSaveAdapter.ts`) — JSON files in `$APPDATA/wyrdloom/saves/slot_<n>.json` per spec §2.5 capability scope. Lazy-imported via `await import('@tauri-apps/plugin-fs')` with `/* @vite-ignore */` so the web bundle never tries to resolve the optional dep. **Functional code path; runtime verification against a real Tauri build deferred to v0.6.x.**
- `makeSaveAdapter()` (`save_factory.ts`) probes `window.__TAURI_INTERNALS__` and picks the right adapter at runtime.

### Auto-save triggers (`src/main.ts`)

- Save fires on: zone change (after the new zone loads), boss kill (after the kill drop resolves), and the `S` key in the hub. Manual save is hub-only — anti-save-scum per spec §8.
- Default character name `'Wyrdling'`; default catacombs seed `'catacombs-1'`. These are placeholders for v0.7.0's character-creation screen.
- `dev.saveNow(slot)` / `dev.loadSlot(slot)` / `dev.deleteSlot(slot)` / `dev.listSlots()` — test-only handles. The save round-trip e2e in `hub_quests.spec.ts` exercises the full path: equip an item, descend into catacombs, save → reload page → load slot → assert zone + atk + equipment + bag length all match.

## Verification

| Layer | Result |
|---|---|
| Vitest unit (combat, AI, iso, loot, inventory, bag, procgen, pathfinding, **quests**, **save_adapter**) | **67/67 pass** |
| Playwright e2e (chromium + webkit, 36 specs each) | **72/72 pass** |
| ESLint, max-warnings 0 | clean |
| TypeScript strict + `noUncheckedIndexedAccess` | clean |
| License + capability gate | clean (no new assets, no new permissions) |

Live-driven through Playwright MCP and the dedicated `bun test:e2e` runner:

- Boot into Whitestone (8, 8) with the Quest-board NPC at (8, 7), no enemies.
- `dev.openNpcByKind('questboard')` opens the dialog with header "Quest-board", greeting "Whitestone Quest-board", and the active intro quest in the list.
- `dev.changeZone('catacombs')` swaps the world: player at (8, 4), grunt + Hollow Bishop spawned, intro quest auto-completes, bones quest auto-activates.
- Save round-trip: equip Honed Iron Sword, descend, save → page reload → load → atk + equipment + zone all restored from IndexedDB.

## Caveats

- **Tauri save adapter is untested at runtime.** The code path is wired and types check, but no actual `tauri dev` boot has been verified yet. v0.6.x will close this; the web adapter is the live ship target for v0.6.0.
- **Title screen + character creation deferred.** The game still drops directly into the hub with the default character name `'Wyrdling'`. Spec §10 puts the title screen + class select in v0.7.0 alongside the talent grid.
- **Catacombs spawns 1 grunt + 1 boss.** The bones quest (kill 3 grunts) relies on the 3-second grunt respawn cycle to be completable. That's playable but tight; v0.7.0 will scale enemy population per room.
- **Hidden rooms and shrines deferred.** Per spec §4.5 each dungeon should have 1–2 hidden rooms and 1 shrine; those land alongside multi-floor dungeons in v0.7.0.
- **Side quests deferred.** v0.6.0 ships only the 3 main quests of Act I + intro. The 6 side quests per spec §5 are queued for v0.7.0–v0.8.0.
- **No floor transitions, single dungeon floor.** Same as v0.5.0 — the catacombs is one floor. Multi-floor + intra-act doors come later.
- **No audio.** howler.js is in `package.json` but unused; sound design comes with the asset pipeline.
- **Procedural Pixi sprites everywhere.** ADR 0003 stands.

## Notable design decisions

### Zone change as the *single* mutable-state transition

`loadZone(W, target, from)` is the only function that swaps the world container's tiles, the actor list, and the dungeon map at once. Click handlers only set `pendingZoneTarget`; the actual swap fires on path arrival inside `tickPlayer`. This makes the doorway flow side-effect-free until the player physically arrives, which is what avoids the "spawn-on-doorway → instant transition back" bug.

### Discriminated union for `QuestObjective`

```ts
type QuestObjective =
  | { kind: 'enter_zone'; zoneId: ZoneId; count: 1 }
  | { kind: 'kill_count'; zoneId: ZoneId; count: number }
  | { kind: 'boss_kill'; bossId: string; count: 1 }
  | { kind: 'rare_pickup'; count: 1 };
```

Each event handler (`onEnemyKilled`, `onBossKilled`, etc.) narrows the union by `kind`. New objective types (e.g., `npc_talk` or `item_use`) are additive — TypeScript fails the build if any handler forgets the new variant. This is the "make illegal states unrepresentable" pattern paying off: `objective.count` is structurally guaranteed to be 1 for `enter_zone` and `boss_kill`, and arbitrary for `kill_count`.

### Schema migrations as a table, not a chain

```ts
export const MIGRATIONS: Record<number, MigrateFn> = {
  // 0: (s) => upgradeFrom0(s),  // when v0.7.0 bumps SAVE_SCHEMA_VERSION
};
```

`migrate()` is a `while (file.schemaVersion < CURRENT)` loop that looks up `MIGRATIONS[file.schemaVersion]` and applies it, rinse-repeat. New migrations are just new table entries; you can't accidentally skip a version. The empty table in v0.6.0 is *intentional* — schema version 1 is the foundational baseline. Loading a (hypothetical) v0.5-era save fails fast with `"no migrator from schema 0"` rather than silently corrupting state.

### Lazy import + `/* @vite-ignore */` for the optional Tauri dep

```ts
async function fs(): Promise<TauriFs> {
  const mod = '@tauri-apps/plugin-fs';
  return await import(/* @vite-ignore */ mod);
}
```

Two layers of defense: the `__TAURI_INTERNALS__` runtime probe in `save_factory.ts` keeps the *code path* from running in the browser, and the `/* @vite-ignore */` keeps Vite from statically resolving the *module reference* and 500-ing in the dev server. The `mod = '...'` indirection is what stops Vite's static analysis; without that, even `/* @vite-ignore */` isn't enough on every Vite version. Both layers are needed — one without the other still breaks one of (web bundle, web dev-server boot).

### Manual save in the hub only

Per spec §8: "anti-save-scum: no in-combat save." The `S` key handler checks `currentZone.id === 'whitestone'` and silently no-ops elsewhere. Auto-save still fires on zone change and boss kill, so progress is preserved without giving the player a "save before the bishop's phase 3" exploit.

### Inventory/equipment serialize as POJOs

`SaveState.inventory` and `.equipment` are plain JSON-serializable. `makeInventory` and the bag system already operate on POJO state, so save/load is just `structuredClone` + `JSON.stringify`. No reanimating "instances" — the actor view layer rebuilds itself from POJOs on load.

## Next: v0.7.0 (Week 7)

Per spec §10:

- Title screen + character creation (class select, name input)
- Talent grid (Path-of-Exile-lite passive tree)
- Smith / Imbuer / Stash NPC implementations (vendor UI, gear-imbuing flow, account stash)
- Side-quest system (the 6 Act-I side quests deferred from v0.6.0)
- Multi-floor dungeons + hidden rooms + shrines
- Frostmoor town hub (Act II) + 6 zones for Act II
- Audio pipeline (howler.js wiring + first-pass SFX library)

ADR 0003 (procedural sprites vs real art) likely revisits here too — by Act II the placeholder aesthetic strain becomes real.
