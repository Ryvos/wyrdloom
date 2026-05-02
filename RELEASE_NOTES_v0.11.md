# WYRDLOOM v0.11.0 — Week 11: Settings + accessibility + Hardcore + character creation.

The polish week. v0.11.0 doesn't add new zones, bosses, or items — it adds the systems the game has been getting away without: a real Settings store, accessibility plumbing, character creation, and a Hardcore mode that finally takes permadeath seriously. Settings live in localStorage so they survive save deletes (color-blind preset, reduce-motion, font scale, audio volumes, per-action keybinds). The new `<wyrd-settings>` panel renders four tabs of bound inputs that write through immediately and re-apply runtime side effects on change. `<wyrd-character-creation>` finally replaces the "every fresh boot is Furyborn / Wyrdling" default with a one-time first-boot modal — class pick (Furyborn, Frostmark, and Sealwarden once any character has dismissed the Pact-Bearer ending), name input, Hardcore opt-in. The Hardcore flag rides into SaveAdapter v6 as `state.hardcore`; on player death the slot is wiped via `saveAdapter.remove(slot)` instead of respawning.

Spec §6 line 209 has called for a Settings panel since v0.4.0. v0.11.0 ships it.

## What ships

### Settings store (`src/systems/settings.ts`)

```ts
interface SettingsState {
  video:    { colorBlind, reduceMotion, fontScale };
  audio:    { masterVolume, sfxVolume, musicVolume, muteOnBlur };
  gameplay: { holdToCast, alwaysSubtitles };
  keybinds: Record<ActionId, string>;  // KeyI / KeyC / Digit1 / etc.
}
```

- Persists to `localStorage['wyrdloom:settings:v1']`. Independent of save slots — a fresh character inherits the chosen color-blind preset, reduce-motion, font scale, audio levels, and keybinds.
- `loadSettings()` shallow-merges partial payloads with `defaultSettings()`, so adding a new section in v0.12.0+ doesn't break old payloads — missing fields fill in from defaults.
- `saveSettings()` writes-through and dispatches `SETTINGS_CHANGED_EVENT` on `window`. main.ts listens and re-applies runtime side effects (color-blind matrix, font-scale CSS variable) without touching the panel.
- `actionForCode(state, code)` is the keybind resolver — given a `KeyboardEvent.code`, returns the ActionId or null. Used by main.ts's `bindKeyboard` to route I / C / B / M / E / O / S / Digit1-4 through user remaps instead of hardcoded `e.key` checks.
- 11 remappable actions: open-inventory, open-character, open-bind, open-imbuer, open-echo-portal, open-settings, manual-save, skill-1..4. Q (quest tracker) and Escape (close-all) stay hardcoded — they're meta-keys, not gameplay.

### `<wyrd-settings>` panel (`src/ui/settings_panel.ts`)

- New PanelId `'settings'` joins the union. Toggled by 'O' default keybind (or the spec-aligned remap target). Esc closes like every other panel.
- Four tabs: Video / Audio / Gameplay / Keybinds. Each input is bound to the live `SettingsState` and writes through on change — no Save button, no dirty-state, no confirmation. Reset to Defaults button clears the lot.
- Keybind capture: click a binding row, the row goes amber + listens via a `keydown` capture-phase handler on `window`. First key pressed becomes the new bind; Esc cancels.
- Sliders show live percentages (`Master (75%)`, `Font scale (110%)`). Color-blind preset is a four-option select: none / deuteranopia / protanopia / tritanopia.

### Accessibility runtime (`src/main.ts`)

- `applyZoneFilter(world, zoneId)` now composes `[zoneFilter, colorBlindFilter]` instead of replacing. The zone color grade (Catacombs blue, Frostvein cyan, Cinderfall amber, Echo violet) layers under the user-chosen color-blind matrix:
  - **deuteranopia**: red/green hue bias correction (saturation 1.15 + slight hue shift).
  - **protanopia**: red-channel attenuation.
  - **tritanopia**: blue/yellow swap correction.
  - **none**: no second filter — the zone grade renders alone.
- `applyFontScale(scale)` writes `--wyrd-font-scale` to `document.documentElement`. Panels can read the variable for future per-element scaling; the global font-size on `:root` already responds.
- All damage-popup spawns and player/enemy `flashHit` calls are gated behind `if (!W.settings.video.reduceMotion)`. Reduce-motion players get the gameplay state changes (HP bar drops, enemy dies) without the visual punctuation.
- SETTINGS_CHANGED_EVENT triggers a re-read of `W.settings` + `applyZoneFilter` + `applyFontScale`. The panel just writes; main.ts is the single integration point.

