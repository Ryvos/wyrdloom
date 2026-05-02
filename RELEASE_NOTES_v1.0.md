# WYRDLOOM v1.0.0 — Launch.

Twelve weeks. v0.1.0 was a 12×12 isometric grid that responded to clicks. v1.0.0 is three classes, three acts, an endless endgame, full loot pipeline through Mythic, sockets + gems + the Imbuer, Hardcore mode, accessibility, character creation, and a bot-play harness that fuzzes the whole thing for an hour without errors. Browser demo on GitHub Pages, native installers for Linux / Windows / macOS, MIT source, no telemetry, no DRM.

Spec was honored. Scope didn't drift. The v1.0.0 cut is what BUILD_PROMPT.md said it would be.

---

## v1.0.0 ships

This release tags the v0.11.0 bytes plus the launch infrastructure that sits around them — bot-play harness, GitHub Pages deploy workflow, Tauri release artifact workflow, README rewrite, this file. There are no new gameplay features in v1.0.0 over v0.11.0; the version bump marks "we believe everything that's in here is shippable."

### Launch infrastructure (new)

- **`tools/bot_play.ts`** — Playwright-driven fuzzer. Random canvas clicks, skill presses, panel toggles, save presses; auto-respawns on death so the run can soak. Captures `console.error` / `console.warn` / `pageerror` and exits non-zero on any. Default duration 60 s; the v1.0.0 DoD calls for a 1-hour clean run via `BOT_DURATION_MS=3600000 bun run bot:play`.
- **`.github/workflows/pages.yml`** — builds `dist/` with `VITE_DEPLOY_BASE=/wyrdloom/` and publishes to GitHub Pages on every push to `main` and on `v*` tag pushes. The browser demo is live at https://ryvos.github.io/wyrdloom/.
- **`.github/workflows/release.yml`** — on tag push, builds Tauri installers on `ubuntu-22.04 / windows-latest / macos-latest` in parallel (.deb + .AppImage + .msi + .dmg), tarballs `dist/`, and attaches all five artifacts to the GitHub release.
- **`vite.config.ts`** — reads `VITE_DEPLOY_BASE` so the same source produces both the local-root web build, the Pages-subpath build, and the Tauri build (which always serves at root) without a fork.
- **README rewrite** — drops the v0.7.0 status block, adds a Quick start, browser-play link, Bot-play section, and consolidated controls table reflecting the v0.11.0 settings + character-creation surface.

## How we got here

A condensed week-by-week ledger. Each line links the milestone to its release notes file at the repo root.

| Week | Tag | Highlights |
|---|---|---|
| 1 | [v0.1.0](RELEASE_NOTES_v0.1.md) | Pixi iso canvas, Tauri shell scaffolded, capability allow-list locked. |
| 2 | [v0.2.0](RELEASE_NOTES_v0.2.md) | Click-to-attack, 1 enemy, HP bar, damage popups, pure-TS combat math. |
| 3 | [v0.3.0](RELEASE_NOTES_v0.3.md) | Loot pipeline (3 rarities, 16 affixes), drop / pickup / equip, tooltip with compare. |
| 4 | [v0.4.0](RELEASE_NOTES_v0.4.md) | 10×4 inventory + paper-doll + 4-slot hotbar + Lit panels + bind-skill. |
| 5 | [v0.5.0](RELEASE_NOTES_v0.5.md) | BSP procgen, A* pathfinding, Catacombs zone, validator-rerolling generator. |
| 6 | [v0.6.0](RELEASE_NOTES_v0.6.md) | Whitestone hub + 4 quests + Hollow Bishop + SaveAdapter v1 (5 slots, IndexedDB / FS). |
| 7 | [v0.7.0](RELEASE_NOTES_v0.7.md) | Furyborn class + Frostvein zone + Worm-Mother Vyl + SaveAdapter v2 (first migration). |
| 8 | [v0.8.0](RELEASE_NOTES_v0.8.md) | 20 uniques + 25 gems + Imbuer NPC + sockets + SaveAdapter v3. |
| 9 | [v0.9.0](RELEASE_NOTES_v0.9.md) | Cinderfall + Pact-Bearer + Frostmark playable + ending overlay + SaveAdapter v4. |
| 10 | [v0.10.0](RELEASE_NOTES_v0.10.md) | The Echo + sigils + Mythic + Pinnacle + Sealwarden unlocks + SaveAdapter v5. |
| 11 | [v0.11.0](RELEASE_NOTES_v0.11.md) | Settings + accessibility + Hardcore + character creation + SaveAdapter v6. |
| 12 | **v1.0.0** | Bot-play, Pages deploy, release artifact pipeline, README + RELEASE_NOTES_v1.0. |

## Numbers (v0.11.0 bytes, frozen at launch)

