// Inventory backing store — a 2D grid (10 wide x 4 tall, D2-coded).
//
// Each cell holds either nothing or a reference to an item that occupies it.
// In v0.4.0 every item is 1x1; the API takes width/height per item so v0.5.0
// can introduce 1x2 / 2x1 / 1x3 footprints without changing call sites.
//
// Pure data + functions. No Pixi imports.

import type { Item } from '../types/items';

export const INV_W = 10;
export const INV_H = 4;

export interface InvSlot {
  readonly item: Item;
  readonly x: number; // top-left grid x
  readonly y: number; // top-left grid y
  readonly w: number; // footprint width (1 in v0.4.0)
  readonly h: number; // footprint height (1 in v0.4.0)
}

export interface Inventory {
  readonly w: number;
  readonly h: number;
  // Stable list of placed items. Ground truth.
  slots: InvSlot[];
}

export function makeInventory(): Inventory {
  return { w: INV_W, h: INV_H, slots: [] };
}

// Build an occupancy grid (true = covered) from the placed slots.
// Recomputed on demand — placements are rare, so the cost is fine.
function occupancy(inv: Inventory): boolean[][] {
  const grid: boolean[][] = Array.from({ length: inv.h }, () =>
    Array.from({ length: inv.w }, () => false),
  );
  for (const s of inv.slots) {
    for (let dy = 0; dy < s.h; dy++) {
      for (let dx = 0; dx < s.w; dx++) {
        const row = grid[s.y + dy];
        if (row) row[s.x + dx] = true;
      }
    }
  }
  return grid;
}

function fits(grid: boolean[][], x: number, y: number, w: number, h: number, invW: number, invH: number): boolean {
  if (x < 0 || y < 0 || x + w > invW || y + h > invH) return false;
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const row = grid[y + dy];
      if (!row || row[x + dx]) return false;
    }
  }
  return true;
}

// Footprint per item. v0.4.0: every item is 1x1. Centralizing this means the
// switch lights up red when a future variant (two-handed weapon) is added.
export function footprintFor(_item: Item): { w: number; h: number } {
  return { w: 1, h: 1 };
}

// Place an item in the first free cell (row-major, top-left scan).
// Returns the resulting slot, or null if the inventory is full.
export function addItem(inv: Inventory, item: Item): InvSlot | null {
  const { w, h } = footprintFor(item);
  const grid = occupancy(inv);
  for (let y = 0; y <= inv.h - h; y++) {
    for (let x = 0; x <= inv.w - w; x++) {
      if (fits(grid, x, y, w, h, inv.w, inv.h)) {
        const slot: InvSlot = { item, x, y, w, h };
        inv.slots.push(slot);
        return slot;
      }
    }
  }
  return null;
}

// Remove an item by uid. Returns the removed slot, or undefined if missing.
export function removeItem(inv: Inventory, uid: string): InvSlot | undefined {
  const idx = inv.slots.findIndex((s) => s.item.uid === uid);
  if (idx < 0) return undefined;
  const removed = inv.slots[idx];
  inv.slots.splice(idx, 1);
  return removed;
}

// True if there's room for at least one more item of the given footprint.
export function hasRoomFor(inv: Inventory, item: Item): boolean {
  const { w, h } = footprintFor(item);
  const grid = occupancy(inv);
  for (let y = 0; y <= inv.h - h; y++) {
    for (let x = 0; x <= inv.w - w; x++) {
      if (fits(grid, x, y, w, h, inv.w, inv.h)) return true;
    }
  }
  return false;
}

// True if every cell is empty.
export function isEmpty(inv: Inventory): boolean {
  return inv.slots.length === 0;
}
