// BSP room-and-corridor dungeon generator. Pure data + functions; deterministic
// on seed. Generator runs a flood-fill validator before yielding — caller never
// sees an unreachable layout.
//
// Per spec §4.5: same seed → same dungeon (non-negotiable). Future biomes
// (Frostvein, Ruined Keep, Blood Cathedral) will reuse the BSP scaffold and
// swap room templates / floor decoration. v0.5.0 ships Catacombs only.

import { makeRng, type Rng } from './rng';

export type Tile = 'wall' | 'floor';

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface DungeonMap {
  readonly w: number;
  readonly h: number;
  readonly tiles: ReadonlyArray<ReadonlyArray<Tile>>; // tiles[y][x]
  readonly rooms: ReadonlyArray<Rect>;
  readonly entrance: Rect;          // first room — player spawns here
  readonly boss: Rect;              // last room — boss / strongest enemy
  readonly seed: string;
}

export interface ProcgenOpts {
  readonly w: number;
  readonly h: number;
  readonly seed: string;
  readonly minRoomSize?: number;     // smallest leaf bounds dim before stop
  readonly minRoomDim?: number;      // smallest carved-room dim
  readonly maxRoomDim?: number;      // largest carved-room dim
  readonly maxRerolls?: number;      // validator reroll cap
}

const DEFAULTS = {
  minRoomSize: 8,
  minRoomDim: 4,
  maxRoomDim: 7,
  maxRerolls: 16,
} as const;

// Public entry point. Returns a validated dungeon or throws if every reroll
// failed (which would be a bug — the validator's reroll cap is generous).
export function generateDungeon(opts: ProcgenOpts): DungeonMap {
  const cap = opts.maxRerolls ?? DEFAULTS.maxRerolls;
  for (let attempt = 0; attempt < cap; attempt++) {
    // Salt the seed per attempt so each reroll is its own deterministic try
    // and a saved root seed still replays the original outcome.
    const subSeed = attempt === 0 ? opts.seed : `${opts.seed}#r${attempt}`;
    const map = generateOnce({ ...opts, seed: subSeed });
    if (validate(map)) return map;
  }
  throw new Error(
    `procgen: validator failed ${cap} times for seed ${opts.seed} ` +
      `(grid ${opts.w}x${opts.h}). Likely too small for the room constraints.`,
  );
}

// One unvalidated generation pass. Exported for tests that want to verify the
// validator actually catches degenerate maps.
export function generateOnce(opts: ProcgenOpts): DungeonMap {
  const w = opts.w;
  const h = opts.h;
  const minRoomSize = opts.minRoomSize ?? DEFAULTS.minRoomSize;
  const minRoomDim = opts.minRoomDim ?? DEFAULTS.minRoomDim;
  const maxRoomDim = opts.maxRoomDim ?? DEFAULTS.maxRoomDim;
  const rng = makeRng(opts.seed);

  // tiles[y][x] — wall everywhere; carve floors.
  const tiles: Tile[][] = Array.from({ length: h }, () =>
    Array.from({ length: w }, () => 'wall' as Tile),
  );

  // BSP partition the bounds into leaves at least minRoomSize on each axis.
  const leaves = bspSplit(rng, { x: 0, y: 0, w, h }, minRoomSize);

  // Carve a room inside each leaf.
  const rooms: Rect[] = leaves.map((leaf) =>
    carveRoom(rng, leaf, minRoomDim, maxRoomDim, tiles),
  );

  // Connect rooms in the order the BSP returned them — leaf-list ordering
  // is deterministic, so corridor topology is too.
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1]!;
    const b = rooms[i]!;
    carveCorridor(rng, a, b, tiles);
  }

  // Entrance = first room; boss = last room. Always different (BSP yields ≥2
  // leaves at the supported sizes).
  const entrance = rooms[0]!;
  const boss = rooms[rooms.length - 1]!;

  return {
    w,
    h,
    tiles: tiles.map((row) => Object.freeze(row.slice())) as ReadonlyArray<ReadonlyArray<Tile>>,
    rooms: Object.freeze(rooms.slice()) as ReadonlyArray<Rect>,
    entrance,
    boss,
    seed: opts.seed,
  };
}

// Recursively split `bounds` into leaves whose width and height are each
// >= 2 * minRoomSize. Stops splitting when neither axis can be split.
function bspSplit(rng: Rng, bounds: Rect, minRoomSize: number): Rect[] {
  const canSplitH = bounds.w >= 2 * minRoomSize;
  const canSplitV = bounds.h >= 2 * minRoomSize;
  if (!canSplitH && !canSplitV) return [bounds];

  // Pick split axis: prefer the longer axis to keep rooms roughly square.
  // Tiebreak randomly to introduce variety.
  let horizontal: boolean;
  if (canSplitH && !canSplitV) horizontal = true;
  else if (!canSplitH && canSplitV) horizontal = false;
  else horizontal = bounds.w === bounds.h ? rng.next() < 0.5 : bounds.w > bounds.h;

  if (horizontal) {
    const minX = bounds.x + minRoomSize;
    const maxX = bounds.x + bounds.w - minRoomSize;
    const splitX = rng.range(minX, maxX);
    const left: Rect = { x: bounds.x, y: bounds.y, w: splitX - bounds.x, h: bounds.h };
    const right: Rect = { x: splitX, y: bounds.y, w: bounds.x + bounds.w - splitX, h: bounds.h };
    return [...bspSplit(rng, left, minRoomSize), ...bspSplit(rng, right, minRoomSize)];
  } else {
    const minY = bounds.y + minRoomSize;
    const maxY = bounds.y + bounds.h - minRoomSize;
    const splitY = rng.range(minY, maxY);
    const top: Rect = { x: bounds.x, y: bounds.y, w: bounds.w, h: splitY - bounds.y };
    const bot: Rect = { x: bounds.x, y: splitY, w: bounds.w, h: bounds.y + bounds.h - splitY };
    return [...bspSplit(rng, top, minRoomSize), ...bspSplit(rng, bot, minRoomSize)];
  }
}

