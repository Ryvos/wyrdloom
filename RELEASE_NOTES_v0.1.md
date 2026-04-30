# WYRDLOOM v0.1.0 — Week 1 spike

First tagged milestone. **Tech-spike only** — proves the toolchain end-to-end and gives every later week a working baseline to ratchet against.

## What ships

- **PixiJS v8 iso canvas** rendering a 12×12 dimetric grid (`TILE_W=64`, `TILE_H=32`). Tiles are procedurally drawn `Graphics` diamonds — no third-party art yet.
- **Click-to-move**: left-click a tile, the player walks to it one tile per ~150 ms. Uses a synthetic step-ticker for now; real A* pathing lands in Week 5 with the BSP dungeon generator.
- **Camera follow**: world centered on the player after every step.
- **Iso math** (`src/engine/iso.ts`): `tileToScreen`, `screenToTile`, `roundTile`, `tileDistance`, `depthFor`. Round-trip property test in `tests/unit/iso.spec.ts` covers every integer cell in a 21×21 region.
- **Tauri 2.x shell** (`src-tauri/`): builds a native window that loads the Vite-built `dist/`. Capability allow-list locked: `core:default` + `window:*` + `dialog:allow-message` + `fs:*` scoped to `$APPDATA/wyrdloom/saves/`. **No `http:`, `shell:`, or `process:`** — enforced by the CI gate.
- **CI tooling**:
  - `tools/check_licenses.ts` — fails the build if any folder under `assets/` lacks a row in `LICENSES.md`, *and* fails on any forbidden Tauri permission identifier (`http:*`, `shell:*`, `process:*`).
  - `tools/sync_version.ts` — keeps `package.json` `"version"` mirrored into `tauri.conf.json` and `Cargo.toml`. Single source of truth = `package.json`.
- **Test scaffolding**:
  - **Vitest** unit suite (5 tests, all green).
  - **Playwright** e2e suite — Chromium + WebKit projects — covering: zero console errors on boot, spawn coordinates, click-to-move end-to-end, out-of-bounds click rejection.
- **Debug handle**: `window.__wyrdloom = { playerTile, goal, version }` exposed for tests + DevTools. Read-only — does not affect game state.

## Verification

The spike was live-driven with Playwright (Chromium 1280×800) before tagging:

| Check | Result |
|---|---|
| Page boots, `__wyrdloom.version` is `"0.1.0"` | ✅ |
| Canvas mounts, player spawns at tile (6, 6) | ✅ |
| Synthetic `pointerdown` at viewport (700, 450) → goal locks to tile (9, 7) | ✅ |
| Player walks (6,6) → (9,7) within 1.5 s, goal clears | ✅ |
| Console at end of session: 0 errors, 0 warnings | ✅ |

`docs/v0.1.0-spike.png` is the post-walk screenshot — committed alongside this file.

## What's *not* in v0.1.0 (intentional)

- No real art assets. `LICENSES.md` lists the planned Kenney + LPC + Pixel Frog vendoring under "intent for v0.2.0" — none of those packs are bundled yet. Keeps the spike hermetic (fresh clone → `bun install && bun run dev` works with no asset network fetch).
- No combat, no enemies, no skills, no HP — Week 2.
- No loot, affixes, items, sockets, gems — Week 3+.
- No menus, inventory, character sheet, settings — Week 4.
- No procedural dungeons, biomes, BSP — Week 5.
- No save / load — adapter interface stubbed (`src/platform/SaveAdapter.ts` lands in Week 6).
- No audio — Howler is in `package.json` but not yet imported anywhere.
- No CI workflow file yet — the matrix lands in Week 2 once we have something stable enough for CI to gate on.

## Known caveats

- The depth-sort key (`depthFor`) breaks ties on equal `tx + ty`; that's fine for non-overlapping ground tiles but will need a secondary key (probably `ty`) once two actors share a tile.
- The step ticker advances on whichever axis has the larger remaining gap. For long L-shaped paths this looks fine; for diagonal paths it'll alternate axis-by-axis. A* in Week 5 obsoletes this entirely.
- Out-of-bounds clicks are silently ignored. We'll surface a "no path" cue (cursor change or shake) in Week 4 once the UI layer exists.
- Tauri build hasn't been run on this checkout — the shell *compiles* but a full `bun run tauri:build` requires the platform's webview-dev libs (`libwebkit2gtk-4.1-dev` on Linux). CI will exercise this on Week 2's first matrix run.

## Next: v0.2.0 (Week 2)

- Vendor Kenney "Isometric Miniature Dungeon" + LPC archer; replace placeholder primitives.
- Combat skeleton: 1 enemy AI, 1 player skill, HP bar, damage numbers, death + respawn.
- First CI workflow (`.github/workflows/ci.yml`) covering lint + typecheck + unit + e2e on Ubuntu only (matrix expands week 4).
- Tauri native build on Linux validated end-to-end.
