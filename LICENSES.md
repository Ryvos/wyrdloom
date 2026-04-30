# Third-party asset & code license attribution

This file is the canonical attribution log for every third-party asset and library shipped with WYRDLOOM. The `tools/check_licenses.ts` CI gate fails the build if an asset directory under `assets/**` exists with no row here. Add the row **before** committing any new asset.

## Allowed licenses

- **CC0 1.0** — public domain, no attribution required (we attribute anyway for traceability)
- **CC-BY 4.0** — attribution required; surfaced in-game on the Credits/Attributions screen
- **CC-BY-SA 3.0** — LPC carve-out only (derivatives stay SA, not the whole game)
- **OFL 1.1** — fonts, attribute the foundry
- **MIT / Apache-2.0 / BSD** — code/libraries, ship the license text

## Forbidden

GPL-only, CC-NC, CC-ND, AI-generated images of unclear copyright status, ripped commercial-game art, anything unlicensed.

---

## v0.1.0 — what's actually shipped

The v0.1.0 spike ships with **procedurally drawn placeholder graphics** (Pixi `Graphics` primitives — diamonds, circles, rectangles) authored in `src/main.ts`. No third-party visual assets are bundled yet. Tile and player visuals are 100% original WYRDLOOM code, MIT-licensed under the project root LICENSE.

### Code dependencies (bundled into `dist/index.js`)

| Library | Version | License | Source | Purpose |
|---|---|---|---|---|
| pixi.js | 8.x | MIT | https://github.com/pixijs/pixijs | renderer |
| howler | 2.2.x | MIT | https://github.com/goldfire/howler.js | audio (loaded but not used in v0.1.0) |
| idb | 8.x | ISC | https://github.com/jakearchibald/idb | IndexedDB wrapper for WebSaveAdapter |
| seedrandom | 3.0.x | MIT | https://github.com/davidbau/seedrandom | deterministic PRNG for procgen |
| @tauri-apps/api | 2.x | MIT/Apache-2.0 | https://github.com/tauri-apps/tauri | Tauri shell IPC |

---

## Vendored assets (none yet — slated for v0.2.0)

The following assets are **planned vendoring** per BUILD_PROMPT §3. None are present in `assets/` yet — every row below is "intent only". When the assets are dropped in, this section moves above the v0.1.0 line and the `(planned)` qualifier is removed.

| Asset | Author | License | Source URL | Target dir | Status |
|---|---|---|---|---|---|
| Isometric Miniature Dungeon | Kenney Vleugels | CC0 1.0 | https://kenney.nl/assets/isometric-miniature-dungeon | `assets/tiles/kenney_iso_miniature_dungeon/` | planned v0.2.0 |
| Roguelike Caves & Dungeons | Kenney Vleugels | CC0 1.0 | https://kenney.nl/assets/roguelike-caves-and-dungeons | `assets/tiles/kenney_roguelike_caves/` | planned v0.5.0 |
| LPC base assets — Archer | LPC contributors | CC-BY-SA 3.0 | https://opengameart.org/content/lpc-collection | `assets/sprites/lpc_archer/` | planned v0.2.0 |
| Pixel Frog "Pixel Adventure" | Pixel Frog | CC0 1.0 | https://pixelfrog-assets.itch.io | `assets/sprites/pixelfrog_adventure/` | planned v0.2.0 |
| MedievalSharp font | Kludgy Fonts | OFL 1.1 | https://fonts.google.com/specimen/MedievalSharp | `assets/fonts/medievalsharp/` | planned v0.2.0 |
| IM Fell DW Pica | Igino Marini | OFL 1.1 | https://fonts.google.com/specimen/IM+Fell+DW+Pica | `assets/fonts/im_fell/` | planned v0.4.0 |
| Press Start 2P | CodeMan38 | OFL 1.1 | https://fonts.google.com/specimen/Press+Start+2P | `assets/fonts/press_start_2p/` | planned v0.4.0 |
| Inter | Rasmus Andersson | OFL 1.1 | https://fonts.google.com/specimen/Inter | `assets/fonts/inter/` | planned v0.4.0 |
| Soundimage music | Eric Matyas | CC-BY 4.0 | https://soundimage.org | `assets/audio/music/soundimage/` | planned v0.6.0 |
| OpenGameArt CC0 SFX | various | CC0 1.0 | https://opengameart.org | `assets/audio/sfx/oga_cc0/` | planned v0.6.0 |

CC-BY and CC-BY-SA assets — when actually shipped — must additionally surface attribution on an in-game Credits/Attributions screen (planned for v0.4.0 alongside the menu system).

---

## How to add a new asset

1. Drop it under `assets/<kind>/<pack_slug>/`. Keep the source pack's folder name slugified.
2. Add a row above with author, license, and source URL.
3. Run `bun run check:licenses` — must exit 0.
4. Commit asset + this file in the same commit.
