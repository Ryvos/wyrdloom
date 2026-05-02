# WYRDLOOM

Single-player isometric action-RPG in the Diablo / Path-of-Exile lineage. **Open-source**, **MIT-licensed**, **no telemetry**, **no microtransactions**, **no online-only DRM**. Ships as both a browser demo and signed native desktop binaries from the same TypeScript source.

> Status: **v0.6.0 — Week 6: Whitestone hub + zone system + 4-quest spine + Hollow Bishop boss + SaveAdapter.** Player now boots into the Whitestone town hub, talks to the Quest-board NPC, and descends into the procgen catacombs through a doorway tile. Three Act-I quests progress sequentially; Hollow Bishop has 3-phase combat. Save state persists to IndexedDB on web (Tauri FS adapter wired but untested at runtime). See `RELEASE_NOTES_v0.6.md`.

![v0.5.0 dungeon spike](docs/v0.5.0-spike.png)

## What's in v0.6.0

- **Zone system** (`src/systems/zone.ts`): doorway tiles transition the player between zones; per-zone player entry tile, NPC list, and color grade
- **Whitestone hub** (`src/levels/whitestone.ts`): hand-authored 16×16 town courtyard with the Quest-board NPC; warm color filter contrasts with the cold catacombs grade
- **Catacombs zone** (`src/levels/catacombs.ts`): wraps v0.5.0 BSP procgen; doorway returns the player next to the Whitestone south gate
- **NPC system** (`src/actors/Npc.ts` + `src/fx/npc_sprite.ts`): `questboard` NPC kind ships in v0.6.0; `smith`, `imbuer`, `stash` placeholders ready for v0.7.0–v0.8.0
- **Quest system** (`src/systems/quests.ts` + `data/quests.json`): four authored quests — intro `q-intro-descend` (auto-active, completes on first catacombs entry), `q-act1-bones` (kill 3 grunts), `q-act1-relic` (rare pickup), `q-act1-bishop` (boss kill). Sequential main-quest unlock chain via `activateNextMainAfter`
- **Quest tracker HUD** (`src/ui/quest_tracker.ts`): compact lowest-order-active view; `Q` toggles expanded all-quests panel
- **NPC dialog HUD** (`src/ui/npc_dialog.ts`): Quest-board renders the active + completed quest list; `Esc` closes
- **Hollow Bishop boss** (`src/actors/Actor.ts` + `src/fx/sprites.ts`): 200 HP, 3-phase combat at 67% / 33% HP thresholds — atk scales 1.0 → 1.4 → 1.8 and cooldown shrinks 1.0 → 0.8 → 0.65. No respawn; guaranteed boss-tier drop
- **SaveAdapter v1** (`src/platform/SaveAdapter.ts`): 5 character slots, schema-versioned migrate() walker, `WebSaveAdapter` (IndexedDB via `idb`) live on web, `TauriSaveAdapter` (FS plugin) wired for native. `S` saves in the hub; auto-save fires on zone change, equip/unequip, and boss kill
- **17 new unit tests** (10 quests + 7 save_adapter) and **8 new e2e tests** (hub_quests.spec.ts) — 67/67 unit and 72/72 e2e green across Chromium + WebKit

## What's in v0.5.0

- **BSP procgen** (`src/systems/procgen.ts`): recursive bounds-split → rooms + L-shaped corridors. Deterministic via `seedrandom` — `catacombs-1` produces a 9-room, 32×32 dungeon every time
- **Flood-fill validator** runs *before* the generator yields; rerolls up to 16 times with a salted seed (`seed#r1`, `seed#r2`, ...) if any floor cell is unreachable
- **A* pathfinding** (`src/systems/pathfinding.ts`): 4-connected uniform-cost grid, Manhattan heuristic. Player click-to-walk and enemy chase both route around walls
- Catacombs Pixi tile renderer (`src/fx/tiles.ts`): floor diamonds + 22-px stacked wall blocks. Wall culling skips ~70% of unexposed walls
- Catacombs `ColorMatrixFilter` on the world container (cool blue-grey, dimmed); HUD remains full-saturation
- Player + enemy spawn placement: player in entrance room, enemy in boss room
- 16 new unit tests (procgen + pathfinding) + 6 new dungeon e2e tests across Chromium + WebKit

