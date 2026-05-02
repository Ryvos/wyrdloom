# WYRDLOOM

Single-player isometric action-RPG in the Diablo / Path-of-Exile lineage. **Open-source**, **MIT-licensed**, **no telemetry**, **no microtransactions**, **no online-only DRM**. Ships as both a browser demo and signed native desktop binaries from the same TypeScript source.

> Status: **v0.5.0 — Week 5: BSP procgen + Catacombs + A* pathfinding.** 32×32 dungeon generated from a deterministic seed; flood-fill validator gates layout; A* drives both player click-to-walk and enemy chase; Catacombs `ColorMatrixFilter` color grade. See `RELEASE_NOTES_v0.5.md`.

![v0.5.0 dungeon spike](docs/v0.5.0-spike.png)

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

## Controls (v0.5.0)

| Action | Binding |
|---|---|
| Move | Left-click a floor tile — A* routes around walls |
| Attack enemy | Left-click an enemy — player A*-walks into melee, then auto-attacks |
| Walk to loot | Left-click a ground item — player A*-walks there |
| Pick up loot | Left-click a ground item *while standing on it* — goes into the bag (no auto-equip) |
| Inspect ground loot | Hover a ground item — tooltip shows name, base stat, affixes, and current-equipped compare |
| Inventory | `I` toggles the 10×4 bag panel; left-click a cell to equip; right-click to drop on the floor |
| Character | `C` toggles the paper-doll panel; click an equipped slot to unequip back to the bag |
| Hotbar | Keys 1-4 trigger bound skills (only `melee` exists today); left-click slot opens bind flow; right-click clears |
| Close panel | `Esc` closes every open panel |
| Quit | Close the window — there's no menu yet |

Vendor UI, gold, talent grid land in v0.6.0–v0.8.0 per spec §10.

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
