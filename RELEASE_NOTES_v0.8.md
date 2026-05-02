# WYRDLOOM v0.8.0 — Week 8: 20 uniques + 25 gems + Imbuer NPC + sockets + SaveAdapter v3

Loot finally has shape. The drop pipeline now rolls `unique` rarity off any monster (3% weight) and forces it on act-boss kills (`guaranteed: true` → guaranteed unique), pulling from a curated 20-entry table in `data/uniques.json` filtered by `ilvl ≤ monsterLevel`. Each unique has fixed affixes — no min/max roll — and one to three baked-in bonus sockets. Bishopcleaver, Vyltooth, Wyrdknot, the worm-chitin Vyl Carapace, and the lullaby-cursed Tin Lullaby all roll deterministically against the kill seed.

Regular monsters now also drop loose gems on a separate ~5% chance roll. 25 gem entries live in `data/gems.json` — 5 kinds (ruby/sapphire/emerald/topaz/diamond) × 5 quality tiers (chipped → perfect). Quality scales the granted stat; quality weights ramp with monster level so the Frostvein actually drops normals and flawless. Topaz and diamond carry half the weight of the standard triplet — meaningfully rarer.

The Imbuer NPC opens up shop south-east of Whitestone's courtyard. Click her, the Imbuer panel pops with two recipes: Imbue (3 magic same-slot → 1 rare, deterministic against the sorted input uids) and Socket Gem (place a loose gem into any item with an empty socket — bag or equipped — with the equipped path triggering a stat recalc so the bonus shows immediately).