### Hardcore mode (`src/main.ts`, `src/platform/SaveAdapter.ts`)

- `SaveState.hardcore: boolean` — chosen at character creation, frozen for the life of the character. Default `false` for legacy saves via MIGRATIONS[5].
- World gains `hardcore: boolean` and `activeSaveSlot: SlotIndex` fields. `autoSave(W, slot)` defaults `slot = W.activeSaveSlot` and updates it on save; `loadSaveAndApply(W, slot)` sets `W.hardcore = state.hardcore` + `W.activeSaveSlot = slot`.
- `onPlayerDeath` branches on `W.hardcore`: hardcore characters get `await W.saveAdapter.remove(W.activeSaveSlot)` and a console warn ("Hardcore: save slot N deleted"); non-hardcore characters take the v0.6.0+ respawn path unchanged.
- `SlotSummary.hardcore` exposes the flag from `list()` so a future Continue UI can paint a skull glyph next to permadeath slots. Both `WebSaveAdapter` and `TauriSaveAdapter` populate it (with `?? false` fallback for legacy slots whose state hasn't been migrated yet — the migrator stamps the field once the slot is loaded).

### `<wyrd-character-creation>` modal (`src/ui/character_creation.ts`)

- Three class cards (Furyborn / Frostmark / Sealwarden), Sealwarden disabled until the localStorage flag `wyrdloom:sealwarden-unlocked:v1` flips. The flag flips inside the existing `wyrdloom:ending-dismiss` listener — same hook that already sets `W.endingSeen = true`. Account-wide unlock per spec §4.2: a future second character can pick Sealwarden at creation even after the first character is deleted.
- Name input (default "Wyrdling"), Hardcore checkbox, Begin button. On submit the modal dispatches `CHARACTER_CREATE_EVENT` with `{ classId, characterName, hardcore }` and main.ts:
  1. Sets `W.characterName` + `W.hardcore` + `W.saveCreatedAt`.
  2. Calls `__wyrdloom.dev.setClass(classId)` — the same in-place class-swap path the dev hook has used since v0.7.0 (rebuilds baseline stats, resets resource bar, clears cooldowns). Reaches through the global instead of duplicating the swap logic.
  3. Calls `autoSave(W, 1)` so the slot exists before the player takes a step.
- First-boot gating: at the end of `main()`, after `mountPanels` returns the modal element, `firstBootMaybeShowCreation(W, modal)` checks `W.saveAdapter.list()`. Empty → modal opens. Any existing slot → modal stays hidden and the player resumes via the dev hooks (no in-game Continue UI yet — that's v0.12.0+).

### SaveAdapter v6 (`src/platform/SaveAdapter.ts`)

- `SAVE_SCHEMA_VERSION` bumps from 5 → 6.
- `SaveState` gains `readonly hardcore: boolean` (required, not optional — every v6 save carries it explicitly).
- `MIGRATIONS[5]` stamps `hardcore: false` onto pre-v0.11.0 saves: existing characters never opted in, so legacy = soft mode. Migration walk now: v1 → v2 → v3 → v4 → v5 → v6. Five migrators, each tiny, each version-stamped.
- `SlotSummary.hardcore` joins the slot summary shape; both adapters populate from `state.hardcore ?? false` since `list()` is a no-migrate fast scan.

### Latent panel-mount fix (`src/main.ts`)

- `mountPanels(hud)` previously appended only 6 of 10 registered panels (`wyrd-imbuer`, `wyrd-echo-portal`, `wyrd-settings`, `wyrd-ending` were imported for side-effect tag registration but never instantiated in the DOM). Their `connectedCallback` listeners for `PANEL_TOGGLE_EVENT` never fired. v0.11.0 closes the gap — the imbuer / echo-portal / ending overlay are reachable in-game for the first time alongside the new settings + character-creation panels.

### Tests

- `tests/unit/settings.spec.ts` — 7 tests. Defaults populate every section; round-trip through localStorage; partial payloads merge with defaults; malformed JSON falls back; `updateSettings` patches + persists; `actionForCode` resolves codes back to action ids. Vitest runs node-env by default; the test file shims `globalThis.window` + a Map-backed `localStorage` in `beforeAll`, then `await import`s the module so the `typeof window` checks resolve correctly.
- `tests/unit/save_adapter.spec.ts` — schema version assertion bumped to 6, MIGRATIONS keys now `['1','2','3','4','5']`, new dedicated v5 → v6 test (only-hardcore default), v4 → v6 walk-through, every migration test asserts `hardcore === false` after migrate. `fakeState()` updated to include `hardcore: false`.
- All pre-existing tests still pass after the additions — 98/98 unit tests green (1664 expect calls).

## File tree

New:
- `src/systems/settings.ts` (~140 lines)
- `src/ui/settings_panel.ts` (~310 lines)
- `src/ui/character_creation.ts` (~230 lines)
- `tests/unit/settings.spec.ts` (~95 lines)
- `RELEASE_NOTES_v0.11.md`

Touched:
- `src/main.ts` — APP_VERSION + header rewrite; `World.settings` / `World.hardcore` / `World.activeSaveSlot` fields; `applyFontScale`; `buildColorBlindFilter`; `applyZoneFilter` composes color-blind matrix; reduce-motion gates around `flashHit` + `spawnDamagePopup`; `bindKeyboard` refactored to `actionForCode` switch; SETTINGS_CHANGED_EVENT listener; `onPlayerDeath` hardcore branch; `autoSave` defaults to `W.activeSaveSlot`; `loadSaveAndApply` restores `hardcore` + `activeSaveSlot`; `snapshotSaveState` includes `hardcore`; `mountPanels` returns char-create element + appends imbuer / echo-portal / settings / ending alongside; `firstBootMaybeShowCreation` + `applyCharacterCreation`; `wyrdloom:ending-dismiss` stamps `SEALWARDEN_UNLOCK_KEY`.
- `src/platform/SaveAdapter.ts` — SCHEMA_VERSION 6, `state.hardcore` + `SlotSummary.hardcore`, MIGRATIONS[5].
- `src/platform/WebSaveAdapter.ts` — `SlotSummary.hardcore` populated with `?? false` fallback.
- `src/platform/TauriSaveAdapter.ts` — same.
- `src/ui/panel.ts` — `'settings'` PanelId.
- `tests/unit/save_adapter.spec.ts` — v6 assertions + v5→v6 / v4→v6 migration tests; `fakeState()` updated.
- `tests/e2e/*.spec.ts` — VERSION / TARGET_VERSION constants bumped to '0.11.0'.
- `package.json` — version 0.11.0.

## Numbers

- 98 unit tests pass (1664 expect calls).
- TypeScript strict + `noUncheckedIndexedAccess` clean across src + tests.
- Production build: 161.30 kB gzip 46.14 kB (game bundle, +16.94 kB / +3.88 kB gzip from v0.10.0 — settings store + settings panel + character-creation modal + accessibility filter + hardcore plumbing); 519.53 kB gzip 150.23 kB (Pixi vendored, unchanged).
- Save schema: v6. Migration table covers v1 → v6 end-to-end.
- Class roster: 3 of 4 implemented (Furyborn, Frostmark, Sealwarden). Bonecaller remains a ClassId tag — v1.0.0+ target.
- Settings: 4 sections, 11 remappable actions, 4 color-blind presets, persists across save deletes.

## Known gaps (carry into v0.12.0+)

- No in-game Continue / slot-picker UI yet. First-boot empty → character-creation modal; existing slots → boot lands on Furyborn @ Wyrdling and players resume via `__wyrdloom.dev.loadSlot(n)` from DevTools. v0.12.0 should add a title-screen Continue list that reads `saveAdapter.list()`.
- Hardcore + character-creation paths are not covered by unit tests — they hit DOM behavior (modal listens to `localStorage`, permadeath path hits `saveAdapter.remove`). Unit coverage would require a jsdom test environment for those paths; v0.12.0+ may stand one up alongside the playwright e2e, or split them into a `@vitest-environment jsdom` file.
- Color-blind matrix presets are heuristic — they're contrast-helpful but not vetted against the LMS-cone-response correction matrices used in clinical accessibility tooling. v0.12.0 may swap in the Brettel/Vienot transforms if user feedback warrants.
- Bonecaller stays a ClassId tag — last class to ship its kit; v1.0.0 release-blocker.
- Sealwarden's three stub skills (Sanctify / Verdict / Final Verse) remain bind-panel-visible but grayed. Effects ship in a v0.11.x point release.
- Audio volumes are persisted but not yet wired to a mixer. v0.11.0 ships the storage; v0.12.0 wires the runtime side once the SFX pipeline lands.
