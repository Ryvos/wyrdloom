# ADR 0002 — Defer real Kenney/LPC art vendoring to v0.3.0

**Status**: Accepted (v0.2.0)
**Date**: 2026-04-30

## Context

BUILD_PROMPT §10 specifies real Kenney + LPC art for v0.2.0:

> Vendor Kenney "Isometric Miniature Dungeon" + LPC archer; replace placeholder primitives.

In Week 2 we attempted to fetch these via `curl`. Kenney's CDN URLs use rotating slug hashes (e.g. `…/2bd0d2a17a-1696591154/kenney_isometric-miniature-dungeon.zip`) that no longer exist — the probes returned 404. OpenGameArt LPC is similarly hash-versioned per-upload.

A clean fix needs one of:

1. Scrape the Kenney/OGA HTML pages at install time to discover the current hashed URL, then download. Fragile against site redesigns.
2. Mirror the assets in our own GitHub Release (we'd need the user to manually upload them once).
3. A `tools/fetch_assets.ts` script with a curated list of stable mirrors + checksums, run on first dev install.

Option 3 is the right long-term path but **requires deciding which mirrors we trust and seeding their checksums**. That's a 30-minute design task by itself, and Week 2's main deliverable is combat — not asset infrastructure.

## Decision

Defer real-asset vendoring to v0.3.0. Ship v0.2.0 with **upgraded procedural sprites** (`src/fx/sprites.ts`):

- Player: small humanoid silhouette (head circle + body rect + cloak shadow).
- Enemy: hunched purple body + skull head with eye sockets.

The procedural code is original WYRDLOOM source under MIT — no third-party attribution debt. `LICENSES.md` keeps the planned-vendoring rows under the v0.2.0 line; they migrate to the "actually shipped" section in v0.3.0.

## Why

- Combat is the spec-mandated v0.2.0 deliverable. Real art is desirable but not load-bearing for the milestone.
- A working procedural fallback means the spike never blocks on a network fetch — the `bun install && bun run dev` story from a fresh clone is preserved.
- Splitting the asset-pipeline work into its own milestone gives it the room it needs (mirror selection, checksum gate, in-game Attributions screen for CC-BY assets).

## Consequences

- v0.2.0 ships with no third-party art.
- v0.3.0 absorbs both its scoped work (loot pipeline) and the asset-vendoring slip. If the loot pipeline runs long, asset vendoring slips again rather than cutting features.
- The procedural sprites are clearly distinguishable in style from real assets, so the visual upgrade in v0.3.0 will be obvious.
