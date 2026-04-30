// Thin input layer. For v0.1 spike: just left-click world coords.
// Real keymap (remappable, KeyboardEvent.code based) lands in Week 4.

import type { Container, FederatedPointerEvent } from 'pixi.js';
import { roundTile, screenToTile } from './iso';
import type { TileCoord } from './iso';

export type ClickHandler = (tile: TileCoord) => void;

export function bindClickToMove(world: Container, onTile: ClickHandler): void {
  // The world container itself is interactive — Pixi v8 needs eventMode set.
  world.eventMode = 'static';
  world.hitArea = {
    contains: () => true, // accept clicks anywhere; refine when we have walls
  };

  world.on('pointerdown', (e: FederatedPointerEvent) => {
    if (e.button !== 0) return; // left only for now
    // Convert to world-local coords (after camera translation).
    const local = world.toLocal(e.global);
    const frac = screenToTile(local.x, local.y);
    onTile(roundTile(frac.tx, frac.ty));
  });
}
