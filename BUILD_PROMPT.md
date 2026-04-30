# BUILD PROMPT — WYRDLOOM (working title)

> A single-player isometric action-RPG in the Diablo / Path-of-Exile lineage. Open-source assets only. 10+ hour main story, infinite endgame loop. Built with **TypeScript + PixiJS** for the game runtime and **Tauri 2.x** for native desktop binaries — same source ships as a browser demo *and* signed native installers.

This file is the canonical spec — preserved verbatim from the original build prompt. Any divergence between this file and code defers to this file unless an ADR in `docs/adr/` documents the change.

---

## 1. What you are building

A top-down 3/4-perspective isometric ARPG. Single-player. Mouse-driven (click-to-move + skill hotbar). Loot-driven progression with rarity tiers. Three classes at launch + one unlockable. Three-act campaign with one boss per act + a final boss + an endless endgame dungeon ("The Echo"). Procedural dungeons stitched from authored rooms.

**Target playtime**:
- Main path: **10–12 hours** for a competent player
- + side content: 5–10 hours
- + endgame loop: indefinite (sigil tiers, leaderboard-able)

**Working title**: WYRDLOOM. Pick your own — keep it ≤ 12 chars so it fits on a save banner.

**Targets — same source, two distributions**:
- **Web** (Vite-built `dist/`) — playable in any modern browser; deployed to GitHub Pages + itch.io HTML5 for the marketing demo.
- **Native** (Tauri-built binaries) — Linux `.AppImage` + `.deb`, Windows `.msi`, macOS universal `.dmg`. The main shipped product.

**Anti-goals (do not build these)**:
- Online-only / always-online DRM
- Microtransactions, lootboxes, season passes
- Telemetry / analytics phoning home (this is enforced — `@tauri-apps/api/http` is OFF the allow-list, see §2.5)
- Multiplayer (defer to v2.0 if at all)
- Voice acting (text-only ships)
- Electron, Webpack, CDN-loaded fonts/scripts, Google Analytics, Sentry, any third-party JS you don't ship from disk

---

## 2. Tech stack — locked

### 2.1 Runtime: **PixiJS v8** + **Tauri 2.x**

**PixiJS v8** (MIT) drives the game canvas. **Tauri 2.x** (MIT/Apache-2.0) wraps the same web build into native binaries.

### 2.2 Language: **TypeScript 5.x strict**

`tsconfig.json` flags: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes`. No implicit `any`. No `// @ts-ignore` without a `// reason: ...` neighbor.

Rust (in `src-tauri/`) only for Tauri commands the JS side genuinely cannot do.

### 2.3 Tooling

- Package manager: **bun** (preferred), pnpm fallback
- Bundler: **Vite 5+**
- Lint: ESLint flat config + Prettier
- Test: **Vitest** unit + **Playwright** e2e (Chromium **and** WebKit)
- Source control: git, GitHub
- CI: GitHub Actions matrix `ubuntu-22.04 / windows-latest / macos-latest`
- Versioning: SemVer; single source = `package.json` `"version"`, mirrored into `tauri.conf.json` + `Cargo.toml` at build time
- Release notes: `RELEASE_NOTES_v<X.Y>.md` per minor

### 2.4 Repo layout

See actual repo. Asset folders mirror source pack name (`assets/sprites/kenney_isodungeon/`) so attribution stays traceable. Everything under `assets/` is served from the Vite build output — no fetch from a CDN at runtime, ever.

### 2.5 Tauri capability allow-list (security hard rule)

**Allowed** (`src-tauri/capabilities/default.json`):
- `core:default`
- `fs:allow-read-file` and `fs:allow-write-file` scoped to `$APPDATA/wyrdloom/saves/`
- `window:allow-set-fullscreen`, `window:allow-set-title`, etc.
- `dialog:allow-message`

**Forbidden** (no expansion without an ADR in `docs/adr/`):
- `http:*` — no phone-home (§1 anti-goal)
- `shell:*` — no shell-out paths
- `process:*` — no child processes
- Anything writing outside `$APPDATA/wyrdloom/`

`tools/check_licenses.ts` enforces the forbidden list mechanically.

---

## 3. Asset sources — open-source only

### 3.1 The hard rule

Every third-party asset must be one of: **CC0**, **CC-BY 4.0**, **CC-BY-SA 3.0** (LPC carve-out only), **OFL** (fonts), **MIT/Apache-2.0** (code).

**Do not use**: GPL-only, CC-NC, CC-ND, unlicensed scrapes, AI-generated images of unclear copyright, ripped commercial-game art.

### 3.2 2D sprites & tiles (recommended path)