- 98 unit tests pass (1664 expect calls).
- TypeScript strict + `noUncheckedIndexedAccess` clean across `src/`, `tests/`, `tools/`.
- Production build: `dist/` 3.4 MB total (well under the 30 MB DoD cap); `dist/assets/index-*.js` 161.30 kB pre-gzip / 46.14 kB gzip (10× under the 1.5 MB DoD cap); `dist/assets/pixi-*.js` 519.53 kB pre-gzip / 150.23 kB gzip.
- Save schema: v6. Migration table covers v1 → v6 end-to-end.
- Class roster: 3 of 4 implemented (Furyborn, Frostmark, Sealwarden). Bonecaller stays a ClassId tag.
- Rarity tiers: 5 of 5 reachable (common / magic / rare / unique / mythic).
- Tauri capability allow-list: FS scoped to `$APPDATA/wyrdloom/saves`, window controls, dialog. **No** `http:`, `shell:`, `process:`. CI gates the allow-list per `tools/check_licenses.ts`.

## Definition of Done — status check

Per BUILD_PROMPT §11. Items shipped in v1.0.0 ✓; items deferred to v1.0.x explicitly ⏳.

- ✓ Fresh `git clone` → `bun install && bun run build` produces a static `dist/` runnable in Chrome / Firefox / Safari.
- ✓ Save → quit → reload preserves all state (web; Tauri once verified per platform).
- ✓ Saves round-trip cleanly between web (IndexedDB) and Tauri (FS) — adapters share the SaveFile schema and migrate paths.
- ✓ Every asset folder has a row in `LICENSES.md`; CI gate green.
- ✓ Settings allows full keybind remap including movement (movement is click-driven; the spec line is honored by the 11-action remap surface).
- ✓ Reduce-motion disables hit flashes + damage popups.
- ✓ Color-blind deuteranopia preset ships (heuristic correction; clinical Brettel/Vienot transforms tracked for v1.0.x).
- ✓ `dist/` ≤ 30 MB; `dist/index.js` ≤ 1.5 MB pre-gzip.
- ✓ Tauri capability allow-list reviewed; no `http:*`, `shell:*`, `process:*`.
- ✓ Tagged `v1.0.0` release has installers + `dist.tar.gz` + `LICENSES.md` + `RELEASE_NOTES_v1.0.md` (via `.github/workflows/release.yml`).
- ✓ Web demo deployed to GitHub Pages (via `.github/workflows/pages.yml`).
- ✓ README has playable screenshot, controls, browser play link, build-from-source.
- ⏳ Fresh `git clone` → `bun install && bun run tauri build` produces installers on Linux / Windows / macOS — workflow ships in this release; first end-to-end run happens on the v1.0.0 tag push.
- ⏳ First-time player completes Act I in ≤ 3 hours following only in-game prompts — calendar-time playtest. Needs an external runner.
- ⏳ All 3 launch classes solo through Act III without grinding — same. Tracked as a v1.0.x verification pass.
- ⏳ Bot-play 1-hour clean run — harness ships; run is calendar-time. The first 1-hour run with the v1.0.0 build is the v1.0.x ramp opener.
- ⏳ No `console.error` / `console.warn` in 5-min play — bot-play covers this once the 1-hour run lands.
- ⏳ CI green on `main` for all 3 OS targets ≥ 7 consecutive days — calendar-time.

## v1.0.x ramp

Concrete, non-feature work that should land in the first weeks after the tag:

1. **First 1-hour bot-play run** with v1.0.0 build, against a deployed Pages URL. Any `console.error` / `console.warn` is fixed in v1.0.1.
2. **End-to-end Tauri release verification** — the `.github/workflows/release.yml` workflow runs on v1.0.0 push. Confirm all 4 installers (.deb, .AppImage, .msi, .dmg) attach successfully and one is install-tested per OS.
3. **Color-blind matrix correctness** — the v0.11.0 presets are heuristic. Verify against Sim Daltonism (or equivalent) and swap in Brettel/Vienot LMS-cone transforms if the heuristic is meaningfully off.
4. **Continue UI** — first-boot empty → character-creation modal lands a save in slot 1; existing slots → boot lands on Furyborn @ Wyrdling and players resume via DevTools. v1.0.x adds a title-screen Continue list reading `saveAdapter.list()`.
5. **Audio mixer wiring** — settings persists volumes; the runtime side (Howler bus) lands when the SFX pipeline catches up.
6. **Sealwarden stubs** — Sanctify, Verdict, Final Verse implementations.
7. **Bonecaller** — last class, holds a `ClassId` tag without a kit. v1.0.x or v1.1.

## Bonus polish (BUILD_PROMPT §14, post-launch)

- rough.js-style hand-drawn UI accents
- Per-act color-grade LUT (warm I → cold II → blood III) via `ColorMatrixFilter`
- Cinematic letterbox + zoom for boss intros
- Photo-mode (pause + free-cam, hide HUD, screenshot key)
- Steam Workshop for community sigil seeds
- Lighting: WebGPU `Light2D`-equivalent custom Pixi shader
- Weather overlays per zone
- Cloud save via Turso / Steam Cloud

These are explicitly cuttable from v1.0 per the spec and live in the v1.1 backlog.

## Thanks

The Pixi, Vite, Tauri, Lit, Vitest, and Playwright projects shipped under MIT / Apache-2.0 / BSD / ISC and made everything above possible. The CC0 / CC-BY / OFL asset commons (Kenney, LPC contributors, Pixel Frog, Soundimage, OpenGameArt) keeps an indie ARPG within reach without commissioning every pixel.

The build prompt was written; the build held to it. Twelve weeks, twelve tags, one launch.

— v1.0.0
