# WYRDLOOM v0.2.0 — Week 2: combat skeleton

Second tagged milestone. Combat is alive: one player skill (melee), one enemy with chase-and-attack AI, HP bar, floating damage popups, full death/respawn cycle for both sides.

## What ships

### Combat data model (`src/actors/Actor.ts` + `src/systems/combat.ts`)

- `Actor` shape: id, kind (`'player' | 'enemy'`), tile coords, hp, alive, attack/move cooldowns, attack target, goal.
- `PLAYER_STATS`: 100 hp, 25 atk, range 1, atk cooldown 400 ms, move cooldown 150 ms.
- `ENEMY_STATS`: 50 hp, 10 atk, range 1, atk cooldown 1000 ms, move cooldown 250 ms, aggro range 5 tiles.
- Pure functions for combat math: `canAttack`, `performAttack`, `respawn`, `distanceBetween`. No Pixi imports — Vitest covers every transition deterministically.

### Enemy AI (`src/systems/ai.ts`)

- `tickEnemy` — chase-toward-player when in aggro range, attack on adjacency, respect cooldowns. Pure function, mutates the actor; tested.
- `stepToward` — picks the larger-gap axis for natural-looking pathing. A* lands in Week 5 with the BSP dungeon.
- Aggro range: enemy stays put if player is more than 5 tiles away. **Important nuance** discovered during MCP playtesting: when the player walks toward the enemy, the enemy reactively walks too — they meet in the middle, not at the enemy's spawn. Combat handles `distance === 0` (overlap) gracefully because `0 ≤ atkRange`; tile-occupancy collision lands in v0.3.0 with A*.

### Player skill — Melee swing

- Left-click empty tile → walk-to-tile (existing v0.1.0 behavior).
- Left-click an alive enemy → set `attackTarget`, walk into melee range, swing on cooldown.
- Auto-engage: once `attackTarget` is set, the player keeps attacking until target dies (then `attackTarget` clears and the goal indicator hides).

### HP bar (`src/ui/hp_bar.ts`)

- DOM-overlaid HP bar at the bottom-center of the viewport, per spec §6.1.
- Liquid-fill SVG clip-path is deferred to v0.4.0 — v0.2.0 ships a CSS-gradient horizontal fill, which is enough to verify the data flow.
- "DEAD" status text fades in on player death and out on respawn.

### Damage popups (`src/fx/damage_popup.ts`)

- Pixi `Text` floats up 32 px and fades to 0 alpha over 800 ms, then auto-destroys.
- Two text styles: hit (tan) and kill (red, 16 px, bolder) — kill popups visually distinct.
- Owns its own ticker hook so callers fire-and-forget.

### Death + respawn

- **Player death**: `playerActor.alive = false`, HP bar to 0 + DEAD status, sprite hidden, 2 s timer, then `respawn()` at `(6, 6)` with full HP.
- **Enemy death**: hidden, queued for 3 s respawn at a random grid edge tile (`randomEdgeTile`).

### Dev hook for tests

`window.__wyrdloom.dev.setPlayerHp(n)` — clamps to `[0, maxHp]`, mirrors `onPlayerDeath` if `n === 0`. Out-of-band, only used by the death-flow Playwright test (natural death needs 10 enemy hits = 10 s, too slow for an automated suite).

## Verification

| Layer | Result |
|---|---|
| Vitest unit (combat + AI + iso math) | **14/14 pass** |
| Playwright e2e (chromium, 9 tests) | **9/9 pass** |
| ESLint, max-warnings 0 | clean |
| TypeScript strict + `noUncheckedIndexedAccess` | clean |
| License + capability gate | clean (no new assets, no new permissions) |

Live-driven with Playwright MCP through three full scenarios:

1. **Kill loop**: click enemy at viewport (832, 400) → player walks (6,6) toward enemy → enemy's AI engages once distance ≤ 5 → they meet at (9, 6) → first attack hits enemy at `cd=Infinity` (fresh actor) → enemy hp 50→25 → 16 frames of cooldown wait → second hit → enemy hp 25→0 → enemy dies (~1.7 s total).
2. **Enemy respawn**: 3 s timer → new enemy at `(8, 11)` (random south edge) with full HP.
3. **Player death**: `__wyrdloom.dev.setPlayerHp(0)` → hp bar to 0/100, DEAD shown, sprite hidden → 2 s timer → respawn at (6,6) with full HP, sprite + bar restored.

## Caveats

- **No collision** between actors: enemies walk into the player's tile and stack visually. Doesn't affect combat math (distance 0 is still ≤ range 1) but looks wrong; tile-occupancy lands in v0.3.0 with A* path planning.
- **Real assets still deferred**. Kenney pack URLs returned 404 (slug hashes rotate on each upload) — fell back to upgraded procedural sprites: cleaner humanoid for player, hunched skull-headed silhouette for enemy. Real Kenney + LPC vendoring rolls into v0.3.0 with a stable manual download script.
- **Vite HMR + Pixi `Application` don't replay state cleanly** — modifying `main.ts` mid-session leaves the old `Application` running with stale handler closures. Always `browser_navigate` after a `main.ts` edit. Documented in the git log.
- **Right-click skills, ranged bolts** — out of scope for v0.2.0 ("1 player skill" per spec §10). Lands in v0.4.0 with the bind-skill UI.

## Next: v0.3.0 (Week 3)

Per spec §10: loot pipeline. Rarity tiers (Common / Magic / Rare / Unique / Mythic), affix table (`data/affixes.json`), drop generation, ground pickup, equip slot, stat recalculation, tooltip compare. The combat numbers will start to mean something.