| Pack | License | Use |
|---|---|---|
| Kenney "Isometric Miniature Dungeon" | CC0 | floor/wall tiles, doors, props |
| Kenney "Roguelike Caves & Dungeons" | CC0 | cavern variants, traps |
| Kenney "Tiny Dungeon" | CC0 | UI iconography |
| 0x72 "Dungeon Tileset II" | CC0 | grimy fallback tiles |
| LPC characters (OpenGameArt) | CC-BY-SA 3.0 | walk cycles |
| Pixel Frog "Pixel Adventure" | CC0 | enemy sprites, FX |
| Cethiel "Pixel Item Pack" | CC0 | weapons, potions, scrolls |

Pre-pack with TexturePacker into `.json`+`.png` atlases under `assets/sprites/<pack>.atlas.json`.

### 3.3 3D — only if you switch

Skip Pixi for Three.js. Quaternius / KayKit / Mixamo / Poly Pizza / Sketchfab CC0.

### 3.4 Audio

Howler.js (MIT) playback. Sources: Eric Matyas Soundimage (CC-BY), Kevin MacLeod (CC-BY), Sonniss GDC bundle, Freesound CC0/CC-BY, OpenGameArt CC0.

Pre-encode every audio asset to `.webm` (Opus) primary + `.mp3` Safari fallback. Strip metadata.

### 3.5 Fonts (all OFL — bundled, never CDN)

- MedievalSharp (titles)
- IM Fell DW Pica (lore)
- Press Start 2P (numbers, popups)
- Inter (menus)

Bundle woff2 + TTF locally. Never `fonts.googleapis.com` at runtime.

### 3.6 `LICENSES.md` is mandatory

One row per third-party asset. CI `tools/check_licenses.ts` auto-fails if any asset folder has no row.

---

## 4. Genre mechanics — full spec

### 4.1 Camera + controls

- Fixed iso, 2:1 dimetric, **64×32 px** tiles
- Left-click move-to-tile / attack-target
- Right-click cast bound skill at cursor
- 1–4 skill bar
- I inventory · C character · M map · Esc pause · Tab loot-highlight
- Shift+click force-attack; hold shift = stand still
- All keys remappable; map stores `KeyboardEvent.code`

### 4.2 Classes — 3 launch + 1 unlockable

| Class | Stat | Resource | Theme |
|---|---|---|---|
| Bonecaller | Will | Bone Shards | Necromancer |
| Furyborn | Strength | Rage | Berserker |
| Frostmark | Agility | Mana | Ice ranger |
| Sealwarden (unlock post Act III) | Faith | Vigil | Paladin |

Six active skills per class. 4×4 talent grid, 12 passive nodes, 1 point per level + 1 per main quest.

### 4.3 Stats

HP, resource, damage = weapon × class-scalar × skill × (1 + crit_chance × crit_damage). Armor + resists capped 75%. Crit chance cap 75%. Move speed cap +75%. CDR cap 50%. Magic find multiplier on rare-or-better drop chance.

### 4.4 Loot — D2-flavored

Tiers: Common / Magic / Rare / Unique / Mythic.

10 slots. Targets: ≥60 uniques, 8 sets, 200 prefixes, 200 suffixes.

Drop tables weighted by monster level. Pack → 1 magic guaranteed, 8% rare. Boss → 1 rare, 30% unique. Act boss → 1 unique guaranteed.

Crafting: Imbuer NPC. Sacrifice 3 magic same-slot → 1 rare. 0–3 sockets per item. 5 gem types × 5 quality tiers.

### 4.5 Procedural dungeons

BSP room-and-corridor (WFC v1.1). Authored rooms tagged by biome. **Deterministic seeded PRNG** — same seed → same dungeon (non-negotiable).

4 biomes: Catacombs (Act I + Echo), Frostvein Caves (Act II), Ruined Keep (Act III 1–3), Blood Cathedral (Act III final + Pinnacle).

Each dungeon: 3–5 floors, 1 boss room, 1–2 hidden rooms, 1 shrine. Generator runs flood-fill validator before yielding.

### 4.6 Combat tuning

Normal mob TTK 1–2 s, elite 5–10 s, boss 30–90 s. Death: 10% XP debt, no item loss; corpse retrieval clears debt. Hardcore mode separate at character creation.

### 4.7 Endgame — "The Echo"

Sigil-based. Tier scales monster level + magic find + boss difficulty. Pinnacle boss at sigil tier 15+, drops Mythic exclusively.

---

## 5. Content scope — 10+ hours