## What's in v0.4.0

- 10×4 inventory grid (`src/systems/bag.ts`) with item-footprint API — 1×1 today, multi-cell ready for v0.5.0
- Pickup → bag (no auto-equip); equip is an explicit click on the inventory cell. Replaced gear returns to bag, or drops to floor if bag is now full
- Paper-doll character sheet with weapon/head/chest/ring slots + derived-stat readout (`Attack 44 (base 25 +19)` style deltas)
- 4-slot skill hotbar at bottom-center; keys 1-4; click empty slot opens bind flow; right-click clears
- Bind-skill panel listing available skills (`melee` only in v0.4.0; full four-skill set in v0.5.0)
- DOM panels using **Lit 3.x** Web Components — `I` toggles inventory, `C` toggles character, `Esc` closes everything
- One-way game-state bridge (`src/ui/store.ts`): panels read state + emit intents, game loop writes state and routes effects
- HUD reshuffle: HP bar bottom-left, hotbar bottom-center, debug top-right
- 7 new Vitest unit tests for `bag.ts` placement / overflow / removal
- 9 new Playwright e2e tests across inventory, character, and bind flows (Chromium + WebKit)

## What's in v0.3.0

- Item types: 12 base items × 4 slots × 3 rarity tiers (Common / Magic / Rare); 16 affixes (10 prefixes, 6 suffixes) across `atk_flat` + `hp_flat` modifiers
- Authored data: `data/items.json` + `data/affixes.json` (room to grow to 200×200 by v0.6.0)
- Deterministic loot roller (`seedrandom` PRNG) — same seed → same item, every time
- Drop on death with weighted rarity + ilvl caps
- Ground items glow in rarity color, pulse animation, name label above
- DOM tooltip on hover with name (rarity color), base damage/armor, every rolled affix, compare-with-equipped
- Click-to-walk-then-click-to-pickup (D2-style); auto-equip into the weapon/head/chest/ring slot
- Equipped weapon's `baseDamage` + `atk_flat` affixes feed `Actor.derivedStats.atk` → flow directly into combat damage
- 4 new e2e tests covering forceDrop determinism, tooltip rendering, walk+pickup-equip, weapon swap

## What's in v0.2.0

- 12×12 isometric grid, procedural sprites (real Kenney + LPC art lands in v0.3.0 — pack URLs were 404 at last attempt; manual download script is the next pass)
- Click-to-move and click-to-attack
- 1 enemy with chase-and-melee AI (aggro range 5, attack on adjacency)
- Player melee skill: 25 dmg, 1-tile range, 400 ms cooldown
- DOM HP bar + floating Pixi-rendered damage popups (kill popup styled distinct from hit)
- Full death + respawn loop for both player (2 s, back to (6,6) full HP) and enemy (3 s, random edge tile, full HP)
- Pure-TS combat math in `src/systems/combat.ts` and `src/systems/ai.ts` — Vitest covers every transition

## What's in v0.1.0

- 12×12 isometric grid, click-to-move pathing
- Pixi v8 + WebGL rendering, Tauri 2.x shell scaffolded
- Capability allow-list locked: FS scoped to `$APPDATA/wyrdloom/saves`, window controls, dialog — no `http:`, `shell:`, `process:`
- Vitest unit tests for iso math, Playwright e2e for boot + click-to-move
- License-compliance CI gate

## Stack

