# ADR 0003 — Real-art vendoring is a permanent backlog item

**Status:** Accepted (2026-04-30, v0.4.0).
**Supersedes:** ADR 0002 (v0.2.0 / v0.3.0 deferral).

## Context

ADR 0002 deferred Kenney + LPC art ingestion from v0.2.0 to v0.3.0, then v0.3.0 deferred again to v0.4.0. This is the third deferral. v0.4.0 release notes called it: "ducking the deadline twice — v0.4.0 needs to absorb it or it slips to a permanent backlog item."

It slipped. This ADR makes that explicit.

## What's actually blocked

The procedural Pixi sprites from v0.1.0 (player diamond, enemy diamond, glowing item glyphs) are not aesthetically final, but they are functionally complete:

- They render.
- Pickup, equip, hotbar, character panels — all work without asset textures.
- The glyph-on-rarity-color pattern (W/H/C/R) tracks slot + rarity legibly.
- The license gate (`tools/check_licenses.ts`) enforces attribution mechanically — no asset can ship unattributed.

What real art would unlock is purely visual polish, not a feature gate.

## Why three deferrals happened

Each previous attempt failed at the same point: **the CDN slugs for both Kenney's pack catalog and the OpenGameArt LPC repository rotate.** The URLs we vendored against in week-1 planning 404 by week-2 implementation. The pipeline that would actually work:

1. Manual download by a human, off-CI, into a local checkout of the asset packs.
2. `cp` into `assets/` with directory structure mirroring the upstream pack.
3. Hand-write the `LICENSES.md` row per asset (CC0 needs no per-asset attribution, but CC-BY-SA LPC parts need author + URL + license per file).
4. Run `bun run check:licenses` to verify the gate accepts.
5. Wire the Pixi loader to read from `assets/...` instead of constructing `Graphics()`.

Steps 1, 3, and 5 are all irreducibly manual. Steps 2 and 4 are mechanical. This is not bot-friendly work.

## Decision

Treat real-art vendoring as **a backlog item that ships when a human runs the manual ingestion pipeline.** No specific milestone owns it. The license gate continues to enforce that nothing slips into the build unattributed, which means the cost of a future PR adding real art is bounded — the gate either passes (ship it) or fails (fix attribution).

The procedural sprites stay in `src/fx/sprites.ts` indefinitely. Inventory glyphs stay in the panel renderers. When real assets arrive, the swap is a pure addition (new sprite/icon loaders) — the rest of the architecture doesn't move.

## Consequences

- **Pro:** v0.5.0 ships with no art-related blocker. The gameplay milestones (procgen, A*, more skills, multi-cell items) all work against the existing visual layer.
- **Pro:** No risk of a half-vendored pack landing partial attributions and tripping the license gate at an awkward moment.
- **Con:** Demo screenshots / README marketing material continue to show procedural art through v0.7.0 at minimum. Mitigation: the rarity color palette is already final and consistent between in-canvas + DOM, so the demos are at least *coherent*.
- **Con:** Future contributors won't understand the procedural sprites are intentional placeholder unless they read this ADR. Mitigation: each `src/fx/sprites.ts` and panel `_glyphFor` function carries a one-line comment pointing here.

## Trigger to revisit

Open this ADR for revision when one of:

1. A user lands a PR with the LPC pack vendored + LICENSES.md rows + sprite loader wired (the gate will tell us mechanically whether it's viable).
2. v1.0 (per spec) requires polished marketing assets and the DoD blocks on it.

Until then, the procedural look is the look.