| Act | Setting | Hours | Quests | Boss |
|---|---|---|---|---|
| I | Burning village → catacombs | ~2.5 | 3 main + 6 side | Hollow Bishop |
| II | Mountain town → ice caves | ~3.0 | 3 main + 6 side | Worm-Mother Vyl |
| III | Ruined keep → blood cathedral | ~3.5 | 3 main + 7 side | The Pact-Bearer |
| Echo | Endless dungeon | open | per-sigil | Pinnacle every 5 floors |

Town hubs: Whitestone (I), Frostmoor (II), Lasthold (III). 4 services per hub: Smith, Imbuer, Stash (4 tabs × 10×10), Quest-board.

25 monster archetypes × 3 biome variants. 6 elite modifiers, combine 2 per pack. 5 designed boss fights, 3 phases each.

---

## 6. UI / UX

HUD = **DOM + CSS overlaid on Pixi canvas** (not in-canvas). Pixi `<canvas>` at z-index 0; HUD `<div>` at z-index 10 with `pointer-events: none` except panels.

- HP/Resource orbs: SVG clip-path liquid fill
- Skill hotbar: `<button>` for keyboard nav
- Minimap: separate `<canvas>`
- Combat text: Pixi Text (world-space)
- Buffs/debuffs: DOM
- Mini-quest tracker: DOM