// Carve a room inside `leaf` and write its tiles. Returns the carved rect.
function carveRoom(rng: Rng, leaf: Rect, minDim: number, maxDim: number, tiles: Tile[][]): Rect {
  // Leave a 1-cell wall border on every side of the leaf so adjacent rooms
  // don't touch (corridors handle reachability).
  const innerW = Math.max(minDim, Math.min(maxDim, leaf.w - 2));
  const innerH = Math.max(minDim, Math.min(maxDim, leaf.h - 2));
  const maxX = leaf.x + leaf.w - innerW - 1;
  const maxY = leaf.y + leaf.h - innerH - 1;
  const x = rng.range(leaf.x + 1, Math.max(leaf.x + 1, maxX));
  const y = rng.range(leaf.y + 1, Math.max(leaf.y + 1, maxY));
  const room: Rect = { x, y, w: innerW, h: innerH };
  for (let ry = 0; ry < innerH; ry++) {
    for (let rx = 0; rx < innerW; rx++) {
      const row = tiles[y + ry];
      if (row) row[x + rx] = 'floor';
    }
  }
  return room;
}

// Carve an L-shaped corridor between two room centers. Random elbow direction
// (horizontal-then-vertical or vertical-then-horizontal) controlled by the rng.
function carveCorridor(rng: Rng, a: Rect, b: Rect, tiles: Tile[][]): void {
  const ax = Math.floor(a.x + a.w / 2);
  const ay = Math.floor(a.y + a.h / 2);
  const bx = Math.floor(b.x + b.w / 2);
  const by = Math.floor(b.y + b.h / 2);
  const horizontalFirst = rng.next() < 0.5;
  if (horizontalFirst) {
    carveHLine(tiles, ax, bx, ay);
    carveVLine(tiles, ay, by, bx);
  } else {
    carveVLine(tiles, ay, by, ax);
    carveHLine(tiles, ax, bx, by);
  }
}

function carveHLine(tiles: Tile[][], x1: number, x2: number, y: number): void {
  const lo = Math.min(x1, x2);
  const hi = Math.max(x1, x2);
  const row = tiles[y];
  if (!row) return;
  for (let x = lo; x <= hi; x++) row[x] = 'floor';
}

function carveVLine(tiles: Tile[][], y1: number, y2: number, x: number): void {
  const lo = Math.min(y1, y2);
  const hi = Math.max(y1, y2);
  for (let y = lo; y <= hi; y++) {
    const row = tiles[y];
    if (row) row[x] = 'floor';
  }
}

// Flood-fill from a known floor cell; every other floor cell must be reachable.
// Returns true iff the map is fully connected.
export function validate(map: DungeonMap): boolean {
  const start = roomCenter(map.entrance);
  return floodCount(map, start.tx, start.ty) === totalFloor(map);
}

function totalFloor(map: DungeonMap): number {
  let n = 0;
  for (let y = 0; y < map.h; y++) {
    const row = map.tiles[y];
    if (!row) continue;
    for (let x = 0; x < map.w; x++) {
      if (row[x] === 'floor') n++;
    }
  }
  return n;
}

// BFS reachability count from (sx, sy). Pure — does not mutate the map.
function floodCount(map: DungeonMap, sx: number, sy: number): number {
  const seen: boolean[][] = Array.from({ length: map.h }, () =>
    Array.from({ length: map.w }, () => false),
  );
  const startRow = map.tiles[sy];
  if (!startRow || startRow[sx] !== 'floor') return 0;
  seen[sy]![sx] = true;
  const q: Array<[number, number]> = [[sx, sy]];
  let head = 0;
  let count = 0;
  const dx = [1, -1, 0, 0];
  const dy = [0, 0, 1, -1];
  while (head < q.length) {
    const cur = q[head++]!;
    const [x, y] = cur;
    count++;
    for (let i = 0; i < 4; i++) {
      const nx = x + dx[i]!;
      const ny = y + dy[i]!;
      if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
      const seenRow = seen[ny]!;
      if (seenRow[nx]) continue;
      const tileRow = map.tiles[ny];
      if (!tileRow || tileRow[nx] !== 'floor') continue;
      seenRow[nx] = true;
      q.push([nx, ny]);
    }
  }
  return count;
}

export function roomCenter(r: Rect): { tx: number; ty: number } {
  return { tx: Math.floor(r.x + r.w / 2), ty: Math.floor(r.y + r.h / 2) };
}

export function isFloor(map: DungeonMap, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return false;
  const row = map.tiles[ty];
  return !!row && row[tx] === 'floor';
}