The tooltip + paper-doll grew socket pips (`◇` empty, `◆` filled in the gem's kind color), unique flavor lines render in italic dim, and gem-as-bag-items get a compact "+X stat when socketed" card that swaps in for the gear-style layout.

SaveAdapter bumps to schema version 3 — no shape break (sockets/gems/uniques are optional fields on `Item`), just a writer-stamp so future shape-breaking changes can branch on it.

## What ships

### Item schema (`src/types/items.ts`)

- `ItemMod` gains the `armor_flat` variant (added in v0.8.0 prep; emerald gems are the first consumer) — every existing exhaustive switch on `modType` lit up red and got an Armor case.
- `Item.unique?: { id, flavor }` — present on uniques only; tooltip and inventory key off it.
- `Item.sockets?: Array<Gem | null>` — mutable on purpose; socketing replaces a `null` entry without needing to re-roll the rest of the gear.
- `Item.gem?: Gem` — set when the Item is a bag-only wrapper for a loose gem (no affixes, equip flow refuses it). Slot is a placeholder ('ring' is conventional).
- `GemDef`, `Gem`, `UniqueDef` types — shared between the JSON authoring files and the runtime.
- `GEM_KINDS` and `GEM_QUALITIES` are `as const` tuples so the kind/quality strings are typed and discriminated unions feed off them.

### Drop pipeline (`src/systems/loot.ts`)

- `RARITY_WEIGHTS` now: common 50 / magic 35 / rare 12 / unique 3. Mythic stays deferred (v0.10.0 target).
- `rollDrop`:
  - `ctx.guaranteed === true` skips the chance roll AND forces `rarity = 'unique'` (act-boss kills always drop a unique).
  - `'unique'` rolls dispatch to `rollUniqueItem` which filters `data/uniques.json` by `ilvl ≤ monsterLevel`, weight-picks by ilvl-gap proximity, hydrates fixed affixes into `RolledAffix[]`, and bakes `bonusSockets` into a fresh `sockets: Array<Gem|null>`.
  - Non-unique drops also roll a small socket count via `SOCKET_WEIGHTS_BY_RARITY` — sockets are scarce by design (gem-economy bottleneck): common rarely sockets, rare can hit 2 with a long tail to 3.
- `rollGemDrop(ctx)` is a separate exported path with `GEM_DROP_CHANCE = 0.05`. Salts the seed (`${seed}-gem`) so the gem roll is independent of the gear roll — a single kill can drop both. Returns an `Item` wrapping the gem so the existing ground-spawn / pickup pipeline takes it as-is.
- Gem quality weights ramp with monster level (chipped/flawed dominate at ilvl ≤ 4; perfects start showing up at ilvl 14+). Topaz and diamond carry half the kind-weight of ruby/sapphire/emerald.
- Determinism preserved end-to-end — same `(monsterLevel, seed, guaranteed)` always produces the same drop, and unique fixed-affix values are integers (no range roll).

### Loot data (`data/uniques.json`, `data/gems.json`)

- **20 uniques** across ilvl 1–16: 7 weapons, 4 head, 4 chest, 5 ring. Highlights:
  - `u-vyltooth` (Steel Blade ilvl 16, +22 / +10 atk, +6 armor, **3 sockets**)
  - `u-wyrdknot` (Gold Signet ilvl 15, +20 atk / +35 hp / +6 armor, 3 sockets)
  - `u-bishopcleaver` (Steel Blade ilvl 12, +14 / +8 atk, +18 hp, 2 sockets)
  - `u-vyl-carapace` (Plate Cuirass ilvl 16, +22 armor, +60 hp, 3 sockets)
  - `u-fang-of-the-cub` (Rusty Dagger ilvl 1, +4 atk, +12 hp, 1 socket — first-act starter unique)
- **25 gems** = 5 kinds × 5 qualities. Ruby/Topaz are atk_flat; Sapphire/Diamond are hp_flat; Emerald is armor_flat. Quality doubles each tier (e.g. Ruby chipped 2 → perfect 32 atk). Topaz scaling is steeper (3 → 48); Diamond is the hp powerhouse (6 → 96).

### Imbuer NPC + crafting (`src/systems/crafting.ts`, `src/ui/imbuer_panel.ts`, `src/levels/whitestone.ts`)

- Imbuer NPC placed at `(11, 10)` in Whitestone — south-east of the courtyard, near the Frostvein gate. Sprite was already authored in `npc_sprite.ts`.
- `imbueRare(inputs)` validates: exactly 3 inputs, all magic, no gems, all same slot. Picks the highest-ilvl base from the inputs (so 3 magic Steel Blades yield a rare Steel Blade, not a downgrade). Affixes freshly rolled as rare against a deterministic seed (`imbue-` + sorted input uids) so selection order doesn't matter.
- `socketGem(item, gem, socketIx?)` validates the item has at least one empty socket; falls back to first empty if no index given. Returns a new Item ref with the socket filled — does not mutate the original.
- `<wyrd-imbuer>` Lit panel (PanelId `'imbuer'`):
  - Two tabs: **Imbue** lists magic items grouped per-slot and enforces the same-slot rule client-side; **Socket** has two columns (gems + items with empty sockets), pick one of each then click Socket.
  - Status line shows recipe state ("0/3 selected", "Pick a gem and a target", "Imbued.", "Socketed.").
  - Selections prune themselves on `STATE_CHANGED_EVENT` so consumed items don't linger as ghost selections.
- Opens automatically when the player clicks the Imbuer NPC (alongside the existing NPC dialog).
- Intent events: `INTENT_IMBUE_EVENT` carries 3 uids; `INTENT_SOCKET_EVENT` carries `gemUid + targetUid`. main.ts handlers (`handleImbue`, `handleSocket`) own the inventory + equipment mutations and trigger `recomputeStats` on equipped-item socketing.

### Tooltip + character sheet (`src/ui/tooltip.ts`, `src/ui/character_panel.ts`)

- Tooltip renders three new branches:
  - Unique flavor in italic dim under the affix list (e.g. *"Pried from the worm-mother's lower jaw."* for Vyltooth).
  - Socket pips colored by gem kind (`◆` ruby = `#c44a2a`, sapphire = `#3a6ec9`, emerald = `#3aa75a`, topaz = `#c8a64a`, diamond = `#dceaf0`; `◇` empty at 45% opacity). Filled pips also list the socketed gem's stat contribution under the pip row.
  - Gem-as-bag-item card: name in gem-kind color, "+X stat when socketed" line — replaces the gear-style layout entirely when `item.gem` is set.
- Paper-doll equipped slots show a compact pip row under the item name, so socket count is visible at a glance without opening the tooltip.

### SaveAdapter v3 (`src/platform/SaveAdapter.ts`)

- `SAVE_SCHEMA_VERSION` bumps from 2 → 3.
- `MIGRATIONS[2]` is a version-stamp bump only — `Item.unique`, `Item.sockets`, `Item.gem` are all optional, so v2 saves load shape-clean. The migrator exists so a future shape-breaking change can branch on `schemaVersion === 3`.
- v1 → v2 → v3 walks through both migrators end-to-end (covered by tests).

### Tests

- `tests/unit/loot.spec.ts` — 11 tests total (4 new): guaranteed boss kill forces a unique with flavor; unique fixed-affix values are deterministic and integer-valued; `rollGemDrop` wraps a Gem in a bag-only Item; gem drops are seed-deterministic.
- `tests/unit/crafting.spec.ts` — 11 tests covering imbue input validation (count, rarity, gem rejection, slot mismatch), highest-ilvl base selection, deterministic output for sorted uid seed, socketing into empty / specific / filled / no-socket cases, and immutability (returns new Item ref).
- `tests/unit/save_adapter.spec.ts` — schema version assertion bumped to 3; migration table assertion expects `['1', '2']`; new test walks v1 → v3 end-to-end (preserves zoneId/killCount and adds Furyborn defaults at the v1→v2 step), and a v2 → v3 no-shape-change test.

## File tree

New:
- `data/uniques.json` (130 lines)
- `data/gems.json` (35 lines)
- `src/systems/crafting.ts` (~120 lines)
- `src/ui/imbuer_panel.ts` (~250 lines)
- `tests/unit/crafting.spec.ts` (~130 lines)
- `RELEASE_NOTES_v0.8.md`

Touched:
- `src/types/items.ts` — added Gem/UniqueDef shapes, Item gains gem/sockets/unique optional fields, ItemMod gains `armor_flat`.
- `src/systems/loot.ts` — unique + gem drop paths, socket-count rolling.
- `src/systems/inventory.ts` — `computeDerivedStats` folds socketed gem stats with new `armor_flat` case.
- `src/ui/tooltip.ts` — gem card, socket pips, unique flavor.
- `src/ui/character_panel.ts` — socket pips on the paper-doll.
- `src/ui/panel.ts`, `src/ui/store.ts` — `'imbuer'` PanelId, ImbueIntent/SocketIntent event types.
- `src/levels/whitestone.ts` — Imbuer NPC entry.
- `src/actors/Npc.ts` — Imbuer dialog teaser updated.
- `src/main.ts` — APP_VERSION bump, intent handlers, NPC kind → panel routing, gem drop call in `handleKill`.
- `src/platform/SaveAdapter.ts` — SCHEMA_VERSION 3, MIGRATIONS[2] no-op stamp.
- `tests/types/wyrdloom-global.d.ts` — `openPanel` accepts `'imbuer'`.
- `tests/unit/loot.spec.ts` — unique + gem coverage.
- `tests/unit/save_adapter.spec.ts` — v3 assertions + v2→v3 migration test.
- `tests/e2e/*.spec.ts` — TARGET_VERSION / VERSION constants bumped to '0.8.0'.

## Numbers

- 84 unit tests pass (1619 expect calls).
- TypeScript strict + `noUncheckedIndexedAccess` clean across src + tests.
- Production build: 125.60 kB gzip 37.71 kB (game bundle); 519.53 kB gzip 150.23 kB (Pixi vendored).
- 20 uniques + 25 gems + 12 base items + 14 affix templates × 5 tiers = the full v0.8.0 loot surface.

## Known gaps (carry into v0.9.0)

- Mythic-tier rarity stays deferred — RARITY_WEIGHTS doesn't list it; tooltip/character-sheet would render it correctly if it ever fired, but no drop path emits one.
- The other 3 classes (Bonecaller / Frostmark / Sealwarden) still only exist as ClassId tags. v0.9.0 ships their kits + the Pact-Bearer as Act III boss.
- Stash + Smith NPCs at Whitestone remain placeholder dialogs.
- Gems can be socketed in equipped items but cannot yet be unsocketed — no Imbuer recipe for gem extraction (intentional: D2 also gates this behind a costly rune-recipe; v0.9.0 may add it).
- Socketing UI is keyboard-only via clicks in the panel; no drag-and-drop from inventory yet.
