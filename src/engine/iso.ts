// Isometric math. Tile is a 2:1 dimetric diamond.
// World (tx, ty) is integer tile coords; screen (sx, sy) is pixels.

export const TILE_W = 64;
export const TILE_H = 32;

export interface TileCoord {
  tx: number;
  ty: number;
}

export interface ScreenCoord {
  sx: number;
  sy: number;
}

// Tile (tx, ty) -> screen pixels (sx, sy).
// Origin (0,0) maps to (0,0); +tx is south-east, +ty is south-west.
export function tileToScreen(tx: number, ty: number): ScreenCoord {
  return {
    sx: (tx - ty) * (TILE_W / 2),
    sy: (tx + ty) * (TILE_H / 2),
  };
}

// Inverse: screen (sx, sy) -> fractional tile coords (still floats, caller rounds).
export function screenToTile(sx: number, sy: number): { tx: number; ty: number } {
  return {
    tx: sy / TILE_H + sx / TILE_W,
    ty: sy / TILE_H - sx / TILE_W,
  };
}

// Round a fractional tile coord to its nearest integer cell.
export function roundTile(tx: number, ty: number): TileCoord {
  return { tx: Math.round(tx), ty: Math.round(ty) };
}

// Manhattan distance in tile space — fine for grid-step pathing without obstacles.
export function tileDistance(a: TileCoord, b: TileCoord): number {
  return Math.abs(a.tx - b.tx) + Math.abs(a.ty - b.ty);
}

// Depth-sort key: higher = drawn on top. South (high tx+ty) draws over north.
export function depthFor(tx: number, ty: number): number {
  return (tx + ty) * 1000;
}
