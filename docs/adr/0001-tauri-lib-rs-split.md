# ADR 0001 — Split Tauri shell into `lib.rs` + `main.rs`

**Status**: Accepted (v0.2.0)
**Date**: 2026-04-30

## Context

The v0.1.0 Tauri shell put everything in `src-tauri/src/main.rs`. The Cargo.toml declared a `[lib]` target named `wyrdloom_lib` with `crate-type = ["staticlib", "cdylib", "rlib"]` because the standard Tauri 2.x template uses that shape — but no `lib.rs` actually existed, which `cargo metadata` rejected with:

```
can't find library `wyrdloom_lib`, rename file to `src/lib.rs` or specify lib.path
```

This surfaced when `bun run tauri:build` was first run (Week 2). We had two options:

1. Drop the `[lib]` block entirely and ship the desktop binary only.
2. Add `src/lib.rs` exposing a `pub fn run()` that builds the Tauri app, and have `main.rs` call into it.

## Decision

Take option 2.

## Why

- Tauri 2.x's mobile target (Android/iOS) requires a `cdylib` library entry point annotated with `#[tauri::mobile_entry_point]`. Putting `run()` in `lib.rs` is the path the Tauri team's templates use; deviating now would mean a refactor in v2.0 if we ever go mobile.
- The cost of the split is one extra file (~5 lines).
- The capability allow-list (BUILD_PROMPT §2.5) is unchanged; this is purely a code-organization choice.

## Consequences

- `src-tauri/src/main.rs` is now a 4-line shim: `wyrdloom_lib::run()`.
- `src-tauri/src/lib.rs` carries the `tauri::Builder` setup, plugin registration, and the `#[cfg_attr(mobile, tauri::mobile_entry_point)]` annotation.
- A future mobile target ships without touching the shell at all (modulo capability scoping).