Menus: pure DOM (no React/Vue) — `HTMLElement` factories or [Lit 3.x](https://lit.dev) (MIT) for Web Components.

Settings: graphics scale, vsync, fullscreen, particles, post-FX, audio sliders, mute-on-blur, gameplay toggles, full keybind remap, color-blind preset (deuteranopia/protanopia/tritanopia), reduce-motion, font-size 80–150%, always-subtitles, hold-vs-toggle skills.

---

## 7. Audio direction

1 looping ambient track per zone (3–4 min seamless). 1 combat-up-tempo overlay (sidechain). 1 stinger per dialogue beat. ~80 unique SFX. No voice acting at launch.

iOS-Safari: one-time `pointerdown` resumes `Howler.ctx`; without, autoplay-muted is the default.

---

## 8. Save / persistence

- 5 character slots, JSON optionally `pako`-deflated, `schema_version: int`
- Auto-save: zone-change, level-up, quest-complete, every 5 min
- Manual save: hubs only (anti-save-scum)
- Schema bump → migrator + fail-fast Tauri `dialog::message` on unknown version
- Hardcore mode: permadeath, save deleted on death
- Cloud save: deferred v1.1

### 8.1 Storage adapter

`src/platform/SaveAdapter.ts` interface. Two impls:

- **`TauriSaveAdapter`** — `@tauri-apps/api/fs` against `$APPDATA/wyrdloom/saves/slot_<n>.json.gz`
- **`WebSaveAdapter`** — IndexedDB via `idb` (object store `wyrdloom.saves`); settings → `localStorage`; full state → IndexedDB

Boot picks via `'__TAURI_INTERNALS__' in window`.

---

## 9. CI / build / release

### 9.1 GitHub Actions matrix: ubuntu-22.04 / windows-latest / macos-latest.

Per job: checkout → bun install --frozen-lockfile → lint+typecheck+test → build → Rust toolchain + platform deps → tauri build → check_licenses → upload artifacts → on `v*` tag from `main`: deploy `dist/` to GitHub Pages + draft GitHub Release with 4 installers + `dist.tar.gz`.

### 9.2 License-compliance gate

`tools/check_licenses.ts` walks `assets/**` and `data/**`, diffs leaf folder slugs against `LICENSES.md` rows. Also greps `tauri.conf.json` + capabilities for forbidden permission identifiers.

### 9.3 Versioning: SemVer; package.json is single source; `sync_version` mirrors at build time.

### 9.4 Bundle-size gate

Hard cap: `dist/` ≤ **30 MB** total, `dist/index.js` ≤ **1.5 MB** pre-gzip. CI fails on > 5% regression.

---

## 10. Milestones — 12-week cadence

| Week | Deliverable |
|---|---|
| 1 | Vite + PixiJS canvas + iso click-to-move + Kenney tileset, 1 walking sprite. Tauri shell empty native window. **Tag `v0.1.0`.** |
| 2 | Combat skeleton: 1 enemy AI, 1 player skill, HP bar, death/respawn, damage numbers. **`v0.2.0`** |
| 3 | Loot pipeline: rarity, affix table, drop, pickup, equip, stat-recalc, tooltip compare. **`v0.3.0`** |
| 4 | Inventory + character + skill hotbar + bind-skill (DOM/Lit). **`v0.4.0`** |
| 5 | BSP procgen + Catacombs + Pixi Filter lighting. Flood-fill validator. **`v0.5.0`** |
| 6 | Act I content: Whitestone hub, intro quest, 3 main, Hollow Bishop. SaveAdapter both targets. **`v0.6.0`** |
| 7 | Frostvein + Worm-Mother. Furyborn playable. **`v0.7.0`** |
| 8 | Class balance + 20 uniques + crafting + sockets + gems. **`v0.8.0`** |
| 9 | Cinderfall + Pact-Bearer + ending. Frostmark playable. **`v0.9.0`** |
| 10 | Echo + sigils + Mythic + Pinnacle. Sealwarden unlocks. **`v0.10.0`** |
| 11 | Settings, save migration, accessibility, color-blind, Hardcore. **`v0.11.0`** |
| 12 | QA, balance, RC builds 4×3 OS, bot-play 1h, marketing, ship **`v1.0.0`**. |

---

## 11. Definition of Done — `v1.0.0`

- [ ] Fresh `git clone` → `bun install && bun run tauri build` produces installers on Linux/Windows/macOS
- [ ] Fresh `git clone` → `bun install && bun run build` produces a static `dist/` runnable in Chrome/Firefox/Safari
- [ ] First-time player completes Act I in ≤ 3 hours following only in-game prompts
- [ ] All 3 launch classes solo through Act III without grinding
- [ ] Bot-play (`tools/bot_play.ts` + Playwright) runs **1 hour randomized inputs without crash, console error, or unhandled rejection**
- [ ] Save → quit → reload preserves all state, on web AND Tauri
- [ ] Saves round-trip cleanly between web (IndexedDB export) and Tauri (FS)
- [ ] Every asset folder has a row in `LICENSES.md`; CI gate green
- [ ] Settings allows full keybind remap including movement
- [ ] Reduce-motion disables: shake, hit-particles, popups, bloom
- [ ] Color-blind deuteranopia preset tested vs Sim Daltonism
- [ ] No `console.error` / `console.warn` in 5-min play (CI Playwright)
- [ ] `dist/` ≤ 30 MB; `dist/index.js` ≤ 1.5 MB pre-gzip
- [ ] Tauri capability allow-list reviewed; no `http:*`, `shell:*`, `process:*`
- [ ] CI green on `main` for all 3 OS targets ≥ 7 consecutive days
- [ ] Tagged `v1.0.0` release has 4 installers + `dist.tar.gz` + `LICENSES.md` + `RELEASE_NOTES_v1.0.md`
- [ ] Web demo deployed to GitHub Pages; opens in Chrome/Firefox/Safari without console errors
- [ ] README has playable screenshot, controls, browser play, build-from-source

---

## 12. Risks + mitigations

| Risk | Mitigation |
|---|---|
| Asset legal ambiguity | License-gate CI; only allowed licenses; LICENSES.md mandatory |
| Combat feel flat in browser | Week 2 spike: hit-stop (4-frame freeze) + screen-shake (CSS transform on canvas) + popups |
| Loot table runaway | Affixes in `data/affixes.json` (pure data); Vitest + seeded PRNG covers roller |
| Save format breaks on schema bump | Migrator per bump; reject unknown schema with clear dialog/modal |
| Procgen unwinnable | Flood-fill validator; reroll on fail |
| Scope creep | Hard-cap at the 12-week table; new features → v1.1 |
| Asset visual clash (Kenney + LPC + 0x72) | Pick one tile pack as anchor; recolor LPC via Pixi `ColorMatrixFilter` |
| Tauri webview engine differs across OS | Playwright matrix Chromium + WebKit; visual-regression on both |
| Mobile Safari iOS audio unlock | One-time pointerdown resumes Howler.ctx |
| `devicePixelRatio` mishandling | Pixi `resolution: Math.min(devicePixelRatio, 2)`; integer pixel scale tiles |
| Large bundle hurts web demo TTI | §9.4 size gate; lazy-load per-act atlases via dynamic `import()` |
| Tauri capability creep | §2.5 list is mechanical; `tools/check_licenses.ts` greps `tauri.conf.json` + capabilities |

---

## 13. START — original build prompt

The original §13 START block (paste-into-build-agent prompt) is preserved in the repo's git history at the commit that introduced this file. The Week 1 spike (`v0.1.0`) was bootstrapped from it.

---

## 14. Bonus polish (cuttable from v1.0, save for v1.1)

- rough.js-style hand-drawn UI accents
- Per-act color-grade LUT (warm I → cold II → blood III) via `ColorMatrixFilter`
- Cinematic letterbox + zoom for boss intros
- Photo-mode (pause + free-cam, hide HUD, screenshot key)
- Steam Workshop for community sigil seeds (post-launch)
- Lighting: WebGPU `Light2D`-equivalent custom Pixi shader
- Weather overlays per zone
- Cloud save via Turso / Steam Cloud (post-launch)
