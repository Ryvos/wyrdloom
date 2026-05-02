# WYRDLOOM

Single-player isometric action-RPG in the Diablo / Path-of-Exile lineage. **Open-source**, **MIT-licensed**, **no telemetry**, **no microtransactions**, **no online-only DRM**. Ships as both a browser demo and signed native desktop binaries from the same TypeScript source.

> Status: **v1.0.0 — launch.** Three playable classes (Furyborn / Frostmark / Sealwarden), three acts (Whitestone hub → Catacombs → Frostvein → Cinderfall), an endless endgame (The Echo with the Pinnacle on floor 5), full loot pipeline (common / magic / rare / unique / mythic with sockets + gems + the Imbuer), Hardcore mode, accessibility (color-blind presets, reduce-motion, font scale), and a remappable settings panel. See [`RELEASE_NOTES_v1.0.md`](RELEASE_NOTES_v1.0.md).

**Browser play:** https://ryvos.github.io/wyrdloom/ (Chrome / Firefox / Safari)

![v0.5.0 dungeon spike](docs/v0.5.0-spike.png)

## Quick start

```bash
git clone https://github.com/Ryvos/wyrdloom
cd wyrdloom
bun install
bun run dev          # http://127.0.0.1:1420
```

First launch opens the character-creation modal — pick Furyborn or Frostmark (Sealwarden unlocks once any character has dismissed the Pact-Bearer ending), name the character, optionally enable Hardcore, click **Begin**.

## Stack

| | |
|---|---|
| Renderer | [PixiJS v8](https://pixijs.com) (MIT) |
| Language | TypeScript 5.x strict + `noUncheckedIndexedAccess` |
| Bundler | [Vite 6](https://vite.dev) |
| Native shell | [Tauri 2.x](https://tauri.app) (MIT/Apache-2.0) |
| HUD framework | [Lit 3.x](https://lit.dev) (BSD-3-Clause) — Web Components for menu panels |
| Audio | [howler.js](https://howlerjs.com) (MIT) |
| Storage | [idb](https://github.com/jakearchibald/idb) (ISC) for web, `@tauri-apps/api/fs` for native |
| Procgen RNG | [seedrandom](https://github.com/davidbau/seedrandom) (MIT) |
| Tests | [Vitest](https://vitest.dev) + [Playwright](https://playwright.dev) (Chromium + WebKit) |
| Pkg mgr | [bun](https://bun.sh) (preferred) — `pnpm` fallback |

## Controls

| Action | Default binding |
|---|---|
| Move | Left-click a floor tile (A* pathfinds around walls) |
| Attack enemy | Left-click an enemy — class-baselined basic strike (Cleave / Volley / Smite) |
| Pick up loot | Left-click a ground item — walks there, then picks up |
| Inspect loot | Hover a ground item — tooltip with affixes + compare-with-equipped |
| Talk to NPC | Left-click a Whitestone NPC (Quest-board, Smith, Imbuer, Wyrdkeeper) |
| Change zone | Step onto a doorway tile (each zone has its own exits) |
| Inventory | `I` |
| Character sheet | `C` |
| Bind skill | `B` |
| Imbuer panel | `M` |
| Echo portal | `E` (at the Wyrdkeeper) |
| Quest tracker (expanded) | `Q` |
| Settings | `O` |
| Manual save | `S` (hubs only — anti-save-scum per spec §8) |
| Skill hotbar | `1` `2` `3` `4` |
| Close panel | `Esc` |

Every binding above is remappable in **Settings → Keybinds**. `Q` and `Esc` are hardcoded as meta-keys. Settings persist across save deletes via localStorage.

## Build from source

### Prerequisites

- Node ≥ 20
- Bun ≥ 1.3 (or pnpm ≥ 9)
- Rust ≥ 1.77 (`rustup default stable`) — only required for the Tauri native build
- Linux: `libwebkit2gtk-4.1-dev libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`

### Web target (browser demo)

```bash
bun install
bun run build        # dist/ — static, serve from anywhere
bun run preview      # quick local server for dist/
```

For the GitHub Pages build (subpath `/wyrdloom/`):

```bash
VITE_DEPLOY_BASE=/wyrdloom/ bun run build
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

Tagged releases trigger `.github/workflows/release.yml` which builds all three OS targets in parallel and attaches the installers + `dist.tar.gz` to the GitHub release.

## Run the tests

```bash
bun run typecheck      # tsc --noEmit (strict + noUncheckedIndexedAccess)
bun run lint           # ESLint, max-warnings 0
bun run test           # Vitest unit tests
bun run test:e2e       # Playwright Chromium + WebKit
bun run check:licenses # asset attribution + Tauri capability gate
```

### Bot-play (DoD: 1 hour clean fuzzer run)

```bash
bun run dev &                                       # in one terminal
BOT_DURATION_MS=3600000 bun run bot:play            # 1-hour fuzzer
```

`tools/bot_play.ts` drives random clicks + keypresses + skill triggers against the canvas, auto-respawns on death, and exits non-zero if any `console.error` / `console.warn` / `pageerror` fires. The 1-hour run validates the v1.0.0 DoD line "no console.error / console.warn in 5-min play" with a 12× safety margin.

CI runs lint + typecheck + unit + e2e on `ubuntu-22.04 / windows-latest / macos-latest` per push to `main`.

## Repo layout

```
src/                    # game source (TS strict)
  systems/              # combat, loot, save adapter, settings, quests
  ui/                   # DOM HUD (Lit Web Components, never in-canvas)
  platform/             # Tauri vs web split — save adapter, file IO
  levels/               # zone authoring (Whitestone, Catacombs, Frostvein, …)
  fx/                   # tile + sprite drawing, color filters
src-tauri/              # Rust shell + capability allow-list
  capabilities/         # FS + window + dialog only (BUILD_PROMPT §2.5)
assets/                 # bundled at build time; never CDN-loaded
data/                   # JSON: items, affixes, uniques, gems, mythics, quests
tests/{unit,e2e}/
tools/                  # license gate, version sync, bot-play
docs/{adr,…}/           # architecture decision records
```

## Saves

- **5 character slots**, schema-versioned (currently v6).
- Manual save is `S`, hubs only. Auto-save fires on zone change, level-up, quest complete, and every 5 minutes.
- Schema bumps add a migrator in `src/platform/SaveAdapter.ts`'s `MIGRATIONS` table; loaders fail-fast on unknown versions.
- **Hardcore characters** are deleted (slot wiped) on death — chosen at character creation, frozen for the life of the save.

## License

WYRDLOOM source: **MIT** (see `LICENSE`).

Third-party assets and libraries: tracked row-by-row in `LICENSES.md`. We accept only CC0 / CC-BY / CC-BY-SA (LPC carve-out) / OFL / MIT / Apache-2.0. The CI license gate fails the build on any unattributed asset folder.

## Spec

The full design + scope spec is in `BUILD_PROMPT.md`. That file is the canonical source of truth — any divergence between this README and the spec defers to the spec.

## Changelog

Per-version notes live in `RELEASE_NOTES_v0.X.md` files at the repo root, from `v0.1.0` through `v1.0.0`. The launch retrospective is `RELEASE_NOTES_v1.0.md`.