| | |
|---|---|
| Renderer | [PixiJS v8](https://pixijs.com) (MIT) |
| Language | TypeScript 5.x strict |
| Bundler | [Vite 6](https://vite.dev) |
| Native shell | [Tauri 2.x](https://tauri.app) (MIT/Apache-2.0) |
| HUD framework | [Lit 3.x](https://lit.dev) (BSD-3-Clause) — Web Components for menu panels |
| Audio | [howler.js](https://howlerjs.com) (MIT) — wired for v0.6.0 |
| Storage | [idb](https://github.com/jakearchibald/idb) (ISC) for web, `@tauri-apps/api/fs` for native |
| Procgen RNG | [seedrandom](https://github.com/davidbau/seedrandom) (MIT) |
| Tests | [Vitest](https://vitest.dev) + [Playwright](https://playwright.dev) |
| Pkg mgr | [bun](https://bun.sh) (preferred) — `pnpm` fallback |

## Controls (v0.6.0)

| Action | Binding |
|---|---|
| Move | Left-click a floor tile — A* routes around walls |
| Attack enemy | Left-click an enemy — player A*-walks into melee, then auto-attacks |
| Walk to loot | Left-click a ground item — player A*-walks there |
| Pick up loot | Left-click a ground item *while standing on it* — goes into the bag (no auto-equip) |
| Inspect ground loot | Hover a ground item — tooltip shows name, base stat, affixes, and current-equipped compare |
| Talk to NPC | Left-click a Whitestone NPC — player A*-walks to an adjacent floor tile, then opens dialog |
| Change zone | Walk onto a doorway tile (Whitestone south gate ↔ Catacombs entrance) |
| Inventory | `I` toggles the 10×4 bag panel; left-click a cell to equip; right-click to drop on the floor |
| Character | `C` toggles the paper-doll panel; click an equipped slot to unequip back to the bag |
| Quests | `Q` toggles the expanded quest panel (compact tracker is always on the right edge) |
| Save | `S` saves to slot 1 — only allowed in the Whitestone hub (anti-save-scum, spec §8) |
| Hotbar | Keys 1-4 trigger bound skills (only `melee` exists today); left-click slot opens bind flow; right-click clears |
| Close panel | `Esc` closes every open panel + the NPC dialog |
| Quit | Close the window — there's no title screen yet |

Vendor UI, gold, talent grid land in v0.7.0–v0.8.0 per spec §10.

## Build from source

### Prerequisites

- Node ≥ 20
- Bun ≥ 1.3 (or pnpm ≥ 9)
- Rust ≥ 1.77 (`rustup default stable`) — only required for the Tauri native build
- Linux: `libwebkit2gtk-4.1-dev libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`

### Web target (browser demo)

```bash
bun install
bun run dev          # http://127.0.0.1:1420
bun run build        # dist/ (static; serve from anywhere)
```

### Native target (Tauri)

```bash
bun run tauri:dev    # native window + Vite dev server
bun run tauri:build  # platform-specific bundle in src-tauri/target/release/bundle/
```

The Tauri bundle target is whichever OS you're building on:

- Linux → `.AppImage` and `.deb`
- Windows → `.msi`
- macOS → `.dmg`

## Run the tests

```bash
bun run typecheck     # tsc --noEmit
bun run lint          # ESLint, max-warnings 0
bun run test          # Vitest unit tests
bun run test:e2e      # Playwright Chromium + WebKit
bun run check:licenses # asset attribution + Tauri capability gate
```

CI (GitHub Actions) runs all of the above on `ubuntu-22.04 / windows-latest / macos-latest`.

## Repo layout

```
src/                  # game source (TS strict)
  engine/             # Pixi wrappers, iso math, input
  systems/            # save adapter, loot, stats — landing later
  ui/                 # DOM HUD overlay
  platform/           # Tauri vs web split (save adapter)
src-tauri/            # Rust shell + capability allow-list
  capabilities/       # FS+window+dialog only (BUILD_PROMPT §2.5)
assets/               # bundled at build time; never CDN-loaded
data/                 # JSON: items, affixes, uniques, gems
tests/{unit,e2e}/
tools/                # license gate, version sync (TS, run via bun)
docs/{adr,…}/         # architecture decision records
```

## License

WYRDLOOM source: **MIT** (see `LICENSE`).

Third-party assets and libraries: tracked row-by-row in `LICENSES.md`. We accept only CC0 / CC-BY / CC-BY-SA (LPC carve-out) / OFL / MIT / Apache-2.0. The CI license gate fails the build on any unattributed asset folder.

## Spec

The full design + scope spec is in `BUILD_PROMPT.md`. That file is the canonical source of truth — any divergence between this README and the spec defers to the spec.
